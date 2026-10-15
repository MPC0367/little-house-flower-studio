/* Small building blocks for the Studio's screens: elements, icons, announcements, dialogs. */
import {t} from './text.mjs?v=studio-20261015-7';

/** h('button.btn.primary', {onClick, type:'button', 'aria-label':…}, child, …) */
export function h(spec,attrs,...children){
  if(attrs==null||typeof attrs!=='object'||attrs instanceof Node||Array.isArray(attrs)){if(attrs!=null)children.unshift(attrs);attrs={};}
  const [tag,...classes]=spec.split('.');
  const el=document.createElement(tag||'div');
  if(classes.length)el.className=classes.join(' ');
  for(const [key,value] of Object.entries(attrs)){
    if(value==null||value===false)continue;
    if(key.startsWith('on')&&typeof value==='function')el.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='class')el.className=[el.className,value].filter(Boolean).join(' ');
    else if(key==='dataset')Object.assign(el.dataset,value);
    else if(key==='html')throw new Error('Raw HTML is not allowed');
    else if(key in el&&!key.includes('-')&&typeof value!=='string'&&key!=='list')el[key]=value;
    else el.setAttribute(key,value===true?'':String(value));
  }
  append(el,children);
  return el;
}
export function append(el,children){
  for(const child of children.flat(Infinity)){
    if(child==null||child===false)continue;
    el.append(child instanceof Node?child:document.createTextNode(String(child)));
  }
  return el;
}
export const clear=(el,...children)=>{el.replaceChildren();return append(el,children);};

/* Icons: one stroke family, drawn on a 24-unit grid, always hidden from assistive technology
   (the button or label next to them carries the words). */
const PATHS={
  orders:'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  calendar:'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  earnings:'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  close:'M18 6 6 18M6 6l12 12',
  back:'M15 18l-6-6 6-6',
  next:'M9 18l6-6-6-6',
  more:'M5 12h.01M12 12h.01M19 12h.01',
  pickup:'M4 9l1.5-5h13L20 9M4 9h16v11H4zM9 20v-6h6v6',
  delivery:'M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  phone:'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.9 2z',
  chat:'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  copy:'M9 9h11v11H9zM5 15H4V4h11v1',
  print:'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z',
  check:'M20 6 9 17l-5-5',
  alert:'M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  refresh:'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  external:'M14 3h7v7M10 14 21 3M21 14v7H3V3h7',
  image:'M4 4h16v16H4zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM20 15l-5-5L5 20',
  flower:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3c1.7 2 1.7 4 0 6-1.7-2-1.7-4 0-6zM12 15c1.7 2 1.7 4 0 6-1.7-2-1.7-4 0-6zM3 12c2-1.7 4-1.7 6 0-2 1.7-4 1.7-6 0zM15 12c2-1.7 4-1.7 6 0-2 1.7-4 1.7-6 0z',
  plus:'M12 5v14M5 12h14',
  minus:'M5 12h14',
  link:'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  sheet:'M4 3h16v18H4zM4 9h16M4 15h16M10 3v18',
};
export function icon(name,{size=20}={}){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width',size);svg.setAttribute('height',size);
  svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('icon');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',PATHS[name]||PATHS.flower);
  svg.append(path);return svg;
}

/* Announcements: one polite region, set once per meaningful result (never every poll). */
let liveRegion;
export function announce(message){
  liveRegion??=document.getElementById('studio-live');
  if(!liveRegion)return;
  liveRegion.textContent='';
  setTimeout(()=>{liveRegion.textContent=message;},30);
}
/* A short note that fades; it also goes to the live region. */
export function toast(message,{tone='info'}={}){
  const host=document.getElementById('studio-toasts');
  if(!host)return;
  const note=h('div.toast',{class:'tone-'+tone,role:'status'},message);
  host.append(note);announce(message);
  setTimeout(()=>{note.classList.add('leaving');setTimeout(()=>note.remove(),220);},2600);
}

export async function copyText(text){
  try{await navigator.clipboard.writeText(text);toast(t('copied'));return true;}
  catch{toast(t('copyFailed'),{tone:'warn'});return false;}
}

/**
 * A modal dialog. Native <dialog> keeps focus inside and closes on Escape (which we route through
 * onCancel so a half-filled form is never lost by accident). Returns {dialog, close}.
 */
