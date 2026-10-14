/* One order, the whole job: a drawer on a large screen, a full page on a phone.
   Edits are made against the revision that was loaded; the server refuses a stale one (409) and
   the Studio then shows the record next to the edit and lets the person choose. Nothing is ever
   overwritten silently, and nothing is sent to a customer from here. */
import {t,pick,lang} from './text.mjs';
import {h,clear,icon,chip,modal,askReason,toast,announce,copyText} from './ui.mjs';
import {satang,baht,parseBaht,longDay,moment,localInput,fromLocalInput} from './format.mjs';
import {statusLabel,nextSteps,canCancel,stepLabel,correctionTargets,paymentLabel,orderImages,designRows,styleNote,occasionName,provinceName} from './model.mjs';
import {STATUS_TONE,PAY_TONE} from './orders.mjs';
import {studio,go} from './app.mjs';
import {printTicket,printCard} from './print.mjs';

const EDITABLE=['notes','needsDetails','deliveryIssue'];
let panel=null;
window.__lhfStudioDirty=()=>!!panel?.dirty();

export function refreshLanguage(){if(panel)panel.render();}
export function showOrder(id,section){
  if(panel&&panel.id===id){panel.section=section;return;}
  if(panel){panel.destroy();panel=null;}
  panel=createPanel(id,section);
}
export function hideOrder(){
  if(!panel)return;
  if(panel.dirty()){
    // the address changed (browser back) but there are unsaved edits: stay, and ask
    const {id,section}=panel;
    history.replaceState(null,'','#'+section+'/'+encodeURIComponent(id));
    panel.askClose();return;
  }
  panel.destroy();panel=null;
}

