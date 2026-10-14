import {checkTransition,paymentState,revenue,hash,legacy} from './domain.mjs';
import {retryDelay} from './hosted-retry.mjs';
const iso=()=>new Date().toISOString();
const active=o=>!['done','cancelled'].includes(o.status);
export function filterOrders(orders,payments,params,today=legacy.time.today()){
 const get=k=>params.get(k)||'',query=get('q').toLowerCase();
 const rows=orders.filter(o=>(!query||[o.ref,o.customer?.name,o.customer?.phone].join(' ').toLowerCase().includes(query))&&(!get('status')||o.status===get('status'))&&(!get('fulfil')||o.fulfil===get('fulfil'))&&(!get('date')||o.date===get('date'))&&(!get('from')||o.date>=get('from'))&&(!get('to')||o.date<=get('to'))&&(!get('type')||o.type===get('type'))&&(!get('attention')||o.needsDetails||o.deliveryIssue||o.status==='review')&&(!get('payment')||paymentState(o,payments).status===get('payment')));
 const priority=o=>!active(o)?5:o.date<today?0:o.date===today?1:o.status==='new'?2:3;
 rows.sort(get('sort')==='newest'?(a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''):get('sort')==='date'?(a,b)=>(a.date||'9999').localeCompare(b.date||'9999'):(a,b)=>priority(a)-priority(b)||(a.date||'9999').localeCompare(b.date||'9999')||(b.createdAt||'').localeCompare(a.createdAt||''));return rows;
}
export function compactOrder(o,payments){return {id:o.id,ref:o.ref,date:o.date,windowLabel:o.windowLabel,fulfil:o.fulfil,status:o.status,customer:{name:o.customer?.name||'Legacy customer'},items:(o.items||[]).map(i=>({name:i.name,qty:i.qty,image:i.image})),type:o.type,preview:o.custom?.preview?.asset||null,previewState:o.custom?.preview?.status||null,style:o.custom?.config?.style||null,confirmedTotal:o.confirmedTotal,revision:o.revision,syncState:o.syncState,payment:paymentState(o,payments),createdAt:o.createdAt,historyIncomplete:o.historyIncomplete,needsDetails:o.needsDetails,deliveryIssue:o.deliveryIssue};}
export function patchOrder(db,putOrder,o,b,actor){
 if(b.operationId&&db.get('staff_operations',b.operationId))return o;
 if(b.expectedRevision!==o.revision){const e=Error('This order changed in another view. Review server values before saving your draft.');e.status=409;e.current=o;throw e;}
 let conflict=null;
 const allowed=['status','notes','confirmedTotal','deliveryFee','needsDetails','deliveryIssue'],patch={};
 if(b.resolveConflict){
  if(actor!=='owner'){const e=Error('Owner role required to resolve a Sheet conflict');e.status=403;throw e;}
  if(!String(b.reason||'').trim())throw Error('Conflict resolution requires a reason');
  conflict=db.get('conflicts',b.resolveConflict);if(!conflict||conflict.orderId!==o.id)throw Error('Conflict is no longer available; refresh Settings');
  if(!['keep-local','apply-external'].includes(b.resolution))throw Error('Choose a conflict resolution');
  if(b.conflictVersion!==hash({external:conflict.external||null,at:conflict.at})){const e=Error('The Sheet conflict changed. Reopen it to review current values.');e.status=409;e.current=o;throw e;}
  if(b.resolution==='apply-external'&&!conflict.external)throw Error('This rejected change has no validated external values to apply');
  b={...b,correction:true};for(const key of allowed)delete b[key];
  if(b.resolution==='apply-external')for(const key of allowed)if(Object.hasOwn(conflict.external,key)&&conflict.external[key]!==undefined)b[key]=conflict.external[key];
 }
 for(const k of allowed)if(Object.hasOwn(b,k)&&JSON.stringify(b[k])!==JSON.stringify(o[k]))patch[k]=b[k];
 if(!Object.keys(patch).length&&!conflict)return o;
 if(['done','cancelled'].includes(o.status)&&!(actor==='owner'&&b.correction&&String(b.reason||'').trim()))throw Error('Completed or cancelled records require an owner correction with a reason');
 if(patch.status)checkTransition(o,patch.status,b.reason,{correction:!!b.correction,role:actor});
 if(patch.notes!=null&&(typeof patch.notes!=='string'||patch.notes.length>4000))throw Error('Notes must be at most 4000 characters');
 for(const k of ['needsDetails','deliveryIssue'])if(k in patch&&typeof patch[k]!=='boolean')throw Error('Attention flags must be true or false');
 for(const k of ['confirmedTotal','deliveryFee'])if(patch[k]!=null&&(!Number.isSafeInteger(patch[k])||patch[k]<0||patch[k]>100000000))throw Error('Use a non-negative amount of at most THB 1,000,000');
 if(('confirmedTotal'in patch||'deliveryFee'in patch)&&!String(b.reason||'').trim())throw Error('Quote or delivery fee changes require a reason');
 const net=paymentState(o,db.all('payments')).net;
 const nextQuote='confirmedTotal'in patch?patch.confirmedTotal:o.confirmedTotal,nextDelivery='deliveryFee'in patch?patch.deliveryFee:o.deliveryFee;if(('confirmedTotal'in patch||'deliveryFee'in patch)&&(nextQuote==null?net>0:nextQuote+(nextDelivery||0)<net))throw Error('The confirmed quote cannot be below recorded net receipts; record an audited refund first');
 const externalRevision=conflict?.external?.revision;if(externalRevision!=null&&(!Number.isSafeInteger(externalRevision)||externalRevision<0||externalRevision>1000000000))throw Error('The external revision is invalid; repair the protected Sheet revision before resolution');
 const updated={...o,...patch,revision:Math.max(o.revision,externalRevision||0)+1,updatedAt:iso(),updatedBy:actor,syncState:'pending'};
 const old=Object.fromEntries(Object.keys(patch).map(k=>[k,o[k]??null]));
 db.transaction(()=>{putOrder(updated);db.event(o.id,actor,{old,new:patch,revision:updated.revision,correction:!!b.correction,origin:b.origin||'staff-app',...(conflict?{conflictId:conflict.id,resolution:b.resolution}:{} )},String(b.reason||'').trim().slice(0,1000));if(conflict)db.remove('conflicts',conflict.id);if(b.operationId)db.put('staff_operations',b.operationId,{id:b.operationId,orderId:o.id,processed:'applied',processedAt:updated.updatedAt});});return updated;
}
export function recordPayment(db,order,b,actor){
 if(!['receipt','refund'].includes(b.type)||!Number.isSafeInteger(b.amount)||b.amount<=0||b.amount>100000000||!/^[-a-zA-Z0-9]{8,100}$/.test(String(b.requestId||'')))throw Error('Invalid payment event');
 const old=db.get('payments',b.requestId);if(old){if(old.orderId!==order.id||old.type!==b.type||old.amount!==b.amount||old.occurredAt!==new Date(b.occurredAt).toISOString()){const e=Error('This idempotency key belongs to a different payment');e.status=409;throw e;}return {payment:old,duplicate:true};}
 const occurred=new Date(b.occurredAt);if(!Number.isFinite(+occurred)||+occurred>Date.now()+60000)throw Error('Use a valid payment date no later than now');
 const state=paymentState(order,db.all('payments'));
 if(b.type==='refund'&&b.amount>state.net)throw Error('Refund exceeds recorded receipts');
 if(b.type==='refund'&&!String(b.reason||'').trim())throw Error('Refund requires a reason');
 if(b.type==='receipt'&&(order.confirmedTotal==null||b.amount>state.outstanding))throw Error('Confirm a quote first; receipts cannot exceed the outstanding balance');
 const payment={id:b.requestId,orderId:order.id,type:b.type,amount:b.amount,occurredAt:occurred.toISOString(),method:['bank_transfer','cash','card','other'].includes(b.method)?b.method:'bank_transfer',actor,externalReference:String(b.externalReference||'').slice(0,200),reason:String(b.reason||'').slice(0,1000),reversalOf:b.reversalOf||null};
 if(payment.reversalOf){const target=db.get('payments',payment.reversalOf);if(b.type!=='refund'||!target||target.orderId!==order.id||target.type!=='receipt')throw Error('A reversal must name a receipt on this order');}
 db.transaction(()=>{db.put('payments',payment.id,payment);db.put('payment_sync',payment.id,{id:payment.id,orderId:order.id,status:'pending',attempts:0,next:0});db.event(order.id,actor,{paymentId:payment.id,type:payment.type,amount:payment.amount,revision:order.revision,origin:'staff-app'},payment.reason);});return {payment,duplicate:false};
}
export function reportRevenue(db,params,at=new Date()){
 const today=legacy.time.today(at),from=params.get('from')||today.slice(0,7)+'-01',to=params.get('to')||today,group=params.get('group')||'day';
 const report=revenue(db.all('payments'),db.all('orders'),from,to,group,db.all('rollups'),db.all('coverage'));
 const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1,previousTo=legacy.util.addDays(from,-1),previousFrom=legacy.util.addDays(previousTo,-days+1);
 const previous=revenue(db.all('payments'),db.all('orders'),previousFrom,previousTo,group,db.all('rollups'),db.all('coverage'));
 const partial=to>=today,comparable=!partial&&report.coverageStatus==='complete'&&previous.coverageStatus==='complete';
 return {...report,comparison:{from:previousFrom,to:previousTo,net:previous.net,partial,comparable,label:partial?'Current period is partial; no percentage comparison':comparable?'Previous complete period of equal length':'Comparison unavailable: incomplete ledger coverage',percent:comparable&&previous.net!==0?100*(report.net-previous.net)/Math.abs(previous.net):null},lastLedgerSync:db.get('meta','last-sync')?.at||null};
}
// One serial worker owns replication. Browser tabs poll only the journal-backed local API.
export function createSyncWorker({db,sheet,putOrder,onState=()=>{},activeIntervalMs=5000,idleIntervalMs=30000,idleAfterMs=30000,clock=()=>Date.now()}){let running=false,requested=false,lastActivity=clock(),lastPoll=0,pollFailures=0,nextPollAt=0;
 const touch=()=>{const wasIdle=clock()-lastActivity>=idleAfterMs;lastActivity=clock();if(wasIdle)void tick({force:true});};
 const state={lastSync:null,error:null};
 function emit(){onState({...state});}
 async function tick({force=false}={}){if(running){if(force)requested=true;return;}for(const p of db.all('payments'))if(!db.get('payment_sync',p.id))db.put('payment_sync',p.id,{id:p.id,orderId:p.orderId,status:'pending',attempts:0,next:0});const readyWrite=[...db.all('queue'),...db.all('payment_sync')].some(q=>q.status==='pending'&&q.next<=Date.now());const delay=clock()-lastActivity>=idleAfterMs?idleIntervalMs:activeIntervalMs;if(!force&&!readyWrite&&(clock()<nextPollAt||lastPoll&&clock()-lastPoll<delay))return;running=true;lastPoll=clock();try{
  for(const op of db.all('queue').filter(q=>q.status==='pending'&&q.next<=Date.now()).sort((a,b)=>(a.revision||0)-(b.revision||0))){
   const o=db.get('orders',op.orderId);if(!o){db.remove('queue',op.id);continue;}
   // A newer revision supersedes an earlier queued snapshot for the same order.
   if(op.revision<o.revision){db.remove('queue',op.id);continue;}
   try{const existing=await sheet.getOperation?.(op.id);if(!existing)await sheet.upsert({...o,syncState:'synced'},op.id);const current=db.get('orders',o.id);if(current.revision===o.revision)db.put('orders',o.id,{...current,syncState:'synced'});db.remove('queue',op.id);state.lastSync=iso();state.error=null;}
   catch(e){op.attempts=(op.attempts||0)+1;op.next=Date.now()+retryDelay(op.attempts,e.retryAfter);op.lastError=String(e.status||'unavailable');op.unknownOutcome=!!e.unknownOutcome;if(op.attempts>=5||[400,401,403,409,422].includes(e.status))op.status='dead-letter';db.put('queue',op.id,op);state.error=op.status==='dead-letter'?'A write requires staff review':'Sync unavailable; pending writes are durable';}
  }
  for(const op of db.all('payment_sync').filter(q=>q.status==='pending'&&q.next<=Date.now())){const payment=db.get('payments',op.id);if(!payment){db.remove('payment_sync',op.id);continue;}try{await sheet.payments([payment]);db.put('payment_sync',op.id,{...op,status:'synced',syncedAt:iso()});}catch(e){op.attempts++;op.next=Date.now()+retryDelay(op.attempts,e.retryAfter);op.lastError=String(e.status||'unavailable');if(op.attempts>=5||[400,401,403,409,422].includes(e.status))op.status='dead-letter';db.put('payment_sync',op.id,op);state.error=op.status==='dead-letter'?'A payment write requires staff review':'Payment replication pending; receipt is saved locally';}}
  const auditEvents=db.all('events').filter(e=>!db.get('audit_sync',e.id));if(auditEvents.length){await sheet.audit?.(auditEvents);for(const event of auditEvents)db.put('audit_sync',event.id,{id:event.id,orderId:event.orderId,syncedAt:iso()});}

  const snapshot=await sheet.read();
  for(const row of snapshot.Bookings){const local=db.get('orders',row.id);if(!local){db.put('quarantine',String(row.id||'unknown'),{reason:'Unknown external order; dry-run import required',at:iso()});continue;}const owned=o=>({revision:o.revision,status:o.status,notes:o.notes,confirmedTotal:o.confirmedTotal,deliveryFee:o.deliveryFee,needsDetails:o.needsDetails,deliveryIssue:o.deliveryIssue});if(hash(owned(row))!==hash(owned(local))&&!db.all('queue').some(q=>q.orderId===row.id)){const previous=db.get('conflicts',row.id),external=owned(row),at=previous&&hash(previous.external)===hash(external)?previous.at:iso();db.put('conflicts',row.id,{id:row.id,orderId:row.id,reason:'Direct Sheet edit detected. Review current values; canonical data was not overwritten.',external,local:owned(local),at,version:hash({external,at})});}}
  for(const update of snapshot.StaffUpdates.filter(x=>!x.processed)){
   const prior=db.get('staff_operations',update.id);if(prior){await sheet.markStaffUpdate(update.id,prior);continue;}
   let result;try{const order=db.get('orders',update.orderId);if(!order)throw Error('Order not found');patchOrder(db,putOrder,order,{...update,operationId:update.id,origin:'Sheet StaffUpdates',correction:false},'staff');result={id:update.id,orderId:update.orderId,processed:'applied',processedAt:iso()};}
   catch(e){result={processed:'conflict',error:e.message,processedAt:iso()};db.put('conflicts',update.id,{id:update.id,orderId:update.orderId,reason:e.message,at:iso()});}
   db.put('staff_operations',update.id,result);await sheet.markStaffUpdate(update.id,result);
  }
  state.lastSync=iso();pollFailures=0;nextPollAt=0;if(!db.all('queue').length&&!db.all('payment_sync').some(p=>p.status!=='synced'))state.error=null;db.put('meta','last-sync',{at:state.lastSync});
 }catch(e){pollFailures++;nextPollAt=clock()+retryDelay(pollFailures,e.retryAfter);state.error='Local Sheet unavailable; showing last known records';}finally{running=false;emit();if(requested){requested=false;queueMicrotask(()=>tick({force:true}));}}}
 return {tick,touch,state};
}
