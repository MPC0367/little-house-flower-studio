/* The opening film on the website and the Studio (shared/opening-film.js): it plays and moves, is on screen no
   longer than the film, is never a still picture, and lets the page go at once when the film cannot play.
   Run against the local Pages stand-in: node scripts/serve-pages.mjs, then
     LHF_PLAYWRIGHT_MODULE=<path to @playwright/test/index.mjs> node tests/opening-film.mjs
   Every /api/ call is answered in the page, so nothing reaches a back end. */
const {chromium,webkit,devices}=await import(process.env.LHF_PLAYWRIGHT_MODULE||'@playwright/test');
const B=(process.env.LHF_TEST_URL||'http://127.0.0.1:5590').replace(/\/$/,'');
const SITE=B+'/Little-House-Flower/?lang=en#/', STUDIO=B+'/little-house-flower-studio/';
// the film (4.4 s) plays a little faster than its own speed (the owner, 15 Oct 2026): 1.25×, about 3.5 s on screen
const SPEED=1.25,SCREEN_MS=4400/SPEED;
const results=[];let fails=0;
const ok=(name,cond,detail)=>{results.push((cond?'PASS ':'FAIL ')+name+(detail?'  '+detail:''));if(!cond)fails++;};
function init({refuse=false,abortFirst=false,hidden=0}={}){
  return ({refuse,abortFirst,hidden})=>{
    const qa=window.__qa={posterImgs:0,overlays:0,errors:[]};
    const origFetch=window.fetch.bind(window);
    window.fetch=(input,init)=>{const u=new URL(input instanceof Request?input.url:String(input),location.href);if(/\/api\//.test(u.pathname)){const rec=u.pathname.endsWith('/preview-recipes');return Promise.resolve(new Response(JSON.stringify(rec?{recipes:[]}:{error:'mocked'}),{status:rec?200:503,headers:{'Content-Type':'application/json'}}));}return origFetch(input,init);};
    new MutationObserver(()=>{for(const o of document.querySelectorAll('.lhf-logo-intro')){if(!o.__seen){o.__seen=1;qa.overlays++;qa.shownAt=performance.now();}if(o.querySelector('img'))qa.posterImgs++;}if(qa.shownAt&&!document.querySelector('.lhf-logo-intro')&&qa.goneAt==null)qa.goneAt=performance.now();}).observe(document,{subtree:true,childList:true});
    const orig=HTMLMediaElement.prototype.play;let calls=0;
    HTMLMediaElement.prototype.play=function(...a){calls++;if(refuse)return Promise.reject(new DOMException('refused for test','NotAllowedError'));if(abortFirst&&calls===1)return Promise.reject(new DOMException('interrupted for test','AbortError'));return orig.apply(this,a);};
    if(hidden){let h=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>h});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h?'hidden':'visible'});setTimeout(()=>{h=false;document.dispatchEvent(new Event('visibilitychange'));},hidden);}
  };
}
async function run(name,type,ctxOpts,url,{init:io={},route,expect='video',reportVar='LHF.logoIntro.report',samples=false}={}){
  const b=await type.launch();const ctx=await b.newContext(ctxOpts);await ctx.addInitScript(init(io),io);
  const req=[];ctx.on('request',r=>req.push(r.url()));
  if(route)await ctx.route(route.pattern,route.handler);
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url,{waitUntil:'commit'});
  let frames=[];
  if(samples){ // sample the film while it plays: it must move
    await p.waitForFunction(()=>{const v=document.querySelector('.lhf-logo-video');return v&&v.currentTime>0.2;},null,{timeout:8000}).catch(()=>{});
    for(let i=0;i<4;i++){frames.push(await p.evaluate(()=>{const v=document.querySelector('.lhf-logo-video');if(!v)return null;const c=document.createElement('canvas');c.width=64;c.height=36;const g=c.getContext('2d');g.drawImage(v,0,0,64,36);const d=g.getImageData(0,0,64,36).data;let s=0;for(let k=0;k<d.length;k+=4)s+=d[k];const corner=(()=>{const c2=document.createElement('canvas');c2.width=v.videoWidth;c2.height=v.videoHeight;const g2=c2.getContext('2d');g2.drawImage(v,0,0);return Array.from(g2.getImageData(8,8,1,1).data.slice(0,3));})();return {t:v.currentTime,sum:s,corner};}));await p.waitForTimeout(700);}
  }
  await p.waitForFunction(()=>window.__qa&&window.__qa.shownAt!=null&&window.__qa.goneAt!=null || (window.LHF&&window.LHF.logoIntro&&window.LHF.logoIntro.report&&window.LHF.logoIntro.report.reason==='reduced-motion') || (window.LHFStudioOpening&&window.LHFStudioOpening.reason==='reduced-motion'),null,{timeout:15000}).catch(()=>{});
  await p.waitForTimeout(300);
  const r=await p.evaluate((rv)=>{const rep=rv==='studio'?window.LHFStudioOpening:window.LHF?.logoIntro?.report;const qa=window.__qa;return {rep,overlays:qa.overlays,cover:qa.goneAt!=null?Math.round(qa.goneAt-qa.shownAt):null,posterImgs:qa.posterImgs,inertMain:(document.querySelector('#main')||document.querySelector('#app'))?.inert,overlayLeft:!!document.querySelector('.lhf-logo-intro')};},reportVar==='studio'?'studio':'site');
  const mp4=req.filter(u=>u.includes('loading-v5-1080p.mp4')).length,poster=req.filter(u=>u.includes('v5-poster')).length;
  await b.close();
  return {...r,mp4,poster,errs,frames};
}
const D={viewport:{width:1440,height:900}};
const envs=[['Chrome desktop',chromium,D],['Safari desktop',webkit,D],['Safari iPhone',webkit,devices['iPhone 13']],['Chrome Android',chromium,devices['Pixel 7']]];
for(const [n,t,o] of envs){
  const r=await run('home '+n,t,o,SITE,{samples:true});
  const moving=r.frames.filter(Boolean);const distinct=new Set(moving.map(f=>f.sum)).size;
  ok(n+': film plays, every frame, at 1.25×',r.rep?.media==='video'&&['film-ended','film-length'].includes(r.rep?.reason)&&r.rep?.speed===SPEED&&r.rep?.timeline>=4000,JSON.stringify({reason:r.rep?.reason,media:r.rep?.media,speed:r.rep?.speed,startDelay:Math.round(r.rep?.startDelay??-1),timeline:Math.round(r.rep?.timeline??-1),cover:r.cover}));
  ok(n+': the picture changes while it plays (not a still)',distinct>=3,'film times '+moving.map(f=>f.t.toFixed(2)).join(', '));
  ok(n+': on screen about 3.5 s, no longer than the film at that speed',r.rep&&r.cover!=null&&r.cover-(r.rep.startDelay||0)<=SCREEN_MS+120,'cover '+r.cover+' ms, wait '+Math.round(r.rep?.startDelay??0)+' ms');
  ok(n+': no still picture, page released, no errors',r.posterImgs===0&&r.poster===0&&r.inertMain===false&&!r.overlayLeft&&r.errs.length===0,JSON.stringify({posterImgs:r.posterImgs,posterRequests:r.poster,errs:r.errs.slice(0,2)}));
  if(n==='Chrome desktop')ok('film background matches the cover (#f6f5f3)',!!moving[0]&&moving[0].corner.every((v,k)=>Math.abs(v-[246,245,243][k])<=4),'film corner rgb '+JSON.stringify(moving[0]?.corner));
}
let r;
r=await run('refused',webkit,devices['iPhone 13'],SITE,{init:{refuse:true}});
ok('Device refuses video: page opens at once, no still',r.rep?.reason==='film-refused'&&r.rep?.media==='none'&&r.cover<600&&r.posterImgs===0&&r.inertMain===false,JSON.stringify({reason:r.rep?.reason,cover:r.cover}));
r=await run('interrupted',chromium,D,SITE,{init:{abortFirst:true}});
ok('First start interrupted: film still plays in full',r.rep?.media==='video'&&r.rep?.timeline>=4000,JSON.stringify({reason:r.rep?.reason,timeline:Math.round(r.rep?.timeline),startDelay:Math.round(r.rep?.startDelay)}));
r=await run('slow 1s',chromium,D,SITE,{route:{pattern:'**/*loading-v5-1080p.mp4',handler:async route=>{await new Promise(z=>setTimeout(z,1000));await route.continue();}}});
ok('Film 1 s late: waits, then plays in full',r.rep?.media==='video'&&r.rep?.timeline>=4000&&r.rep?.startDelay<2000,JSON.stringify({reason:r.rep?.reason,startDelay:Math.round(r.rep?.startDelay),timeline:Math.round(r.rep?.timeline),cover:r.cover}));
r=await run('slow 4s',chromium,D,SITE,{route:{pattern:'**/*loading-v5-1080p.mp4',handler:async route=>{await new Promise(z=>setTimeout(z,4000));await route.continue().catch(()=>{});}}});
ok('Film too slow (4 s): page opens after 2 s, no still',r.rep?.reason==='film-not-started'&&r.rep?.media==='none'&&r.cover<=2400&&r.posterImgs===0,JSON.stringify({reason:r.rep?.reason,cover:r.cover}));
r=await run('missing',chromium,D,SITE,{route:{pattern:'**/*loading-v5-1080p.mp4',handler:route=>route.fulfill({status:404,body:'missing'})}});
ok('Film missing: page opens quickly, no still',['film-error','film-not-started'].includes(r.rep?.reason)&&r.rep?.media==='none'&&r.cover<=2400,JSON.stringify({reason:r.rep?.reason,cover:r.cover}));
r=await run('hidden',chromium,D,SITE,{init:{hidden:1500}});
ok('Opened in a background tab: film waits until seen, then plays',r.rep?.media==='video'&&r.rep?.timeline>=4000,JSON.stringify({reason:r.rep?.reason,timeline:Math.round(r.rep?.timeline),cover:r.cover}));
r=await run('reduced',chromium,{...D,reducedMotion:'reduce'},SITE);
ok('Reduced motion: no opening and no film download',r.overlays===0&&r.mp4===0&&r.rep?.reason==='reduced-motion',JSON.stringify({overlays:r.overlays,mp4:r.mp4}));
// session rules: first non-home page plays; a second non-home load in the same session does not, and does not download the film
{const b=await chromium.launch();const ctx=await b.newContext(D);await ctx.addInitScript(init({}),{});const req=[];ctx.on('request',x=>req.push(x.url()));const p=await ctx.newPage();
 await p.goto(B+'/Little-House-Flower/?lang=en#/flowers');await p.waitForFunction(()=>window.__qa?.goneAt!=null,null,{timeout:15000}).catch(()=>{});const first=await p.evaluate(()=>window.LHF.logoIntro.report);
 const before=req.filter(u=>u.includes('loading-v5')).length;await p.reload();await p.waitForTimeout(2500);const second=await p.evaluate(()=>({overlays:window.__qa.overlays,report:window.LHF.logoIntro.report}));const after=req.filter(u=>u.includes('loading-v5')).length;
 ok('First page of a session (#/flowers) plays the film',first?.media==='video',first?.reason);
 ok('Second non-home load in the session: no opening, no film download',second.overlays===0&&after===before,JSON.stringify({overlays:second.overlays,mp4Before:before,mp4After:after}));
 await p.goto(B+'/Little-House-Flower/?lang=en#/');await p.reload();await p.waitForFunction(()=>window.__qa?.goneAt!=null,null,{timeout:15000}).catch(()=>{});const home=await p.evaluate(()=>window.LHF.logoIntro.report);
 ok('Homepage in the same session still plays',home?.media==='video',home?.reason);await b.close();}