function createPanel(id,section){
  const self={id,section,order:null,base:null,draft:{},saving:false,status:'',error:'',changedElsewhere:false,conflict:null,destroyed:false};
  const opener=document.activeElement;
  const scrollY=window.scrollY;
  const body=h('div.drawer-body');
  const saveBar=h('div.save-bar',{hidden:true});
  const live=h('p.visually-hidden',{role:'status'});
  const closeButton=h('button.icon-button.drawer-close',{type:'button','aria-label':t('order.close'),onClick:()=>requestClose()},icon('close'));
  const backButton=h('button.btn.quiet.drawer-back',{type:'button',onClick:()=>requestClose()},icon('back',{size:18}),t('order.back'));
  const title=h('h2.drawer-title',{id:'order-title'},'…');
  const dialog=h('dialog.drawer',{'aria-labelledby':'order-title'},
    h('div.drawer-frame',h('header.drawer-head',backButton,title,closeButton),body,saveBar,live));
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)requestClose();});
  // the browser can close the drawer without asking (a repeated Escape): never lose unsaved edits that way
  dialog.addEventListener('close',()=>{
    if(self.destroyed)return;
    if(self.dirty()){dialog.showModal();self.askClose();}
    else go(self.section);
  });
  document.body.append(dialog);dialog.showModal();
  document.body.classList.add('has-drawer');
  clear(body,h('p.loading-line',t('order.loading')));
  closeButton.focus();

  self.dirty=()=>EDITABLE.some(k=>Object.hasOwn(self.draft,k)&&JSON.stringify(self.draft[k])!==JSON.stringify(self.base?.[k]??(k==='notes'?'':false)));
  self.destroy=()=>{
    self.destroyed=true;off();
    dialog.classList.add('closing');
    const finish=()=>{dialog.close();dialog.remove();document.body.classList.remove('has-drawer');
      window.scrollTo({top:scrollY});
      const back=document.querySelector(`tr[data-id="${CSS.escape(id)}"] a`)||opener;
      if(back?.isConnected)back.focus({preventScroll:true});};
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();else setTimeout(finish,200);
  };
  function requestClose(){if(self.dirty())self.askClose();else go(self.section);}
  self.askClose=()=>{
    const dlg=modal({title:t('dialog.closeTitle'),body:[h('p.dialog-text',t('dialog.closeBody'))],onCancel:()=>dlg.close(),actions:[
      h('button.btn.quiet',{type:'button',onClick:()=>dlg.close()},t('dialog.keep')),
      h('button.btn.quiet.danger-text',{type:'button',onClick:()=>{dlg.close();self.draft={};go(self.section);}},t('order.discard')),
      h('button.btn.primary',{type:'button',onClick:async()=>{dlg.close();if(await save())go(self.section);}},t('order.save'))]});
  };

  async function load({keepDraft=true}={}){
    try{
      const order=await studio.source.order(id);
      if(self.destroyed)return;
      self.order=order;self.base=order;self.changedElsewhere=false;
      if(!keepDraft)self.draft={};
      studio.absorb(order);
      self.render();
    }catch(error){
      if(self.destroyed)return;
      clear(body,h('div.empty-state',icon('alert',{size:28}),h('p',error.status===404?t('order.notfound'):error.message),
        h('button.btn.quiet',{type:'button',onClick:()=>load()},t('sync.retry'))));
      title.textContent=t('order.notfound');
    }
  }
  /* a newer revision on the list while this is open: reload quietly, or warn if there are edits */
  const off=studio.on('orders',()=>{
    if(!self.base||self.saving)return;
    const row=studio.orders.find(o=>o.id===id);
    if(!row||row.revision<=self.base.revision)return;
    if(self.dirty()){if(!self.changedElsewhere){self.changedElsewhere=true;self.render();announce(t('order.changedElsewhere'));}}
    else load();
  });

  /* ---------- writes ---------- */
  const opId=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2);
  async function patch(fields,{reason,correction=false}={}){
    self.saving=true;self.status='saving';self.error='';paintSaveBar();
    try{
      await studio.source.update(id,{revision:self.base.revision,fields,reason,correction,operationId:opId()});
      // forget only what was sent: anything typed while saving stays as a new edit
      for(const k of Object.keys(fields))if(JSON.stringify(self.draft[k])===JSON.stringify(fields[k]))delete self.draft[k];
      self.status='saved';live.textContent=t('order.saved');
      await load();
      setTimeout(()=>{if(self.status==='saved'){self.status='';paintSaveBar();}},2500);
      return true;
    }catch(error){
      if(error.status===409){self.status='';await openConflict(error.current,fields);return false;}
      self.status='failed';self.error=error.message;live.textContent=t('order.saveFailed',{error:error.message});
      return false;
    }finally{self.saving=false;paintSaveBar();}
  }
  async function save(){
    const fields={};
    for(const k of EDITABLE)if(Object.hasOwn(self.draft,k)&&JSON.stringify(self.draft[k])!==JSON.stringify(self.base[k]??(k==='notes'?'':false)))fields[k]=self.draft[k];
    if(!Object.keys(fields).length)return true;
    return patch(fields);
  }
  async function changeStatus(status,{reason,correction=false}={}){
    if(self.dirty()){toast(t('order.unsaved'),{tone:'warn'});}
    return patch({status},{reason,correction});
  }

  /* ---------- conflict: the record now, next to what this person typed ---------- */
  async function openConflict(current,mine){
    let theirs=current;
    if(!theirs||theirs.revision==null){try{theirs=await studio.source.order(id);}catch{theirs=null;}}
    if(!theirs){toast(t('error.generic'),{tone:'warn'});return;}
    const fieldLabel={notes:t('order.notes'),needsDetails:t('order.needsDetails'),deliveryIssue:t('order.deliveryIssue'),status:t('col.status'),confirmedTotal:t('order.quote'),deliveryFee:t('order.deliveryFee')};
    const show=(k,v)=>k==='status'?statusLabel(v,theirs.fulfil):['needsDetails','deliveryIssue'].includes(k)?t(v?'yes':'no'):['confirmedTotal','deliveryFee'].includes(k)?(v==null?t('empty'):satang(v)):(v||t('empty'));
    const choice={};
    const rows=Object.keys(mine).map(k=>{
      const same=JSON.stringify(theirs[k]??null)===JSON.stringify(mine[k]??null);
      choice[k]=same?'theirs':'mine';
      const name='conflict-'+k;
      const option=(value,label)=>h('label.choice',h('input',{type:'radio',name,value,checked:choice[k]===value,onChange:()=>{choice[k]=value;}}),h('span',label));
      return h('fieldset.conflict-field',h('legend',fieldLabel[k]||k),
        h('div.conflict-values',h('div',h('span.field-label',t('conflict.theirs')),h('p.conflict-value',show(k,theirs[k]))),h('div',h('span.field-label',t('conflict.mine')),h('p.conflict-value',show(k,mine[k])))),
        same?null:h('div.choice-row',option('mine',t('conflict.keepMine')),option('theirs',t('conflict.useTheirs')),k==='notes'&&theirs.notes&&mine.notes?option('both',t('conflict.combine')):null));
    });
    const statusNote=theirs.status!==self.base.status&&!('status' in mine)?h('p.dialog-text',t('conflict.status',{status:statusLabel(theirs.status,theirs.fulfil)})):null;
    const dlg=modal({title:t('conflict.title'),className:'wide',onCancel:()=>{dlg.close();self.base=theirs;self.order=theirs;self.render();},body:[h('p.dialog-text',t('conflict.body')),statusNote,...rows],actions:[
      h('button.btn.quiet',{type:'button',onClick:()=>{dlg.close();self.base=theirs;self.order=theirs;self.render();}},t('dialog.keep')),
      h('button.btn.primary',{type:'button',onClick:async()=>{
        dlg.close();
        self.base=theirs;self.order=theirs;
        const fields={};
        for(const k of Object.keys(mine)){
          if(choice[k]==='mine')fields[k]=mine[k];
          else if(choice[k]==='both')fields[k]=theirs.notes+'\n— — —\n'+mine.notes;
          else delete self.draft[k];
        }
        for(const k of Object.keys(fields))if(EDITABLE.includes(k))self.draft[k]=fields[k];
        self.render();
        if(Object.keys(fields).length)await patch(fields);
      }},t('order.save'))]});
  }

  /* ---------- the panel ---------- */
  function paintSaveBar(){
    const dirty=self.dirty(),readOnly=studio.readOnly;
    saveBar.hidden=readOnly||!(dirty||self.status);
    const statusText=self.status==='saving'?t('order.saving'):self.status==='saved'?t('order.saved'):self.status==='failed'?t('order.saveFailed',{error:self.error}):dirty?t('order.unsaved'):'';
    clear(saveBar,h('p.save-state',{class:'state-'+(self.status||'dirty')},self.status==='saved'?icon('check',{size:18}):self.status==='failed'?icon('alert',{size:18}):null,statusText),
      dirty?h('div.save-actions',
        h('button.btn.quiet',{type:'button',disabled:self.saving,onClick:()=>{self.draft={};self.render();}},t('order.discard')),
        h('button.btn.primary',{type:'button',disabled:self.saving,onClick:()=>save()},self.saving?t('order.saving'):t('order.save'))):null);
  }
  self.render=()=>{
    const o=self.order;if(!o)return;
    const keepScroll=body.scrollTop;
    title.textContent=o.ref;
    backButton.lastChild.textContent=t('order.back');closeButton.setAttribute('aria-label',t('order.close'));
    clear(body,
      headSection(o),
      self.changedElsewhere?h('div.banner.warn',icon('alert',{size:18}),h('span',t('order.changedElsewhere')),
        h('button.btn.small.quiet',{type:'button',onClick:()=>openConflict(null,Object.fromEntries(EDITABLE.filter(k=>Object.hasOwn(self.draft,k)).map(k=>[k,self.draft[k]])))},t('order.reload'))):null,
      stepsSection(o),handoverSection(o),designSection(o),moneySection(o),notesSection(o),contactSection(o),historySection(o));
    body.scrollTop=keepScroll;
    paintSaveBar();
  };

  function headSection(o){
    return h('section.order-head',
      h('div.order-chips',chip(statusLabel(o.status,o.fulfil),STATUS_TONE[o.status]||'alert'),
        o.status==='cancelled'&&!(o.payments||[]).length?null:chip(paymentLabel(o.payment?.status),PAY_TONE[o.payment?.status]||'quiet'),
        h('span.revision',t('order.revision',{n:o.revision}))),
      h('p.order-sub',h('strong',o.customer?.name||''),' · ',t('order.created',{time:moment(o.createdAt)||t('empty')})),
      h('button.btn.small.quiet',{type:'button',onClick:()=>copyText(o.ref)},icon('copy',{size:16}),t('order.copyRef')));
  }
  function stepsSection(o){
    if(studio.readOnly)return h('section.order-section',h('p.section-help',t('statusHelp.'+(o.status||'review'))));
    const steps=nextSteps(o);
    const owner=studio.me?.role==='owner';
    return h('section.order-section.steps',{'aria-labelledby':'s-steps'},
      h('h3.section-title',{id:'s-steps'},t('order.next')),
      h('p.section-help',t('statusHelp.'+(['new','confirmed','preparing','ready','out','done','cancelled','review'].includes(o.status)?o.status:'review'))),
      h('div.step-buttons',
        ...steps.map((s,i)=>h('button.btn',{type:'button',class:i===0?'primary':'quiet',disabled:self.saving,onClick:async()=>{
          if(o.status==='review'){const r=await askReason({title:stepLabel(s,o.fulfil),confirmLabel:stepLabel(s,o.fulfil)});if(r)changeStatus(s,{reason:r.reason});return;}
          changeStatus(s);}},stepLabel(s,o.fulfil))),
        canCancel(o)?h('button.btn.quiet.danger-text',{type:'button',disabled:self.saving,onClick:async()=>{
          const r=await askReason({title:t('cancel.title',{ref:o.ref}),body:t('cancel.body'),confirmLabel:t('cancel.confirm'),danger:true});
          if(r)changeStatus('cancelled',{reason:r.reason});}},t('action.cancelled')):null,
        owner?h('button.btn.quiet',{type:'button',disabled:self.saving,onClick:()=>correct(o)},t('action.correct')):null));
  }
  async function correct(o){
    const select=h('select.field',{id:'correct-to'},correctionTargets(o).map(s=>h('option',{value:s},statusLabel(s,o.fulfil))));
    const r=await askReason({title:t('correct.title',{ref:o.ref}),body:t('correct.body'),confirmLabel:t('correct.confirm'),
      extra:{node:h('div',h('label.field-label',{for:'correct-to'},t('correct.to')),select),value:()=>select.value}});
    if(r)changeStatus(r.extra,{reason:r.reason,correction:true});
  }
  function field(label,value){return value==null||value===''?null:h('div.kv',h('dt',label),h('dd',value));}
  function phoneLink(phone,name){return phone?h('a.inline-link',{href:'tel:'+String(phone).replace(/[^\d+]/g,'')},icon('phone',{size:16}),h('span',phone),h('span.visually-hidden',' '+t('order.call',{name:name||''}))):null;}
  function addressText(a){
    if(!a)return '';
    if(typeof a==='string')return a;
    return [a.line,a.district,provinceName(a.province),a.postcode].filter(Boolean).join(', ');
  }
  function handoverSection(o){
    const address=o.fulfil==='delivery'?addressText(o.address):'';
    return h('section.order-section',{'aria-labelledby':'s-hand'},
      h('h3.section-title',{id:'s-hand'},t('order.handover')),
      h('dl.kv-list',
        field(t('order.when'),[o.date?longDay(o.date):t('empty'),o.windowLabel].filter(Boolean).join(' · ')),
        field(t('order.how'),h('span.fulfil',icon(o.fulfil==='delivery'?'delivery':'pickup',{size:18}),t('fulfil.'+(o.fulfil==='delivery'?'delivery':'pickup')))),
        field(t('order.customer'),h('span.stack',o.customer?.name||'',phoneLink(o.customer?.phone,o.customer?.name),o.customer?.line?h('span.muted','LINE: '+o.customer.line):null)),
        o.recipient?.name||o.recipient?.phone?field(t('order.recipient'),h('span.stack',o.recipient?.name||'',phoneLink(o.recipient?.phone,o.recipient?.name))):null,
        address?field(t('order.address'),h('span.stack',address,h('button.btn.small.quiet',{type:'button',onClick:()=>copyText(address)},icon('copy',{size:16}),t('order.copyAddress')))):null),
      h('div.card-message',
        h('h4.sub-title',t('order.card')),
        o.card?.message?h('blockquote.card-text',o.card.message):h('p.muted',t('order.cardNone')),
        o.anonymous?h('p.muted',t('order.anonymous')):null,
        o.card?.message?h('button.btn.small.quiet',{type:'button',onClick:()=>printCard(o)},icon('print',{size:16}),t('order.printCard')):null));
  }
  function imageFigure(img){
    const caption=t('img.'+img.role);
    const button=h('button.figure-button',{type:'button','aria-label':t('order.enlarge',{label:caption}),onClick:()=>viewImage(img.src,caption)},
      h('img',{src:img.src,srcset:img.srcset||null,sizes:'(min-width: 960px) 260px, 45vw',alt:caption,loading:'lazy',decoding:'async',
        onError:e=>{e.target.closest('figure')?.replaceWith(h('figure.order-figure.missing',h('div.figure-missing',icon('image',{size:24}),t('img.unavailable')),h('figcaption',caption)));}}));
    return h('figure.order-figure',button,h('figcaption',caption,img.qa?h('span.muted',' · '+t('img.qaPending')):null));
  }
  function designSection(o){
    const images=orderImages(o);
    const c=o.custom;
    const reference=c?.hasReference||c?.referenceAssetId;
    const items=(o.items||[]).length?h('ul.item-list',(o.items||[]).map(item=>h('li',
      h('span.item-name',pick(item.name)||item.name||''),
      item.qty!=null?h('span.item-qty',t('order.qty',{qty:item.qty})):null,
      h('span.item-price',item.kind==='quote'||item.line==null?t('order.lineQuote'):baht(item.line))))):null;
    return h('section.order-section',{'aria-labelledby':'s-design'},
      h('h3.section-title',{id:'s-design'},t('order.design')),
      images.length?h('div.figures',images.map(imageFigure)):null,
      c?.preview&&c.preview.status&&c.preview.status!=='ready'?h('p.muted',t('img.pending')):null,
      reference?h('p.reference-note',icon('image',{size:18}),t('img.referencePrivate')):null,
      items,
      o.brief?h('div.brief',h('h4.sub-title',t('type.custom')),h('p.prewrap',o.brief)):null,
      c?h('dl.kv-list',
        ...designRows(c.config||{style:c.style,flowers:c.flowers}).map(([label,value])=>field(label,value)),
        field(t('order.occasion'),c.occasion?occasionName(c.occasion):null),
        field(t('order.colourNote'),c.feel||o.colourNote||null),
        field(t('order.budget'),budgetText(c)),
        field(t('order.estimate'),c.estimate?.kind==='published'&&c.estimate.low!=null?t('order.estimate.published',{amount:satang(c.estimate.low)}):t('order.estimate.quote')),
        c.banknoteValue?field(t('order.banknotes'),baht(c.banknoteValue)):null):null,
      c&&styleNote(c.style)?h('p.section-help',styleNote(c.style)):null,
      c?.notes||o.customerNotes?h('div.brief',h('h4.sub-title',t('order.customerNotes')),h('p.prewrap',c?.notes||o.customerNotes)):null,
      !c&&o.colourNote?field(t('order.colourNote'),o.colourNote):null);
  }
  function budgetText(c){
    if(c.budgetCustom)return baht(c.budgetCustom);
    const tiers={b1:[500,1000],b2:[1000,1500],b3:[1500,2500],b4:[2500,4000],b5:[4000,null]};
    const tier=tiers[c.budgetTier];if(!tier)return c.budget||null;
    return tier[1]?baht(tier[0])+'–'+baht(tier[1]):baht(tier[0])+'+';
  }
  function moneySection(o){
    const p=o.payment||{},cancelled=o.status==='cancelled',owner=studio.me?.role==='owner';
    const payments=[...(o.payments||[])].sort((a,b)=>(a.occurredAt||'').localeCompare(b.occurredAt||''));
    const canWrite=!studio.readOnly;
    return h('section.order-section',{'aria-labelledby':'s-money'},
      h('h3.section-title',{id:'s-money'},t('order.money')),
      h('dl.kv-list.money',
        field(t('order.quote'),o.confirmedTotal!=null?satang(o.confirmedTotal):h('span.muted',t('order.quoteNone'))),
        o.fulfil==='delivery'?field(t('order.deliveryFee'),o.deliveryFee!=null?satang(o.deliveryFee):h('span.muted',t('order.deliveryFeeNone'))):null,
        field(t('order.received'),satang(p.net||0)),
        cancelled?null:field(t('order.outstanding'),p.outstanding!=null?satang(p.outstanding):h('span.muted',t('order.quoteNone')))),
      canWrite&&!cancelled?h('button.btn.small.quiet',{type:'button',onClick:()=>editMoney(o)},t(o.fulfil==='delivery'?'money.editBoth':'money.editQuote')):null,
      h('h4.sub-title',t('order.payments')),
      payments.length?h('ul.ledger',payments.map(pay=>h('li.ledger-row',{class:'is-'+pay.type},
        h('span.ledger-type',t(pay.type==='refund'?'pay.refund':'pay.receipt')),
        h('span.ledger-amount',(pay.type==='refund'?'−':'')+satang(pay.amount)),
        h('span.ledger-meta',[moment(pay.occurredAt),t('pay.method.'+(pay.method||'other')),pay.externalReference,pay.reason].filter(Boolean).join(' · ')),
        h('span.ledger-who',actorName(pay.actor))))):h('p.muted',t('order.paymentsNone')),
      canWrite?h('div.button-row',
        cancelled?null:h('button.btn.small.primary',{type:'button',disabled:o.confirmedTotal==null||!p.outstanding,title:o.confirmedTotal==null?t('payment.needsQuote'):null,onClick:()=>recordPayment(o,'receipt')},icon('plus',{size:16}),t('order.recordPayment')),
        (p.net||0)>0&&owner?h('button.btn.small.quiet',{type:'button',onClick:()=>recordPayment(o,'refund')},icon('minus',{size:16}),t('order.recordRefund')):null):null,
      o.confirmedTotal==null&&!cancelled&&canWrite?h('p.section-help',t('payment.needsQuote')):null,
      h('p.section-help',t('order.paymentNote')));
  }
  async function editMoney(o){
    const quote=h('input.field',{id:'m-quote',inputmode:'decimal',autocomplete:'off',value:o.confirmedTotal!=null?String(o.confirmedTotal/100):''});
    const fee=h('input.field',{id:'m-fee',inputmode:'decimal',autocomplete:'off',placeholder:t('money.feeEmpty'),value:o.deliveryFee!=null?String(o.deliveryFee/100):''});
    const error=h('p.field-error',{hidden:true,role:'alert'});
    const r=await askReason({title:t(o.fulfil==='delivery'?'money.editBoth':'money.editQuote'),body:t('money.body'),confirmLabel:t('money.save'),extra:{node:h('div.form-grid',
      h('div',h('label.field-label',{for:'m-quote'},t('money.quote')),quote),
      o.fulfil==='delivery'?h('div',h('label.field-label',{for:'m-fee'},t('money.fee')),fee):null,error),value:()=>({quote:quote.value,fee:fee.value})}});
    if(!r)return;
    const fields={};
    const q=r.extra.quote.trim()===''?null:parseBaht(r.extra.quote),f=r.extra.fee.trim()===''?null:parseBaht(r.extra.fee);
    if((r.extra.quote.trim()!==''&&q==null)||(r.extra.fee.trim()!==''&&f==null)){toast(t('money.invalid'),{tone:'warn'});return editMoney(o);}
    if(q!==(o.confirmedTotal??null))fields.confirmedTotal=q;
    if(o.fulfil==='delivery'&&f!==(o.deliveryFee??null))fields.deliveryFee=f;
    if(Object.keys(fields).length)await patch(fields,{reason:r.reason});
  }
  function recordPayment(o,type){
    const p=o.payment||{},requestId=opId();   // one idempotency key per dialog: a double press records once
    const max=type==='refund'?p.net||0:p.outstanding||0;
    const amount=h('input.field',{id:'p-amount',inputmode:'decimal',autocomplete:'off',value:max?String(max/100):''});
    const when=h('input.field',{id:'p-when',type:'datetime-local',value:localInput(),max:localInput()});
    const method=h('select.field',{id:'p-method'},['bank_transfer','cash','card','other'].map(m=>h('option',{value:m},t('pay.method.'+m))));
    const reference=h('input.field',{id:'p-ref',maxlength:200,autocomplete:'off'});
    const reason=h('textarea.field',{id:'p-reason',rows:2,maxlength:1000});
    const receipts=(o.payments||[]).filter(x=>x.type==='receipt');
    const reversal=h('select.field',{id:'p-rev'},h('option',{value:''},t('payment.none')),receipts.map(x=>h('option',{value:x.id},satang(x.amount)+' · '+moment(x.occurredAt))));
    const error=h('p.field-error',{role:'alert',hidden:true});
    let busy=false;
    const submit=h('button.btn.primary',{type:'button',onClick:async()=>{
      if(busy)return;
      const cents=parseBaht(amount.value),at=fromLocalInput(when.value);
      const fail=msg=>{error.textContent=msg;error.hidden=false;};
      if(cents==null||cents<=0)return fail(t('money.invalid'));
      if(cents>max)return fail(t('payment.max',{amount:satang(max)}));
      if(!at||Date.parse(at)>Date.now()+60000)return fail(t('error.generic'));
      if(type==='refund'&&!reason.value.trim()){reason.focus();return fail(t('reason.required'));}
      busy=true;submit.disabled=true;submit.textContent=t('order.saving');
      try{
        await studio.source.addPayment(id,{type,amount:cents,occurredAt:at,method:method.value,externalReference:reference.value.trim(),reason:reason.value.trim(),requestId,...(type==='refund'&&reversal.value?{reversalOf:reversal.value}:{})});
        dlg.close();toast(t('order.saved'));await load();
      }catch(failure){busy=false;submit.disabled=false;submit.textContent=t(type==='refund'?'refund.save':'payment.save');fail(failure.message);}
    }},t(type==='refund'?'refund.save':'payment.save'));
    const dlg=modal({title:t(type==='refund'?'refund.title':'payment.title',{ref:o.ref}),body:[h('div.form-grid',
      h('div',h('label.field-label',{for:'p-amount'},t('payment.amount')),amount,h('p.field-help',t('payment.max',{amount:satang(max)}))),
      h('div',h('label.field-label',{for:'p-when'},t('payment.when')),when),
      h('div',h('label.field-label',{for:'p-method'},t('payment.method')),method),
      h('div',h('label.field-label',{for:'p-ref'},t('payment.reference')),reference),
      type==='refund'&&receipts.length?h('div',h('label.field-label',{for:'p-rev'},t('payment.reversal')),reversal):null,
      h('div.span-2',h('label.field-label',{for:'p-reason'},t('reason.label')+(type==='refund'?'':' ('+t('payment.reference').split('(')[1]?.replace(')','')+')')),reason),
      error)],actions:[h('button.btn.quiet',{type:'button',onClick:()=>dlg.close()},t('dialog.cancel')),submit]});
  }
  function notesSection(o){
    const value=k=>Object.hasOwn(self.draft,k)?self.draft[k]:(o[k]??(k==='notes'?'':false));
    const notes=h('textarea.field.notes',{id:'o-notes',rows:4,maxlength:4000,readOnly:studio.readOnly,'aria-describedby':'o-notes-help',onInput:e=>{self.draft.notes=e.target.value;paintSaveBar();}});
    notes.value=value('notes');
    const flag=(k)=>h('label.check',h('input',{type:'checkbox',checked:!!value(k),disabled:studio.readOnly,onChange:e=>{self.draft[k]=e.target.checked;paintSaveBar();}}),h('span',t('order.'+k)));
    return h('section.order-section',{'aria-labelledby':'s-notes'},
      h('h3.section-title',{id:'s-notes'},t('order.notes')),
      h('p.section-help',{id:'o-notes-help'},t('order.notesHelp')),notes,
      h('fieldset.flags',h('legend.sub-title',t('order.flags')),flag('needsDetails'),flag('deliveryIssue')));
  }
  function contactSection(o){
    const phone=o.customer?.phone;
    return h('section.order-section',{'aria-labelledby':'s-contact'},
      h('h3.section-title',{id:'s-contact'},t('order.contact')),
      h('div.button-row',
        phone?h('a.btn.small.quiet',{href:'tel:'+String(phone).replace(/[^\d+]/g,'')},icon('phone',{size:16}),t('order.call',{name:o.customer?.name||''})):null,
        phone?h('button.btn.small.quiet',{type:'button',onClick:()=>copyText(phone)},icon('copy',{size:16}),t('order.copyPhone')):null,
        o.customer?.line?h('button.btn.small.quiet',{type:'button',onClick:()=>copyText(o.customer.line)},icon('chat',{size:16}),t('order.copyLine')):null,
        h('button.btn.small.quiet',{type:'button',onClick:()=>messageDraft(o)},icon('chat',{size:16}),t('order.draft')),
        h('button.btn.small.quiet',{type:'button',onClick:()=>printTicket(o)},icon('print',{size:16}),t('order.printTicket'))));
  }
  function historySection(o){
    const events=[...(o.events||[])].sort((a,b)=>(b.at||'').localeCompare(a.at||''));
    return h('section.order-section',{'aria-labelledby':'s-history'},
      h('h3.section-title',{id:'s-history'},t('order.history')),
      events.length?h('ol.history',events.map(e=>h('li.history-item',
        h('div.history-lines',...eventLines(e,o).map(line=>h('p',line))),
        h('p.history-meta',[moment(e.at),t('by',{who:actorName(e.actor)}),e.change?.correction?t('event.correction'):null].filter(Boolean).join(' · ')),
        e.reason?h('p.history-reason','“'+e.reason+'”'):null))):h('p.muted',t('order.historyNone')));
  }
  return load(),self;
}

