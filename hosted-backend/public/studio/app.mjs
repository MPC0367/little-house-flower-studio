/* The Studio: Little House Flower's staff app. Orders first, then the production calendar and
   earnings; settings are secondary. One shared state, refreshed in the background while someone is
   using it, so every screen shows the same orders. */
import {t,lang,setLang} from './text.mjs';
import {h,clear,icon,announce,modal} from './ui.mjs';
import {time,today,longDay} from './format.mjs';
import {demoSource} from './source-demo.mjs';
import {sheetSource,savedSheet,forgetSheet} from './source-sheet.mjs';

const ACTIVE_MS=5000,IDLE_MS=30000,IDLE_AFTER=60000,STALE_AFTER=30000,BACKOFF=[5000,10000,20000,40000,60000];
const FILTERS_KEY='lhf.studio.filters.v1';

function loadFilters(){
  const base={q:'',view:'next',fulfil:'',type:'',payment:'',from:'',to:'',sort:'priority'};
  try{return {...base,...JSON.parse(sessionStorage.getItem(FILTERS_KEY)||'{}')};}catch{return base;}
}

/* ---------- shared state ---------- */
const listeners=new Map();
export const studio={
  source:null,me:null,readOnly:false,
  orders:[],loadedAt:null,lastSave:null,error:null,failures:0,retryAt:0,loading:false,
  known:new Set(),held:new Set(),
  query:loadFilters(),
  on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return ()=>listeners.get(event).delete(fn);},
  emit(event,detail){for(const fn of listeners.get(event)||[])try{fn(detail);}catch(error){console.error(error);}},
  setQuery(patch){
    const before=this.query.q;Object.assign(this.query,patch);
    try{sessionStorage.setItem(FILTERS_KEY,JSON.stringify(this.query));}catch{}
    if(patch.q!==undefined&&patch.q!==before)refresh({force:true,reset:true});
    this.emit('query');
  },
  /** after a save: put the server's copy of an order into the list without waiting for a poll */
  absorb(order){
    if(!order?.id)return;
    const at=this.orders.findIndex(o=>o.id===order.id);
    const row=compactFrom(order,at>=0?this.orders[at]:null);
    if(at>=0)this.orders[at]=row;else{this.orders.push(row);this.known.add(row.id);}
    this.emit('orders',{changed:[order.id]});
  },
  refresh:(options)=>refresh(options),
};
/** the list row the server would send, built from a full order */
function compactFrom(o,old){
  return {...(old||{}),id:o.id,ref:o.ref,date:o.date,windowLabel:o.windowLabel,fulfil:o.fulfil,status:o.status,customer:{name:o.customer?.name||old?.customer?.name||''},
    items:(o.items||[]).map(i=>({name:i.name,qty:i.qty,image:i.image})),type:o.type,preview:o.custom?.preview?.asset||old?.preview||null,style:o.custom?.config?.style||old?.style||null,
    confirmedTotal:o.confirmedTotal??null,revision:o.revision,payment:o.payment||old?.payment,createdAt:o.createdAt,historyIncomplete:o.historyIncomplete,needsDetails:o.needsDetails,deliveryIssue:o.deliveryIssue};
}

/* ---------- keeping the orders fresh ---------- */
let inFlight=null,timer=null,lastInput=Date.now();
async function refresh({force=false,reset=false}={}){
  if(inFlight){if(force)inFlight.then(()=>refresh({reset}));return inFlight;}
  if(!studio.source)return;
  clearTimeout(timer);
  studio.loading=true;studio.emit('freshness');
  inFlight=(async()=>{
    try{
      const data=await studio.source.orders({q:studio.query.q});
      const first=studio.loadedAt===null||reset;
      const incoming=data.orders||[];
      const newIds=first?[]:incoming.filter(o=>!studio.known.has(o.id)).map(o=>o.id);
      if(first){studio.known=new Set(incoming.map(o=>o.id));studio.held.clear();}
      for(const id of newIds)studio.held.add(id);
      studio.orders=incoming;studio.loadedAt=Date.now();studio.lastSave=data.lastSave;studio.conflicts=data.conflicts||0;
      studio.error=null;studio.failures=0;studio.retryAt=0;
      studio.emit('orders',{first,newIds});
      if(newIds.length)announce(t('new.arrived',{count:newIds.length}));
    }catch(error){
      studio.error=error;studio.failures++;
      studio.retryAt=Date.now()+BACKOFF[Math.min(studio.failures-1,BACKOFF.length-1)]+Math.round(Math.random()*400);
      if(error.status===401)return showSignIn();
    }finally{
      studio.loading=false;inFlight=null;studio.emit('freshness');schedule();
    }
  })();
  return inFlight;
}
/** let held-back new orders into the list (the person asked for them) */
export function releaseHeld(){for(const id of studio.held)studio.known.add(id);studio.held.clear();studio.emit('orders',{released:true});}
function schedule(){
  clearTimeout(timer);
  if(document.hidden||!studio.source)return;
  const wait=studio.failures?Math.max(0,studio.retryAt-Date.now()):(Date.now()-lastInput>IDLE_AFTER?IDLE_MS:ACTIVE_MS);
  timer=setTimeout(()=>refresh(),wait);
}
for(const type of ['pointerdown','keydown','wheel','touchstart'])window.addEventListener(type,()=>{const wasIdle=Date.now()-lastInput>IDLE_AFTER;lastInput=Date.now();if(wasIdle)refresh();},{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();else clearTimeout(timer);});
window.addEventListener('online',()=>{studio.emit('freshness');refresh();});
window.addEventListener('offline',()=>studio.emit('freshness'));
setInterval(()=>studio.emit('freshness'),10000);

