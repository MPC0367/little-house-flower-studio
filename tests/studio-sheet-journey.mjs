/* The Studio connected to the shop's Google Sheet through google/studio.gs, run by the local stand-in
   (node scripts/sheet-emulator.mjs, 5585) plus serve-pages (5590). Resets the synthetic test Sheet first.
     LHF_PLAYWRIGHT_MODULE=<path to @playwright/test/index.mjs> node tests/studio-sheet-journey.mjs */
const {chromium}=await import(process.env.LHF_PLAYWRIGHT_MODULE||'@playwright/test');
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const URL='http://127.0.0.1:5590/little-house-flower-studio/',EXEC='http://127.0.0.1:5585/exec';
const out=[];let fails=0;const ok=(n,c,d='')=>{out.push((c?'PASS ':'FAIL ')+n+(d?'  '+d:''));if(!c)fails++;};
await fetch('http://127.0.0.1:5585/_test/reset',{method:'POST'});
const keys=JSON.parse(fs.readFileSync(fileURLToPath(new globalThis.URL('../.emulator/keys.json',import.meta.url)),'utf8'));
const wb=async()=>(await fetch('http://127.0.0.1:5585/_test/workbook')).json();
const cell=async(refEnd,label)=>{const w=await wb(),b=w.sheets.find(s=>s.name==='Bookings').rows,col=b[0].findIndex(h=>String(h).endsWith(' / '+label)),row=b.find(r=>String(r[1]).endsWith(refEnd));return {value:row[col],ref:row[1]};};
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});const errs=[];
const P=await ctx.newPage();P.on('pageerror',e=>errs.push(e.message));
const requests=[];P.on('request',r=>{if(r.url().startsWith(EXEC))requests.push(r.method()+' '+(r.headers()['content-type']||''));});
try{
await P.goto(URL+'#settings');await P.waitForSelector('.settings-card');
await P.locator('summary',{hasText:"Connect the shop's Google Sheet"}).click();
await P.locator('#sheet-url').fill(EXEC);await P.locator('#sheet-key').fill('wrong-key-'+'x'.repeat(30));await P.getByRole('button',{name:'Connect'}).click();
await P.waitForSelector('.connect-form .field-error:not([hidden])');
ok('a wrong key is refused with the script\'s own words',(await P.locator('.connect-form .field-error').textContent()).includes('not recognised'));
await P.locator('#sheet-key').fill(keys.staff);await P.getByRole('button',{name:'Connect'}).click();
await P.waitForSelector('text=This Studio reads and writes the shop',{timeout:10000});
ok('connected as the person the key belongs to',(await P.locator('.settings-card').first().textContent()).includes('Florist (test)'));
ok('requests go as POST text/plain only (no preflight)',requests.every(r=>r.startsWith('POST text/plain')),[...new Set(requests)].join(', '));
ok('no "Demo data" badge once on the real Sheet',await P.locator('.demo-badge').count()===0);
await P.goto(URL+'#orders');await P.waitForSelector('tr.order-row');
await P.getByRole('button',{name:/^All\s*\d+/}).click();
ok('the Sheet\'s 12 bookings are listed',await P.locator('tr.order-row').count()===12,String(await P.locator('tr.order-row').count()));
const late=await cell('LATE','Status');
await P.goto(URL+'#orders/'+encodeURIComponent('t'+late.ref.replace(/\W/g,'').toLowerCase()));await P.waitForSelector('.order-head');
await P.getByRole('button',{name:'Start making'}).click();
await P.waitForFunction(()=>document.querySelector('dialog.drawer .order-chips .chip')?.textContent.includes('Making'),null,{timeout:10000});
ok('the Sheet now says กำลังจัด',(await cell('LATE','Status')).value==='กำลังจัด');
const w=await wb(),act=w.sheets.find(s=>s.name==='_Activity').rows.at(-1);
ok('the write is in _Activity with the person\'s name',act[1]==='Florist (test)'&&act[5]==='status',JSON.stringify(act.slice(1,8)));
// a person edits the status cell straight in the Sheet
await fetch('http://127.0.0.1:5585/_test/edit',{method:'POST',body:JSON.stringify({ref:late.ref,label:'สถานะ / Status',value:'พร้อมรับ'})});
await P.waitForFunction(()=>document.querySelector('dialog.drawer .order-chips .chip')?.textContent.includes('Ready'),null,{timeout:15000});
ok('the Studio picks up the Sheet edit by itself',true);
ok('history says it was changed in the Google Sheet',(await P.locator('.history').textContent()).includes('Changed directly in the Google Sheet'));
await P.getByRole('button',{name:'Close'}).first().click();
await P.goto(URL+'#earnings');await P.waitForSelector('.headline-value',{timeout:10000});
await P.getByRole('button',{name:'Week'}).click();await P.waitForTimeout(300);await P.getByRole('button',{name:'Month'}).click();
await P.waitForFunction(()=>document.querySelector('.headline-value')?.textContent.includes('1,290')||document.querySelector('.data-table')?.textContent.includes('1,290'),null,{timeout:10000}).catch(()=>{});
const text=await P.locator('.earnings-body').textContent();
ok('earnings show the fixture: ฿1,490 received, ฿200 refunded',text.includes('฿1,490')&&text.includes('฿200'),'');
await P.goto(URL+'#settings');await P.getByRole('button',{name:'Disconnect and go back to the demo'}).click();
await P.waitForSelector('text=This Studio is showing demo data',{timeout:10000});
ok('disconnecting returns to the demo and forgets the key',await P.evaluate(()=>!sessionStorage.getItem('lhf.studio.sheet.v1')&&!localStorage.getItem('lhf.studio.sheet.v1')));
}catch(e){ok('journey ran to the end',false,e.message.split('\n')[0]);}
ok('no JavaScript errors',errs.length===0,errs.slice(0,3).join(' | '));
console.log(out.join('\n'));console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;await b.close();
