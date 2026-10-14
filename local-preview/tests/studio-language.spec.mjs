import {test,expect} from '@playwright/test';

const admin=process.env.LHF_STAFF_TEST_ORIGIN||'http://127.0.0.1:5274';
const thai=/[ก-๙]/;
const englishHeadings={today:'A little care, every day.',orders:'Every little detail.',calendar:'A week in flowers.',earnings:'Money, clearly.',settings:'The studio settings.'};

async function login(page){
 await page.goto(admin+'/#orders');
 await page.getByRole('button',{name:/Enter local workspace/}).click();
 await expect(page.locator('#view h1')).toHaveText(englishHeadings.orders);
}
async function language(page,code,{dialog=false}={}){
 const scope=dialog?page.locator('dialog[open]'):page;
 const button=scope.getByRole('button',{name:code==='th'?'ภาษาไทย':'English',exact:true});
 await expect(button).toBeVisible();await button.click();
 await expect(page.locator('html')).toHaveAttribute('lang',code);
}
async function tag(locator,name){await locator.evaluate((node,key)=>node.dataset.languageQa=key,name);}

test('login has accessible English and Thai choices and persists the language into the authenticated workspace',async({page})=>{
 await page.goto(admin+'/#today');
 await expect(page.getByRole('button',{name:'ภาษาไทย',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'English',exact:true})).toBeVisible();
 const role=page.locator('.login select');await role.selectOption('staff');
 await language(page,'th');await expect(page.locator('.login h1')).toContainText(thai);await expect(page.locator('.login button[type="submit"]')).toContainText(thai);await expect(role).toHaveValue('staff');
 await language(page,'en');await expect(page.locator('.login h1')).toHaveText('Welcome to the studio');await expect(role).toHaveValue('staff');
 await language(page,'th');await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','th');await expect(page.locator('.login h1')).toContainText(thai);
 await page.locator('.login button[type="submit"]').click();await expect(page.locator('#view h1')).toContainText(thai);
 await expect(page.getByRole('button',{name:'English',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'ภาษาไทย',exact:true})).toBeVisible();
 await language(page,'en');await expect(page.locator('#view h1')).toHaveText(englishHeadings.today);
});

test('Thai navigation and key headings survive every workspace route and reload, then switch back to English',async({page})=>{
 await login(page);await language(page,'th');
 for(const route of Object.keys(englishHeadings)){
  const link=page.locator('.navigation a[href="#'+route+'"]');await expect(link).toContainText(thai);await expect(link).toHaveAttribute('aria-label',thai);await link.click();
  await expect(page.locator('#view h1')).toContainText(thai);await expect(link).toHaveAttribute('aria-current','page');await expect(page.locator('html')).toHaveAttribute('lang','th');
 }
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','th');await expect(page.locator('#view h1')).toContainText(thai);
 await language(page,'en');await expect(page.locator('#view h1')).toHaveText(englishHeadings.settings);
 await page.locator('.navigation a[href="#orders"]').click();await expect(page.locator('#view h1')).toHaveText(englishHeadings.orders);
 await expect(page.getByLabel('Status',{exact:true})).toBeVisible();await expect(page.getByLabel('Payment state',{exact:true})).toBeVisible();
});

test('switching language preserves filters and translates status and payment options without changing their values',async({page})=>{
 await login(page);
 await page.getByLabel('Status',{exact:true}).selectOption('confirmed');await page.getByLabel('Payment state',{exact:true}).selectOption('unpaid');
 await page.getByLabel('Search orders',{exact:true}).fill('DEMO-ROSE-3');await expect(page.locator('.order-table tbody tr')).toHaveCount(1);
 const reference=await page.locator('.order-table tbody strong').innerText();
 await tag(page.getByLabel('Status',{exact:true}),'status-filter');await tag(page.getByLabel('Payment state',{exact:true}),'payment-filter');await tag(page.getByLabel('Search orders',{exact:true}),'search-filter');
 await language(page,'th');
 await expect(page.locator('[data-language-qa="status-filter"]')).toHaveValue('confirmed');await expect(page.locator('[data-language-qa="payment-filter"]')).toHaveValue('unpaid');await expect(page.locator('[data-language-qa="search-filter"]')).toHaveValue('DEMO-ROSE-3');
 await expect(page.locator('[data-language-qa="status-filter"] option:checked')).toContainText(thai);await expect(page.locator('[data-language-qa="payment-filter"] option:checked')).toContainText(thai);
 await expect(page.locator('.order-table tbody .pill').first()).toContainText(thai);await expect(page.locator('.order-table tbody td').nth(4)).toContainText(thai);await expect(page.locator('.order-table tbody strong')).toHaveText(reference);
 await language(page,'en');await expect(page.getByLabel('Status',{exact:true})).toHaveValue('confirmed');await expect(page.getByLabel('Payment state',{exact:true})).toHaveValue('unpaid');await expect(page.getByLabel('Search orders',{exact:true})).toHaveValue('DEMO-ROSE-3');
});

