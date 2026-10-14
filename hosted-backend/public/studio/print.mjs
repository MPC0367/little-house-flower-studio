/* Paper for the flower bench: a work ticket with everything needed to make and hand over an order,
   and the free message card. Built in a print-only layer; the screen is never printed. */
import {t,pick} from './text.mjs';
import {h,clear} from './ui.mjs';
import {satang,baht,longDay,moment} from './format.mjs';
import {statusLabel,paymentLabel,designRows,occasionName,provinceName} from './model.mjs';

function layer(kind,...children){
  let root=document.getElementById('print-root');
  if(!root){root=h('div',{id:'print-root','aria-hidden':'true'});document.body.append(root);}
  clear(root,h('div.print-page',{class:'print-'+kind},children));
  document.body.dataset.printing=kind;
  const done=()=>{delete document.body.dataset.printing;clear(root);window.removeEventListener('afterprint',done);};
  window.addEventListener('afterprint',done);
  setTimeout(()=>window.print(),50);
}
const row=(label,value)=>value==null||value===''?null:h('tr',h('th',{scope:'row'},label),h('td',value));
function addressText(a){if(!a)return '';if(typeof a==='string')return a;return [a.line,a.district,provinceName(a.province),a.postcode].filter(Boolean).join(', ');}

export function printTicket(o){
  const c=o.custom,p=o.payment||{};
  const items=(o.items||[]).map(i=>`${pick(i.name)||i.name} × ${i.qty??1}${i.line!=null?' · '+baht(i.line):''}`);
  layer('ticket',
    h('header.print-head',h('p.print-shop','Little House Flower'),h('h1',o.ref),h('p',statusLabel(o.status,o.fulfil)+' · '+t('fulfil.'+(o.fulfil==='delivery'?'delivery':'pickup')))),
    h('table.print-table',h('tbody',
      row(t('order.when'),[o.date?longDay(o.date):'',o.windowLabel].filter(Boolean).join(' · ')),
      row(t('order.customer'),[o.customer?.name,o.customer?.phone,o.customer?.line?'LINE '+o.customer.line:null].filter(Boolean).join(' · ')),
      row(t('order.recipient'),[o.recipient?.name,o.recipient?.phone].filter(Boolean).join(' · ')),
      o.fulfil==='delivery'?row(t('order.address'),addressText(o.address)):null,
      row(t('order.items'),items.length?h('span',items.map(line=>h('span.print-line',line))):null),
      ...(c?designRows(c.config||{}).map(([label,value])=>row(label,value)):[]),
      c?.occasion?row(t('order.occasion'),occasionName(c.occasion)):null,
      row(t('order.colourNote'),c?.feel||o.colourNote||null),
      c?.banknoteValue?row(t('order.banknotes'),baht(c.banknoteValue)):null,
      row(t('order.customerNotes'),c?.notes||o.customerNotes||null),
      o.brief?row(t('type.custom'),o.brief):null,
      row(t('order.notes'),o.notes||null),
      row(t('order.needsDetails'),o.needsDetails?t('yes'):null),
      row(t('order.deliveryIssue'),o.deliveryIssue?t('yes'):null),
      row(t('order.card'),o.card?.message?(o.anonymous?o.card.message+' ('+t('order.anonymous')+')':o.card.message):t('order.cardNone')),
      row(t('order.quote'),o.confirmedTotal!=null?satang(o.confirmedTotal):t('order.quoteNone')),
      o.fulfil==='delivery'?row(t('order.deliveryFee'),o.deliveryFee!=null?satang(o.deliveryFee):t('order.deliveryFeeNone')):null,
      row(t('col.payment'),paymentLabel(p.status)+(p.outstanding?' · '+t('order.outstanding')+' '+satang(p.outstanding):'')))),
    h('p.print-foot',t('order.created',{time:moment(o.createdAt)||''})+' · '+t('order.revision',{n:o.revision})));
}

export function printCard(o){
  if(!o.card?.message)return;
  // exactly the customer's words: no sender is added (an anonymous card must not name anyone)
  layer('card',h('div.card-sheet',h('p.card-print-text',o.card.message),h('p.card-print-shop','Little House Flower')));
}
