/* The Studio calendar's month grid (laid out like the O2 dashboard's calendar): the first view, a box per date
   under weekday columns with its handovers as "time · customer" in status colours, a colour key, a chosen date
   listed in full under the grid, dots instead of words on a phone, English and Thai, no sideways scrolling.
   Needs the local stack (lhf-pages 5590, lhf-backend 5580). Reads only: it opens an order and closes it.
     LHF_PLAYWRIGHT_MODULE=<path to @playwright/test/index.mjs> node tests/studio-calendar.mjs */
const {chromium,webkit,devices}=await import(process.env.LHF_PLAYWRIGHT_MODULE||'@playwright/test');
const STUDIO='http://127.0.0.1:5590/little-house-flower-studio/';
const out=[];let fails=0;const ok=(n,c,d='')=>{out.push((c?'PASS ':'FAIL ')+n+(d?'  '+d:''));if(!c)fails++;};
const bangkokToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date());
const monthOf=(iso,locale)=>new Intl.DateTimeFormat(locale,{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(iso.slice(0,7)+'-01T00:00:00Z'));
async function open(type,options,lang){
  const browser=await type.launch();const ctx=await browser.newContext({...options,reducedMotion:'reduce'});
  await ctx.addInitScript(l=>{try{localStorage.setItem('lhf.admin.language.v1',l);sessionStorage.removeItem('lhf.studio.calendar.v2');}catch{}},lang);
  const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(STUDIO+'#calendar');await page.waitForSelector('.month-grid .mcell',{timeout:20000});
  await page.waitForFunction(()=>!document.querySelector('.loading-line'),null,{timeout:15000});
  return {browser,page,errs};
}
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const now=bangkokToday();

// ---- desktop, English
{
  const {browser,page,errs}=await open(chromium,{viewport:{width:1440,height:900}},'en');
  ok('Month is the first view',await page.locator('.segment[aria-pressed="true"]').textContent()==='Month');
  ok('the label is this month',(await page.locator('.date-label').textContent())===monthOf(now,'en-GB'),await page.locator('.date-label').textContent());
  const heads=await page.locator('.month-head span').allTextContents();
  ok('weekday columns Monday to Sunday',heads.length===7&&/^mon/i.test(heads[0])&&/^sun/i.test(heads[6]),heads.join(' '));
  const cells=await page.locator('.mcell').count();ok('whole weeks: a box per date',cells%7===0&&cells>=28&&cells<=42,String(cells));
  ok('today is marked and chosen',await page.locator(`.mcell.is-today.is-selected[data-date="${now}"]`).count()===1);
  ok('dates outside the month are marked',await page.locator('.mcell.is-out').count()===cells-new Date(Date.UTC(+now.slice(0,4),+now.slice(5,7),0)).getUTCDate());
  ok('colour key names the statuses',(await page.locator('.cal-key .chip').count())===6,(await page.locator('.cal-key').textContent()).replace(/\s+/g,' '));
  // a busy date: three lines written out, the rest as "+N more"; every line is "time · customer"
  const busy=await page.evaluate(()=>[...document.querySelectorAll('.mcell')].map(c=>({d:c.dataset.date,n:+(c.querySelector('.mcell-count')?.textContent||0),lines:c.querySelectorAll('.mentry').length,more:c.querySelector('.mcell-more')?.textContent||''})).filter(c=>c.n>0));
  ok('handovers appear in their date boxes',busy.length>0,busy.map(c=>c.d.slice(8)+':'+c.n).join(' '));
  ok('at most three lines a box, the rest as "+N more"',busy.every(c=>c.lines===Math.min(3,c.n)&&(c.n>3?c.more===`+${c.n-3} more`:c.more==='')),JSON.stringify(busy.filter(c=>c.n>3).slice(0,2)));
  const line=page.locator('.mentry-link').first();
  ok('a line reads time · customer',/^\d{2}:\d{2}$/.test(await line.locator('.mentry-time').textContent())&&(await line.locator('.mentry-text').textContent()).length>0,(await line.textContent()));
  ok('a line says everything to a screen reader',/\d{2}:\d{2}.*,.*,/.test(await line.getAttribute('aria-label')||''),await line.getAttribute('aria-label'));
  ok('long names stay inside their box (no sideways scroll)',await overflow(page)<=0,'overflow '+await overflow(page)+' px');
  const boxesInside=await page.evaluate(()=>[...document.querySelectorAll('.mcell')].every(c=>{const r=c.getBoundingClientRect();return [...c.querySelectorAll('.mentry')].every(e=>e.getBoundingClientRect().right<=r.right+0.5);}));
  ok('every line ends inside its box',boxesInside);
  // choosing a date lists it in full under the grid
  const target=busy.sort((a,b)=>b.n-a.n)[0];
  await page.locator(`.mcell[data-date="${target.d}"] .mcell-date`).click();
  ok('choosing a date marks it',await page.locator(`.mcell[data-date="${target.d}"] .mcell-date`).getAttribute('aria-pressed')==='true');
  ok('its handovers are listed in full under the grid',await page.locator('.day-agenda .job').count()===target.n,`${await page.locator('.day-agenda .job').count()} of ${target.n}`);
  ok('the list is headed by the date',(await page.locator('#cal-agenda').textContent()).includes(String(+target.d.slice(8))));
  ok('focus stays on the chosen date',await page.evaluate(d=>document.activeElement?.closest('.mcell')?.dataset.date===d,target.d));
  await page.keyboard.press('ArrowRight');
  const right=await page.evaluate(()=>document.querySelector('.mcell.is-selected')?.dataset.date);
  ok('arrow keys move between dates',right>target.d,right);
  await page.keyboard.press('ArrowUp');
  ok('up moves a week back',await page.evaluate(()=>document.querySelector('.mcell.is-selected')?.dataset.date)<right);
  // "+N more" chooses its date
  const moreCell=busy.find(c=>c.n>3);
  if(moreCell){await page.locator(`.mcell[data-date="${moreCell.d}"] .mcell-more`).click();ok('"+N more" lists the whole day',await page.locator('.day-agenda .job').count()===moreCell.n);}
  // a line opens the order; closing it returns to the month
  await page.locator('.mentry-link').first().click();await page.waitForSelector('dialog.drawer .order-head',{timeout:10000});
  ok('a line opens its order',await page.locator('dialog.drawer .order-head').isVisible());
  await page.keyboard.press('Escape');await page.waitForTimeout(500);
  ok('closing the order returns to the month',await page.locator('.month-grid').isVisible()&&!(await page.locator('dialog.drawer[open]').count()));
  // months move; Today comes back
  await page.getByRole('button',{name:'Next month'}).click();
  const next=await page.locator('.date-label').textContent();
  ok('next month',next!==monthOf(now,'en-GB')&&await page.locator('.mcell.is-today').count()<=1,next);
  ok('the first of that month is chosen',(await page.evaluate(()=>document.querySelector('.mcell.is-selected')?.dataset.date)).endsWith('-01'));
  await page.getByRole('button',{name:'Previous month'}).click();await page.getByRole('button',{name:'Previous month'}).click();
  await page.getByRole('button',{name:'Today',exact:true}).click();
  ok('Today returns to this month and today',(await page.locator('.date-label').textContent())===monthOf(now,'en-GB')&&await page.locator(`.mcell.is-selected[data-date="${now}"]`).count()===1);
  // week and day keep the chosen date
  await page.locator(`.mcell[data-date="${target.d}"] .mcell-date`).click();
  await page.getByRole('button',{name:'Week',exact:true}).click();await page.waitForSelector('.day-column');
  ok('Week shows the week of the chosen date',await page.locator('.day-column').count()===7&&(await page.locator('.date-label').textContent()).length>0);
  await page.getByRole('button',{name:'Month',exact:true}).click();
  ok('back to Month keeps the chosen date',await page.locator(`.mcell.is-selected[data-date="${target.d}"]`).count()===1);
  await page.getByLabel('Show completed and cancelled').check();
  ok('the key adds completed and cancelled when they are shown',await page.locator('.cal-key .chip').count()===8);
  await page.getByLabel('Show completed and cancelled').uncheck();
  ok('desktop: no script errors',errs.length===0,errs.slice(0,2).join(' | '));
  await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(300);
  ok('narrower desktop (1024): no sideways scroll, words still in the boxes',await overflow(page)<=0&&await page.locator('.mentry-link').first().isVisible());
  const roomy=await page.evaluate(()=>{const e=document.querySelector('.mentry-link');const tm=e.querySelector('.mentry-time').getBoundingClientRect(),tx=e.querySelector('.mentry-text').getBoundingClientRect();return {below:tx.top>=tm.bottom-1,width:Math.round(tx.width)};});
  ok('narrower desktop (1024): the time sits above the name, which gets the box\'s width',roomy.below&&roomy.width>=70,JSON.stringify(roomy));
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(300);
  const wide=await page.evaluate(()=>{const e=document.querySelector('.mentry-link');const tm=e.querySelector('.mentry-time').getBoundingClientRect(),tx=e.querySelector('.mentry-text').getBoundingClientRect();return {sameLine:Math.abs(tx.top-tm.top)<4,width:Math.round(tx.width)};});
  ok('wide desktop (1440): time · customer on one line',wide.sameLine&&wide.width>=70,JSON.stringify(wide));
  await browser.close();
}

// ---- phones: dots instead of words, the list under the grid does the reading
// a date is the whole box: 44 px wide from a 390 px phone; at 320 px seven columns leave about 37 px (still well over the 24 px minimum)
for(const [name,type,device,lang,minWidth] of [['iPhone, English',webkit,devices['iPhone 13'],'en',44],['320 px, Thai',chromium,{viewport:{width:320,height:640},isMobile:true,hasTouch:true},'th',36],['320 px, English',chromium,{viewport:{width:320,height:640},isMobile:true,hasTouch:true},'en',36]]){
  const {browser,page,errs}=await open(type,device,lang);
  ok(name+': no sideways scroll',await overflow(page)<=0,'overflow '+await overflow(page));
  ok(name+': words hidden in the boxes, dots shown',!(await page.locator('.mentry-link').first().isVisible().catch(()=>false))&&await page.locator('.mcell-dots').first().isVisible());
  ok(name+': the hint says to tap a date',await page.locator('.month-hint').isVisible(),await page.locator('.month-hint').textContent());
  const sizes=await page.evaluate(()=>[...document.querySelectorAll('.mcell-date')].map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];}));
  ok(name+': every date is at least 44 px tall',sizes.every(([,hgt])=>hgt>=44),'smallest '+JSON.stringify(sizes.reduce((m,s)=>s[1]<m[1]?s:m,[0,999])));
  ok(name+': no date is narrower than '+minWidth+' px',sizes.every(([w])=>w>=minWidth),'narrowest '+Math.min(...sizes.map(s=>s[0])));
  ok(name+': the month name and its arrows fit',await page.evaluate(()=>{const n=document.querySelector('.date-nav').getBoundingClientRect();return n.right<=document.documentElement.clientWidth;}));
  const busy=await page.evaluate(()=>[...document.querySelectorAll('.mcell')].map(c=>({d:c.dataset.date,dots:c.querySelectorAll('.mdot').length})).find(c=>c.dots>0));
  if(busy){await page.locator(`.mcell[data-date="${busy.d}"] .mcell-date`).tap();ok(name+': tapping a date lists its handovers',await page.locator('.day-agenda .job').count()>=busy.dots,String(await page.locator('.day-agenda .job').count()));}
  if(lang==='th'){
    ok('Thai: the views are named in Thai',(await page.locator('.segmented').textContent()).includes('เดือน'));
    ok('Thai: the month in the Buddhist year',/25\d\d/.test(await page.locator('.date-label').textContent()),await page.locator('.date-label').textContent());
    ok('Thai: the key in Thai',(await page.locator('.cal-key').textContent()).includes('สีบอกสถานะ'));
  }
  ok(name+': no script errors',errs.length===0,errs.slice(0,2).join(' | '));
  await browser.close();
}
console.log(out.join('\n'));console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;
