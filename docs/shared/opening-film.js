/* The opening film, shared by the website (logo-intro.js) and the Studio (studio/opening.js).
   The opening IS the supplied film, little-house-flower-loading-v5-1080p.mp4 (4.4 s, the owner's file, unchanged).
   - It plays once, from its first frame, at its own speed: never held, slowed, sped up or looped.
   - It is never on screen longer than the film: the cover's fade runs over the film's last, still 100% frame
     and the cover is gone when the film ends.
   - It is never replaced by a picture. Until the film moves the cover is plain paper in the film's own colour.
     If it cannot start within START_WAIT_MS of the page being visible (a device that refuses video by itself,
     a slow network, a missing file) or stops moving, the cover closes and the page shows without an opening.
   The page shell starts the film's download before the application loads (window.LHF_OPENING_FILM). */
(function(){
'use strict';
const FILM='/Little-House-Flower/media/little-house-flower-loading-v5-1080p.mp4';
const FILM_MS=4400,START_WAIT_MS=2000,STALL_MS=1200,FADE_MS=180;

function configure(video){
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';
  video.autoplay=false;video.loop=false;video.controls=false;video.disablePictureInPicture=true;
  video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.setAttribute('tabindex','-1');
  return video;
}
// The element the page shell made early, if any; otherwise a new one.
function element(){
  const early=window.LHF_OPENING_FILM;window.LHF_OPENING_FILM=null;
  if(early instanceof HTMLVideoElement&&!early.error)return configure(early);
  const video=configure(document.createElement('video'));video.src=FILM;return video;
}
// A page that will not show the opening lets the early download go.
function discard(){
  const early=window.LHF_OPENING_FILM;window.LHF_OPENING_FILM=null;
  if(early instanceof HTMLVideoElement){early.removeAttribute('src');early.load();}
}

function run(stage,{onEnd}={}){
  const video=element();video.classList.add('lhf-logo-video');stage.append(video);
  const state={playback:'waiting',reason:null,timeline:0,startDelay:null,duration:FILM_MS/1000};
  let over=false,began=null,startedAt=null,lastTime=-1,lastMove=0,waitTimer=null,endTimer=null,safety=null,poll=null,lastAttempt=-Infinity;
  const now=()=>performance.now();
  const filmMs=()=>Number.isFinite(video.duration)&&video.duration>0?video.duration*1000:FILM_MS;

  function close(reason){
    if(over)return false;over=true;state.reason=reason;state.timeline=video.currentTime*1000;
    clearTimeout(waitTimer);clearTimeout(endTimer);clearTimeout(safety);clearInterval(poll);
    document.removeEventListener('visibilitychange',visibility);
    return true;
  }
  function end(reason){if(close(reason))onEnd?.(reason,state);}
  function attempt(){
    if(over||document.hidden)return;
    lastAttempt=now();
    let promise;
    try{promise=video.play();}catch(error){promise=Promise.reject(error);}
    Promise.resolve(promise).catch(error=>{
      if(over||startedAt!==null)return;
      // A device that refuses video by itself (iPhone Low Power Mode, a browser setting) will not change its mind
      // while the cover waits: open the page now rather than show a frozen picture.
      if(error?.name==='NotAllowedError'&&!document.hidden){state.playback='refused';end('film-refused');return;}
      // Interrupted (the tab was hidden, a new load): the poll tries again while the wait lasts.
      state.playback='retrying';
    });
  }
  function check(){
    if(over)return;
    const t=video.currentTime;state.timeline=t*1000;
    if(startedAt===null){
      if(t>0&&!video.paused){
        startedAt=now()-t*1000;state.startDelay=startedAt-began;state.playback='playing';lastTime=t;lastMove=now();
        clearTimeout(waitTimer);
        // the wall clock agrees with the film: whatever the network does, the cover is gone when the film's length is up
        endTimer=setTimeout(()=>end('film-length'),Math.max(0,filmMs()-FADE_MS-t*1000));
      }else if(video.paused&&video.readyState>=2&&now()-lastAttempt>250)attempt();
      return;
    }
    if(video.ended||t*1000>=filmMs()-FADE_MS){state.playback='ended';end('film-ended');return;}
    if(t!==lastTime){lastTime=t;lastMove=now();}
    else if(now()-lastMove>STALL_MS){state.playback='stalled';end('film-stalled');}
  }
  function begin(){
    if(began!==null||over)return;
    began=now();
    waitTimer=setTimeout(()=>{if(startedAt===null){state.playback=video.error?'error':'not-started';end('film-not-started');}},START_WAIT_MS);
    safety=setTimeout(()=>end('film-limit'),START_WAIT_MS+FILM_MS);
    poll=setInterval(check,50);
    attempt();
  }
  function visibility(){
    if(over||document.hidden)return;
    if(began===null)begin();else if(video.paused)attempt();
  }
  video.addEventListener('playing',check);video.addEventListener('timeupdate',check);
  video.addEventListener('ended',()=>{if(!over){state.playback='ended';end('film-ended');}});
  video.addEventListener('error',()=>{if(!over){state.playback='error';end('film-error');}});
  document.addEventListener('visibilitychange',visibility);
  // A page opened in a background tab waits until it is seen; the film is not spent unseen.
  if(!document.hidden)begin();
  // stop() is the owner taking the cover away; it does not call onEnd
  return {video,state,stop(){close('stopped');video.pause();video.removeAttribute('src');video.load();}};
}

window.LHFOpeningFilm=Object.freeze({FILM,FILM_MS,START_WAIT_MS,FADE_MS,run,discard});
})();
