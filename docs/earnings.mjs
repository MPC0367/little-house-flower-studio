/* Earnings: money that actually moved, by the day it moved (Bangkok time). Payments received minus
   refunds is the headline; it is cash, not profit. Order values are a separate figure. Periods
   without records say so instead of showing zero, and days still to come are left empty. */
import {t} from './text.mjs?v=studio-20261015-7';
import {h,clear,icon} from './ui.mjs?v=studio-20261015-7';
import {satang,day,today,addDays,weekStart,monthStart,monthEnd,monthName,shortMonth,weekdayShort,dayNumber,number} from './format.mjs?v=studio-20261015-7';

const KEY='lhf.studio.earnings.v1';
const SVG='http://www.w3.org/2000/svg';
function load(){try{return {period:'month',anchor:today(),from:'',to:'',...JSON.parse(sessionStorage.getItem(KEY)||'{}')};}catch{return {period:'month',anchor:today(),from:'',to:''};}}
const daysBetween=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/86400000)+1;

/** the range shown, and the previous calendar period it is compared with */
export function ranges(state){
  const a=state.anchor;
  if(state.period==='week'){const from=weekStart(a);return {from,to:addDays(from,6),group:'day',prev:{from:addDays(from,-7),to:addDays(from,-1)}};}
  if(state.period==='year'){const y=Number(a.slice(0,4));return {from:`${y}-01-01`,to:`${y}-12-31`,group:'month',prev:{from:`${y-1}-01-01`,to:`${y-1}-12-31`}};}
  if(state.period==='custom'&&state.from&&state.to&&state.from<=state.to){
    const n=daysBetween(state.from,state.to);
    return {from:state.from,to:state.to,group:n>62?'month':'day',prev:{from:addDays(state.from,-n),to:addDays(state.from,-1)}};
  }
  const from=monthStart(a),to=monthEnd(a),pm=monthStart(addDays(from,-1));
  return {from,to,group:'day',prev:{from:pm,to:monthEnd(pm)}};
}

