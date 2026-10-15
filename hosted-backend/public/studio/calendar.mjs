/* The production calendar: what has to be ready, day by day, by handover window. Overdue work and
   orders without a date are listed first so nothing slips. Statuses here are the shop's record,
   not courier tracking.
   Three views. Month is a grid laid out like the O2 dashboard's calendar (the owner's request, 15 Oct 2026):
   weekday columns, the date at the top of each box and its handovers under it as "time · customer", coloured
   by status with a key; choosing a date lists that day in full under the grid. On a phone the boxes are
   too narrow for words, so they show a dot per handover and the list under the grid does the reading.
   Week and Day are the columns they were. */
import {t} from './text.mjs';
import {h,clear,icon,chip} from './ui.mjs';
import {today,addDays,weekStart,monthStart,monthEnd,monthName,day,longDay,weekdayShort,dayNumber} from './format.mjs';
import {statusLabel,itemSummary,isOverdue,ACTIVE} from './model.mjs';
import {STATUS_TONE} from './orders.mjs';

const KEY='lhf.studio.calendar.v2';   // v2: the month grid is the first view
const MODES=['month','week','day'];
const SHOWN=3;   // handovers written out in a month box; the rest are "+N more"
const KEY_STATUSES=['new','review','confirmed','preparing','ready','out'],DONE_STATUSES=['done','cancelled'];
function load(){
  const base={mode:'month',date:today(),selected:today(),showDone:false};
  try{return {...base,...JSON.parse(sessionStorage.getItem(KEY)||'{}')};}catch{return base;}
}
/** the first day of the month n months from iso's */
function shiftMonth(iso,n){const [y,m]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,10);}
const startTime=o=>(o.windowLabel||'').split(/[–-]/)[0].trim();
const tone=o=>STATUS_TONE[o.status]||'alert';

