import {PRICING_RULES_VERSION,pricingRules} from '../shared/pricing-rules.mjs';
import vm from 'node:vm';import fs from 'node:fs';import crypto from 'node:crypto';import {VERSION,visualConfig,validateConfig,nextStatuses,originalConfig} from '../shared/config.mjs';
const iso=d=>d.toISOString().slice(0,10);const ctx={LHF:{util:{iso,parseISO:s=>new Date(s+'T00:00:00Z'),addDays:(s,n)=>iso(new Date(new Date(s+'T00:00:00Z').getTime()+n*864e5)),clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),rnd:()=>crypto.randomBytes(3).toString('hex'),uid:()=>crypto.randomUUID()},i18n:{shopNow:()=>({iso:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date())})}},Intl,Date};vm.createContext(ctx);
for(const file of ['core/booking-engine.js','data/settings.js','data/catalog.js'])vm.runInContext(fs.readFileSync(new URL('../customer/'+file,import.meta.url),'utf8'),ctx);
export const legacy=ctx.LHF;export const catalog=JSON.parse(JSON.stringify(legacy.catalog.products));export const data=JSON.parse(JSON.stringify(legacy.data));
const imageJS=fs.readFileSync(new URL('../customer/data/images.js',import.meta.url),'utf8');export const images=JSON.parse(imageJS.match(/window.__LHF_IMAGES=(.*?);\n/)[1]);
export const hash=o=>crypto.createHash('sha256').update(typeof o==='string'?o:JSON.stringify(o)).digest('hex');export const visualKey=c=>hash(visualConfig(c));
export function estimate(c={},qty=1,today=legacy.time.today()){
 const p=catalog.find(x=>x.id===c.sourceProduct);const common={currency:'THB',rulesVersion:PRICING_RULES_VERSION,adjustmentRules:pricingRules.adjustments,catalogVersion:VERSION,deliveryFeeSatang:null,exclusions:['Delivery by distance','Unconfirmed substitutions'],confidence:'unknown',comparatorIds:p?[p.id]:[],expires:p?.priceValidUntil||null};
 const unchangedMatches=!c.style||(p&&JSON.stringify(visualConfig(c))===JSON.stringify(visualConfig(originalConfig(p))));
 if(!p||!c.unchanged||!unchangedMatches||!['fixed','tiers'].includes(p.pricing)||!p.price||today>p.priceValidUntil)return {...common,kind:'quote',low:null,high:null,reasons:['The shop must confirm this configuration and price.']};
 const unit=legacy.engine.tierPrice(p,qty)*100;return {...common,kind:'published',low:unit*qty,high:unit*qty,confidence:'published',breakdown:[{label:p.name.en,quantity:qty,unitSatang:unit}],reasons:[]};
}
export function validateOrder(b){
 if(!b||typeof b!=='object'||!b.id||!/^[-a-zA-Z0-9]{8,80}$/.test(b.id))throw Error('Valid request ID required');
 if(!['product','custom'].includes(b.type)||!['pickup','delivery'].includes(b.fulfil))throw Error('Invalid order type or fulfilment');
 if(!Array.isArray(b.items)||b.items.length>30)throw Error('Invalid items');
 if(b.items.some(i=>!catalog.some(p=>p.id===i.productId)||!Number.isInteger(i.qty)||i.qty<1||i.qty>(catalog.find(p=>p.id===i.productId)?.maxQty||20)))throw Error('Invalid product or quantity');
 const errors=legacy.engine.validate(b);if(Object.keys(errors).length)throw Error('Missing or invalid fields: '+Object.keys(errors).join(', '));
 const dateCtx=legacy.engine.ctx(data.bookingDefaults);const date=legacy.engine.dateStatus(b.date,dateCtx,null,{type:b.type,leadDays:legacy.engine.leadFor(b,data.bookingDefaults)});
 if(!date.ok||!legacy.engine.windowsFor(b.date,b.fulfil,dateCtx,null).some(w=>w.id===b.windowId&&w.ok))throw Error('Invalid date or time window');
 for(const s of [b.customer?.name,b.recipient?.name,b.customer?.phone,b.recipient?.phone,b.customer?.line])if(typeof s==='string'&&s.length>150)throw Error('Contact field too long');
 if(JSON.stringify(b.address||{}).length>2000||String(b.custom?.notes||'').length>1000||String(b.custom?.feel||'').length>300)throw Error('Details too long');
 if(b.type==='custom'&&!b.custom?.config)throw Error('Custom orders require a complete validated configuration');
 if(b.custom&&(!b.custom.config||typeof b.custom!=='object'))throw Error('Invalid custom design');
 if(b.custom?.config?.sourceProduct&&!catalog.some(p=>p.id===b.custom.config.sourceProduct))throw Error('Unknown source product');
 if(b.custom?.config&&typeof b.custom.config.unchanged!=='boolean')throw Error('Invalid source design flag');
 for(const [label,value,limit]of [['notes',b.custom?.notes,1000],['feel',b.custom?.feel,300],['occasion',b.custom?.occasion,100],['colourNote',b.colourNote,300]])if(value!=null&&(typeof value!=='string'||value.length>limit))throw Error('Invalid '+label);
 if(b.custom?.banknoteValue!=null&&(!Number.isFinite(Number(b.custom.banknoteValue))||Number(b.custom.banknoteValue)<0||Number(b.custom.banknoteValue)>10000000))throw Error('Invalid banknote amount');
 if(b.custom?.config){const e=validateConfig(b.custom.config,Object.keys(legacy.catalog.flowers).filter(x=>x!=='banknotes'));if(e.length)throw Error(e.join(' '));}
 return true;
}
export function paymentState(order,payments){const own=payments.filter(p=>p.orderId===order.id),net=own.reduce((n,p)=>n+(p.type==='refund'?-p.amount:p.amount),0),confirmedPayable=order.confirmedTotal==null?null:order.confirmedTotal+(order.deliveryFee||0);return {net,confirmedPayable,status:own.some(p=>p.type==='refund')?(net<=0?'refunded':'part-refunded'):net===0?'unpaid':confirmedPayable!=null&&net>=confirmedPayable?'paid':'part-paid',outstanding:confirmedPayable==null?null:Math.max(0,confirmedPayable-net)};}
const localDate=d=>legacy.time.today(new Date(d));
const shiftDate=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function revenue(payments,orders,from,to,group='day',rollups=[],coverage=[]){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||from>to||Date.parse(to)-Date.parse(from)>3660*86400000)throw Error('Use a valid report range of at most ten years');
 if(!['day','month'].includes(group))throw Error('Unsupported report grouping');
 const rows={}, includedPayments=[];let gross=0,refunds=0;
 for(let date=from;date<=to;date=shiftDate(date,1)){const key=group==='month'?date.slice(0,7):date;rows[key]??={period:key,gross:0,refunds:0,net:0,days:0,completeDays:0,eventCount:0,orderIds:[]};rows[key].days++;if(coverage.some(c=>c.status==='complete'&&date>=(c.from||c.date)&&date<=(c.to||c.date)))rows[key].completeDays++;}
 function add(date,g,r,orderId,eventCount=1){if(date<from||date>to)return;const k=group==='month'?date.slice(0,7):date;const row=rows[k];row.gross+=g;row.refunds+=r;row.net+=g-r;row.eventCount+=eventCount;if(orderId&&!row.orderIds.includes(orderId))row.orderIds.push(orderId);gross+=g;refunds+=r;}
 for(const p of payments){if(!p.occurredAt||!Number.isFinite(Date.parse(p.occurredAt))||!['receipt','refund'].includes(p.type))continue;const date=localDate(p.occurredAt);add(date,p.type==='receipt'?p.amount:0,p.type==='refund'?p.amount:0,p.orderId);if(date>=from&&date<=to)includedPayments.push(p);}
 for(const r of rollups)add(r.date,r.gross||0,r.refunds||0,null,r.eventCount||1);
 const resultRows=Object.values(rows).sort((a,b)=>a.period.localeCompare(b.period)).map(r=>({...r,coverage:r.completeDays===r.days?'complete':r.eventCount?'partial':'unknown',...(r.completeDays!==r.days&&!r.eventCount?{gross:null,refunds:null,net:null}:{})}));
 const complete=resultRows.every(r=>r.coverage==='complete'),anyData=resultRows.some(r=>r.coverage!=='unknown');
 const inRangeOrders=orders.filter(o=>o.date>=from&&o.date<=to),confirmed=inRangeOrders.filter(o=>!['new','cancelled','review'].includes(o.status));
 const outstandingOrders=confirmed.filter(o=>o.confirmedTotal!=null),unknownQuotes=inRangeOrders.filter(o=>o.confirmedTotal==null&&!['cancelled','done'].includes(o.status)).length;
 const selectedRollups=rollups.filter(r=>r.date>=from&&r.date<=to),confirmedValue=selectedRollups.reduce((n,r)=>n+(r.confirmedValue||0),0)+confirmed.reduce((n,o)=>n+(o.confirmedTotal||0),0);
 const stateNames={confirmed:'Not started',preparing:'In progress',ready:'Ready',out:'Shipped',done:'Completed'};
 return {gross:anyData?gross:null,refunds:anyData?refunds:null,net:anyData?gross-refunds:null,recordedGross:gross,recordedRefunds:refunds,recordedNet:gross-refunds,rows:resultRows,outstanding:outstandingOrders.reduce((n,o)=>n+paymentState(o,payments).outstanding,0),unknownQuotes,confirmedValue,completed:selectedRollups.reduce((n,r)=>n+(r.completed||0),0)+inRangeOrders.filter(o=>o.status==='done').length,confirmedCount:outstandingOrders.length,averageConfirmedValue:outstandingOrders.length?outstandingOrders.reduce((n,o)=>n+o.confirmedTotal,0)/outstandingOrders.length:null,deliveryFees:confirmed.reduce((n,o)=>n+(o.deliveryFee||0),0),banknoteValue:confirmed.reduce((n,o)=>n+(Number(o.custom?.banknoteValue)||0)*100,0),statusGroups:Object.entries(stateNames).map(([status,label])=>({status,label,count:inRangeOrders.filter(o=>o.status===status).length,orders:inRangeOrders.filter(o=>o.status===status).map(o=>({id:o.id,ref:o.ref}))})),historyIncompleteOrders:orders.filter(o=>o.historyIncomplete).length,coverage:complete?'Complete synthetic ledger coverage':anyData?'Partial history · recorded events only':'No recorded data',coverageStatus:complete?'complete':anyData?'partial':'unknown',range:{from,to},timezone:'Asia/Bangkok',currency:'THB',metricVersion:VERSION,amountBasis:'Cash: payment event date. Confirmed value and outstanding: requested handover date. Cancelled/new/review excluded from confirmed metrics.'};
}
export function checkTransition(order,status,reason,options={}){
 if(status===order.status)return;
 const normal=nextStatuses(order.status,order.fulfil).includes(status);
 const valid=['new','confirmed','preparing','ready','out','done','cancelled','review'].includes(status)&&!(order.fulfil==='pickup'&&status==='out');
 if(!normal&&!(valid&&options.correction&&options.role==='owner'))throw Error('Transition not allowed; owner correction required');
 if((status==='cancelled'||!normal||order.status==='review')&&!String(reason||'').trim())throw Error('Cancellation, review resolution or correction requires a reason');
}
export function safeCell(v){return /^[=+@\-\t\r]/.test(String(v))?"'"+v:v;}
