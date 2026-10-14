/* What an order means to the Studio: its status and the steps it may take next, payment states,
   the saved views and filters of the order list, and which pictures may be shown.
   The status steps come from shared/config.mjs, the same rules the server enforces. */
import {nextStatuses,styles,materials,finishes,palettes,ribbonLabels,sizeLabels,styleNotes} from './shared/config.mjs?v=studio-20261015-1';
import {t,pick,lang} from './text.mjs?v=studio-20261015-1';
import {today,addDays} from './format.mjs?v=studio-20261015-1';
import {flowerNames,occasionNames,provinceNames} from './names.mjs?v=studio-20261015-1';

export const STATUSES=['new','confirmed','preparing','ready','out','done','cancelled','review'];
export const ACTIVE=s=>!['done','cancelled'].includes(s);

/** label for a status, in the words for this order's handover (ready to collect vs to send) */
export function statusLabel(status,fulfil){
  if(status==='ready'&&fulfil==='delivery')return t('status.ready.delivery');
  if(status==='done'&&fulfil==='pickup')return t('status.done.pickup');
  return STATUSES.includes(status)?t('status.'+status):t('status.review');
}
/** the forward steps a person may take now; cancel is offered separately */
export function nextSteps(order){
  return nextStatuses(order.status,order.fulfil).filter(s=>s!=='cancelled');
}
export const canCancel=order=>nextStatuses(order.status,order.fulfil).includes('cancelled');
export function stepLabel(status,fulfil){
  if(status==='done'&&fulfil==='pickup')return t('action.done.pickup');
  return t('action.'+status);
}
/** statuses an owner may correct to (the server refuses 'out' for pickups) */
export function correctionTargets(order){
  return STATUSES.filter(s=>s!==order.status&&s!=='review'&&!(order.fulfil==='pickup'&&s==='out'));
}

export const paymentLabel=status=>t('pay.'+(['unpaid','part-paid','paid','part-refunded','refunded'].includes(status)?status:'unpaid'));

/* ---------- the order list ---------- */
export const VIEWS=[
  ['next',o=>ACTIVE(o.status)],
  ['new',o=>o.status==='new'||o.status==='review'],
  ['today',o=>o.date===today()&&ACTIVE(o.status)],
  ['notstarted',o=>o.status==='confirmed'],
  ['making',o=>o.status==='preparing'],
  ['ready',o=>o.status==='ready'],
  ['shipped',o=>o.status==='out'],
  ['awaiting',o=>o.status!=='cancelled'&&o.confirmedTotal!=null&&(o.payment?.outstanding||0)>0],
  ['attention',o=>o.needsDetails||o.deliveryIssue||o.status==='review'||isOverdue(o)],
  ['done',o=>o.status==='done'],
  ['cancelled',o=>o.status==='cancelled'],
  ['all',()=>true],
];
const viewTest=Object.fromEntries(VIEWS);
export const viewIds=VIEWS.map(v=>v[0]);
export function isOverdue(o,now=today()){return !!o.date&&o.date<now&&ACTIVE(o.status);}
export function dayTag(o,now=today()){
  if(!o.date||!ACTIVE(o.status))return null;
  if(o.date<now)return 'overdue';
  if(o.date===now)return 'today';
  if(o.date===addDays(now,1))return 'tomorrow';
  return null;
}
/** the filters other than the saved view; search is done by the server, which can see phone numbers */
export function matchesFilters(o,f){
  if(f.fulfil&&o.fulfil!==f.fulfil)return false;
  if(f.type&&o.type!==f.type)return false;
  if(f.payment&&o.payment?.status!==f.payment)return false;
  if(f.from&&!(o.date&&o.date>=f.from))return false;
  if(f.to&&!(o.date&&o.date<=f.to))return false;
  return true;
}
export function inView(o,view){return (viewTest[view]||viewTest.next)(o);}
/** same priority as the server: overdue, today, new, then the rest by date; finished last */
export function sortOrders(rows,sort='priority',now=today()){
  const rank=o=>!ACTIVE(o.status)?5:o.date&&o.date<now?0:o.date===now?1:o.status==='new'||o.status==='review'?2:3;
  const byDate=(a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.windowLabel||'').localeCompare(b.windowLabel||'');
  const newest=(a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'');
  const copy=[...rows];
  if(sort==='newest')return copy.sort(newest);
  if(sort==='date')return copy.sort((a,b)=>byDate(a,b)||newest(a,b));
  return copy.sort((a,b)=>rank(a)-rank(b)||byDate(a,b)||newest(a,b));
}
export function filtersActive(f){return !!(f.fulfil||f.type||f.payment||f.from||f.to||f.q);}