export function mount(host,studio){
  const state=load();if(state.period==='custom'&&!(state.from&&state.to))state.period='month';
  const save=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(state));}catch{}};
  const head=h('div.view-head'),body=h('div.earnings-body',{'aria-live':'polite','aria-busy':'true'});
  clear(host,h('section.view-earnings',{'aria-labelledby':'earn-title'},head,body));
  let token=0;

  function controls(){
    const r=ranges(state);
    const label=state.period==='week'?`${day(r.from,{weekday:false})} – ${day(r.to,{weekday:false,year:true})}`:
      state.period==='year'?r.from.slice(0,4):state.period==='month'?monthName(r.from):`${day(r.from,{year:true})} – ${day(r.to,{year:true})}`;
    const shift=dir=>{
      if(state.period==='week')state.anchor=addDays(weekStart(state.anchor),7*dir);
      else if(state.period==='year')state.anchor=`${Number(state.anchor.slice(0,4))+dir}-01-01`;
      else state.anchor=monthStart(dir>0?addDays(monthEnd(state.anchor),1):addDays(monthStart(state.anchor),-1));
      save();refresh();
    };
    const from=h('input.field',{id:'e-from',type:'date',value:state.from||ranges({...state,period:'month'}).from});
    const to=h('input.field',{id:'e-to',type:'date',value:state.to||today()});
    const customError=h('p.field-error',{role:'alert',hidden:true},t('earn.rangeInvalid'));
    clear(head,
      h('h1.view-title',{id:'earn-title'},t('earn.title')),
      h('div.earnings-controls',
        h('div.segmented',{role:'group','aria-label':t('earn.period')},
          ...['week','month','year','custom'].map(p=>h('button.segment',{type:'button','aria-pressed':String(state.period===p),onClick:()=>{state.period=p;if(p!=='custom')state.anchor=today();save();refresh();}},t('earn.'+p)))),
        state.period==='custom'?h('form.custom-range',{onSubmit:e=>{e.preventDefault();if(!from.value||!to.value||from.value>to.value){customError.hidden=false;return;}state.from=from.value;state.to=to.value;save();refresh();}},
          h('div',h('label.field-label',{for:'e-from'},t('filter.from')),from),h('div',h('label.field-label',{for:'e-to'},t('filter.to')),to),
          h('button.btn.small.primary',{type:'submit'},t('earn.apply')),customError):
          h('div.date-nav',h('button.icon-button',{type:'button','aria-label':t('calendar.previous'),onClick:()=>shift(-1)},icon('back')),h('p.date-label',label),
            h('button.icon-button',{type:'button','aria-label':t('calendar.next'),onClick:()=>shift(1)},icon('next')))),
      h('p.section-help',t('earn.basis')));
  }

  async function refresh(){
    controls();
    const my=++token,r=ranges(state);
    body.setAttribute('aria-busy','true');
    if(!body.firstChild)clear(body,h('p.loading-line',t('earn.loading')));
    try{
      const [report,previous]=await Promise.all([
        studio.source.revenue({from:r.from,to:r.to,group:r.group}),
        studio.source.revenue({from:r.prev.from,to:r.prev.to,group:'month'}).catch(()=>null)]);
      if(my!==token)return;
      paint(report,previous,r);
    }catch(error){
      if(my!==token)return;
      clear(body,h('div.empty-state',icon('alert',{size:28}),h('p',t('earn.error')),h('p.muted',error.message),h('button.btn.quiet',{type:'button',onClick:refresh},t('sync.retry'))));
    }finally{if(my===token)body.setAttribute('aria-busy','false');}
  }

  function refLink(orderId){
    const o=studio.orders.find(x=>x.id===orderId);
    return h('a.inline-link',{href:'#earnings/'+encodeURIComponent(orderId)},o?.ref||orderId);
  }
  function paint(report,previous,r){
    const now=today();
    const partial=r.to>=now;
    let compare;
    if(partial)compare=t('earn.partial');
    else if(!previous||previous.coverageStatus!=='complete'||report.coverageStatus!=='complete')compare=t('earn.noCompare');
    else{
      const diff=report.net-previous.net;
      compare=t('earn.compare',{days:daysBetween(r.prev.from,r.prev.to)})+': '+satang(previous.net)+(previous.net?` (${diff>=0?'+':'−'}${number(Math.abs(Math.round(100*diff/Math.abs(previous.net))))}%)`:'');
    }
    const card=(label,value,help,tone)=>h('div.metric',{class:tone?'tone-'+tone:''},h('p.metric-label',label),h('p.metric-value',value),help?h('p.metric-help',help):null);
    const unknown=report.net==null;
    const coverageText=t('earn.coverage.'+(report.coverageStatus||'unknown'))+(report.coverage&&/synthetic/i.test(report.coverage)?' · '+t('demo.badge'):'');
    clear(body,
      h('div.headline',
        h('p.headline-label',t('earn.net')),
        h('p.headline-value',unknown?t('earn.noRecords'):satang(report.net)),
        h('p.headline-help',t('earn.netHelp')),
        h('p.headline-compare',compare),
        h('p.coverage',{class:'cov-'+(report.coverageStatus||'unknown')},coverageText)),
      h('div.metrics',
        card(t('earn.gross'),report.gross==null?t('earn.noRecords'):satang(report.gross)),
        card(t('earn.refunds'),report.refunds==null?t('earn.noRecords'):satang(report.refunds),null,'refund'),
        card(t('earn.confirmed'),satang(report.confirmedValue||0),t('earn.confirmedHelp')),
        card(t('earn.outstanding'),satang(report.outstanding||0)),
        card(t('earn.completed'),number(report.completed||0)),
        card(t('earn.average'),report.averageConfirmedValue!=null?satang(Math.round(report.averageConfirmedValue)):t('empty')),
        card(t('earn.unknownQuotes'),number(report.unknownQuotes||0)),
        card(t('earn.delivery'),satang(report.deliveryFees||0)),
        card(t('earn.banknotes'),satang(report.banknoteValue||0))),
      chart(report,r,now),
      table(report,r,now),
      statusGroups(report),
      report.historyIncompleteOrders?h('p.section-help',icon('alert',{size:16}),t('earn.legacy',{count:report.historyIncompleteOrders})):null);
  }

  function periodLabel(period,group){return group==='month'?monthName(period+'-01'):day(period);}
  function chart(report,r,now){
    const rows=report.rows||[];
    const W=Math.max(320,rows.length*28),H=220,top=16,base=150,bottom=H-30,left=56,right=8;
    const max=Math.max(1,...rows.map(x=>x.gross||0)),minR=Math.max(1,...rows.map(x=>x.refunds||0));
    const up=base-top,down=bottom-base-24;
    const scaleUp=up/max,scaleDown=Math.min(down/minR,scaleUp);
    const bw=Math.max(6,Math.min(22,(W-left-right)/rows.length*0.6)),slot=(W-left-right)/Math.max(1,rows.length);
    const svg=document.createElementNS(SVG,'svg');
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('class','chart');svg.setAttribute('role','group');
    svg.setAttribute('aria-label',t('earn.chartLabel',{from:day(r.from,{year:true}),to:day(r.to,{year:true})}));
    const el=(name,attrs,text)=>{const n=document.createElementNS(SVG,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;return n;};
    const defs=el('defs',{});
    const pattern=el('pattern',{id:'refund-hatch',width:6,height:6,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'});
    pattern.append(el('rect',{width:6,height:6,class:'hatch-bg'}),el('line',{x1:0,y1:0,x2:0,y2:6,class:'hatch-line'}));
    defs.append(pattern);svg.append(defs);
    // scale: zero line, the largest day, half of it
    for(const v of [0,max/2,max]){
      const y=base-v*scaleUp;
      svg.append(el('line',{x1:left,x2:W-right,y1:y,y2:y,class:v?'grid':'axis'}),el('text',{x:left-6,y:y+4,class:'tick','text-anchor':'end'},v?satang(Math.round(v)):'0'));
    }
    const tip=h('div.chart-tip',{role:'status',hidden:true});
    rows.forEach((row,i)=>{
      const x=left+i*slot+(slot-bw)/2,period=row.period;
      const future=r.group==='day'?period>now:period>now.slice(0,7);
      const g=el('g',{class:'bar-group',tabindex:future?'-1':'0',role:'img'});
      const lbl=periodLabel(period,r.group);
      let text;
      if(future){text=lbl+': —';}
      else if(row.gross==null){g.append(el('rect',{x,y:base-14,width:bw,height:14,class:'bar-unknown'}));text=lbl+': '+t('earn.noRecords');}
      else{
        if(row.gross>0)g.append(el('rect',{x,y:base-row.gross*scaleUp,width:bw,height:Math.max(1,row.gross*scaleUp),class:'bar-gross'}));
        if(row.refunds>0)g.append(el('rect',{x,y:base,width:bw,height:Math.max(1,row.refunds*scaleDown),class:'bar-refund',fill:'url(#refund-hatch)'}));
        if(!row.gross&&!row.refunds)g.append(el('rect',{x,y:base-1,width:bw,height:1,class:'bar-zero'}));
        text=`${lbl}: ${t('earn.col.gross')} ${satang(row.gross)}, ${t('earn.col.refunds')} ${satang(row.refunds)}, ${t('earn.col.net')} ${satang(row.net)}`+(row.coverage==='partial'?' ('+t('earn.partialRow')+')':'');
      }
      g.setAttribute('aria-label',text);
      const tick=r.group==='month'?shortMonth(period+'-01'):rows.length<=7?weekdayShort(period)+' '+dayNumber(period):String(dayNumber(period));
      if(r.group==='month'||rows.length<=7||dayNumber(period)%5===1||i===rows.length-1)svg.append(el('text',{x:x+bw/2,y:H-10,class:'tick','text-anchor':'middle'},tick));
      const show=()=>{tip.textContent=text;tip.hidden=false;};
      g.addEventListener('focus',show);g.addEventListener('pointerenter',show);
      g.addEventListener('blur',()=>{tip.hidden=true;});g.addEventListener('pointerleave',()=>{if(document.activeElement!==g)tip.hidden=true;});
      svg.append(g);
    });
    const legend=h('ul.legend',
      h('li',h('span.swatch.gross',{'aria-hidden':'true'}),t('earn.legend.gross')),
      h('li',h('span.swatch.refund',{'aria-hidden':'true'}),t('earn.legend.refunds')),
      h('li',h('span.swatch.unknown',{'aria-hidden':'true'}),t('earn.legend.unknown')));
    return h('figure.chart-figure',h('figcaption.sub-title',t('earn.chart',{unit:t('earn.unit.'+(r.group==='month'?'month':'day'))})),h('div.chart-scroll',svg),tip,legend);
  }
  function table(report,r,now){
    const rows=(report.rows||[]).filter(row=>r.group==='day'?row.period<=now:row.period<=now.slice(0,7));
    return h('details.figures-table',{open:rows.length<=12},
      h('summary.sub-title',t('earn.table')),
      h('div.table-scroll',h('table.data-table',
        h('caption.visually-hidden',t('earn.table')),
        h('thead',h('tr',...['period','gross','refunds','net','orders'].map(k=>h('th',{scope:'col'},t('earn.col.'+k))))),
        h('tbody',rows.map(row=>h('tr',{class:'cov-'+row.coverage},
          h('th',{scope:'row'},periodLabel(row.period,r.group)),
          ...(row.gross==null?[h('td',{colspan:3},t('earn.noRecords'))]:[h('td',satang(row.gross)),h('td',row.refunds?'−'+satang(row.refunds):satang(0)),h('td',satang(row.net),row.coverage==='partial'?h('span.muted',' · '+t('earn.partialRow')):null)]),
          h('td.refs',(row.orderIds||[]).length?(row.orderIds||[]).map(refLink):t('empty'))))))));
  }
  function statusGroups(report){
    const groups=(report.statusGroups||[]).filter(g=>g.count);
    if(!groups.length)return null;
    const label={confirmed:t('view.notstarted'),preparing:t('view.making'),ready:t('view.ready'),out:t('view.shipped'),done:t('view.done')};
    return h('section.status-groups',{'aria-labelledby':'earn-status'},h('h2.sub-title',{id:'earn-status'},t('earn.statuses')),
      h('ul.group-list',groups.map(g=>h('li',h('span.group-name',label[g.status]||g.label),h('span.group-count',String(g.count)),
        h('span.group-refs',g.orders.map(o=>h('a.inline-link',{href:'#earnings/'+encodeURIComponent(o.id)},o.ref)))))));
  }
  // any change to an order or to money received, from this screen or another one, refreshes the figures
  const signature=()=>studio.orders.map(o=>o.id+':'+o.revision+':'+(o.payment?.net??'')+':'+o.status).sort().join('|');
  let seen=signature();
  refresh();
  const off=studio.on('orders',()=>{const next=signature();if(next!==seen){seen=next;refresh();}});
  return {unmount(){off();token++;}};
}
