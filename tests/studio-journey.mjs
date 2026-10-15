/* The rebuilt Studio against the demo back end: every editing flow, conflicts, Thai, phone layout.
   Needs the local stack: node scripts/serve-pages.mjs (5590) and the hosted back end on 5580 (preview lhf-backend,
   README: Studio and back end). Writes synthetic bookings and edits to that LOCAL back end only.
     LHF_PLAYWRIGHT_MODULE=<path to @playwright/test/index.mjs> node tests/studio-journey.mjs */
const {chromium, devices}=await import(process.env.LHF_PLAYWRIGHT_MODULE||'@playwright/test');
const URL='http://127.0.0.1:5590/little-house-flower-studio/';
const out=[];let fails=0;const ok=(n,c,d='')=>{out.push((c?'PASS ':'FAIL ')+n+(d?'  '+d:''));if(!c)fails++;};
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const errs=[];ctx.on('page',p=>p.on('pageerror',e=>errs.push(e.message)));
const A=await ctx.newPage();
try{
await A.goto(URL);await A.waitForSelector('tr.order-row',{timeout:15000});
ok('Orders is the first screen',await A.locator('h1').textContent()==='Orders');
// counts: the New view count equals the rows it shows
await A.getByRole('button',{name:/^New\s*\d+/}).click();
const newCount=Number((await A.getByRole('button',{name:/^New\s*\d+/}).textContent()).replace(/\D/g,''));
ok('saved-view count equals its rows',await A.locator('tr.order-row').count()===newCount,newCount+' rows');
// pick a new order without a price
const id=await A.evaluate(()=>{const r=[...document.querySelectorAll('tr.order-row')].find(tr=>tr.querySelector('.chip')?.textContent.includes('New')&&tr.querySelector('.amount.is-quote'));return r?.dataset.id;});
ok('found a new order with no price',!!id,id);
await A.goto(URL+'#orders/'+encodeURIComponent(id));await A.waitForSelector('dialog.drawer .order-head');
const ref=await A.locator('#order-title').textContent();
await A.getByRole('button',{name:'Confirm order'}).click();
await A.waitForFunction(()=>document.querySelector('dialog.drawer .order-chips .chip')?.textContent.includes('Confirmed'),null,{timeout:8000});
ok('status step: New → Confirmed',true);
ok('history records the step',(await A.locator('.history').textContent()).includes('Status: New → Confirmed'));
// price with reason
await A.getByRole('button',{name:'Change the confirmed price'}).click();
await A.locator('#m-quote').fill('1490');
await A.getByRole('button',{name:'Save prices'}).click();
ok('a price change without a reason is refused',await A.locator('#reason-help').isVisible());
await A.locator('dialog.dialog textarea').fill('TEST quote agreed on LINE');
await A.getByRole('button',{name:'Save prices'}).click();
await A.waitForFunction(()=>document.querySelector('.money')?.textContent.includes('฿1,490'),null,{timeout:8000});
ok('confirmed price saved',true);
// payment
await A.getByRole('button',{name:'Record a payment'}).click();
ok('amount prefilled with what is still to collect',await A.locator('#p-amount').inputValue()==='1490');
await A.locator('#p-amount').fill('500');
await A.locator('dialog.dialog').getByRole('button',{name:'Record payment'}).dblclick();
await A.waitForFunction(()=>document.querySelector('.ledger')?.textContent.includes('฿500'),null,{timeout:8000});
const ledgerRows=await A.locator('.ledger-row').count();
ok('double-pressed payment recorded once',ledgerRows===1,ledgerRows+' rows');
ok('still to collect is ฿990',(await A.locator('.money').textContent()).includes('฿990'));
// notes and save bar
await A.locator('#o-notes').fill('TEST note A1');
ok('save bar appears for an unsaved edit',await A.locator('.save-bar').isVisible());
await A.locator('.save-bar').getByRole('button',{name:'Save'}).click();
await A.waitForFunction(()=>document.querySelector('.save-state')?.textContent.includes('Saved'),null,{timeout:8000});
ok('notes saved',true);
// conflict: tab B saves a different note on the same order while A has an unsaved edit
const B=await ctx.newPage();await B.goto(URL+'#orders/'+encodeURIComponent(id));await B.waitForSelector('#o-notes');
await A.locator('#o-notes').fill('TEST note from A');
await B.locator('#o-notes').fill('TEST note from B');await B.locator('.save-bar').getByRole('button',{name:'Save'}).click();
await B.waitForFunction(()=>document.querySelector('.save-state')?.textContent.includes('Saved'),null,{timeout:8000});
await A.bringToFront();
await A.waitForSelector('.banner.warn',{timeout:15000});
ok('A is told the order changed elsewhere, edit kept',(await A.locator('#o-notes').inputValue())==='TEST note from A');
await A.locator('.save-bar').getByRole('button',{name:'Save'}).click();
await A.waitForSelector('dialog.dialog fieldset.conflict-field',{timeout:8000});
const conflictText=await A.locator('dialog.dialog').textContent();
ok('conflict shows the record and the edit side by side',conflictText.includes('TEST note from B')&&conflictText.includes('TEST note from A'));
await A.getByLabel('Keep both notes').check();
await A.locator('dialog.dialog').getByRole('button',{name:'Save'}).click();
await A.waitForFunction(()=>{const v=document.querySelector('#o-notes')?.value||'';return v.includes('from B')&&v.includes('from A');},null,{timeout:8000});
ok('both notes kept, nothing overwritten',true);
// unsaved close
await A.locator('#o-notes').fill('TEST unsaved');
await A.keyboard.press('Escape');
await A.waitForSelector('text=Save your changes?');
await A.getByRole('button',{name:'Keep editing'}).click();
ok('Keep editing keeps the order open',await A.locator('dialog.drawer').isVisible());
await A.waitForFunction(()=>document.querySelectorAll('dialog[open]').length===1);await A.keyboard.press('Escape');await A.waitForSelector('text=Save your changes?',{timeout:3000});await A.locator('dialog.dialog').getByRole('button',{name:'Discard'}).click();
await A.waitForFunction(()=>!document.querySelector('dialog.drawer'),null,{timeout:5000});
ok('Discard closes and returns to the list',A.url().endsWith('#orders'));
// cancel needs a reason
const id2=await A.evaluate(()=>[...document.querySelectorAll('tr.order-row')].find(tr=>tr.querySelector('.chip')?.textContent.includes('New'))?.dataset.id);
await A.goto(URL+'#orders/'+encodeURIComponent(id2));await A.waitForSelector('.order-head');
await A.getByRole('button',{name:'Cancel order…'}).click();
await A.getByRole('button',{name:'Cancel the order'}).click();
ok('cancelling without a reason is refused',await A.locator('#reason-help').isVisible());
await A.locator('dialog.dialog textarea').fill('TEST customer asked to cancel');
await A.getByRole('button',{name:'Cancel the order'}).click();
await A.waitForFunction(()=>document.querySelector('dialog.drawer .order-chips .chip')?.textContent.includes('Cancelled'),null,{timeout:8000});
ok('cancelled with its reason',(await A.locator('.history').textContent()).includes('TEST customer asked to cancel'));
ok('a cancelled order offers no payment',await A.getByRole('button',{name:'Record a payment'}).count()===0);
await A.getByRole('button',{name:'Close'}).first().click();
// Thai
await A.getByRole('button',{name:'ไทย'}).first().click();
await A.waitForFunction(()=>document.querySelector('h1')?.textContent==='คำจอง',null,{timeout:5000});
ok('Thai: the whole Studio switches',(await A.locator('.sidebar').textContent()).includes('ปฏิทินงาน'));
await A.getByRole('button',{name:'EN'}).first().click();
// calendar, earnings, settings
await A.goto(URL+'#calendar');await A.waitForSelector('.month-grid');   // the month grid is the first view (tests/studio-calendar.mjs)
await A.locator('.calendar-controls .segment').nth(1).click();await A.waitForSelector('.day-column');
ok('calendar week has 7 days',await A.locator('.day-column').count()===7);
await A.goto(URL+'#earnings');await A.waitForSelector('.headline-value',{timeout:10000});
ok('earnings headline',(await A.locator('.headline-label').textContent())==='Money received');
await A.getByRole('button',{name:'Year'}).click();await A.waitForFunction(()=>document.querySelectorAll('.chart .bar-group').length===12,null,{timeout:8000});
ok('year view has 12 months',true);
await A.goto(URL+'#settings');await A.waitForSelector('.settings-card');
await A.locator('summary',{hasText:"Connect the shop's Google Sheet"}).click();
await A.locator('#sheet-url').fill('https://example.com/exec');await A.locator('#sheet-key').fill('x');await A.getByRole('button',{name:'Connect'}).click();
ok('a wrong script address is refused before anything is sent',(await A.locator('.connect-form .field-error').textContent()).includes('script.google.com'));
// phone
const P=await (await b.newContext({...devices['iPhone 13'],reducedMotion:'reduce'})).newPage();P.on('pageerror',e=>errs.push(e.message));
await P.goto(URL);await P.waitForSelector('tr.order-row');
ok('phone: three tabs at the bottom',await P.locator('.tabbar .nav-item').count()===3);
const small=await P.evaluate(()=>[...document.querySelectorAll('button,a,select,input')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(e).visibility!=='hidden'&&(r.height<44)&&!e.closest('.visually-hidden')&&e.type!=='checkbox'}).map(e=>(e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().height)));
ok('phone: every control at least 44 px high',small.length===0,small.slice(0,8).join(', '));
const overflow=await P.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
ok('phone: no sideways scrolling',overflow<=1,overflow+'px');
await P.locator('tr.order-row a').first().click();await P.waitForSelector('dialog.drawer .order-head');
const dw=await P.evaluate(()=>document.querySelector('dialog.drawer').getBoundingClientRect().width);
ok('phone: the order opens as a full page',dw>=389,dw+'px');
await P.getByRole('button',{name:'Back to orders'}).click();await P.waitForFunction(()=>!document.querySelector('dialog.drawer'));
ok('phone: Back returns to the list',true);
}catch(e){ok('journey ran to the end',false,e.message.split('\n')[0]);}
ok('no JavaScript errors',errs.length===0,errs.slice(0,3).join(' | '));
console.log(out.join('\n'));console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;await b.close();
