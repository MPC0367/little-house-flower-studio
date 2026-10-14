import fs from 'node:fs';
import assert from 'node:assert/strict';
const {webkit,expect}=await import(process.env.LHF_PLAYWRIGHT_MODULE||'@playwright/test');
const base=(process.env.LHF_TEST_URL||'http://127.0.0.1:5580').replace(/\/$/,'');
const password=process.env.LHF_TEST_PASSWORD||fs.readFileSync('.dev.vars','utf8').match(/^DEMO_PASSWORD=(.+)$/m)[1];
const credentials={username:'client',password};
const authorization='Basic '+Buffer.from('client:'+password).toString('base64');
const out='.sites-runtime/qa';fs.mkdirSync(out,{recursive:true});
let stage='password gates';const checks=[],errors=[];
const request=async(path,options={})=>fetch(base+path,{redirect:'manual',...options,headers:{Authorization:authorization,...options.headers}});
for(const path of ['/','/studio/','/api/catalogue','/api/admin/orders','/img/original-logo.jpg','/media/little-house-flower-v5-poster-1080p.mp4','/studio/admin.mjs','/shared/config.mjs']){
 const res=await fetch(base+path,{redirect:'manual'});assert.equal(res.status,401,'unguarded '+path);assert.ok(res.headers.get('www-authenticate')?.includes('Basic'));
}
checks.push('Password required for storefront, studio, API, images and code');
assert.equal((await request('/api/admin/orders')).status,401);
assert.equal((await request('/api/admin/login',{method:'POST',headers:{Origin:'https://invalid.example','Content-Type':'application/json','X-CSRF':'local-preview'},body:JSON.stringify({password})})).status,403);
assert.equal((await request('/api/admin/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-CSRF':'local-preview'},body:JSON.stringify({role:'owner'})})).status,401);
checks.push('Staff session required; wrong-origin writes and role bypass rejected');
const browser=await webkit.launch();
const customer=await browser.newContext({httpCredentials:credentials,serviceWorkers:'block',reducedMotion:'reduce',viewport:{width:1440,height:1000}});
const studio=await browser.newContext({httpCredentials:credentials,serviceWorkers:'block',reducedMotion:'reduce',viewport:{width:1440,height:1000}});
try{
 const page=await customer.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 stage='customer home';await page.goto(base+'/?lang=en#/',{waitUntil:'domcontentloaded'});await expect(page.locator('h1')).toBeVisible();await expect(page.locator('.local-banner')).toContainText('CLIENT DEMO');
 await expect(page.getByRole('button',{name:/skip animation/i})).toHaveCount(0);
 checks.push('Branded storefront and loading intro available, no Skip control');
 stage='automatic customization';await page.goto(base+'/?lang=en#/custom',{waitUntil:'domcontentloaded'});
 const current=()=>expect.poll(()=>page.evaluate(()=>{const c=LHF.store.draft().custom;return c?.preview?.status==='ready'&&c.preview.clientKey===c.estimateKey?c.preview.asset.id:null;}),{timeout:45000}).not.toBeNull();
 await current();const before=await page.locator('.preview-photo').getAttribute('src');
 await page.locator('.custom-steps button').nth(1).click();await page.getByRole('button',{name:'Lily',exact:true}).click();await page.getByLabel('Flower palette').selectOption('pink-white');await current();await expect(page.locator('.preview-photo')).not.toHaveAttribute('src',before);await page.locator('.preview-photo').evaluate(img=>img.decode());
 await page.locator('.custom-steps button').nth(2).click();await page.getByRole('button',{name:'Black',exact:true}).click();await page.getByLabel('Ribbon',{exact:true}).selectOption('burgundy');await page.getByLabel('Size relative to reference').selectOption('larger');await current();
 const asset=await page.evaluate(()=>LHF.store.draft().custom.preview.asset);await page.locator('.preview-photo').evaluate(img=>img.decode());await page.screenshot({path:out+'/customizer.png'});
 checks.push('Automatic flower, palette, wrapping, ribbon and size preview updates');
 stage='synthetic checkout';await page.locator('.custom-steps button').nth(3).click();await page.getByLabel('Budget range').selectOption('b3');await page.getByLabel('Notes for the florist').fill('Synthetic hosted verification only. Not a real order.');await page.getByRole('button',{name:'Continue →',exact:true}).click();await page.getByRole('button',{name:'Choose a date →'}).click();await page.locator('.cal-day.ok').first().click();await page.getByRole('button',{name:'Next',exact:true}).click();await page.locator('input[name=fulfil][value=pickup]').check();await page.locator('input[name=window][value=p2]').check();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Hosted demo test');await page.getByLabel('Phone',{exact:false}).first().fill('0800000000');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Send the reservation',exact:true}).click();await expect(page.getByRole('heading',{name:'Demo request saved'})).toBeVisible({timeout:45000});const order=await page.evaluate(()=>LHF.store.get('lastOrder'));assert.equal(order.custom.previewAssetId,asset.id);
 checks.push('Synthetic reservation saved with exact customized preview');
 stage='studio sign-in';const admin=await studio.newPage();admin.setDefaultTimeout(45000);admin.on('pageerror',e=>errors.push(e.message));await admin.goto(base+'/studio/#orders',{waitUntil:'domcontentloaded'});await admin.getByLabel('Workspace password',{exact:true}).fill(password);await admin.locator('.login button[type=submit]').click();
 stage='order details';await admin.getByLabel('Search orders',{exact:true}).fill(order.ref);await expect(admin.locator('.order-table tbody tr')).toHaveCount(1);await admin.locator('.order-table tbody tr td').nth(1).click();const drawer=admin.locator('dialog.drawer');await expect(drawer).toContainText('Hosted demo test');await expect(drawer).toContainText('Lily');await drawer.locator('.order-design-image').evaluate(img=>img.decode());await admin.getByRole('button',{name:'Enlarge product image',exact:true}).first().click();await expect(admin.getByRole('dialog',{name:'Enlarged product image',exact:true})).toBeVisible();await admin.keyboard.press('Escape');
 checks.push('Shared order details, requested date, custom choices and enlarged image');
 stage='Thai';await drawer.locator('[data-admin-language=th]').click();await expect(drawer).toContainText('สีดอกไม้');await admin.screenshot({path:out+'/studio-thai.png'});await drawer.getByRole('button',{name:'ปิด',exact:true}).click();await admin.locator('[data-admin-language=en]').first().click();
 stage='crosslinks and persistence';assert.equal(await admin.evaluate(()=>window.LHF_SHARE_CONTEXT.customerURL),'/');assert.equal(await page.evaluate(()=>window.LHF_SHARE_CONTEXT.studioURL),'/studio/');await admin.reload();await expect(admin.locator('.order-table')).toBeVisible();
 await admin.evaluate(()=>location.hash='settings');await expect(admin.locator('#password-settings')).toBeVisible();await expect(admin.locator('#password-settings').getByLabel('Current password',{exact:true})).toBeVisible();
 checks.push('English/Thai controls, reload persistence, crosslinks and password settings');
 stage='mobile';await admin.setViewportSize({width:390,height:844});assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await admin.screenshot({path:out+'/studio-mobile.png'});
 assert.deepEqual(errors,[]);checks.push('Mobile layout and zero JavaScript errors');
 const result={ok:true,base,checkedAt:new Date().toISOString(),orderId:order.id,checks,javascriptErrors:errors};fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(e){console.error('Hosted verification failed at '+stage+': '+e.message.replaceAll(password,'[redacted]'));fs.writeFileSync(out+'/result.json',JSON.stringify({ok:false,base,stage,error:e.message.replaceAll(password,'[redacted]'),checks},null,2));process.exitCode=1;}finally{await customer.close();await studio.close();await browser.close();}