export function actorName(actor){
  if(!actor)return t('empty');
  if(['owner','staff','read-only'].includes(actor))return t('role.'+actor);
  if(actor==='demo customer'||actor==='customer')return t('order.customer');
  if(actor==='demo seed')return t('demo.badge');
  return actor;
}
function eventLines(e,o){
  const c=e.change||{};
  if(c.created)return [t('event.created')];
  if(c.origin==='sheet-edit')return [t('event.sheetEdit'),...diffLines(c,o)];
  if(c.paymentId)return [t('event.payment',{type:t(c.type==='refund'?'pay.refund':'pay.receipt'),amount:satang(c.amount)})];
  const lines=diffLines(c,o);
  return lines.length?lines:[t('order.edit')];
}
function diffLines(c,o){
  const lines=[],old=c.old||{},neu=c.new||{};
  for(const k of Object.keys(neu)){
    if(k==='status')lines.push(t('event.status',{from:statusLabel(old.status,o.fulfil),to:statusLabel(neu.status,o.fulfil)}));
    else if(k==='notes')lines.push(t('event.notes'));
    else if(k==='confirmedTotal'||k==='deliveryFee')lines.push(t('event.'+k,{from:old[k]==null?t('empty'):satang(old[k]),to:neu[k]==null?t('empty'):satang(neu[k])}));
    else if(k==='needsDetails'||k==='deliveryIssue')lines.push(t('event.'+k,{to:t(neu[k]?'yes':'no')}));
  }
  return lines;
}

