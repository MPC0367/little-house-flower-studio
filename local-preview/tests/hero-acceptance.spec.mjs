import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
test.use({reducedMotion:'no-preference'});
const position='.hero-position';
async function home(page){
 await page.addInitScript(()=>sessionStorage.setItem('lhf.logo.intro.v5','1'));
 await page.goto('/?lang=en#/');await expect.poll(()=>page.locator('.hero-media img.hi').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
}
test('hero auto-advance pauses on hover, focus, hidden state and manual choice; Play resumes',async({page})=>{
 await page.clock.install();await home(page);await page.clock.pauseAt(new Date());
 const advance=()=>page.clock.runFor(6100);
 await page.locator('.hero-media').hover();await advance();await expect(page.locator(position)).toHaveText('01 / 04');
 await page.mouse.move(0,0);await advance();await expect(page.locator(position)).toHaveText('02 / 04');
 await page.getByRole('button',{name:'Next photograph',exact:true}).focus();await advance();await expect(page.locator(position)).toHaveText('02 / 04');
 await page.locator('#skiplink').focus();await advance();await expect(page.locator(position)).toHaveText('03 / 04');
 // A deterministic visibility fixture exercises the browser-hidden guard.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await advance();await expect(page.locator(position)).toHaveText('03 / 04');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await advance();await expect(page.locator(position)).toHaveText('04 / 04');
 await page.getByRole('button',{name:'Previous photograph',exact:true}).click();await expect(page.locator(position)).toHaveText('03 / 04');await page.mouse.move(0,0);await page.locator('#skiplink').focus();await advance();await expect(page.locator(position)).toHaveText('03 / 04');
 await page.getByRole('button',{name:'Play slideshow',exact:true}).click();await page.mouse.move(0,0);await page.locator('#skiplink').focus();await advance();await expect(page.locator(position)).toHaveText('04 / 04');
 await page.getByRole('button',{name:'Pause slideshow',exact:true}).click();await page.mouse.move(0,0);await page.locator('#skiplink').focus();await advance();await expect(page.locator(position)).toHaveText('04 / 04');
});
for(const width of [1440,390])test(`all four final hero crops and seam geometry at ${width}px`,async({page})=>{
 await fs.mkdir('docs/final-qa',{recursive:true});await page.setViewportSize({width,height:width===390?844:900});await home(page);await page.getByRole('button',{name:'Pause slideshow',exact:true}).click();await page.evaluate(()=>document.fonts.ready);
 const viewport=width===390?'mobile':'desktop',rows=[];
 for(let i=0;i<4;i++){
  if(i){await page.getByRole('button',{name:'Next photograph',exact:true}).click();await expect(page.locator(position)).toHaveText(String(i+1).padStart(2,'0')+' / 04');await page.waitForTimeout(300);if(i===1)await page.locator('.hero-media').screenshot({path:`docs/final-qa/hero-transition-${viewport}.png`,animations:'allow'});}
  await page.waitForTimeout(820);await expect(page.locator('.hero-scale>.pic')).toHaveCount(1);await expect.poll(()=>page.locator('.hero-media img.hi').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
  const row=await page.locator('.hero-media').evaluate(media=>{const picture=media.querySelector('.pic'),image=picture.querySelector('img.hi'),m=media.getBoundingClientRect(),p=picture.getBoundingClientRect(),im=image.getBoundingClientRect();return {key:LHF.heroSlides[Number(media.querySelector('.hero-position').textContent.slice(0,2))-1].key,photo:image.currentSrc.split('/').pop(),native:[image.naturalWidth,image.naturalHeight],container:[m.width,m.height],picture:[p.x-m.x,p.y-m.y,p.width,p.height],image:[im.x-m.x,im.y-m.y,im.width,im.height],objectPosition:getComputedStyle(image).objectPosition,objectFit:getComputedStyle(image).objectFit,scaleTransform:getComputedStyle(media.querySelector('.hero-scale')).transform,leftGradient:getComputedStyle(media,'::before').display};});
  expect(row.scaleTransform).toBe('none');expect(row.leftGradient).toBe('none');expect(row.objectFit).toBe('cover');expect(row.picture[0]).toBe(0);expect(row.picture[1]).toBe(0);expect(row.image).toEqual(row.picture);expect(row.picture.slice(2)).toEqual(row.container);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('.hero-media').screenshot({path:`docs/final-qa/hero-${i+1}-${viewport}.png`});await page.evaluate(()=>scrollTo({top:0,left:0,behavior:'instant'}));await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);await page.screenshot({path:`docs/final-qa/home-slide-${i+1}-${viewport}.png`});rows.push(row);
 }
 await fs.writeFile(`docs/final-qa/hero-${viewport}-geometry.json`,JSON.stringify(rows,null,2));
});