/* ---------- what to make ---------- */
export const flowerName=id=>pick(flowerNames[id])||String(id||'').replaceAll('_',' ');
export const occasionName=id=>pick(occasionNames[id])||id||'';
export const provinceName=id=>pick(provinceNames[id])||id||'';
export const styleName=id=>{const s=styles.find(x=>x[0]===id);return s?s[lang()==='th'?1:2]:id||'';};
export function itemSummary(o){
  if(o.type==='custom'&&!(o.items||[]).length)return t('items.custom',{style:styleName(o.style||o.custom?.style)});
  const items=o.items||[];if(!items.length)return t('empty');
  const first=items[0],name=pick(first.name)||first.name||'';
  const head=first.qty>1?`${name} × ${first.qty}`:name;
  return items.length>1?head+' '+t('items.more',{count:items.length-1}):head;
}
/** the design choices of a made-to-order request, as [label, value] pairs */
export function designRows(config={}){
  const th=lang()==='th',n=th?1:2,a=th?0:1;
  const rows=[
    [th?'รูปแบบ':'Style',styleName(config.style)],
    [th?'ดอกไม้':'Flowers',(config.flowers||[]).map(flowerName).join(', ')||(th?'ให้ร้านเลือกดอกไม้':'Florist’s choice')],
    [th?'โทนดอกไม้':'Palette',palettes.find(p=>p[0]===config.palette)?.[n]],
    [th?'ห่อหรือภาชนะ':'Container',materials[config.container]?.[a]],
    [th?'สีห่อหรือภาชนะ':'Finish',finishes.find(f=>f[0]===config.finish)?.[n]],
    [th?'ริบบิ้น':'Ribbon',ribbonLabels[config.ribbon]?.[a]],
    [th?'ขนาด':'Size',sizeLabels[config.size]?.[a]],
  ];
  return rows.filter(r=>r[1]);
}
export const styleNote=style=>styleNotes[style]?.[lang()==='th'?0:1]||'';

/* ---------- pictures ---------- */
/** Only the shop's own image routes on this origin, never an outside address. The exact patterns
   matter: the GitHub Pages build rewrites "^\/Little-House-Flower\/img\/" and "^\/little-house-flower-studio\/api\/" to the project prefixes. */
export const safeOrderImagePath=source=>{
  if(typeof source!=='string'||!source)return null;
  try{
    const url=new URL(source.startsWith('/')?source:'/'+source,location.origin);
    if(url.origin!==location.origin||url.search||url.hash||url.pathname.includes('..')||/%2e/i.test(url.pathname))return null;
    return /^\/Little-House-Flower\/img\/[a-z0-9_./-]+$/i.test(url.pathname)||/^\/little-house-flower-studio\/api\/assets\/[a-z0-9-]+$/i.test(url.pathname)||/^\/little-house-flower-studio\/api\/preview-assets\/hosted-composition-[a-f0-9]{24}$/i.test(url.pathname)?url.pathname:null;
  }catch{return null;}
};
export const safeSrcset=srcset=>{
  if(typeof srcset!=='string')return null;
  const parts=srcset.split(',').map(s=>s.trim().split(/\s+/));
  if(!parts.length||parts.some(p=>p.length!==2||!/^\d+w$/.test(p[1])||!safeOrderImagePath(p[0])))return null;
  return parts.map(p=>safeOrderImagePath(p[0])+' '+p[1]).join(', ');
};
/** the pictures of an order, each with what it is: shop photo, AI concept, illustration or customer reference */
export function orderImages(order){
  const out=[];
  for(const item of order.items||[]){
    const src=safeOrderImagePath(item.image);
    if(src)out.push({src,role:'product',caption:pick(item.name)||item.name||''});
  }
  const preview=order.custom?.preview?.asset||order.preview||null;
  if(preview){
    const src=safeOrderImagePath(preview.url);
    const kind=preview.kind==='composition'||/hosted-composition/.test(preview.url||'')?'composition':preview.kind==='product'||preview.role==='product'?'product':'concept';
    if(src)out.push({src,srcset:safeSrcset(preview.srcset),role:kind,qa:preview.qa?.floristApproval==='pending'||/approval pending/i.test(String(preview.qa||''))});
  }
  return out;
}
