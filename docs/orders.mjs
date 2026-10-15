/* Orders: the queue to act on. Saved views and their counts are worked out from the same filtered
   list that is shown. While someone is looking, rows keep their places: new orders wait behind a
   notice, and a row whose status changed is updated where it is. */
import {t} from './text.mjs?v=studio-20261015-2';
import {h,clear,icon,chip} from './ui.mjs?v=studio-20261015-2';
import {satang,day,today} from './format.mjs?v=studio-20261015-2';
import {VIEWS,inView,matchesFilters,sortOrders,filtersActive,statusLabel,paymentLabel,itemSummary,dayTag,orderImages,ACTIVE,isOverdue} from './model.mjs?v=studio-20261015-2';
import {go,releaseHeld} from './app.mjs?v=studio-20261015-2';

export const STATUS_TONE={new:'new',review:'alert',confirmed:'calm',preparing:'making',ready:'ready',out:'out',done:'done',cancelled:'cancelled'};
export const PAY_TONE={unpaid:'quiet',['part-paid']:'making',paid:'ready',['part-refunded']:'alert',refunded:'alert'};

export function mount(host,studio){
  let displayIds=null;   // the order of rows on screen, kept while polling
  let drawn='';          // what is on screen now; an unchanged poll draws nothing
  const summary=h('div.summary');
  const views=h('div.views',{role:'group','aria-label':t('view.label')});
  const filters=h('div.filters');
  const notice=h('div.notice-slot',{'aria-live':'polite'});
  const count=h('p.list-count',{'aria-live':'polite'});
  const list=h('div.order-list');
  let filtersOpen=false;
  const filterToggle=h('button.btn.quiet.filters-toggle',{type:'button','aria-expanded':'false','aria-controls':'order-filters',onClick:()=>{
    filtersOpen=!filtersOpen;filterToggle.setAttribute('aria-expanded',String(filtersOpen));filters.classList.toggle('open',filtersOpen);}});
  const sortSlot=h('div.sort-select'),clearSlot=h('span');
  filters.id='order-filters';
  clear(host,h('section.view-orders',{'aria-labelledby':'orders-title'},
    h('div.view-head',h('h1.view-title',{id:'orders-title'},t('orders.title'))),
    summary,views,h('div.filter-bar',filterToggle,sortSlot,clearSlot,filters),notice,count,list));

  const q=()=>studio.query;
  const select=(id,label,value,options,onChange)=>h('div.filter',
    h('label.field-label',{for:id},label),
    h('select.field',{id,onChange:event=>onChange(event.target.value)},options.map(([v,text])=>h('option',{value:v,selected:v===value},text))));

  function renderFilters(){
    const f=q();
    const on=[f.fulfil,f.type,f.payment,f.from,f.to].filter(Boolean).length;
    clear(filterToggle,icon('search',{size:18}),t('filter.more'),on?h('span.filter-count',String(on)):null);
    clear(sortSlot,h('label.field-label',{for:'f-sort'},t('sort.label')),h('select.field',{id:'f-sort',onChange:e=>change({sort:e.target.value})},[['priority',t('sort.priority')],['date',t('sort.date')],['newest',t('sort.newest')]].map(([v,text])=>h('option',{value:v,selected:v===f.sort},text))));
    clear(clearSlot,filtersActive(f)?h('button.btn.quiet.clear-filters',{type:'button',onClick:()=>{change({fulfil:'',type:'',payment:'',from:'',to:'',q:''});const g=document.getElementById('global-search');if(g)g.value='';}},t('filter.clear')):null);
    clear(filters,
      select('f-fulfil',t('filter.fulfil'),f.fulfil,[['',t('filter.any')],['pickup',t('fulfil.pickup')],['delivery',t('fulfil.delivery')]],v=>change({fulfil:v})),
      select('f-type',t('filter.type'),f.type,[['',t('filter.any')],['product',t('type.product')],['custom',t('type.custom')]],v=>change({type:v})),
      select('f-pay',t('filter.payment'),f.payment,[['',t('filter.any')],...['unpaid','part-paid','paid','part-refunded','refunded'].map(s=>[s,paymentLabel(s)])],v=>change({payment:v})),
      h('div.filter',h('label.field-label',{for:'f-from'},t('filter.from')),h('input.field',{id:'f-from',type:'date',value:f.from,onChange:e=>change({from:e.target.value})})),
      h('div.filter',h('label.field-label',{for:'f-to'},t('filter.to')),h('input.field',{id:'f-to',type:'date',value:f.to,onChange:e=>change({to:e.target.value})})),
      );
  }
  function change(patch){displayIds=null;studio.setQuery(patch);renderFilters();render({force:true});}

  function visibleSet(){return studio.orders.filter(o=>!studio.held.has(o.id));}
  function renderSummary(){
    const all=visibleSet(),now=today();
    const tile=(label,value,view,tone)=>h('button.summary-tile',{type:'button',class:'tone-'+tone,'aria-pressed':String(q().view===view),onClick:()=>change({view})},
      h('span.summary-value',String(value)),h('span.summary-label',label));
    const outstanding=all.filter(o=>o.status!=='cancelled'&&o.confirmedTotal!=null).reduce((n,o)=>n+(o.payment?.outstanding||0),0);
    clear(summary,
      tile(t('summary.new'),all.filter(o=>o.status==='new'||o.status==='review').length,'new','new'),
      tile(t('summary.today'),all.filter(o=>o.date===now&&ACTIVE(o.status)).length,'today','calm'),
      tile(t('summary.overdue'),all.filter(o=>isOverdue(o,now)).length,'attention','alert'),
      tile(t('summary.outstanding'),satang(outstanding),'awaiting','quiet'));
  }
  function renderViews(filtered){
    clear(views,...VIEWS.map(([id])=>{
      const n=filtered.filter(o=>inView(o,id)).length;
      return h('button.view-chip',{type:'button','aria-pressed':String(q().view===id),onClick:()=>change({view:id})},t('view.'+id),h('span.view-count',String(n)));
    }));
  }
  function renderNotice(){
    const held=studio.held.size;
    clear(notice,held?h('div.new-orders',icon('alert',{size:18}),h('span',t('new.arrived',{count:held})),
      h('button.btn.small.primary',{type:'button',onClick:()=>{displayIds=null;releaseHeld();}},t('new.show'))):null);
  }

  function row(o){
    const tag=dayTag(o),img=orderImages(o).find(i=>i.role==='product'||i.role==='concept'||i.role==='composition');
    const thumb=img?h('img.thumb',{src:img.src,alt:'',loading:'lazy',decoding:'async',width:48,height:48,onError:e=>e.target.replaceWith(h('span.thumb.placeholder',icon('flower',{size:20})))}):h('span.thumb.placeholder',icon('flower',{size:20}));
    const amount=o.status==='cancelled'?t('empty'):o.confirmedTotal!=null?satang(o.confirmedTotal):o.subtotal!=null?t('amount.from',{amount:satang(o.subtotal)}):t('amount.quote');
    return h('tr.order-row',{dataset:{id:o.id},class:o.status==='cancelled'?'is-cancelled':''},
      h('td.c-thumb',thumb),
      h('th.c-order',{scope:'row'},h('a.order-link',{href:'#orders/'+encodeURIComponent(o.id)},o.ref),h('span.order-customer',o.customer?.name||'')),
      h('td.c-handover',h('span.handover-date',day(o.date)||t('empty')),h('span.handover-window',o.windowLabel||''),tag?h('span.day-tag',{class:'tag-'+tag},t('tag.'+tag)):null),
      h('td.c-fulfil',h('span.fulfil',icon(o.fulfil==='delivery'?'delivery':'pickup',{size:18}),h('span',t('fulfil.'+(o.fulfil==='delivery'?'delivery':'pickup'))))),
      h('td.c-items',itemSummary(o),o.needsDetails||o.deliveryIssue||o.historyIncomplete?h('span.flags',
        o.needsDetails?h('span.flag',t('order.needsDetails')):null,o.deliveryIssue?h('span.flag',t('order.deliveryIssue')):null):null),
      h('td.c-status',chip(statusLabel(o.status,o.fulfil),STATUS_TONE[o.status]||'alert')),
      h('td.c-payment',o.status==='cancelled'&&o.payment?.status==='unpaid'?t('empty'):chip(paymentLabel(o.payment?.status),PAY_TONE[o.payment?.status]||'quiet')),
      h('td.c-amount',h('span.amount',{class:o.confirmedTotal==null?'is-quote':''},amount)));
  }
  function skeleton(){return h('div.skeleton-list',{'aria-hidden':'true'},...Array.from({length:6},()=>h('div.skeleton-row')));}

  function render({force=false}={}){
    const signature=JSON.stringify([q(),[...studio.held],studio.loadedAt?1:0,studio.orders.map(o=>[o.id,o.revision,o.status,o.payment?.status,o.payment?.outstanding,o.confirmedTotal,o.date])]);
    if(!force&&signature===drawn)return;
    drawn=signature;
    renderSummary();renderNotice();
    const f=q();
    const filtered=visibleSet().filter(o=>matchesFilters(o,f));
    renderViews(filtered);
    let rows=filtered.filter(o=>inView(o,f.view));
    const sorted=sortOrders(rows,f.sort);
    if(displayIds){
      // keep the places people are looking at; anything newly matching goes to the end
      const at=new Map(displayIds.map((id,i)=>[id,i]));
      rows=[...sorted].sort((a,b)=>(at.has(a.id)?at.get(a.id):1e9)-(at.has(b.id)?at.get(b.id):1e9));
    }else rows=sorted;
    displayIds=rows.map(o=>o.id);
    const total=visibleSet().length;
    if(!studio.loadedAt){count.textContent=t('orders.loading');clear(list,skeleton());return;}
    count.textContent=t('orders.count',{count:rows.length,total});
    if(!total){clear(list,h('div.empty-state',icon('flower',{size:28}),h('p',t('orders.none'))));return;}
    if(!rows.length){clear(list,h('div.empty-state',icon('search',{size:28}),h('p',t('orders.nomatch')),
      h('button.btn.quiet',{type:'button',onClick:()=>change({view:'all',fulfil:'',type:'',payment:'',from:'',to:'',q:''})},t('filter.clear'))));return;}
    const focused=document.activeElement?.closest?.('tr.order-row')?.dataset.id;
    const table=h('table.order-table',
      h('caption.visually-hidden',t('orders.title')+' · '+t('view.'+f.view)),
      h('thead',h('tr',h('th.c-thumb',{scope:'col'},h('span.visually-hidden',t('order.images'))),...['order','handover','fulfil','items','status','payment','amount'].map(k=>h('th',{scope:'col',class:'c-'+k},t('col.'+k))))),
      h('tbody',rows.map(row)));
    table.addEventListener('click',event=>{
      const tr=event.target.closest('tr.order-row');if(!tr||event.target.closest('a'))return;
      go('orders',tr.dataset.id);
    });
    clear(list,table);
    if(focused)table.querySelector(`tr[data-id="${CSS.escape(focused)}"] a`)?.focus({preventScroll:true});
  }
  renderFilters();render();
  const offOrders=studio.on('orders',info=>{if(info?.first||info?.released)displayIds=null;render();});
  const offQuery=studio.on('query',()=>{displayIds=null;render({force:true});});
  return {unmount(){offOrders();offQuery();}};
}