export function mount(host,studio){
  const state=load();
  if(!MODES.includes(state.mode))state.mode='month';
  const save=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(state));}catch{}};
  const head=h('div.view-head'),body=h('div.calendar-body');
  clear(host,h('section.view-calendar',{'aria-labelledby':'cal-title'},head,body));

  function job(o){
    return h('li.job',{class:'tone-'+tone(o)},
      h('a.job-link',{href:'#calendar/'+encodeURIComponent(o.id)},
        h('span.job-time',o.windowLabel||''),
        h('span.job-main',h('span.job-ref',o.ref),h('span.job-name',o.customer?.name||'')),
        h('span.job-items',itemSummary(o)),
        h('span.job-meta',h('span.fulfil',icon(o.fulfil==='delivery'?'delivery':'pickup',{size:16}),t('fulfil.'+(o.fulfil==='delivery'?'delivery':'pickup'))),chip(statusLabel(o.status,o.fulfil),tone(o)))));
  }
  // one line in a month box: the start of its handover window, then the order
  function entry(o){
    const words=[o.windowLabel,o.ref,o.customer?.name,statusLabel(o.status,o.fulfil)].filter(Boolean);
    return h('li.mentry',{class:'tone-'+tone(o)},
      h('a.mentry-link',{href:'#calendar/'+encodeURIComponent(o.id),title:words.join(' · '),'aria-label':words.join(', ')},
        h('span.mentry-time',startTime(o)),h('span.mentry-text',o.customer?.name||o.ref)));   // who, as the O2 calendar says what
  }
  const byWindow=(a,b)=>(a.windowLabel||'').localeCompare(b.windowLabel||'')||a.ref.localeCompare(b.ref);

  function pick(d){
    state.selected=d;save();render();
    body.querySelector(`.mcell[data-date="${d}"] .mcell-date`)?.focus({preventScroll:true});
  }
  function move(direction){
    if(state.mode==='month'){
      state.date=shiftMonth(state.date,direction);
      const now=today();state.selected=now.slice(0,7)===state.date.slice(0,7)?now:state.date;
    }else state.date=addDays(state.date,direction*(state.mode==='week'?7:1));
    save();render();
  }
  function setMode(mode){
    if(mode===state.mode)return;
    if(state.mode==='month')state.date=state.selected;   // the week or day of the date chosen in the grid
    if(mode==='month')state.selected=state.date;
    state.mode=mode;save();render();
  }

  function month(orders,now){
    const first=monthStart(state.date),last=monthEnd(state.date),start=weekStart(first);
    const weeks=Math.round((Date.parse(addDays(weekStart(last),7))-Date.parse(start))/(7*86400000));
    const days=Array.from({length:weeks*7},(_,i)=>addDays(start,i));
    if(!days.includes(state.selected))state.selected=now.slice(0,7)===first.slice(0,7)?now:first;
    const byDay=new Map();
    for(const o of orders){if(!o.date)continue;if(!byDay.has(o.date))byDay.set(o.date,[]);byDay.get(o.date).push(o);}
    for(const list of byDay.values())list.sort(byWindow);
    // arrow keys move between dates, as in a calendar
    function arrows(e,d){
      const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];
      if(!step)return;
      const target=addDays(d,step);
      if(days.includes(target)){e.preventDefault();pick(target);}
    }
    const cells=days.map(d=>{
      const list=byDay.get(d)||[],selected=d===state.selected,isToday=d===now;
      return h('li.mcell',{class:[d<first||d>last?'is-out':'',isToday?'is-today':'',selected?'is-selected':''].filter(Boolean).join(' '),dataset:{date:d}},
        h('button.mcell-date',{type:'button','aria-pressed':String(selected),
          'aria-label':[longDay(d),isToday?t('tag.today'):null,t('calendar.count',{count:list.length})].filter(Boolean).join(' · '),
          onClick:()=>pick(d),onKeydown:e=>arrows(e,d)},
          h('span.mcell-number',String(dayNumber(d))),
          list.length?h('span.mcell-count',{'aria-hidden':'true'},String(list.length)):null,
          list.length?h('span.mcell-dots',{'aria-hidden':'true'},list.slice(0,4).map(o=>h('span.mdot',{class:'tone-'+tone(o)}))):null),
        list.length?h('ul.mcell-list',list.slice(0,SHOWN).map(entry)):null,
        list.length>SHOWN?h('button.mcell-more',{type:'button',onClick:()=>pick(d)},t('calendar.more',{count:list.length-SHOWN})):null);
    });
    const chosen=byDay.get(state.selected)||[];
    const keyStatuses=state.showDone?[...KEY_STATUSES,...DONE_STATUSES]:KEY_STATUSES;
    return [
      h('div.cal-key',h('span.cal-key-label',t('calendar.key')),keyStatuses.map(s=>chip(statusLabel(s),STATUS_TONE[s]))),
      h('div.month',
        h('div.month-head',{'aria-hidden':'true'},days.slice(0,7).map(d=>h('span',weekdayShort(d)))),
        h('ol.month-grid',{'aria-label':monthName(first)},cells),
        h('p.month-hint',t('calendar.hint'))),
      h('section.day-agenda',{'aria-labelledby':'cal-agenda','aria-live':'polite'},
        h('h2.sub-title',{id:'cal-agenda'},longDay(state.selected),h('span.agenda-count',' · '+t('calendar.count',{count:chosen.length}))),
        chosen.length?h('ul.job-list.inline',chosen.map(job)):h('p.muted.day-empty',t('calendar.nothing')))
    ];
  }

  let drawn='';
  function render({force=false}={}){
    const signature=JSON.stringify([state,studio.query.q,[...studio.held],studio.loadedAt?1:0,studio.orders.map(o=>[o.id,o.revision,o.status,o.date,o.windowLabel])]);
    if(!force&&signature===drawn)return;
    drawn=signature;
    const now=today();
    const orders=studio.orders.filter(o=>!studio.held.has(o.id)&&(state.showDone||ACTIVE(o.status)));
    const label=state.mode==='month'?monthName(state.date)
      :state.mode==='week'?(()=>{const s=weekStart(state.date);return `${day(s,{weekday:false})} – ${day(addDays(s,6),{weekday:false,year:true})}`;})()
      :longDay(state.date);
    const step={month:t('calendar.previousMonth'),week:t('calendar.previous'),day:t('calendar.previous')}[state.mode];
    const stepNext={month:t('calendar.nextMonth'),week:t('calendar.next'),day:t('calendar.next')}[state.mode];
    const nav=(direction,text,iconName)=>h('button.icon-button',{type:'button','aria-label':text,onClick:()=>move(direction)},icon(iconName));
    clear(head,
      h('h1.view-title',{id:'cal-title'},t('calendar.title')),
      h('div.calendar-controls',
        h('div.segmented',{role:'group','aria-label':t('calendar.view')},
          ...MODES.map(m=>h('button.segment',{type:'button','aria-pressed':String(state.mode===m),onClick:()=>setMode(m)},t('calendar.'+m)))),
        h('div.date-nav',nav(-1,step,'back'),h('p.date-label',{'aria-live':'polite'},label),nav(1,stepNext,'next'),
          h('button.btn.small.quiet',{type:'button',onClick:()=>{state.date=now;state.selected=now;save();render();}},t('calendar.today'))),
        h('label.check.small',h('input',{type:'checkbox',checked:state.showDone,onChange:e=>{state.showDone=e.target.checked;save();render();}}),h('span',t('calendar.showDone')))),
      studio.query.q?h('p.section-help',t('filter.search')+': “'+studio.query.q+'”'):null);
    const overdue=studio.orders.filter(o=>!studio.held.has(o.id)&&isOverdue(o,now)).sort((a,b)=>a.date.localeCompare(b.date));
    const undated=studio.orders.filter(o=>!studio.held.has(o.id)&&!o.date&&ACTIVE(o.status));
    let view;
    if(state.mode==='month')view=month(orders,now);
    else{
      const days=state.mode==='week'?Array.from({length:7},(_,i)=>addDays(weekStart(state.date),i)):[state.date];
      view=h('div.days',{class:'mode-'+state.mode},days.map(d=>{
        const list=orders.filter(o=>o.date===d).sort(byWindow);
        const isToday=d===now;
        return h('section.day-column',{class:isToday?'is-today':'','aria-label':longDay(d)+' · '+t('calendar.count',{count:list.length})},
          h('header.day-head',h('span.day-name',weekdayShort(d)),h('span.day-number',String(dayNumber(d))),isToday?h('span.day-tag.tag-today',t('tag.today')):null,
            h('span.day-count',list.length?String(list.length):'')),
          list.length?h('ul.job-list',list.map(job)):h('p.muted.day-empty',t('calendar.nothing')));
      }));
    }
    clear(body,
      !studio.loadedAt?h('p.loading-line',t('orders.loading')):null,
      overdue.length?h('section.calendar-alert',{'aria-labelledby':'cal-overdue'},h('h2.sub-title',{id:'cal-overdue'},icon('alert',{size:18}),t('calendar.overdue')),h('ul.job-list.inline',overdue.map(job))):null,
      undated.length?h('section.calendar-alert',{'aria-labelledby':'cal-undated'},h('h2.sub-title',{id:'cal-undated'},t('calendar.unscheduled')),h('ul.job-list.inline',undated.map(job))):null,
      view);
  }
  render();
  const off=studio.on('orders',render);
  return {unmount(){off();}};
}
