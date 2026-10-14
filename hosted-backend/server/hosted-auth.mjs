import {hash,verifyPassword,authError} from './hosted-crypto.mjs';
const cached=new Map(),pending=new Map();
export const hasValidPasswordCache=(password,record)=>typeof password==='string'&&(cached.get(record?.authVersion+':'+hash(password))||0)>Date.now();
export function basicPassword(request){
  const header=request.headers.get('authorization');
  if(!header||header.length>2048||!/^Basic [A-Za-z0-9+/]+={0,2}$/.test(header))return null;
  try{const bytes=Uint8Array.from(atob(header.slice(6)),c=>c.charCodeAt(0)),value=new TextDecoder('utf-8',{fatal:true}).decode(bytes),colon=value.indexOf(':');return value.slice(0,colon)==='client'?value.slice(colon+1):null;}catch{return null;}
}
export function checkAttempts(db,request,purpose='login'){
  const now=Date.now(),ledger=db.get('meta','auth-attempts')||{},client=hash(request.headers.get('cf-connecting-ip')||'local').slice(0,24);
  for(const key of [purpose+':'+client,purpose+':global']){const entry=ledger[key];if(entry&&entry.until>now&&entry.count>=(key.endsWith(':global')?40:8))throw authError('Too many attempts. Please wait a minute and try again.',429);}
}
export function recordAttempt(db,request,purpose='login'){
  const now=Date.now(),ledger=db.get('meta','auth-attempts')||{},client=hash(request.headers.get('cf-connecting-ip')||'local').slice(0,24);
  for(const [key,value] of Object.entries(ledger))if(value.until<=now)delete ledger[key];
  for(const key of [purpose+':'+client,purpose+':global']){const entry=ledger[key]||{until:now+60000,count:0};entry.count++;ledger[key]=entry;}
  db.put('meta','auth-attempts',ledger);
}
export async function checkedPassword(password,record){
  const now=Date.now(),key=record?.authVersion+':'+hash(typeof password==='string'?password:'');
  for(const [id,expiry] of cached)if(expiry<=now)cached.delete(id);
  if(cached.get(key)>now)return true;
  if(!pending.has(key))pending.set(key,verifyPassword(password,record).finally(()=>pending.delete(key)));
  const valid=await pending.get(key);
  if(valid){if(cached.size>=128)cached.delete(cached.keys().next().value);cached.set(key,now+30000);}
  return valid;
}
