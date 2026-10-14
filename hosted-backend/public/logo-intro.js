/* The website's opening: the supplied v5 brand film over the page while it loads. Kept separate from routing and
   shop operations. How the film plays (and why it is never a still picture) is in shared/opening-film.js.
   Homepage loads always play it; other routes once per browser session; never with reduced motion. */
(function(){
'use strict';
const SESSION_KEY='lhf.logo.intro.v5';
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
 const film=window.LHFOpeningFilm;
 if(!film)return null;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){film.discard();markSeen();lastReport={reason:'reduced-motion',elapsed:0,milestones:{},progress:0};return null;}
 // Homepage reloads always replay; other routes keep their once-per-session opening.
 if(!demo&&seen()&&LHF.router.parse(location.hash).path!=='/'){film.discard();return null;}
 const begun=performance.now(),milestones={shell:false,logo:false,criticalImage:false,route:false};
 const state={elapsed:0,timeline:0,progress:0,milestones,reason:null,demo,media:'video',playback:'waiting',startDelay:null,duration:film.FILM_MS/1000};
 const overlay=elem('div','lhf-logo-intro');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('tabindex','-1');overlay.setAttribute('aria-label',tr('ยินดีต้อนรับสู่ลิตเติลเฮาส์ฟลาวเวอร์','Welcome to Little House Flower'));
 const stage=elem('div','lhf-logo-stage');
 // Keep the supplied artwork intact; the film's decorative percentage is not network readiness.
 stage.setAttribute('role','img');stage.setAttribute('aria-label','Little House Flower — Represent your love');
 const number=elem('span','lhf-logo-progress','0%');number.setAttribute('role','progressbar');number.setAttribute('aria-valuemin','0');number.setAttribute('aria-valuemax','100');number.setAttribute('aria-valuenow','0');number.setAttribute('aria-label',tr('ความพร้อมของหน้าเว็บ','Page readiness'));
 const caption=elem('span','lhf-logo-progress-label',tr('กำลังเตรียมหน้าเว็บ','Preparing your visit'));
 const announce=elem('span','lhf-logo-sr',tr('กำลังเตรียมหน้าเว็บ','Preparing the page'));announce.setAttribute('role','status');announce.setAttribute('aria-live','polite');
 overlay.append(stage,number,caption,announce);
 const previous=document.activeElement;
 const background=[...document.body.children].map(el=>[el,el.inert]);
 let finished=false,dismissing=false,observer=null,criticalStarted=false,criticalCleanup=null,player=null;
 function finish(reason){
  if(finished)return;finished=true;
  player?.stop();
  const f=player?.state;
  state.reason=reason;state.elapsed=performance.now()-begun;
  state.timeline=f?.timeline??0;state.playback=f?.playback??'none';state.startDelay=f?.startDelay??null;
  // 'video' only if the film actually moved on screen; otherwise the page opened without an opening
  state.media=f?.startDelay!=null?'video':'none';
  observer?.disconnect();criticalCleanup?.();window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);overlay.remove();
  background.forEach(([el,inert])=>{if(el.isConnected)el.inert=inert;});
  if(previous&&previous!==document.body&&previous.isConnected&&!previous.inert){previous.focus({preventScroll:true});}
  else {const entry=document.querySelector('#skiplink');entry?.focus({preventScroll:true});}
  // the page goes on loading behind the opening; only if it is still empty a while later does it offer Retry and LINE
  if(!milestones.route)setTimeout(safeFallback,6000);
  markSeen();running=null;lastReport=structuredClone(state);document.dispatchEvent(new CustomEvent('lhf:intro-dismissed',{detail:lastReport}));
 }
 function dismiss(reason){if(finished||dismissing)return;dismissing=true;overlay.classList.add('is-dismissing');setTimeout(()=>finish(reason),film.FADE_MS);}
 function onError(){safeFallback();finish('application-error');}
 overlay.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();overlay.focus({preventScroll:true});}});
 background.forEach(([el])=>{el.inert=true;});document.body.append(overlay);overlay.focus({preventScroll:true});running=state;
 window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
 function mark(name){
  if(finished||milestones[name])return;milestones[name]=true;
  state.progress=(milestones.shell?40:0)+(milestones.logo?20:0)+(milestones.criticalImage?20:0)+(milestones.route?20:0);
  number.textContent=state.progress+'%';number.setAttribute('aria-valuenow',String(state.progress));
  if(state.progress===100){announce.textContent=tr('หน้าเว็บพร้อมแล้ว','Page ready');caption.textContent=tr('ยินดีต้อนรับ','Welcome');}
 }
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
 // The film decides when the cover goes: at its end, or at once if it cannot play. The page loads behind it.
 player=film.run(stage,{onEnd:reason=>dismiss(reason)});
 player.video.addEventListener('loadeddata',()=>mark('logo'),{once:true});
 if(player.video.readyState>=2)mark('logo');
 return state;
}
LHF.localIntro=()=>start({demo:forced});
// Local-only inspection tooling. No route change, data mutation or live request.
LHF.logoIntro={replay(){return local?start({demo:true}):null;},get report(){return lastReport;},get state(){return running;}};
document.addEventListener('lhf:replay-intro',()=>{if(local)LHF.logoIntro.replay();});
})();