export function modal({title,body=[],actions=[],onCancel,onClose,className='',labelledBy}={}){
  const heading=h('h2.dialog-title',{id:'dlg-'+Math.random().toString(36).slice(2)},title);
  const dialog=h('dialog.dialog',{class:className,'aria-labelledby':labelledBy||heading.id},
    h('div.dialog-body',heading,body),
    actions.length?h('div.dialog-actions',actions):null);
  const opener=document.activeElement;
  let closed=false;
  const close=()=>{if(closed)return;closed=true;if(dialog.open)dialog.close();dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});onClose?.();};
  dialog.addEventListener('cancel',event=>{event.preventDefault();(onCancel||close)();});
  // a browser may close a dialog itself (a second Escape skips the cancel step): tidy up the same way
  dialog.addEventListener('close',()=>{if(!closed)close();});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)(onCancel||close)();
  });
  document.body.append(dialog);dialog.showModal();
  const first=dialog.querySelector('[autofocus],input,textarea,select');
  (first||dialog.querySelector('button')||dialog).focus();
  return {dialog,close};
}

/** A reason dialog: resolves with the trimmed reason, or null if the person backs out. */
export function askReason({title,body,confirmLabel,danger=false,extra=null}){
  return new Promise(resolve=>{
    const field=h('textarea.field',{id:'reason-'+Date.now(),rows:3,maxlength:1000,required:true,'aria-describedby':'reason-help'});
    const error=h('p.field-error',{id:'reason-help',hidden:true},t('reason.required'));
    let done=false;
    const finish=value=>{if(done)return;done=true;dlg.close();resolve(value);};
    const confirm=h('button.btn',{type:'button',class:danger?'danger':'primary',onClick:()=>{
      const value=field.value.trim();
      if(!value){error.hidden=false;field.setAttribute('aria-invalid','true');field.focus();return;}
      finish({reason:value,extra:extra?.value?.()});
    }},confirmLabel);
    const dlg=modal({title,onCancel:()=>finish(null),onClose:()=>finish(null),body:[
      body?h('p.dialog-text',body):null,
      extra?.node||null,
      h('label.field-label',{for:field.id},t('reason.label')),field,error,
    ],actions:[h('button.btn.quiet',{type:'button',onClick:()=>finish(null)},t('dialog.cancel')),confirm]});
  });
}

/** A labelled chip for a status or payment state; colour is never the only signal. */
export function chip(text,tone){return h('span.chip',{class:'tone-'+tone},h('span.chip-dot',{'aria-hidden':'true'}),text);}

/* The O2 studio credit (assets/brand/o2-credit.html). Per the studio's rule it sits on the screens a
   visitor sees before the Studio opens (sign-in, connection trouble), never inside the working app.
   One name in every language; unlisted site, so noreferrer. */
const O2_MARK="M56.99 99.51A50 50 0 0 1 33.88 2.67L38 10.97A40.84 40.84 0 0 0 52.65 90.75ZM42.27 0.6A50 50 0 0 1 66.45 97.22L62.34 88.93A40.84 40.84 0 0 0 46.59 9.31ZM157.94 74.78L148.9 74.77C147.72 72.56 147.05 70.73 145.23 68.89C138.08 61.67 125.49 63.06 119.44 70.92L118.43 72.68C116.33 76.4 116.59 78.85 116.23 82.89C113.81 83.15 109.39 83.26 107.04 82.84C106.96 80.45 106.94 77.98 107.43 75.63C109.72 64.58 119.41 55.88 130.73 55.04C140.97 54.28 151.46 58.93 156.12 68.39C157.1 70.38 158.02 72.54 157.94 74.78ZM148.84 83.59C151.04 83.14 155.75 83.23 158.04 83.51C157.97 85.63 157.24 87.64 156.34 89.53C153.35 95.79 148.24 98.9 142.26 101.9C137.63 104.22 133.19 106.96 128.53 109.23C126.42 110.25 120.74 112.92 119.24 114.34C116.45 116.97 117.29 117.47 116.13 119.2L114.32 121.49C112.04 121.8 109.41 121.77 107.13 121.51C106.19 114 111.68 108.04 117.74 104.62C124.34 100.89 131.24 97.68 137.85 93.97C143.08 91.03 146.6 89.67 148.84 83.59ZM121.53 120.51C124.54 119.99 135.15 120.36 138.93 120.36C142.92 120.36 154.81 119.99 157.91 120.49L157.85 129.51C154.88 129.77 151.82 129.6 148.83 129.59L135.02 129.59C130.67 129.59 119.91 129.95 116.29 129.48C117.52 126.27 119.99 123.58 121.53 120.51Z";
export function o2Credit(){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','o2-credit__mark');svg.setAttribute('viewBox','0 0 158.1 129.7');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('fill','currentColor');path.setAttribute('d',O2_MARK);svg.append(path);
  return h('a.o2-credit',{href:'https://o2-designstudio.com/',target:'_blank',rel:'noopener noreferrer',lang:'en','aria-label':'Website by O2 Design Studio (opens in a new tab)'},h('span.o2-credit__lockup',svg,'Design Studio'));
}
