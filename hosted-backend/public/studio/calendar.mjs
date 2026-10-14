/* The production calendar: what has to be ready, day by day, by handover window. Overdue work and
   orders without a date are listed first so nothing slips. Statuses here are the shop's record,
   not courier tracking. */
import {t} from './text.mjs';
import {h,clear,icon,chip} from './ui.mjs';
import {today,addDays,weekStart,day,longDay,weekdayShort,dayNumber} from './format.mjs';
import {statusLabel,itemSummary,isOverdue,ACTIVE} from './model.mjs';
import {STATUS_TONE} from './orders.mjs';

const KEY='lhf.studio.calendar.v1';
function load(){try{return {mode:'week',date:today(),showDone:false,...JSON.parse(sessionStorage.getItem(KEY)||'{}')};}catch{return {mode:'week',date:today(),showDone:false};}}

export function mount(host,studio){
  const state=load();
  const save=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(state));}catch{}};
  const head=h('div.view-head'),body=h('div.calendar-body');
  clear(host,h('section.view-calendar',{'aria-labelledby':'cal-title'},head,body));

  function job(o){
    return h('li.job',{class:'tone-'+(STATUS_TONE[o.status]||'alert')},
      h('a.job-link',{href:'#calendar/'+encodeURIComponent(o.id)},
        h('span.job-time',o.windowLabel||''),
        h('span.job-main',h('span.job-ref',o.ref),h('span.job-name',o.customer?.name||'')),
        h('span.job-items',itemSummary(o)),
        h('span.job-meta',h('span.fulfil',icon(o.fulfil==='delivery'?'delivery':'pickup',{size:16}),t('fulfil.'+(o.fulfil==='delivery'?'delivery':'pickup'))),chip(statusLabel(o.status,o.fulfil),STATUS_TONE[o.status]||'alert'))));
  }
  const byWindow=(a,b)=>(a.windowLabel||'').localeCompare(b.windowLabel||'')||a.ref.localeCompare(b.ref);
  let drawn='';
  function render({force=false}={}){
    const signature=JSON.stringify([state,studio.query.q,[...studio.held],studio.loadedAt?1:0,studio.orders.map(o=>[o.id,o.revision,o.status,o.date,o.windowLabel])]);
    if(!force&&signature===drawn)return;
    drawn=signature;
    const now=today();
    const orders=studio.orders.filter(o=>!studio.held.has(o.id)&&(state.showDone||ACTIVE(o.status)));
    const start=state.mode==='week'?weekStart(state.date):state.date;
    const days=state.mode==='week'?Array.from({length:7},(_,i)=>addDays(start,i)):[state.date];
    const label=state.mode==='week'?`${day(days[0],{weekday:false})} – ${day(days[6],{weekday:false,year:true})}`:longDay(state.date);
    const step=state.mode==='week'?7:1;
    const nav=(delta,text,iconName)=>h('button.icon-button',{type:'button','aria-label':text,onClick:()=>{state.date=addDays(state.date,delta);save();render();}},icon(iconName));
    clear(head,
      h('h1.view-title',{id:'cal-title'},t('calendar.title')),
      h('div.calendar-controls',
        h('div.segmented',{role:'group','aria-label':t('calendar.title')},
          ...['week','day'].map(m=>h('button.segment',{type:'button','aria-pressed':String(state.mode===m),onClick:()=>{state.mode=m;save();render();}},t('calendar.'+m)))),
        h('div.date-nav',nav(-step,t('calendar.previous'),'back'),h('p.date-label',{'aria-live':'polite'},label),nav(step,t('calendar.next'),'next'),
          h('button.btn.small.quiet',{type:'button',onClick:()=>{state.date=now;save();render();}},t('calendar.today'))),
        h('label.check.small',h('input',{type:'checkbox',checked:state.showDone,onChange:e=>{state.showDone=e.target.checked;save();render();}}),h('span',t('calendar.showDone')))),
      studio.query.q?h('p.section-help',t('filter.search')+': “'+studio.query.q+'”'):null);
    const overdue=studio.orders.filter(o=>!studio.held.has(o.id)&&isOverdue(o,now)).sort((a,b)=>a.date.localeCompare(b.date));
    const undated=studio.orders.filter(o=>!studio.held.has(o.id)&&!o.date&&ACTIVE(o.status));
    const columns=days.map(d=>{
      const list=orders.filter(o=>o.date===d).sort(byWindow);
      const isToday=d===now;
      return h('section.day-column',{class:isToday?'is-today':'','aria-label':longDay(d)+' · '+t('calendar.count',{count:list.length})},
        h('header.day-head',h('span.day-name',weekdayShort(d)),h('span.day-number',String(dayNumber(d))),isToday?h('span.day-tag.tag-today',t('tag.today')):null,
          h('span.day-count',list.length?String(list.length):'')),
        list.length?h('ul.job-list',list.map(job)):h('p.muted.day-empty',t('calendar.nothing')));
    });
    clear(body,
      !studio.loadedAt?h('p.loading-line',t('orders.loading')):null,
      overdue.length?h('section.calendar-alert',{'aria-labelledby':'cal-overdue'},h('h2.sub-title',{id:'cal-overdue'},icon('alert',{size:18}),t('calendar.overdue')),h('ul.job-list.inline',overdue.map(job))):null,
      undated.length?h('section.calendar-alert',{'aria-labelledby':'cal-undated'},h('h2.sub-title',{id:'cal-undated'},t('calendar.unscheduled')),h('ul.job-list.inline',undated.map(job))):null,
      h('div.days',{class:'mode-'+state.mode},columns));
  }
  render();
  const off=studio.on('orders',render);
  return {unmount(){off();}};
}
