import {test,expect} from '@playwright/test';
async function open(page,route='/flowers',lang='en'){
 await page.goto('/?lang='+lang+'#'+route);
 await expect(page.locator('#main h1')).toBeVisible();
 await expect(page.locator('link[href="/polish.css"]')).toHaveCount(1);
}
test('catalogue searches bilingual flower names, removes selected filters and clears no-results',async({page})=>{
 await open(page);
 await page.getByRole('searchbox').fill('กุหลาบ');
 await expect(page.locator('.pcard').first()).toBeVisible();
 const expected=await page.evaluate(()=>LHF.catalog.products.filter(p=>(p.name.th+' '+p.name.en+' '+(p.flowers||[]).map(f=>[LHF.catalog.flowers[f]?.th,LHF.catalog.flowers[f]?.en].join(' ')).join(' ')).toLowerCase().includes('กุหลาบ')).length);
 await expect(page.locator('.pcard')).toHaveCount(expected);
 await expect(page.getByRole('button',{name:'Remove Search: กุหลาบ'})).toBeVisible();
 await page.getByRole('button',{name:'Remove Search: กุหลาบ'}).click();
 await expect(page.locator('.pcard')).toHaveCount(16);
 await page.getByRole('searchbox').fill('no-flower-exists-zzzz');
 await expect(page.locator('.pcard')).toHaveCount(0);
 await page.getByRole('button',{name:'Clear all filters'}).click();
 await expect(page.locator('.pcard')).toHaveCount(16);
 await expect(page.getByRole('searchbox')).toBeFocused();
});
test('shared display prices honor expiry without changing preserved catalog data',async({page})=>{
 await open(page);
 const result=await page.evaluate(()=>{const p=LHF.catalog.byId('white-rose');return {before:p.priceValidUntil,expired:LHF.ui.priceLabel({...p,priceValidUntil:'2020-01-01'}),live:LHF.ui.priceLabel({...p,priceValidUntil:'2099-12-31'}),after:p.priceValidUntil};});
 expect(result.expired).not.toContain('1,090');expect(result.live).toContain('1,090');expect(result.after).toBe(result.before);
});
test('meaning search offers clear recovery and preserves card draft across language and reload',async({page})=>{
 await open(page,'/meanings');
 const field=page.getByRole('textbox',{name:'Type what you want to say'});
 await field.fill('zzzz-nomatch');
 await expect(page.locator('.meaning-empty')).toBeVisible();
 await expect(page.locator('#meaning-count')).toHaveText('12 / 200');
 await page.getByRole('button',{name:'ไทย',exact:true}).click();
 await expect(page.locator('#meaning-message')).toHaveValue('zzzz-nomatch');
 await page.reload();await expect(page.locator('#meaning-message')).toHaveValue('zzzz-nomatch');
 await page.locator('.meaning-empty button').click();await expect(page.locator('#meaning-message')).toHaveValue('');
 expect(await page.evaluate(()=>LHF.store.draft().card.message)).toBe('');
});
test('occasion link preserves unrelated saved custom brief and card',async({page})=>{
 await open(page,'/occasions/birthday');
 await page.evaluate(()=>LHF.store.setDraft({custom:{style:'basket',flowers:['rose_white'],notes:'Keep my bespoke note',budgetTier:'b3',feel:'A quiet garden'},card:{message:'Keep my card'}}));
 await page.locator('.occ-hero a[href*="/custom"]').click();
 await expect(page).toHaveURL(/#\/custom\?occasion=birthday/);
 await expect(page.locator('.customizer-layout')).toBeVisible();
 const draft=await page.evaluate(()=>LHF.store.draft());
 expect(draft.custom.notes).toBe('Keep my bespoke note');expect(draft.custom.budgetTier).toBe('b3');expect(draft.card.message).toBe('Keep my card');expect(draft.custom.occasion).toBe('birthday');
});
test('gallery keyboard viewer isolates focus and returns to the same tile and scroll',async({page})=>{
 await open(page,'/instagram');
 const tile=page.locator('.mtile:not(.quote)').nth(4);await tile.scrollIntoViewIfNeeded();
 const before=await page.evaluate(()=>scrollY);await tile.click();
 await expect(page.locator('.viewer')).toBeVisible();
 expect(await page.locator('#main').evaluate(e=>e.inert)).toBe(true);
 await page.keyboard.press('ArrowRight');await expect(page.locator('.viewer .close-x')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('.viewer')).toHaveCount(0);
 await expect(tile).toBeFocused();expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThan(3);
 expect(await page.locator('#main').evaluate(e=>e.inert)).toBe(false);
});
test('failed gallery photographs retain named tiles and an actionable viewer fallback',async({page})=>{
 await page.route('**/img/hr_*',route=>route.abort());await open(page,'/instagram');
 const tile=page.locator('.mtile:not(.quote)').filter({has:page.locator('.pic[data-media-state="unavailable"]')}).first();
 await expect(tile).toBeVisible();await expect(tile.locator('a')).toHaveCount(0);
 await tile.click();await expect(page.locator('.viewer .pic-fallback')).toBeVisible();await expect(page.getByRole('button',{name:'Retry photograph'})).toBeVisible();
 await expect(page.locator('.viewer .pic-fallback a')).toHaveAttribute('href',/instagram/);
});
test('mobile navigation and gallery controls stay reachable at 320px and short landscape',async({page})=>{
 for(const viewport of [{width:320,height:568},{width:667,height:375}]){
  await page.setViewportSize(viewport);await open(page,'/instagram','th');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('.menu-word').click();await expect(page.locator('.menu-sheet [aria-current=page]')).toHaveAttribute('href','#/instagram');
  await page.keyboard.press('Escape');await expect(page.locator('.menu-word')).toBeFocused();
  await page.locator('.mtile:not(.quote)').first().click();
  await expect(page.locator('.viewer-mobile-controls')).toBeVisible();
  for(const control of await page.locator('.viewer-mobile-controls button').all())expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await page.locator('.viewer').evaluate(e=>e.scrollWidth<=innerWidth+1)).toBe(true);
  await page.keyboard.press('Escape');
 }
});
test('reveal observer failure leaves every requested section visible',async({page})=>{
 await open(page,'/flowers');
 const result=await page.evaluate(()=>{
  const original=LHF.util.onVisible;LHF.util.onVisible=()=>{throw Error('Synthetic observer failure');};
  const root=document.createElement('section');root.style.position='absolute';root.style.top='5000px';const target=document.createElement('div');target.setAttribute('data-reveal','');target.textContent='Visible fallback';root.appendChild(target);document.body.appendChild(root);
  LHF.ui.reveal(root);const visible=!target.classList.contains('rv-wait')||target.classList.contains('is-in');LHF.util.onVisible=original;root.remove();return visible;
 });expect(result).toBe(true);
});