/* ---------- a picture, larger ---------- */
function viewImage(src,caption){
  let zoom=1;
  const img=h('img.viewer-image',{src,alt:caption});
  const value=h('output.viewer-zoom',{'aria-live':'polite'},'100%');
  const set=delta=>{zoom=Math.min(3,Math.max(1,zoom+delta));img.style.width=zoom*100+'%';value.textContent=Math.round(zoom*100)+'%';out.disabled=zoom===1;inn.disabled=zoom===3;};
  const out=h('button.btn.small.quiet',{type:'button',onClick:()=>set(-.5)},t('viewer.zoomOut'));
  const inn=h('button.btn.small.quiet',{type:'button',onClick:()=>set(.5)},t('viewer.zoomIn'));
  const dlg=modal({title:caption,className:'viewer',body:[h('div.viewer-stage',{tabindex:'0'},img)],actions:[out,value,inn,h('button.btn.primary',{type:'button',onClick:()=>dlg.close()},t('order.close'))]});
  set(0);
}

/* ---------- a message to copy (never sent from here) ---------- */
function messageDraft(o){
  const th=(o.lang||lang())==='th';
  const name=o.customer?.name||'';
  const when=[o.date?(th?longDayIn(o.date,'th'):longDayIn(o.date,'en')):'',o.windowLabel].filter(Boolean).join(' ');
  const price=o.confirmedTotal!=null?satang(o.confirmedTotal):null;
  const pickup=o.fulfil!=='delivery';
  const T={
    new:th?`สวัสดีค่ะ คุณ${name} ร้าน Little House Flower ได้รับคำจอง ${o.ref} สำหรับ ${when} แล้วนะคะ ร้านจะยืนยันรายละเอียดและราคาให้อีกครั้งค่ะ`:`Hello ${name}, this is Little House Flower. We have your booking ${o.ref} for ${when}. We will confirm the details and the price shortly.`,
    confirmed:th?`สวัสดีค่ะ คุณ${name} ร้านยืนยันคำจอง ${o.ref} สำหรับ ${when} แล้วค่ะ${price?` ราคา ${price}`:''}${pickup?'':' ค่าส่งคิดตามระยะทาง'} ขอบคุณที่ไว้ใจร้านนะคะ`:`Hello ${name}, your booking ${o.ref} for ${when} is confirmed${price?`, at ${price}`:''}.${pickup?'':' Delivery is charged by distance.'} Thank you for choosing us.`,
    ready:th?(pickup?`สวัสดีค่ะ คุณ${name} ดอกไม้ของคำจอง ${o.ref} พร้อมให้มารับที่ร้านแล้วค่ะ`:`สวัสดีค่ะ คุณ${name} ดอกไม้ของคำจอง ${o.ref} จัดเสร็จแล้ว กำลังจะออกไปส่งค่ะ`):(pickup?`Hello ${name}, the flowers for ${o.ref} are ready to collect at the shop.`:`Hello ${name}, the flowers for ${o.ref} are ready and will go out for delivery soon.`),
    out:th?`สวัสดีค่ะ คุณ${name} ดอกไม้ของคำจอง ${o.ref} ออกจากร้านไปส่งแล้วค่ะ`:`Hello ${name}, the flowers for ${o.ref} are on their way.`,
    done:th?`ขอบคุณคุณ${name} มากนะคะ หวังว่าจะชอบดอกไม้จากร้าน Little House Flower ค่ะ`:`Thank you, ${name}. We hope you love the flowers from Little House Flower.`,
    cancelled:th?`สวัสดีค่ะ คุณ${name} คำจอง ${o.ref} ถูกยกเลิกแล้วค่ะ หากมีคำถามติดต่อร้านได้เลยนะคะ`:`Hello ${name}, booking ${o.ref} has been cancelled. Please contact us with any questions.`,
  };
  const text=h('textarea.field.draft',{id:'draft-text',rows:6});
  text.value=T[o.status]||T.new;
  const dlg=modal({title:t('draft.title',{name}),body:[h('p.dialog-text',t('draft.body')),h('label.visually-hidden',{for:'draft-text'},t('order.draft')),text],
    actions:[h('button.btn.quiet',{type:'button',onClick:()=>dlg.close()},t('order.close')),h('button.btn.primary',{type:'button',onClick:()=>copyText(text.value)},icon('copy',{size:16}),t('draft.copy'))]});
}
function longDayIn(iso,code){return new Intl.DateTimeFormat(code==='th'?'th-TH':'en-GB',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(new Date(iso+'T00:00:00Z'));}