/** the freshness line: when the list was loaded, what it is connected to, and any trouble */
export function freshness(){
  const at=studio.loadedAt?time(studio.loadedAt):null;
  if(!navigator.onLine)return {tone:'warn',text:t('sync.offline',{time:at||'—'})};
  if(studio.error&&studio.failures){
    const seconds=Math.max(1,Math.ceil((studio.retryAt-Date.now())/1000));
    return {tone:'warn',text:studio.loadedAt?t('sync.stale',{time:at}):t('sync.failed',{seconds}),retry:true};
  }
  if(studio.loadedAt&&Date.now()-studio.loadedAt>STALE_AFTER&&!document.hidden)return {tone:'warn',text:t('sync.stale',{time:at}),retry:true};
  if(!studio.loadedAt)return {tone:'quiet',text:t('sync.updating')};
  return {tone:'ok',text:t('sync.updated',{time:at})};
}
export const sourceLine=()=>studio.source?.kind==='sheet'?t('sync.sheet',{pending:0}):t('sync.demo');

/* ---------- routing ---------- */
const SECTIONS=['orders','calendar','earnings','settings'];
export function route(){
  const raw=decodeURIComponent(location.hash.slice(1));
  if(raw==='today'||raw==='')return {section:'orders',order:null};
  const [section,order]=raw.split('/');
  return {section:SECTIONS.includes(section)?section:'orders',order:order||null};
}
export function go(section,order=null){
  const next='#'+section+(order?'/'+encodeURIComponent(order):'');
  if(location.hash!==next)location.hash=next;else applyRoute();
}

/* ---------- the shell ---------- */
const views={
  orders:()=>import('./orders.mjs'),
  calendar:()=>import('./calendar.mjs'),
  earnings:()=>import('./earnings.mjs'),
  settings:()=>import('./settings.mjs'),
};
let mounted=null,mountedSection=null,shell=null;

function navItem(section,{compact=false}={}){
  const current=route().section===section;
  const label=t('nav.'+section);
  const count=section==='orders'?studio.orders.filter(o=>o.status==='new'||o.status==='review').length:0;
  return h('a.nav-item',{href:'#'+section,'aria-current':current?'page':null,dataset:{section}},
    icon(section,{size:compact?22:20}),h('span.nav-label',label),
    count?h('span.nav-count',{'aria-label':t('summary.new')+': '+count},String(count)):null);
}
function languageSwitch(){
  return h('div.lang-switch',{role:'group','aria-label':t('lang.label')},
    ...[['en','EN'],['th','ไทย']].map(([code,text])=>h('button.lang-option',{type:'button','aria-pressed':String(lang()===code),lang:code,onClick:()=>{if(lang()!==code)setLang(code);}},text)));
}
function installDialog(){
  modal({title:t('install.title'),body:[h('p.dialog-text',t('install.body'))],actions:[h('button.btn.primary',{type:'button',onClick:event=>event.target.closest('dialog').dispatchEvent(new Event('cancel'))},t('install.ok'))]});
}
let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
async function install(){if(installPrompt){const p=installPrompt;installPrompt=null;await p.prompt();}else installDialog();}
const websiteURL=()=>window.LHF_SHARE_CONTEXT?.customerURL||'/';

