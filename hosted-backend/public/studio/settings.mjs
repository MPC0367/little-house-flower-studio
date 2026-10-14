/* Settings: where the orders live and how the Studio reaches them, plus the few things a person can
   change. Connecting the shop's Google Sheet works like O2's own dashboard: the owner gives each
   person the Studio script's address and a personal key; the key stays on that person's device. */
import {t,lang,setLang} from './text.mjs';
import {h,clear,icon,toast} from './ui.mjs';
import {moment} from './format.mjs';
import {studio,connect} from './app.mjs';
import {demoSource} from './source-demo.mjs';
import {sheetSource,saveSheet,forgetSheet,validScriptURL,savedSheet} from './source-sheet.mjs';

export function mount(host){
  const body=h('div.settings-body');
  clear(host,h('section.view-settings',{'aria-labelledby':'set-title'},h('div.view-head',h('h1.view-title',{id:'set-title'},t('settings.title'))),body));
  let info=null,token=0;
  const card=(id,title,...children)=>h('section.settings-card',{'aria-labelledby':id},h('h2.sub-title',{id},title),...children);
  const kv=(label,value)=>value==null?null:h('div.kv',h('dt',label),h('dd',value));

  function connection(){
    const source=studio.source;
    if(source.kind==='sheet'){
      return card('set-conn',t('settings.connection'),
        h('p',icon('sheet',{size:18}),' ',t('settings.sheet',{name:studio.me?.name||'',role:t('role.'+(studio.me?.role||'staff'))})),
        h('dl.kv-list',kv(t('settings.sheetName'),studio.me?.sheetName||''),kv(t('settings.lastRead'),studio.loadedAt?moment(studio.loadedAt):t('empty')),kv(t('settings.pending'),'0')),
        h('button.btn.quiet',{type:'button',onClick:async()=>{forgetSheet();await connect(demoSource);}},t('settings.disconnect')));
    }
    const saved=savedSheet();
    const address=h('input.field',{id:'sheet-url',type:'url',inputmode:'url',autocomplete:'off',spellcheck:false,placeholder:'https://script.google.com/macros/s/…/exec',value:saved?.url||''});
    const key=h('input.field',{id:'sheet-key',type:'password',autocomplete:'off',spellcheck:false});
    const remember=h('input',{id:'sheet-remember',type:'checkbox'});
    const error=h('p.field-error',{role:'alert',hidden:true});
    const submit=h('button.btn.primary',{type:'submit'},t('settings.test'));
    const form=h('form.connect-form',{onSubmit:async event=>{
      event.preventDefault();error.hidden=true;
      const url=address.value.trim();
      if(!validScriptURL(url)){error.textContent=t('settings.badAddress');error.hidden=false;address.focus();return;}
      if(!key.value.trim()){key.focus();return;}
      submit.disabled=true;submit.textContent=t('settings.testing');
      try{
        const source=sheetSource({url,key:key.value.trim()});
        const me=await source.me();
        saveSheet({url,key:key.value.trim(),remember:remember.checked});
        toast(t('settings.connected',{name:me.sheetName||'Google Sheet',who:me.name||''}));
        await connect(source);
      }catch(failure){error.textContent=failure.message;error.hidden=false;submit.disabled=false;submit.textContent=t('settings.test');}
    }},
      h('div',h('label.field-label',{for:'sheet-url'},t('settings.address')),address),
      h('div',h('label.field-label',{for:'sheet-key'},t('settings.key')),key),
      h('label.check',remember,h('span',t('settings.remember'))),error,submit);
    return card('set-conn',t('settings.connection'),
      h('p',t('settings.demo')),
      studio.me?.publicPreview?h('p.public-banner',icon('alert',{size:16}),t('demo.public')):null,
      h('details.connect',h('summary.sub-title',t('settings.connect')),h('p.section-help',t('settings.connectHelp')),form));
  }
  function conflicts(){
    const list=info?.conflicts||[];
    return card('set-conf',t('settings.conflicts'),
      list.length?h('ul.conflict-list',list.map(c=>h('li',h('a.inline-link',{href:'#orders/'+encodeURIComponent(c.orderId)},studio.orders.find(o=>o.id===c.orderId)?.ref||c.orderId),' · ',c.reason||'',c.at?h('span.muted',' · '+moment(c.at)):null))):h('p.muted',t('settings.conflictsNone')));
  }
  function render(){
    clear(body,
      connection(),
      conflicts(),
      card('set-prev',t('settings.previews'),h('p',info?.previewProvider||t('empty'))),
      card('set-notif',t('settings.notifications'),h('p',t('settings.notificationsOff'))),
      card('set-lang',t('lang.label'),h('div.lang-switch',{role:'group','aria-label':t('lang.label')},
        ...[['en','English'],['th','ไทย']].map(([code,text])=>h('button.lang-option',{type:'button','aria-pressed':String(lang()===code),lang:code,onClick:()=>{if(lang()!==code)setLang(code);}},text)))),
      card('set-account',t('settings.account'),
        h('p',t('settings.signedInAs',{who:studio.me?.name||t('role.'+(studio.me?.role||'owner')),role:t('role.'+(studio.me?.role||'owner'))})),
        studio.source.kind==='demo'&&!studio.me?.publicPreview?h('button.btn.quiet',{type:'button',onClick:async()=>{try{await demoSource.signOut();}catch{}location.reload();}},t('settings.signOut')):null),
      card('set-app',t('settings.app'),h('p.muted',t('settings.version',{version:info?.version||studio.me?.version||'—'})),h('p.section-help',t('install.body'))));
  }
  async function load(){
    const my=++token;
    try{const data=await studio.source.settings();if(my===token){info=data;render();}}
    catch(error){if(my===token){info=null;render();toast(error.message,{tone:'warn'});}}
  }
  render();load();
  const off=studio.on('orders',()=>{});
  return {unmount(){off();token++;}};
}
