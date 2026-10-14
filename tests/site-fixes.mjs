/* The website fixes of 15 October 2026 (the brief's audit findings), checked in a browser.
   Needs the local stack: node scripts/serve-pages.mjs (5590) and the hosted back end on 5580 (preview lhf-backend,
   README: Studio and back end). Writes synthetic bookings and edits to that LOCAL back end only.
     LHF_PLAYWRIGHT_MODULE=<path to @playwright/test/index.mjs> node tests/site-fixes.mjs */
const {chromium, expect}=await import(process.env.LHF_PLAYWRIGHT_MODULE||'@playwright/test');
const base='http://127.0.0.1:5590/Little-House-Flower';
const out=[];let fails=0;const ok=(n,c,d='')=>{out.push((c?'PASS ':'FAIL ')+n+(d?'  '+d:''));if(!c)fails++;};
const b=await chromium.launch();
const ctxFor=(o={})=>b.newContext({serviceWorkers:'allow',reducedMotion:'reduce',viewport:{width:1440,height:1000},...o});
const errs=[];
async function book(page,name,beforeSend){
  await page.goto(base+'/?lang=en#/flowers/white-rose');await page.waitForSelector('.product-actions');
  await page.locator('.product-actions .btn-primary').first().click();await page.waitForURL(/#\/order/);
  await page.locator('.cal-day.ok').first().click();await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.locator('input[name=fulfil][value=pickup]').check();await page.locator('input[name=window][value=p2]').check();await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill(name);await page.getByLabel('Phone',{exact:false}).first().fill('0800000000');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByRole('checkbox').check();if(beforeSend)await page.evaluate(beforeSend);await page.getByRole('button',{name:'Send the reservation',exact:true}).click();
}
try{
// 1. pictures in the builder load on the Pages copy
{const c=await ctxFor();const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));const bad=[];p.on('response',r=>{if(/\/img\//.test(r.url())&&r.status()>=400)bad.push(r.status()+' '+r.url());});
 await p.goto(base+'/?lang=en#/custom');await p.waitForSelector('.preview-photo',{timeout:30000});await p.waitForTimeout(2500);
 ok('builder pictures load (no 404 on Pages paths)',bad.length===0,bad.slice(0,3).join(' | '));
 // 6. starting from a product asks before replacing a design in progress
 await p.locator('.custom-steps button').nth(1).click();await p.getByRole('button',{name:'Sunflower',exact:true}).click();await p.waitForTimeout(500);
 let asked=null;p.once('dialog',d=>{asked=d.message();d.dismiss();});
 await p.goto(base+'/?lang=en#/flowers/white-rose');await p.waitForSelector('.product-actions');await p.getByRole('link',{name:'Customize this design'}).click();await p.waitForTimeout(1500);
 ok('Customize asks before replacing a design in progress',!!asked&&asked.includes('design in progress'),asked||'no question');
 const flowers=await p.evaluate(()=>LHF.store.draft().custom?.config?.flowers||[]);
 ok('saying no keeps the customer\'s design',flowers.includes('sunflower'),JSON.stringify(flowers));
 await c.close();}
// 2. catalogue booking receipt has no "null"
{const c=await ctxFor();const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));await book(p,'Site fix receipt test');
 await expect(p.getByRole('heading',{name:'Reservation saved'})).toBeVisible({timeout:30000});
 const text=await p.locator('#main').textContent();ok('catalogue receipt has no "null"',!/\bnull\b/.test(text));
 // 3. aria-current follows the page
 await p.goto(base+'/?lang=en#/flowers');await p.waitForTimeout(600);await p.goto(base+'/?lang=en#/occasions');await p.waitForTimeout(800);
 const cur=await p.evaluate(()=>[...document.querySelectorAll('.nav-main a[aria-current=page]')].map(a=>a.getAttribute('href')));
 ok('the menu marks the page you are on',cur.length===1&&cur[0].endsWith('/occasions'),JSON.stringify(cur));
 // 5. privacy and consent wording
 await p.goto(base+'/?lang=en#/privacy');await p.waitForSelector('#main h1');const priv=await p.locator('#main').textContent();
 ok('privacy names Lalamove for deliveries and says there is no automatic deletion yet',priv.includes('Lalamove')&&priv.includes('not yet deleted automatically'));
 ok('privacy says photos are opened only by signed-in staff',priv.includes('Only signed-in shop staff can open it'));
 ok('privacy date updated',/15 October 2026|October 15, 2026|15 Oct/.test(priv),'');
 // 8. not-found page
 await p.goto(base+'/?lang=en#/flowers/does-not-exist');await p.waitForTimeout(800);
 const nf=await p.locator('#main').textContent();ok('a broken link offers home, flowers, LINE and phone',nf.includes('See all flowers')&&nf.includes('LINE')&&nf.includes('062 749 5533'));
 // 9. price sort groups price-on-request
 await p.goto(base+'/?lang=en#/flowers?sort=price-asc');await p.waitForTimeout(1000);
 ok('price sort puts price-on-request in its own group',await p.locator('h2.sort-group').count()===1,await p.locator('h2.sort-group').textContent().catch(()=>'none'));
 // 11. Customize only where it adds something
 await p.goto(base+'/?lang=en#/flowers');await p.waitForTimeout(600);
 const wreath=await p.evaluate(()=>LHF.catalog.products.find(x=>x.category==='wreath')?.slug);
 if(wreath){await p.goto(base+'/?lang=en#/flowers/'+wreath);await p.waitForSelector('.product-actions');ok('no Customize on a wreath',await p.getByRole('link',{name:'Customize this design'}).count()===0);}
 await c.close();}
// 7. the answer to a booking is lost: the booking was saved and is found by its id, never reported lost
{const c=await ctxFor();const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
 await book(p,'Site fix lost answer',()=>{const real=LHF.localAPI;LHF.localAPI=async(path,body,opts)=>{if(/\/api\/orders$/.test(path)){await real(path,body,opts);throw Object.assign(new Error('The operation timed out.'),{name:'TimeoutError'});}return real(path,body,opts);};});
 await expect(p.getByRole('heading',{name:'Reservation saved'})).toBeVisible({timeout:30000});
 ok('a lost answer for a saved booking is confirmed by its id, not reported lost',true);await c.close();}
{const c=await ctxFor();const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
 await book(p,'Site fix no answer',()=>{const real=LHF.localAPI;let lookups=0;LHF.localAPI=async(path,body,opts)=>{if(/\/api\/orders\/submission\//.test(path)){lookups++;if(lookups===1)return real(path,body,opts);throw new TypeError('Failed to fetch');}if(/\/api\/orders$/.test(path))throw Object.assign(new Error('The operation timed out.'),{name:'TimeoutError'});return real(path,body,opts);};});
 await p.waitForSelector('text=couldn’t confirm your reservation',{timeout:30000});
 ok('no answer at all says "couldn\'t confirm" and offers Check again',await p.getByRole('button',{name:'Check again'}).count()===1);
 await p.getByRole('button',{name:'Check again'}).click();await p.waitForTimeout(1500);
 ok('checking again while still offline keeps saying "couldn\'t confirm"',await p.locator('text=couldn’t confirm your reservation').count()>0);await c.close();}
// 4. slideshow (motion allowed): caption sizes, Play resumes while focused, no strip on slide 2 at 899 px
{const c=await b.newContext({serviceWorkers:'allow',viewport:{width:1440,height:1000}});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto(base+'/?lang=en#/');await p.waitForSelector('.lhf-logo-intro',{state:'detached',timeout:15000});
 ok('after the opening the skip link is not shown',await p.evaluate(()=>document.activeElement?.id!=='skiplink'));
 ok('hero caption carries the size',(await p.locator('.hero-caption').textContent()).includes('× H'),await p.locator('.hero-caption').textContent());
 const pause=p.locator('.hero-controls button').nth(2);await pause.click();await pause.click();
 const before=await p.locator('.hero-position').textContent();await p.waitForTimeout(7000);const after=await p.locator('.hero-position').textContent();
 ok('Play resumes the slideshow even while focus stays on it',before!==after,before+' → '+after);
 await p.setViewportSize({width:899,height:900});await p.waitForTimeout(400);
 await pause.click();for(let i=0;i<4;i++){if((await p.locator('.hero-position').textContent()).startsWith('02'))break;await p.locator('.hero-controls button').nth(1).click();await p.waitForTimeout(1100);}
 const gap=await p.evaluate(()=>{const m=document.querySelector('.hero-media').getBoundingClientRect(),pics=[...document.querySelectorAll('.hero-scale>.pic')],pic=pics[pics.length-1].getBoundingClientRect();return Math.round(m.right-pic.right);});
 ok('slide 2 fills the hero at 899 px (no pale strip)',gap<=1,gap+' px');
 await c.close();}
// 10. Thai cards without a photo are not clipped at 320 px
{const c=await ctxFor({viewport:{width:320,height:700}});const p=await c.newPage();
 await p.goto(base+'/?lang=th#/flowers');await p.waitForTimeout(1500);
 const clipped=await p.evaluate(()=>[...document.querySelectorAll('.pcard-noimg')].filter(el=>el.scrollHeight>el.clientHeight+1).length);
 ok('Thai no-photo cards at 320 px show all their words',clipped===0,clipped+' clipped');await c.close();}
}catch(e){ok('checks ran to the end',false,e.message.split('\n')[0]);}
ok('no JavaScript errors',errs.length===0,errs.slice(0,3).join(' | '));
console.log(out.join('\n'));console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;await b.close();