function buildShell(){
  const app=document.getElementById('app');
  const skip=document.querySelector('.skip');if(skip)skip.textContent=t('app.skip');
  const freshnessNode=h('p.freshness',{id:'freshness',role:'status'});
  const demo=studio.me?.demo?h('span.demo-badge',t('demo.badge')):null;
  const search=h('form.top-search',{role:'search',onSubmit:event=>{event.preventDefault();}},
    h('label.visually-hidden',{for:'global-search'},t('filter.search')),icon('search',{size:18}),
    h('input',{id:'global-search',type:'search',placeholder:t('filter.searchHint'),autocomplete:'off',value:studio.query.q,
      onInput:debounce(event=>{studio.setQuery({q:event.target.value.trim()});if(route().section!=='orders')go('orders');},250)}));
  const who=studio.me?(studio.me.name?studio.me.name+' · ':'')+t('role.'+(studio.me.role||'owner')):'';
  const sidebar=h('nav.sidebar',{'aria-label':t('nav.main')},
    h('a.brand',{href:'#orders'},h('span.brand-mark',{'aria-hidden':'true'},'LH'),h('span.brand-text',h('span.brand-shop',t('app.shop')),h('span.brand-app',t('app.name')))),
    h('div.nav-main',navItem('orders'),navItem('calendar'),navItem('earnings')),
    h('div.nav-foot',navItem('settings'),
      h('a.nav-item.quiet',{href:websiteURL(),target:'_blank',rel:'noopener noreferrer'},icon('external'),h('span.nav-label',t('nav.website'))),
      languageSwitch()));
  const more=h('button.icon-button.more-button',{type:'button','aria-label':t('nav.more'),'aria-haspopup':'dialog',onClick:openMore},icon('more',{size:22}));
  const topbar=h('header.topbar',
    h('a.brand.compact',{href:'#orders','aria-label':t('app.shop')+' · '+t('app.name')},h('span.brand-mark',{'aria-hidden':'true'},'LH'),h('span.brand-app',t('app.name'))),
    h('div.topbar-date',longDay(today())),
    search,
    h('div.topbar-status',freshnessNode,demo),
    who?h('div.topbar-who',{title:who},who):null,
    more);
  const tabs=h('nav.tabbar',{'aria-label':t('nav.main')},navItem('orders',{compact:true}),navItem('calendar',{compact:true}),navItem('earnings',{compact:true}));
  const banner=studio.me?.publicPreview?h('p.public-banner',icon('alert',{size:16}),t('demo.public')):null;
  const readonly=studio.readOnly?h('p.public-banner',icon('alert',{size:16}),t('readonly.banner')):null;
  const main=h('main.workspace',{id:'workspace',tabindex:'-1'},banner,readonly,h('div',{id:'view'}));
  clear(app,sidebar,h('div.main-column',topbar,main),tabs);
  shell={freshnessNode,search};
  paintFreshness();
}
function openMore(){
  const item=(label,iconName,action)=>h('button.menu-item',{type:'button',onClick:()=>{dlg.close();action();}},icon(iconName),h('span',label));
  const dlg=modal({title:t('nav.more'),className:'sheet',body:[
    h('div.menu-list',
      item(t('nav.settings'),'settings',()=>go('settings')),
      item(t('nav.install'),'plus',install),
      h('a.menu-item',{href:websiteURL(),target:'_blank',rel:'noopener noreferrer'},icon('external'),h('span',t('nav.website')))),
    h('div.menu-lang',h('span.field-label',t('lang.label')),languageSwitch()),
  ],actions:[h('button.btn.quiet',{type:'button',onClick:()=>dlg.close()},t('order.close'))]});
}
function paintFreshness(){
  if(!shell)return;
  const state=freshness();
  shell.freshnessNode.className='freshness tone-'+state.tone;
  clear(shell.freshnessNode,h('span.freshness-dot',{'aria-hidden':'true'}),h('span',state.text),
    state.retry?h('button.link-button',{type:'button',onClick:()=>refresh({force:true})},t('sync.retry')):null);
  shell.freshnessNode.title=sourceLine();
  document.querySelectorAll('.nav-item[data-section="orders"]').forEach(link=>{
    const count=studio.orders.filter(o=>o.status==='new'||o.status==='review').length;
    let badge=link.querySelector('.nav-count');
    if(!count){badge?.remove();return;}
    if(!badge){badge=h('span.nav-count');link.append(badge);}
    badge.textContent=String(count);badge.setAttribute('aria-label',t('summary.new')+': '+count);
  });
}
studio.on('freshness',paintFreshness);
studio.on('orders',paintFreshness);

