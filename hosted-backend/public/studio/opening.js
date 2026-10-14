/* The Studio's opening: the same supplied film as the website (shared/opening-film.js, where the rules are),
   over the Studio while it loads. It plays on every load of the Studio, never with reduced motion. The Studio
   loads behind it and is ready to use the moment the film ends. */
(function(){
'use strict';
const film=window.LHFOpeningFilm;
if(!film)return;
if(matchMedia('(prefers-reduced-motion: reduce)').matches){film.discard();window.LHFStudioOpening={reason:'reduced-motion',media:'none'};return;}
function start(){
  const begun=performance.now();
  const overlay=document.createElement('div');overlay.className='lhf-logo-intro';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('tabindex','-1');overlay.setAttribute('aria-label','Little House Flower · The Studio');
  const stage=document.createElement('div');stage.className='lhf-logo-stage';
  stage.setAttribute('role','img');stage.setAttribute('aria-label','Little House Flower — Represent your love');
  overlay.append(stage);
  const background=[...document.body.children].map(el=>[el,el.inert]);
  background.forEach(([el])=>{el.inert=true;});
  document.body.append(overlay);overlay.focus({preventScroll:true});
  overlay.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();overlay.focus({preventScroll:true});}});
  let finished=false,dismissing=false,player=null;
  function finish(reason){
    if(finished)return;finished=true;
    player?.stop();const f=player?.state;
    overlay.remove();
    background.forEach(([el,inert])=>{if(el.isConnected)el.inert=inert;});
    window.LHFStudioOpening={reason,elapsed:performance.now()-begun,timeline:f?.timeline??0,playback:f?.playback??'none',startDelay:f?.startDelay??null,media:f?.startDelay!=null?'video':'none'};
    document.dispatchEvent(new CustomEvent('lhf:studio-opening-dismissed',{detail:window.LHFStudioOpening}));
  }
  function dismiss(reason){if(finished||dismissing)return;dismissing=true;overlay.classList.add('is-dismissing');setTimeout(()=>finish(reason),film.FADE_MS);}
  player=film.run(stage,{onEnd:dismiss});
}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
