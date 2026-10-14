/* Supplied v5 brand film. Kept separate from routing and shop operations. */
(function(){
'use strict';
const SESSION_KEY='lhf.logo.intro.v5';
const VIDEO='/media/little-house-flower-loading-v5-1080p.mp4';
const POSTER='/media/little-house-flower-v5-poster-1080p.png';
const MAX_WAIT=6500;
// The supplied film reaches its baked-in 100% at about 3.3s. Hold at ~96% while the page loads.
const MIN_ANIMATION=3000,READY_FINISH=650,HOLD_FRACTION=3/4.4;
const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
const query=new URLSearchParams(location.search);
const forced=local&&query.get('intro')==='1';
const tr=(th,en)=>LHF.i18n?.lang==='th'?th:en;
let running=null,lastReport=null;
function seen(){try{return sessionStorage.getItem(SESSION_KEY)==='1';}catch{return false;}}
function markSeen(){try{sessionStorage.setItem(SESSION_KEY,'1');}catch{}}
function elem(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;}
function safeFallback(){
 const main=document.querySelector('#main');
 if(!main||main.children.length)return;
 const box=elem('section','lhf-logo-error');
 box.append(elem('h1','', 'Little House Flower'),elem('p','',tr('หน้าเว็บยังไม่พร้อม กรุณาลองอีกครั้ง หรือติดต่อร้านผ่าน LINE','The page could not finish loading. Please retry or contact the shop through LINE.')));
 const retry=elem('button','',tr('ลองอีกครั้ง','Retry'));retry.type='button';retry.addEventListener('click',()=>location.reload());
 const contact=elem('a','','LINE @littlehouseflower');contact.href='https://lin.ee/2RYsFwz';
 box.append(retry,contact);main.append(box);
}
function start({demo=false}={}){
 document.querySelector('#loader')?.remove();
 if(running)return running;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){markSeen();lastReport={reason:'reduced-motion',elapsed:0,milestones:{},progress:0};return null;}
 if(!demo&&seen())return null;
 const begun=performance.now(),milestones={shell:false,logo:false,criticalImage:false,route:false};
 const state={elapsed:0,timeline:0,progress:0,milestones,reason:null,demo,hold:null,media:'video',playback:'loading',duration:null};
 const overlay=elem('div','lhf-logo-intro');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('tabindex','-1');overlay.setAttribute('aria-label',tr('ยินดีต้อนรับสู่ลิตเติลเฮาส์ฟลาวเวอร์','Welcome to Little House Flower'));
 const stage=elem('div','lhf-logo-stage');
 // Keep the supplied artwork intact; the film's decorative percentage is not network readiness.
 stage.setAttribute('role','img');stage.setAttribute('aria-label','Little House Flower — Represent your love');
 const video=elem('video','lhf-logo-video'),poster=elem('img','lhf-logo-poster');
 video.muted=true;video.defaultMuted=true;video.autoplay=true;video.playsInline=true;video.preload='auto';video.controls=false;video.loop=false;video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.disablePictureInPicture=true;
 // The supplied poster is the final 100% frame. Reserve it for fallback to avoid a 100-to-0 flash.
 poster.alt='';poster.width=1920;poster.height=1080;poster.hidden=true;poster.src=POSTER;stage.append(video,poster);
 const number=elem('span','lhf-logo-progress','0%');number.setAttribute('role','progressbar');number.setAttribute('aria-valuemin','0');number.setAttribute('aria-valuemax','100');number.setAttribute('aria-valuenow','0');number.setAttribute('aria-label',tr('ความพร้อมของหน้าเว็บ','Page readiness'));
 const caption=elem('span','lhf-logo-progress-label',tr('กำลังเตรียมหน้าเว็บ','Preparing your visit'));
 const announce=elem('span','lhf-logo-sr',tr('กำลังเตรียมหน้าเว็บ','Preparing the page'));announce.setAttribute('role','status');announce.setAttribute('aria-live','polite');
 overlay.append(stage,number,caption,announce);
 const previous=document.activeElement;
 const background=[...document.body.children].map(el=>[el,el.inert]);
 let finished=false,dismissing=false,readyAt=null,raf=null,timer=null,startupTimer=null,observer=null,showValue=0,lastFrame=performance.now(),criticalStarted=false,criticalCleanup=null,fallbackAt=null,playbackEnded=false,lastVideoTime=0,lastPlaybackAt=performance.now();
 function finish(reason){
  if(finished)return;finished=true;state.reason=reason;state.elapsed=performance.now()-begun;
  clearTimeout(timer);clearTimeout(startupTimer);cancelAnimationFrame(raf);observer?.disconnect();criticalCleanup?.();window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);video.pause();video.removeAttribute('src');video.load();overlay.remove();
  background.forEach(([el,inert])=>{if(el.isConnected)el.inert=inert;});
  if(previous&&previous!==document.body&&previous.isConnected&&!previous.inert){previous.focus({preventScroll:true});}
  else {const entry=document.querySelector('#skiplink');entry?.focus({preventScroll:true});}
  markSeen();running=null;const {seek,resume,...report}=state;lastReport=structuredClone(report);document.dispatchEvent(new CustomEvent('lhf:intro-dismissed',{detail:lastReport}));
 }
 function dismiss(reason){if(finished||dismissing)return;dismissing=true;overlay.classList.add('is-dismissing');setTimeout(()=>finish(reason),180);}
 function onError(){safeFallback();finish('application-error');}
 overlay.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();overlay.focus({preventScroll:true});}});
 background.forEach(([el])=>{el.inert=true;});document.body.append(overlay);overlay.focus({preventScroll:true});running=state;
 // Arm cleanup before asynchronous work so failed assets or other scripts cannot trap focus.
 timer=setTimeout(()=>{safeFallback();finish(milestones.route?'budget':'route-unavailable');},MAX_WAIT);
 window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
 function mark(name){if(finished||milestones[name])return;milestones[name]=true;state.progress=(milestones.shell?40:0)+(milestones.logo?20:0)+(milestones.criticalImage?20:0)+(milestones.route?20:0);if(state.progress===100&&readyAt===null){readyAt=performance.now();announce.textContent=tr('หน้าเว็บพร้อมแล้ว','Page ready');caption.textContent=tr('ยินดีต้อนรับ','Welcome');}}
 function criticalImage(){
  if(criticalStarted)return;criticalStarted=true;
  // The inline LQIP is already decoded, but is not the critical photograph.
  const hero=document.querySelector('#main .hero-media img.hi')||document.querySelector('#main img[fetchpriority="high"]:not(.lq)')||document.querySelector('#main img[loading="eager"]:not(.lq):not([src^="data:"])');
  if(!hero){mark('criticalImage');return;}
  let settled=false,decoding=false;
  criticalCleanup=()=>{hero.removeEventListener('load',loaded);hero.removeEventListener('error',settle);};
  function settle(){if(finished||settled)return;settled=true;criticalCleanup();if(!hero.naturalWidth){const holder=hero.closest('.hero-media')||hero.parentElement;if(holder){holder.dataset.introImageFallback='true';holder.style.backgroundColor='#eeeae2';}hero.dataset.imageFallback='true';}mark('criticalImage');}
  function loaded(){if(finished||decoding)return;decoding=true;if(typeof hero.decode==='function')hero.decode().then(settle,settle);else settle();}
  // ResizeObserver supplies src after layout. Calling decode on the empty
  // element rejects immediately, so wait for its real load/error first.
  hero.addEventListener('load',loaded,{once:true});hero.addEventListener('error',settle,{once:true});
  if((hero.currentSrc||hero.getAttribute('src')||hero.getAttribute('srcset'))&&hero.complete){if(hero.naturalWidth)loaded();else settle();}
 }
 function check(){
  const main=document.querySelector('#main');
  if(main&&document.querySelector('header'))mark('shell');
  if(main?.children.length&&main.dataset.route){mark('route');criticalImage();}
 }
 observer=new MutationObserver(check);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-route']});check();
 function usePoster(reason){
  if(finished||state.media==='poster')return;
  state.media='poster';state.playback=reason;fallbackAt=performance.now();clearTimeout(startupTimer);video.pause();video.hidden=true;video.removeAttribute('src');video.load();poster.hidden=false;
  const settle=()=>{if(finished)return;if(!poster.naturalWidth){poster.hidden=true;stage.append(elem('span','lhf-logo-text-fallback','Little House Flower'));}mark('logo');};
  if(poster.complete)settle();else{poster.addEventListener('load',settle,{once:true});poster.addEventListener('error',settle,{once:true});}
 }
 function play(){
  if(finished||state.media!=='video')return;
  try{const promise=video.play();promise?.catch(()=>usePoster('blocked'));}catch{usePoster('blocked');}
 }
 function syncPlayback(now){
  if(state.media!=='video'||state.hold!==null||!Number.isFinite(video.duration))return;
  if(readyAt===null){
   const holdAt=video.duration*HOLD_FRACTION;
   if(video.currentTime>=holdAt){video.pause();if(video.currentTime>holdAt)video.currentTime=holdAt;state.playback='waiting-for-page';}
   return;
  }
  if(playbackEnded)return;
  // Keep a calm minimum viewing time, then complete in step with actual page readiness.
  const finishBy=Math.max(begun+MIN_ANIMATION,readyAt+READY_FINISH);
  const rate=Math.max(.5,Math.min(4,(video.duration-video.currentTime)/Math.max(.1,(finishBy-now)/1000)));
  if(Math.abs(video.playbackRate-rate)>.04)video.playbackRate=rate;
  if(state.playback==='waiting-for-page'){state.playback='playing';lastPlaybackAt=now;play();}
 }
 video.addEventListener('loadedmetadata',()=>{if(!finished)state.duration=video.duration;});
 video.addEventListener('loadeddata',()=>{if(!finished&&state.media==='video')mark('logo');});
 video.addEventListener('playing',()=>{if(finished||state.media!=='video')return;clearTimeout(startupTimer);state.playback='playing';lastPlaybackAt=performance.now();});
 video.addEventListener('ended',()=>{if(finished||state.media!=='video')return;if(readyAt===null){video.currentTime=video.duration*HOLD_FRACTION;video.pause();state.playback='waiting-for-page';return;}playbackEnded=true;state.playback='ended';mark('logo');});
 video.addEventListener('error',()=>usePoster('error'));
 // A blocked request or a play() promise that never settles must not cover the shop indefinitely.
 startupTimer=setTimeout(()=>usePoster('stalled'),1800);
 video.src=VIDEO;play();
 function tick(now){
  if(finished)return;state.elapsed=now-begun;
  const dt=Math.min(50,now-lastFrame);lastFrame=now;
  syncPlayback(now);
  state.timeline=video.currentTime*1000;
  if(state.media==='video'&&state.playback==='playing'&&!playbackEnded&&state.hold===null){
   if(video.currentTime!==lastVideoTime){lastVideoTime=video.currentTime;lastPlaybackAt=now;}
   else if(now-lastPlaybackAt>1800)usePoster('stalled');
  }
  showValue=Math.min(state.progress,showValue+dt*.24);const display=Math.round(showValue);number.textContent=display+'%';number.setAttribute('aria-valuenow',String(display));
  overlay.dataset.timeline=String(Math.round(state.timeline));overlay.dataset.ready=String(state.progress===100);overlay.dataset.media=state.media;
  const artworkDone=playbackEnded&&state.elapsed>=MIN_ANIMATION||state.media==='poster'&&now-fallbackAt>=350&&state.elapsed>=600;
  if(artworkDone&&readyAt!==null&&state.hold===null)dismiss('ready');
  raf=requestAnimationFrame(tick);
 }
 raf=requestAnimationFrame(tick);
 state.seek=ms=>{state.hold=Math.max(0,Math.min((Number.isFinite(video.duration)?video.duration:4.4)*1000,Number(ms)||0));video.pause();video.currentTime=state.hold/1000;state.timeline=state.hold;};
 state.resume=()=>{state.hold=null;lastPlaybackAt=performance.now();play();};
 return state;
}
LHF.localIntro=()=>start({demo:forced});
// Local-only inspection tooling. No route change, data mutation or live request.
LHF.logoIntro={replay(){return local?start({demo:true}):null;},get report(){return lastReport;},get state(){return running;},setFrame(ms){if(local&&running){running.seek(ms);return true;}return false;},resume(){if(local&&running)running.resume();}};
document.addEventListener('lhf:replay-intro',()=>{if(local)LHF.logoIntro.replay();});
})();
