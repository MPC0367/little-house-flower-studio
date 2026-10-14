import {test, expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import fs from 'node:fs/promises';

test.use({reducedMotion:'no-preference'});
const intro = '.lhf-logo-intro';
const movie = '/media/little-house-flower-loading-v5-1080p.mp4';
const poster = '/media/little-house-flower-v5-poster-1080p.png';
const timeout = 7200;
const report = page => page.evaluate(() => LHF.logoIntro.report);
async function replay(page, path = '/') {
  await page.goto('/?lang=en&intro=1#' + path, {waitUntil:'domcontentloaded'});
  await expect(page.locator(intro)).toBeVisible();
}
async function released(page) {
  await expect(page.locator(intro)).toHaveCount(0, {timeout});
  expect(await page.locator('#main').evaluate(element => element.inert)).toBe(false);
}

test('the supplied 1080p movie and poster are served unchanged with usable media types', async ({request}) => {
  const video = await request.get(movie), image = await request.get(poster);
  expect(video.ok()).toBe(true);expect(image.ok()).toBe(true);
  expect(video.headers()['content-type']).toContain('video/mp4');
  expect(image.headers()['content-type']).toContain('image/png');
  const bytes = await video.body(), still = await image.body();
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('efbfee856901212a8852b9315437c4fc26bcb772ffbcc2dc5ee86c0917d9156a');
  expect(createHash('sha256').update(still).digest('hex')).toBe('cc838a2c51b0e8d7fa2e212756ffe2da1676212ed56ab03d6618c38af2f66de7');
  const metadata = await sharp(still).metadata();expect([metadata.width, metadata.height]).toEqual([1920,1080]);
});

test('1080p video plays inline without sound or looping and fits small and large screens', async ({page}) => {
  await fs.mkdir('docs/logo-qa', {recursive:true});
  for (const width of [320,1440]) {
    await page.setViewportSize({width,height:900});await replay(page);
    const video = page.locator('.lhf-logo-stage video');
    await expect(video).toBeVisible();await expect(video).toHaveAttribute('src',movie);await expect(video).not.toHaveAttribute('poster', /.+/);await expect(page.locator('.lhf-logo-poster')).toHaveAttribute('src',poster);await expect(page.locator('.lhf-logo-poster')).toBeHidden();
    await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
    const media = await video.evaluate(element => ({muted:element.muted,inline:element.playsInline,loop:element.loop,controls:element.controls,width:element.videoWidth,height:element.videoHeight,duration:element.duration,fit:getComputedStyle(element).objectFit}));
    expect(media).toMatchObject({muted:true,inline:true,loop:false,controls:false,width:1920,height:1080,fit:'contain'});expect(media.duration).toBeCloseTo(4.4,1);
    await page.evaluate(() => LHF.logoIntro.setFrame(1200));
    const stage = page.locator('.lhf-logo-stage'), box = await stage.boundingBox();
    expect(media.width/media.height).toBeCloseTo(16/9,1);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(901);
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await stage.screenshot({path:`docs/logo-qa/video-${width}.png`});
    await page.evaluate(() => LHF.logoIntro.resume());await released(page);expect((await report(page)).reason).toBe('ready');
  }
});

test('ready content keeps a readable three-second movie and does not replay within the session', async ({page}) => {
  await page.goto('/?lang=en#/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('.lhf-logo-stage video')).toBeVisible();
  await page.evaluate(() => {const video=document.querySelector('.lhf-logo-stage video');window.__introEnded=false;window.__introRates=[video.playbackRate];video.addEventListener('ratechange',()=>window.__introRates.push(video.playbackRate));video.addEventListener('ended',()=>window.__introEnded=true,{once:true});});
  await released(page);await expect(page.locator('#main h1')).toBeVisible();
  const result = await report(page);
  expect(result.reason).toBe('ready');expect(result.playback).toBe('ended');expect(result.media).toBe('video');expect(result.progress).toBe(100);
  expect(result.elapsed).toBeGreaterThanOrEqual(3000);expect(result.elapsed).toBeLessThan(4300);expect(await page.evaluate(() => window.__introEnded)).toBe(true);const rates=await page.evaluate(()=>window.__introRates);expect(Math.max(...rates)).toBeGreaterThan(1);expect(Math.max(...rates)).toBeLessThanOrEqual(4);expect(Math.min(...rates)).toBeGreaterThanOrEqual(.5);
  expect(await page.evaluate(() => sessionStorage.getItem('lhf.logo.intro.v5'))).toBe('1');
  const repeatMedia = [];page.on('request',request => {if ([movie,poster].includes(new URL(request.url()).pathname))repeatMedia.push(request.url());});
  await page.reload();await expect(page.locator('#main h1')).toBeVisible();await expect(page.locator(intro)).toHaveCount(0);
  await page.evaluate(() => LHF.router.navigate('/custom'));await expect(page.locator('#main h1')).toBeVisible();await expect(page.locator(intro)).toHaveCount(0);expect(repeatMedia).toEqual([]);
});

test('the loader offers no skip action in either language and restores focus after automatic completion', async ({page}) => {
  for (const language of ['en','th']) {
    await page.goto('/?lang='+language+'&intro=1#/', {waitUntil:'domcontentloaded'});
    const overlay=page.locator(intro);await expect(overlay).toBeVisible();await page.evaluate(() => LHF.logoIntro.setFrame(400));
    await expect(overlay.getByRole('button')).toHaveCount(0);await expect(overlay).not.toContainText(/Skip animation|ข้ามภาพเคลื่อนไหว/);
    await expect(overlay).toBeFocused();expect(await page.locator('#main').evaluate(element=>element.inert)).toBe(true);
    for (const key of ['Tab','Shift+Tab','Enter','Escape']) {
      await page.keyboard.press(key);await expect(overlay).toBeVisible();await expect(overlay).toBeFocused();
      expect(await page.locator('#main').evaluate(element=>element.inert)).toBe(true);
    }
    await page.evaluate(() => LHF.logoIntro.resume());await released(page);expect((await report(page)).reason).toBe('ready');
    await expect(page.locator('#main h1')).toBeVisible();await expect(page.locator('#skiplink')).toBeFocused();
  }
  // A settled replay must restore the exact prior focus and prior inert flags.
  await page.evaluate(() => {document.querySelector('#toasts').inert=true;document.querySelector('#skiplink').focus();LHF.logoIntro.replay();});
  await expect(page.locator(intro)).toBeVisible();await expect(page.locator(intro)).toBeFocused();await released(page);
  expect((await report(page)).reason).toBe('ready');expect(await page.locator('#toasts').evaluate(element=>element.inert)).toBe(true);await expect(page.locator('#skiplink')).toBeFocused();
});

test('reduced motion makes no intro media requests and keeps direct product and custom routes usable', async ({page}) => {
  const requested = [];page.on('request',request=>{if([movie,poster].includes(new URL(request.url()).pathname))requested.push(request.url());});
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const route of ['/flowers/white-rose','/custom']) {
    await page.goto('/?lang=en&intro=1#'+route);await expect(page.locator('#main h1')).toBeVisible();await released(page);
    expect((await report(page)).reason).toBe('reduced-motion');expect(new URL(page.url()).hash).toBe('#'+route);
  }
  expect(requested).toEqual([]);
});

for (const failure of ['blocked','error']) {
  test(`video ${failure} shows the supplied poster and releases the page without an unhandled rejection`, async ({page}) => {
    const errors = [];page.on('pageerror',error=>errors.push(error.message));
    if (failure==='blocked') await page.addInitScript(() => {HTMLMediaElement.prototype.play=()=>Promise.reject(new DOMException('Synthetic autoplay rejection','NotAllowedError'));});
    else await page.route('**'+movie,route=>route.abort('failed'));
    await replay(page);
    const fallback = page.locator('.lhf-logo-poster');await expect(fallback).toBeVisible();await expect(fallback).toHaveAttribute('src',poster);
    await released(page);await expect(page.locator('#main h1')).toBeVisible();
    const result=await report(page);expect(result.reason).toBe('ready');expect(result.media).toBe('poster');expect(result.playback).toBe(failure);expect(result.elapsed).toBeGreaterThanOrEqual(550);expect(result.elapsed).toBeLessThan(6800);expect(errors).toEqual([]);
  });
}

test('failure of both supplied media assets still releases the usable storefront', async ({page}) => {
  await page.route('**'+movie,route=>route.abort('failed'));
  await page.route('**'+poster,route=>route.abort('failed'));
  await replay(page);await released(page);await expect(page.locator('#main h1')).toBeVisible();
  const result=await report(page);expect(result.media).toBe('poster');expect(result.playback).toBe('error');expect(result.elapsed).toBeLessThan(6800);await expect(page.locator('#skiplink')).toBeFocused();
});

test('a movie request that never settles cannot trap the page or keyboard focus', async ({page}) => {
  let unblock;const gate=new Promise(resolve=>{unblock=resolve;});
  await page.route('**'+movie,async route=>{await gate;await route.abort('failed').catch(()=>{});});
  try {
    await replay(page);await released(page);await expect(page.locator('#main h1')).toBeVisible();
    const result=await report(page);expect(['budget','ready']).toContain(result.reason);expect(result.elapsed).toBeLessThan(6800);expect(['stalled','error']).toContain(result.playback);await expect(page.locator('#skiplink')).toBeFocused();
  } finally {unblock();}
});

test('the movie holds before its baked 100 percent frame while the hero loads, then finishes when ready', async ({page}) => {
  let release;const gate=new Promise(resolve=>{release=resolve;});let requested=false;
  await page.route('**/img/hr_p11_box_congrats_1490__*',async route=>{requested=true;await gate;await route.continue();});
  await page.addInitScript(()=>{const Native=window.ResizeObserver;window.ResizeObserver=class extends Native{constructor(callback){super((entries,observer)=>{if(entries[0]?.target.closest('.hero-media'))setTimeout(()=>callback(entries,observer),500);else callback(entries,observer);});}};});
  try {
    await replay(page);expect(await page.locator('.hero-media img.hi').getAttribute('src')).toBeNull();expect(await page.locator('.hero-media img.lq').evaluate(element=>element.complete&&element.naturalWidth>0)).toBe(true);
    expect(await page.evaluate(()=>LHF.logoIntro.state.milestones.criticalImage)).toBe(false);
    await expect.poll(()=>requested).toBe(true);await expect(page.locator('.hero-media img.hi')).toHaveAttribute('src',/hr_p11_box_congrats/);
    await expect.poll(()=>page.evaluate(()=>LHF.logoIntro.state?.progress)).toBe(80);expect(await page.locator('.hero-media img.hi').evaluate(element=>element.naturalWidth)).toBe(0);await expect(page.locator(intro)).toHaveAttribute('data-ready','false');
    const elapsed=await page.evaluate(()=>LHF.logoIntro.state.elapsed);await page.waitForTimeout(Math.max(0,4250-elapsed));
    await expect(page.locator(intro)).toBeVisible();const held=await page.locator('.lhf-logo-stage video').evaluate(video=>({time:video.currentTime,ended:video.ended}));expect(held.time).toBeGreaterThanOrEqual(2.95);expect(held.time).toBeLessThanOrEqual(3.05);expect(held.ended).toBe(false);expect(await page.evaluate(()=>LHF.logoIntro.state.progress)).toBe(80);expect(await page.evaluate(()=>LHF.logoIntro.state.playback)).toBe('waiting-for-page');
    const releaseAt=await page.evaluate(()=>LHF.logoIntro.state.elapsed);release();await released(page);const result=await report(page);expect(result.reason).toBe('ready');expect(result.playback).toBe('ended');expect(result.elapsed-releaseAt).toBeLessThan(1300);expect(result.milestones.criticalImage).toBe(true);expect(result.progress).toBe(100);
  } finally {release();}
});

test('blocked fonts and a failed photograph cannot trap otherwise healthy video playback', async ({page}) => {
  await page.route('**/*',route=>/fonts\.(googleapis|gstatic)\.com|hr_p11_box_congrats/.test(route.request().url())?route.abort():route.continue());
  await page.addInitScript(()=>{HTMLImageElement.prototype.decode=()=>Promise.reject(new Error('Synthetic decode failure'));});
  await replay(page);await released(page);await expect(page.locator('#main h1')).toBeVisible();const result=await report(page);expect(result.reason).toBe('ready');expect(result.progress).toBe(100);expect(result.elapsed).toBeLessThan(6800);
});

test('a critical image that never decodes keeps readiness honest until the bounded fallback', async ({page}) => {
  await page.addInitScript(()=>{HTMLImageElement.prototype.decode=function(){return this.src.includes('/media/')?Promise.resolve():new Promise(()=>{});};});
  await replay(page);await page.waitForTimeout(250);
  expect(Number(await page.locator('[role=progressbar]').getAttribute('aria-valuenow'))).toBeLessThan(100);
  await released(page);const result=await report(page);expect(result.reason).toBe('budget');expect(result.progress).toBeLessThan(100);expect(result.elapsed).toBeLessThan(6800);
});

test('direct product entry remains intact and progress announces only loading and ready', async ({page}) => {
  await replay(page,'/flowers/white-rose');
  await page.evaluate(()=>{window.logoStatusChanges=[];const status=document.querySelector('.lhf-logo-sr');window.logoStatusChanges.push(status.textContent);new MutationObserver(()=>window.logoStatusChanges.push(status.textContent)).observe(status,{childList:true,subtree:true,characterData:true});});
  await released(page);await expect(page.locator('#main h1')).toContainText('White Rose');expect(new URL(page.url()).hash).toBe('#/flowers/white-rose');
  const result=await report(page);expect(result.reason).toBe('ready');expect(result.progress).toBe(100);const messages=await page.evaluate(()=>window.logoStatusChanges);expect(messages.length).toBeLessThanOrEqual(2);expect(messages.some(text=>/\d+%/.test(text))).toBe(false);
});

test('an application exception releases the intro and presents an honest retry when no route exists', async ({page}) => {
  await replay(page);await page.evaluate(()=>{document.querySelector('#main').replaceChildren();document.querySelector('#main').removeAttribute('data-route');window.dispatchEvent(new ErrorEvent('error',{message:'Synthetic application error'}));});
  await released(page);await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();expect((await report(page)).reason).toBe('application-error');
});

test('a missing route reaches the bounded retry fallback without reporting 100 percent', async ({page}) => {
  await page.route(/\/(?:core\/router|storefront)\.js(?:\?.*)?$/,async route=>{const response=await route.fetch();let body=await response.text();if(route.request().url().includes('/storefront.js')){const marker='/* ---- app.js ---- */';expect(body).toContain(marker);body=body.replace(marker,'LHF.router.start=()=>{};\n'+marker);}else body+='\nLHF.router.start=()=>{};';await route.fulfill({response,body});});
  await replay(page);await released(page);await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();const result=await report(page);expect(result.reason).toBe('route-unavailable');expect(result.progress).toBeLessThan(100);expect(result.elapsed).toBeLessThan(6800);
});
