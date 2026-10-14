import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const open=async(page,route='/')=>{await page.goto('/?lang=en#'+route);await expect(page.locator('#main h1')).toBeVisible();};
async function saveSyntheticBooking(page){
 await open(page,'/order');
 await page.evaluate(()=>{
  const date=LHF.util.addDays(LHF.time.today(),5);
  LHF.store.setDraft({type:'product',items:[{productId:'white-rose',qty:1}],date,windowId:'p2',windowLabel:'10:00–12:00',fulfil:'pickup',customer:{name:'Local Regression Customer',phone:'0800000000',line:''},recipient:{name:'Local Regression Customer',phone:'0800000000'},card:{message:'Thank you, always;\nขอบคุณสำหรับทุกอย่าง'},sameAsMe:true});
  LHF.router.navigate('/order',{step:'review'});
 });
 await expect(page.getByRole('button',{name:'Send the reservation',exact:true})).toBeVisible();
 await page.locator('.book-sheet input[type=checkbox]').check();
 await page.getByRole('button',{name:'Send the reservation',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Local request saved'})).toBeVisible();
 return page.evaluate(()=>LHF.store.get('lastOrder'));
}
test('synthetic booking downloads a correctly timed and escaped calendar file',async({page})=>{
 const booking=await saveSyntheticBooking(page);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Add to calendar',exact:true}).click()]);
 const contents=fs.readFileSync(await download.path(),'utf8'),unfolded=contents.replace(/\r\n /g,'');
 expect(download.suggestedFilename()).toBe('little-house-flower-'+booking.ref+'.ics');
 expect(unfolded).toContain('BEGIN:VCALENDAR');expect(unfolded).toContain('UID:'+booking.id+'@littlehouseflower');
 expect(unfolded).toContain('DTSTART:'+booking.date.replaceAll('-','')+'T030000Z');
 expect(unfolded).toContain('DTEND:'+booking.date.replaceAll('-','')+'T050000Z');
 expect(unfolded).toContain('Thank you\\, always\\;\\nขอบคุณสำหรับทุกอย่าง');
 for(const line of contents.split('\r\n'))expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
});
test('copy-summary recovery preserves receipt content when clipboard access is denied',async({page})=>{
 const booking=await saveSyntheticBooking(page);
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Synthetic clipboard denial');}}});document.execCommand=()=>false;});
 await page.getByRole('button',{name:'Copy summary',exact:true}).click();
 const summary=page.getByRole('dialog',{name:'Copy summary'}).getByRole('textbox');
 await expect(summary).toHaveAttribute('readonly','');
 const value=await summary.inputValue();expect(value).toContain(booking.ref);expect(value).toContain('White Rose');expect(value).toContain('Thank you, always;');
 expect(value).toContain('1,090');expect(value).not.toContain('undefined');
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Copy summary',exact:true})).toBeFocused();
});
test('card writer uses the saved draft and booking card counter and preview persist',async({page})=>{
 await open(page,'/flowers');await page.evaluate(()=>LHF.store.setDraft({card:{message:'Thank you for everything'}}));
 await page.getByRole('button',{name:'Write the card',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('Thank you for everything');
 await page.getByRole('dialog').getByRole('textbox').fill('Always by your side');
 await page.getByRole('button',{name:'Book with this card',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Now the card',exact:true})).toHaveValue('Always by your side');
 await expect(page.locator('.card-write')).toContainText('19/200');
 await expect(page.locator('.card-write')).toContainText('Preview');
 await page.reload();await expect(page.getByRole('textbox',{name:'Now the card',exact:true})).toHaveValue('Always by your side');
});
test('privacy, business links, private receipt fallback and malformed deep links stay reachable',async({page})=>{
 await open(page,'/privacy');const policy=page.locator('.policy');
 await expect(policy).toContainText('36 hours');await expect(policy).toContainText('30 days');await expect(policy).toContainText('not sent to an AI provider');
 await open(page,'/contact');await expect(page.locator('.contact-actions a[href="tel:+66627495533"]')).toBeVisible();
 await expect(page.locator('.contact-actions a[href^="https://maps.app.goo.gl/"]')).toBeVisible();
 await expect(page.locator('.contact-actions a[href="https://lin.ee/2RYsFwz"]')).toBeVisible();
 for(const route of ['/flowers/not-a-product','/occasions/not-an-occasion','/%E0%A4%A','/missing-route']){await open(page,route);await expect(page.getByRole('heading',{name:'Nothing at this door.'})).toBeVisible();await expect(page.getByRole('link',{name:'Back home',exact:true})).toBeVisible();}
 await open(page,'/flowers/white-rose');await expect(page.locator('#main h1')).toContainText('White Rose');
 await open(page,'/order/done/unavailable-local-id?ref=LH261015-TEST');
 await expect(page.getByRole('heading',{name:'This reservation is saved on the phone it was made on'})).toBeVisible();
 await expect(page.locator('.done .ref')).toHaveText('LH261015-TEST');
 await expect(page.locator('.done')).not.toContainText('Local Regression Customer');
});
test('without JavaScript, the contact fallback is immediately usable without a blocking loader',async({browser,baseURL})=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const page=await context.newPage();await page.goto(baseURL+'/?lang=en');
 const line=page.locator('noscript a[href="https://lin.ee/2RYsFwz"]');await expect(line).toBeVisible();
 await line.click({trial:true,timeout:1500});
 await expect(page.locator('.loader:visible,.lhf-logo-intro:visible,.local-intro:visible')).toHaveCount(0);
 await context.close();
});
test('customer browsing and synthetic submission never send writes beyond loopback',async({page})=>{
 const writes=[],attemptedExternalWrites=[],destinations=new Set(),responses=[];
 page.on('response',async response=>{if(response.url().includes('/api/orders'))responses.push({url:response.url(),status:response.status(),body:await response.text().catch(()=>'<unavailable>')});});
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());destinations.add(url.origin);
  if(!['GET','HEAD','OPTIONS'].includes(request.method())){
   writes.push({method:request.method(),url:request.url()});
   if(!['127.0.0.1','localhost'].includes(url.hostname)){attemptedExternalWrites.push(request.url());return route.abort();}
  }
  return route.continue();
 });
 for(const route of ['/','/flowers','/custom','/instagram','/contact','/privacy'])await open(page,route);
 try{await saveSyntheticBooking(page);}catch(error){await test.info().attach('submission-responses.json',{body:JSON.stringify(responses,null,2),contentType:'application/json'});throw new Error(error.message+'\nLocal API responses: '+JSON.stringify(responses));}
 expect(writes.some(x=>x.url.endsWith('/api/orders'))).toBe(true);expect(attemptedExternalWrites).toEqual([]);
 expect([...destinations].some(x=>/script\.google|sheets\.google/.test(x))).toBe(false);
 await test.info().attach('network-destinations.json',{body:JSON.stringify({writes,destinations:[...destinations],attemptedExternalWrites},null,2),contentType:'application/json'});
});
test('refreshed custom receipt retains public design and estimate while removing private fields',async({page})=>{
 await open(page,'/flowers');
 const id=await page.evaluate(async()=>{
  const id=crypto.randomUUID();
  const booking={id,ref:'LH261015-RCPT',type:'custom',date:LHF.util.addDays(LHF.time.today(),5),windowId:'p2',windowLabel:'10:00–12:00',fulfil:'pickup',createdAt:new Date().toISOString(),items:[],customer:{name:'Private Receipt Person',phone:'0812345678'},recipient:{name:'Private Recipient'},card:{message:'Private card text'},address:{line:'Private home address'},lang:'en',status:'new',hasQuote:true,custom:{style:'bouquet',occasion:'birthday',budgetTier:'b3',banknoteValue:2000,priceRuleVersion:'rules-v1',notes:'Private bespoke note',feel:'Private feeling',referenceAssetId:'private-reference-id',referenceUrl:'/api/assets/private-reference-id',hasReference:true,config:{style:'bouquet',container:'paper',finish:'cream',palette:'red',flowers:['rose_red','eucalyptus'],ribbon:'cream',size:'reference',unchanged:false,promptVersion:1,modelVersion:'unconnected',customerName:'Do not retain me'},previewAssetId:'concept-red-roses-cream-v1',previewVersion:1,preview:{status:'ready',key:'receipt-public-preview',asset:{id:'concept-red-roses-cream-v1',version:1,url:'/img/concept-red-roses-cream-1200.webp',kind:'concept',label:'AI concept',privateToken:'Do not retain token'}},estimate:{kind:'quote',currency:'THB',low:null,high:null,catalogVersion:'local-v1',rulesVersion:'rules-v1',confidence:'unknown',reasons:['Private pricing note']},snapshotAt:new Date().toISOString()}};
  await LHF.db.createBooking(booking);LHF.router.navigate('/order/done/'+id);return id;
 });
 await expect(page.locator('.book-snapshot')).toBeVisible();
 // An older release may have kept private nested fields: revisiting also scrubs them.
 await page.evaluate(id=>{const receipts=JSON.parse(localStorage.getItem('lhf.db.bookings'));const receipt=receipts.find(b=>b.id===id);receipt.custom.referenceUrl='/api/assets/legacy-private-photo';receipt.custom.config.privateNote='Legacy private note';localStorage.setItem('lhf.db.bookings',JSON.stringify(receipts));},id);
 await page.reload();await expect(page.locator('.book-snapshot')).toBeVisible();
 const stored=await page.evaluate(id=>JSON.parse(localStorage.getItem('lhf.db.bookings')).find(b=>b.id===id),id);
 expect(stored.custom.config.flowers).toEqual(['rose_red','eucalyptus']);expect(stored.custom.previewAssetId).toBe('concept-red-roses-cream-v1');expect(stored.custom.estimate.rulesVersion).toBe('rules-v1');expect(stored.custom.config.promptVersion).toBe(1);expect(stored.custom.config.modelVersion).toBe('unconnected');expect(stored.custom.banknoteValue).toBe(2000);expect(stored.custom.priceRuleVersion).toBe('rules-v1');
 const serialized=JSON.stringify(stored);for(const privateValue of ['Private Receipt Person','0812345678','Private Recipient','Private card text','Private home address','Private bespoke note','Private feeling','private-reference-id','Do not retain','Private pricing note','legacy-private-photo','Legacy private note'])expect(serialized).not.toContain(privateValue);
 await expect(page.locator('.book-snapshot img')).toHaveAttribute('src','/img/concept-red-roses-cream-1200.webp');
});
test('rendered customer text and meaningful control boundaries meet targeted contrast thresholds',async({page})=>{
 const samples=[];
 async function measure(selector){const found=await page.locator(selector).evaluateAll(nodes=>{
  const parse=s=>{const n=s.match(/[\d.]+/g)?.map(Number)||[0,0,0];return [n[0],n[1],n[2],n[3]??1];};
  const background=(node)=>{for(let el=node;el;el=el.parentElement){const c=parse(getComputedStyle(el).backgroundColor);if(c[3]===1)return c.slice(0,3);}return [255,255,255];};
  const luminance=c=>c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  return nodes.filter(el=>el.getClientRects().length&&!el.disabled&&getComputedStyle(el).opacity==='1').map(el=>{const s=getComputedStyle(el),bg=background(el),outside=background(el.parentElement);return {label:(el.getAttribute('aria-label')||el.textContent||el.tagName).trim().slice(0,65),class:el.className,color:s.color,background:bg,border:s.borderTopColor,textRatio:ratio(parse(s.color).slice(0,3),bg),boundaryRatio:Math.min(ratio(parse(s.borderTopColor).slice(0,3),bg),ratio(parse(s.borderTopColor).slice(0,3),outside)),borderWidth:parseFloat(s.borderTopWidth)};});
 });samples.push(...found);for(const item of found){expect(item.textRatio,item.label+' text').toBeGreaterThanOrEqual(4.5);if(item.borderWidth>0)expect(item.boundaryRatio,item.label+' boundary').toBeGreaterThanOrEqual(3);}}
 await open(page,'/flowers');await page.getByRole('searchbox').fill('white');await expect(page.locator('.filter-chip').first()).toBeVisible();await measure('.filter-search .input,.filter-search .select,.chip,.lang-switch');
 await open(page,'/custom');await expect(page.locator('.custom-steps')).toBeVisible();await measure('.choice,.recipe-card,.preview-label');
 await page.locator('.custom-steps button').nth(2).click();await measure('.finish-swatches button:not(:disabled),.custom-step .select');
 await open(page,'/order');await page.evaluate(()=>{LHF.store.setDraft({type:'product',custom:null,items:[{productId:'white-rose',qty:1}],date:LHF.util.addDays(LHF.time.today(),5),fulfil:'pickup'});LHF.router.navigate('/order',{step:'when'});});await expect(page.locator('.cal')).toBeVisible();await measure('.cal-nav button,.window:not(.no)');
 const reportPath=test.info().outputPath('customer-contrast-samples.json');fs.writeFileSync(reportPath,JSON.stringify(samples,null,2));await test.info().attach('customer-contrast-samples.json',{path:reportPath,contentType:'application/json'});
 expect(samples.length).toBeGreaterThan(20);
});
