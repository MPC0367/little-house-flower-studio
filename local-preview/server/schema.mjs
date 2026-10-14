import {statusLabels} from '../shared/config.mjs';
import {hash} from './domain.mjs';
export const legacyHeaders=['received','ref','status','dateNeeded','window','fulfil','items','brief','budget','subtotal','quoteNeeded','customerName','customerPhone','recipientName','recipientPhone','address','district','province','card','anonymous','lang','notes','id','customerLine','payment','source','writtenIso'];
export const legacyStatuses={'รอยืนยัน':'new','ยืนยันแล้ว':'confirmed','กำลังจัด':'preparing','พร้อมรับ':'ready','ออกจากบ้านแล้ว':'out','ถึงมือแล้ว':'done','ยกเลิก':'cancelled'};
export const schema={version:2,legacyHeaders,Bookings:['order_id','display_ref','request_id','schema_version','created_at_utc','needed_local_date','time_window_id','fulfillment','status_id','revision','sync_state'],OrderItems:['item_id','order_id','product_id','quantity','config_json','config_hash','preview_asset_id','preview_version'],Assets:['asset_id','role','storage_key','mime','width','height','content_hash','retention_until'],Payments:['payment_id','order_id','event_type','amount_satang','occurred_at_utc','actor'],StaffUpdates:['operation_id','order_id','expected_revision','change_json','processed'],RevenueDaily:['date','metric_version','gross_receipts','refunds','confirmed_order_value','completed'],Coverage:['from','to','status','source','reviewed_at']};
const alias={id:'id',ref:'ref',status:'status',confirmedtotal:'confirmedTotal',order_id:'id',display_ref:'ref',needed_local_date:'date',dateneeded:'date',date:'date',status_id:'status',created_at_utc:'createdAt',writteniso:'createdAt',received:'createdAt',fulfillment:'fulfil',customerphone:'customerPhone',recipientphone:'recipientPhone',customername:'customerName',recipientname:'recipientName',customerline:'customerLine',confirmed_total_satang:'confirmedTotal',subtotal:'legacySubtotalTHB'};
const normalizeHeader=s=>String(s).trim().replace(/^\uFEFF/,'').toLowerCase();
export function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;}
const moneyToSatang=value=>{const s=String(value).trim().replace(/฿|THB/gi,'').trim();if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(s))return null;const n=Math.round(Number(s.replaceAll(',',''))*100);return Number.isSafeInteger(n)?n:null;};
// The caller persists migrationMap in its sandbox. No live import or schema mutation occurs here.
export function dryRunImport(rows,{headers,migrationMap={}}={}){
 const objects=rows.map(row=>Array.isArray(row)?Object.fromEntries((headers||[]).map((h,i)=>[h,row[i]])):row);
 const recognizedHeaders=new Set(),unrecognizedHeaders=new Set(),seen=new Set(),accepted=[],quarantine=[],warnings=[];
 for(const [index,raw] of objects.entries()){if(!raw||typeof raw!=='object'||Array.isArray(raw)){quarantine.push({id:'invalid-row-'+index,reason:'Malformed row',reasons:['Malformed row'],review:{status:'review'}});continue;}const row={};for(const [name,value] of Object.entries(raw)){const normalized=normalizeHeader(name),key=alias[normalized]||Object.keys(raw).find(k=>k===name)||name;row[key]=value;if(alias[normalized]||legacyHeaders.map(normalizeHeader).includes(normalized)||['id','status','date','confirmedTotal'].includes(name))recognizedHeaders.add(name);else unrecognizedHeaders.add(name);}
 const identity=String(row.id||row.ref||hash(JSON.stringify(Object.entries(raw).sort(([a],[b])=>a.localeCompare(b)))));
 const key=String(row.id||migrationMap[identity]||('legacy-'+hash(identity).slice(0,20)));migrationMap[identity]=key;
 const reasons=[];if(seen.has(key))reasons.push('Duplicate ID');seen.add(key);
 const originalStatus=String(row.status||'').trim(),status=legacyStatuses[originalStatus]||(Object.hasOwn(statusLabels,originalStatus)?originalStatus:null);
 if(!status)reasons.push('Unknown legacy status');
 const date=String(row.date||'').trim();if(!validDate(date))reasons.push('Malformed date');
 for(const field of ['received','writtenIso','created_at_utc'])if(raw[field]!=null&&raw[field]!==''&&(!Number.isFinite(Date.parse(String(raw[field])))||!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(String(raw[field]))))reasons.push('Malformed timestamp: '+field);
 if(row.fulfil!=null&&!['pickup','delivery'].includes(row.fulfil))reasons.push('Unknown fulfillment');
 let confirmedTotal=row.confirmedTotal==null||row.confirmedTotal===''?null:Number(row.confirmedTotal);
 if(confirmedTotal!=null&&(!Number.isSafeInteger(confirmedTotal)||confirmedTotal<0))reasons.push('Malformed amount');
 const subtotal=row.legacySubtotalTHB==null||row.legacySubtotalTHB===''?null:moneyToSatang(row.legacySubtotalTHB);
 if(row.legacySubtotalTHB!=null&&row.legacySubtotalTHB!==''&&subtotal==null)reasons.push('Malformed legacy subtotal');
 // Legacy subtotal is an order value, not evidence of a confirmed quote or receipt.
 const historyIncomplete=!!row.payment&&!['unpaid','ยังไม่ชำระ','รอชำระ'].includes(String(row.payment).trim());
 for(const field of ['customerPhone','recipientPhone'])if(typeof row[field]==='number')warnings.push({id:key,field,reason:'Numeric phone source may have lost leading zeroes; verify before import'});
 const normalized={...row,legacy:{...raw},id:key,status:status||'review',originalStatus,date,confirmedTotal,legacySubtotalSatang:subtotal,customerPhone:String(row.customerPhone||''),recipientPhone:String(row.recipientPhone||''),historyIncomplete,schemaVersion:2};
 if(historyIncomplete)warnings.push({id:key,reason:'Legacy payment label has no trustworthy payment event date; exclude from receipts'});
 if(reasons.length)quarantine.push({id:key,reason:reasons.join('; '),reasons,review:normalized});else accepted.push(normalized);
 }
 const incoming=new Set([...recognizedHeaders].map(normalizeHeader));
 return {schemaVersion:2,rows:rows.length,accepted,quarantine,warnings,recognizedHeaders:[...recognizedHeaders],unrecognizedHeaders:[...unrecognizedHeaders],missingFields:['id','status','dateNeeded'].filter(k=>!incoming.has(normalizeHeader(k))&&!incoming.has({id:'order_id',status:'status_id',dateNeeded:'date'}[k])),migrationMap,destructive:false,backupRequiredBeforeApply:true};
}