// Studio
for(const [n,t,o] of [['Chrome desktop',chromium,D],['Safari iPhone',webkit,devices['iPhone 13']]]){
  r=await run('studio '+n,t,o,STUDIO,{reportVar:'studio',samples:true});
  const distinct=new Set(r.frames.filter(Boolean).map(f=>f.sum)).size;
  ok('Studio '+n+': film plays and moves at 1.25×, about 3.5 s',r.rep?.media==='video'&&distinct>=3&&['film-ended','film-length'].includes(r.rep?.reason)&&r.rep?.speed===SPEED&&r.cover-(r.rep.startDelay||0)<=SCREEN_MS+120,JSON.stringify({reason:r.rep?.reason,speed:r.rep?.speed,timeline:Math.round(r.rep?.timeline??-1),startDelay:Math.round(r.rep?.startDelay??-1),cover:r.cover}));
  ok('Studio '+n+': Studio usable afterwards, no still, no errors',r.inertMain===false&&!r.overlayLeft&&r.posterImgs===0&&r.errs.length===0,JSON.stringify({errs:r.errs.slice(0,2)}));
}
r=await run('studio refused',webkit,devices['iPhone 13'],STUDIO,{reportVar:'studio',init:{refuse:true}});
ok('Studio, device refuses video: opens at once',r.rep?.reason==='film-refused'&&r.cover<600,JSON.stringify({reason:r.rep?.reason,cover:r.cover}));
r=await run('studio reduced',chromium,{...D,reducedMotion:'reduce'},STUDIO,{reportVar:'studio'});
ok('Studio, reduced motion: no opening, no film download',r.overlays===0&&r.mp4===0,JSON.stringify({overlays:r.overlays,mp4:r.mp4}));
console.log(results.join('\n'));console.log(fails?fails+' FAILED':'ALL PASSED');process.exitCode=fails?1:0;
