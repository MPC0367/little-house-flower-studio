import {test,expect} from '@playwright/test';
test('expired or changed saved design price requires visible acknowledgment before any order write',async({page})=>{
 let submissions=0;page.on('request',r=>{if(r.url().endsWith('/api/orders')&&r.method()==='POST')submissions++;});
 await page.goto('/?lang=en#/');await expect(page.locator('#main h1')).toBeVisible();
 await page.evaluate(()=>{
  const config=LHF.designConfig.originalConfig(LHF.catalog.byId('white-rose'));
  LHF.store.setDraft({type:'custom',items:[],custom:{ready:true,style:'bouquet',config,budgetTier:'b3',estimate:{kind:'published',low:10000,high:10000,currency:'THB',rulesVersion:'old-price'}},date:LHF.util.addDays(LHF.time.today(),5),windowId:'p2',windowLabel:'10:00–12:00',fulfil:'pickup',customer:{name:'Local price check',phone:'0800000000'},recipient:{name:'Local recipient',phone:'0800000000'},sameAsMe:true,card:{message:''}});
  LHF.router.navigate('/order',{step:'review'});
 });
 await page.locator('.book-sheet input[type=checkbox]').check();await page.getByRole('button',{name:'Send the reservation',exact:true}).click();
 await expect(page.getByRole('button',{name:'Accept update and send request'})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Price information has changed'})).toContainText('1,090');expect(submissions).toBe(0);
 await page.getByRole('button',{name:'Accept update and send request'}).click();await expect(page.getByRole('heading',{name:'Local request saved'})).toBeVisible();expect(submissions).toBe(1);
 expect(await page.evaluate(()=>LHF.store.get('lastOrder').custom.estimate.low)).toBe(109000);
});
test('an unfinished custom draft is preserved but excluded from a product-only review and receipt',async({page})=>{
 await page.goto('/?lang=en#/custom');await expect(page.locator('.customizer-layout')).toBeVisible();
 await page.evaluate(()=>{LHF.store.setDraft({type:'product',items:[{productId:'white-rose',qty:1}],date:LHF.util.addDays(LHF.time.today(),5),windowId:'p2',windowLabel:'10:00–12:00',fulfil:'pickup',customer:{name:'Synthetic product only',phone:'0800000000'},recipient:{name:'Synthetic product only',phone:'0800000000'},card:{message:''}});LHF.router.navigate('/order',{step:'review'});});
 await expect(page.locator('.book-snapshot')).toHaveCount(0);expect(await page.evaluate(()=>!!LHF.store.draft().custom.config)).toBe(true);
 await page.locator('.book-sheet input[type=checkbox]').check();await page.getByRole('button',{name:'Send the reservation',exact:true}).click();await expect(page.getByRole('heading',{name:'Local request saved'})).toBeVisible();expect(await page.evaluate(()=>LHF.store.get('lastOrder').custom)).toBeNull();
});