test('language changes preserve unsaved order, payment and reply inputs and never translate customer content or save records',async({page})=>{
 await login(page);const orderId='demo-custom-box';const before=await (await page.request.get(admin+'/api/admin/orders/'+orderId)).json();
 // Read-only browser response fixture: these strings deliberately equal UI labels.
 // Their presence must never turn a customer name or card into translated UI copy.
 await page.route('**/api/admin/orders/'+orderId,async route=>{
  if(route.request().method()!=='GET')return route.continue();
  const response=await route.fetch(),order=await response.json();
  await route.fulfill({response,json:{...order,customer:{...order.customer,name:'Orders',line:'Calendar'},card:{...order.card,message:'Save changes'},custom:{...order.custom,notes:'Payments'}}});
 });
 await page.getByLabel('Search orders').fill('DEMO-CUSTOM-BOX');await expect(page.locator('.order-table tbody tr')).toHaveCount(1);await page.locator('.order-table tbody button').click();const dialog=page.locator('dialog[open]');await expect(dialog).toBeVisible();
 const fields={notes:dialog.getByLabel('Staff notes',{exact:true}),quote:dialog.getByLabel('Confirmed arrangement quote (THB)',{exact:true}),fee:dialog.getByLabel('Delivery fee (THB, blank means unconfirmed)',{exact:true}),reason:dialog.getByLabel('Reason for change',{exact:true}),amount:dialog.getByLabel('Amount (THB)',{exact:true}),date:dialog.getByLabel('Received / refunded at (Bangkok)',{exact:true}),method:dialog.getByLabel('Payment method',{exact:true}),type:dialog.getByLabel('Event type',{exact:true}),paymentReference:dialog.getByLabel('Payment reference',{exact:true}),paymentReason:dialog.getByLabel('Payment reason',{exact:true}),reply:dialog.getByLabel('Customer reply draft',{exact:true})};
 const values={notes:'Settings — English / ภาษาไทย draft',quote:'2450.50',fee:'120',reason:'Owner correction remains my original wording',amount:'450.25',date:'2026-10-15T09:45',method:'cash',type:'refund',paymentReference:'ORDERS-CALENDAR-REF',paymentReason:'Customer original reason / เหตุผลเดิม',reply:'Hello Orders, do not translate this unsent reply. ขอบคุณค่ะ'};
 for(const[key,node]of Object.entries(fields)){await tag(node,key);if(['method','type'].includes(key))await node.selectOption(values[key]);else await node.fill(values[key]);}
 await fields.notes.evaluate(node=>node.setSelectionRange(12,12));
 await tag(dialog.locator('dt').filter({hasText:/^Customer$/}).locator('xpath=following-sibling::dd[1]'),'customer-content');await tag(dialog.locator('dt').filter({hasText:/^LINE contact$/}).locator('xpath=following-sibling::dd[1]'),'line-content');await tag(dialog.locator('dt').filter({hasText:/^Card$/}).locator('xpath=following-sibling::dd[1]'),'card-content');
 const customerBefore=await page.locator('[data-language-qa="customer-content"]').innerText();
 await page.evaluate(()=>{window.__languageDraftNodes=[...document.querySelectorAll('dialog [data-language-qa]')];});
 const writes=[];page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push(r.method()+' '+r.url());});
 await language(page,'th',{dialog:true});
 await expect(dialog.getByRole('heading',{name:/ชำระเงิน/})).toBeVisible();await expect(dialog.getByRole('button',{name:/บันทึก/}).first()).toBeVisible();
 for(const[key,value]of Object.entries(values))await expect(page.locator('[data-language-qa="'+key+'"]')).toHaveValue(value);
 await expect(page.locator('[data-language-qa="customer-content"]')).toHaveText(customerBefore,{useInnerText:true});await expect(page.locator('[data-language-qa="line-content"]')).toHaveText('Calendar');await expect(page.locator('[data-language-qa="card-content"]')).toHaveText('Save changes');await expect(dialog.getByText('Payments',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.__languageDraftNodes.every(node=>node.isConnected))).toBe(true);expect(await page.locator('[data-language-qa=notes]').evaluate(node=>[node.selectionStart,node.selectionEnd])).toEqual([12,12]);expect(await page.evaluate(()=>window.LHFStudioHasUnsavedChanges())).toBe(true);
 await language(page,'en',{dialog:true});for(const[key,value]of Object.entries(values))await expect(page.locator('[data-language-qa="'+key+'"]')).toHaveValue(value);
 const after=await (await page.request.get(admin+'/api/admin/orders/'+orderId)).json();expect(after.revision).toBe(before.revision);expect(after.customer).toEqual(before.customer);expect(after.card).toEqual(before.card);expect(after.notes).toBe(before.notes);expect(after.confirmedTotal).toBe(before.confirmedTotal);expect(after.deliveryFee).toBe(before.deliveryFee);expect(after.payments).toEqual(before.payments);expect(writes).toEqual([]);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.getByRole('button',{name:'Discard all changes',exact:true}).click();await expect(dialog).toHaveCount(0);
});