let routeToken=0;
async function applyRoute(){
  const token=++routeToken,{section,order}=route();
  document.querySelectorAll('.nav-item[data-section]').forEach(a=>a.setAttribute('aria-current',a.dataset.section===section?'page':'false'));
  if(mountedSection!==section){
    mounted?.unmount?.();mounted=null;mountedSection=null;
    const module=await views[section]();
    if(token!==routeToken)return;
    const host=document.getElementById('view');clear(host);
    mounted=module.mount(host,studio);mountedSection=section;
    document.title=t('nav.'+section)+' · '+t('app.shop')+' · '+t('app.name');
  }
  const detail=await import('./order.mjs');
  if(token!==routeToken)return;
  if(order&&section!=='settings')detail.showOrder(order,section);else detail.hideOrder();
}
window.addEventListener('hashchange',applyRoute);
window.addEventListener('lhf:languagechange',()=>{
  buildShell();mounted?.unmount?.();mounted=null;mountedSection=null;applyRoute();
  import('./order.mjs').then(m=>m.refreshLanguage?.());
});

/* ---------- sign-in (only when the demo server is password-protected) ---------- */
function showSignIn(){
  const app=document.getElementById('app');
  const field=h('input.field',{id:'signin-password',type:'password',autocomplete:'current-password',required:true});
  const error=h('p.field-error',{role:'alert',hidden:true});
  const form=h('form.signin',{onSubmit:async event=>{
    event.preventDefault();error.hidden=true;
    try{await demoSource.signIn(field.value);await start();}
    catch(failure){error.textContent=t('signin.failed',{error:failure.message});error.hidden=false;field.focus();}
  }},
    h('span.brand-mark.large',{'aria-hidden':'true'},'LH'),
    h('h1.signin-title',t('signin.title')),
    h('label.field-label',{for:field.id},t('signin.password')),field,error,
    h('button.btn.primary.wide',{type:'submit'},t('signin.submit')),languageSwitch());
  clear(app,h('main.signin-page',{id:'workspace'},form));
  field.focus();
}

/* ---------- start ---------- */
export async function connect(source){
  studio.source=source;studio.orders=[];studio.loadedAt=null;studio.known=new Set();studio.held.clear();studio.error=null;studio.failures=0;
  studio.me=await source.me();
  studio.readOnly=studio.me.role==='read-only';
  mounted?.unmount?.();mounted=null;mountedSection=null;
  buildShell();await applyRoute();await refresh({force:true,reset:true});
}
async function start({useDemo=false}={}){
  const saved=useDemo?null:savedSheet();
  if(saved){
    // never fall back to demo data silently: someone could think they were working on real orders
    try{await connect(sheetSource(saved));return;}
    catch(error){
      const app=document.getElementById('app');
      clear(app,h('main.signin-page',{id:'workspace'},h('div.signin',h('span.brand-mark.large',{'aria-hidden':'true'},'LH'),
        h('h1.signin-title',t('settings.connect')),h('p.field-error',{role:'alert'},error.message),
        h('button.btn.primary.wide',{type:'button',onClick:()=>start()},t('sync.retry')),
        h('button.btn.quiet.wide',{type:'button',onClick:()=>{forgetSheet();start({useDemo:true});}},t('settings.disconnect')),languageSwitch())));
      return;
    }
  }
  try{
    const config=await demoSource.authConfig();
    if(config.passwordProtected){try{await demoSource.me();}catch(error){if(error.status===401)return showSignIn();throw error;}}
    await connect(demoSource);
  }catch(error){
    const app=document.getElementById('app');
    clear(app,h('main.signin-page',{id:'workspace'},h('div.signin',h('span.brand-mark.large',{'aria-hidden':'true'},'LH'),h('h1.signin-title',t('orders.error')),h('p',error.message),
      h('button.btn.primary',{type:'button',onClick:()=>start()},t('sync.retry')))));
  }
}
function debounce(fn,ms){let id;return (...args)=>{clearTimeout(id);id=setTimeout(()=>fn(...args),ms);};}

/* The native Mac shell asks this before closing or reloading; the order screen answers it. */
window.LHFStudioHasUnsavedChanges=()=>!!window.__lhfStudioDirty?.();
window.addEventListener('beforeunload',event=>{if(window.__lhfStudioDirty?.()&&!window.LHF_NATIVE_APP){event.preventDefault();event.returnValue='';}});
document.querySelector('.skip')?.addEventListener('click',event=>{event.preventDefault();document.getElementById('workspace')?.focus();});
if('serviceWorker' in navigator&&!window.LHF_NATIVE_APP&&!window.LHF_PAGES_APP&&location.pathname.startsWith('/studio/')){
  // network-only worker: it never stores orders, customers or pictures (sw.js)
  window.addEventListener('load',()=>navigator.serviceWorker.register('/studio/sw.js',{scope:'/studio/',updateViaCache:'none'}).catch(()=>{}));
}
start();
