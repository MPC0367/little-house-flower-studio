import {test,expect} from '@playwright/test';

const admin='http://127.0.0.1:5274';
async function loginAndOpen(page,reference='DEMO-ROSE-7'){
 await page.goto(admin+'/#orders');
 await page.getByRole('button',{name:'Enter local workspace'}).click();
 await page.getByLabel('Search orders').fill(reference);
 await expect(page.locator('.order-table tbody tr')).toHaveCount(1);
 await page.locator('.order-table tbody button').click();
 await expect(page.getByRole('dialog')).toBeVisible();
}
const dirty=page=>page.evaluate(()=>window.LHFStudioHasUnsavedChanges());

test('payment-only drafts guard close and native reload without submitting payments',async({page})=>{
 await loginAndOpen(page);let payments=0;
 page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/payments'))payments++;});
 await page.getByLabel('Amount (THB)',{exact:true}).fill('125');
 await expect.poll(()=>dirty(page)).toBe(true);
 expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('button',{name:'Discard drafts',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Save and close',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByLabel('Amount (THB)',{exact:true})).toHaveValue('125');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Discard drafts',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await dirty(page)).toBe(false);expect(payments).toBe(0);
});

test('saving order edits retains pending payment and reply drafts without auto-recording',async({page})=>{
 await loginAndOpen(page);let payments=0;
 page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/payments'))payments++;});
 await page.getByLabel('Staff notes').fill('Local draft preservation check');
 await page.getByLabel('Amount (THB)',{exact:true}).fill('125');
 await page.getByLabel('Payment reference').fill('DRAFT-NOT-A-PAYMENT');
 await page.getByLabel('Customer reply draft',{exact:true}).fill('My edited reply remains until I copy it.');
 await page.getByRole('button',{name:'Record payment',exact:true}).click();
 await expect(page.getByText('Save or discard your order changes before recording a payment. Your payment draft will stay here.')).toBeVisible();
 expect(payments).toBe(0);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save and close',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Save order changes',exact:true}).click();
 await expect(page.locator('.unsaved-choices')).toBeEmpty();
 await expect(page.getByLabel('Staff notes')).toHaveValue('Local draft preservation check');
 await expect(page.getByLabel('Amount (THB)',{exact:true})).toHaveValue('125');
 await expect(page.getByLabel('Payment reference')).toHaveValue('DRAFT-NOT-A-PAYMENT');
 await expect(page.getByLabel('Customer reply draft',{exact:true})).toHaveValue('My edited reply remains until I copy it.');
 expect(await dirty(page)).toBe(true);expect(payments).toBe(0);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('button',{name:'Discard drafts',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Discard drafts',exact:true}).click();
});

test('reply-only drafts are protected and reverting auxiliary fields clears the guard',async({page})=>{
 await loginAndOpen(page);const reply=page.getByLabel('Customer reply draft',{exact:true}),original=await reply.inputValue();
 await reply.fill('A carefully edited customer reply.');
 expect(await dirty(page)).toBe(true);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('button',{name:'Discard drafts',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await reply.fill(original);
 await page.getByLabel('Amount (THB)',{exact:true}).fill('300');
 expect(await dirty(page)).toBe(true);
 await page.getByLabel('Amount (THB)',{exact:true}).fill('');
 expect(await dirty(page)).toBe(false);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
