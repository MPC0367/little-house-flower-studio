import {hash,randomHex,authError} from './hosted-crypto.mjs';

const names={admin:'lhf_staff',customer:'lhf_customer'};
const responseNames={demo:'X-LHF-Demo-Session',admin:'X-LHF-Staff-Session',customer:'X-LHF-Customer-Session'};
const requestNames={admin:'x-lhf-staff-session',customer:'x-lhf-customer-session'};
export const secureAttribute=request=>new URL(request.url).protocol==='https:'?' Secure;':'';

export function sessionToken(request,kind){
  if(kind==='demo')return /^Bearer [a-f0-9]{64}$/.test(request.headers.get('authorization')||'')?request.headers.get('authorization').slice(7):null;
  const supplied=request.headers.get(requestNames[kind]);
  // An explicitly supplied but invalid token must not fall back to a cookie.
  if(supplied!==null)return /^[a-f0-9]{64}$/.test(supplied)?supplied:null;
  const cookies=Object.fromEntries((request.headers.get('cookie')||'').split(';').map(part=>part.trim().split('=')));
  return /^[a-f0-9]{64}$/.test(cookies[names[kind]]||'')?cookies[names[kind]]:null;
}

export function session(db,request,kind){
  const token=sessionToken(request,kind),record=token?db.get('sessions',hash(token)):null;
  return record&&record.kind===kind&&record.expires>Date.now()&&(
    kind==='customer'||record.authVersion===db.get('meta','staff-password')?.authVersion
  )?record:null;
}

export function issueSession(db,kind,cookies,request,responseHeaders){
  for(const old of db.all('sessions'))if(old.expires<=Date.now())db.remove('sessions',old.id);
  if(db.all('sessions').length>=300)throw authError('The demo is busy. Please try again later.',429);
  const token=randomHex(),seconds=kind==='customer'?129600:43200;
  const record={id:hash(token),kind,role:kind==='admin'?'owner':undefined,expires:Date.now()+seconds*1000,authVersion:db.get('meta','staff-password').authVersion};
  db.put('sessions',record.id,record);responseHeaders.set(responseNames[kind],token);
  if(kind!=='demo')cookies.push(`${names[kind]}=${token}; HttpOnly;${secureAttribute(request)} SameSite=Strict; Path=/; Max-Age=${seconds}`);
  return record;
}

export function exposeExistingSession(request,kind,responseHeaders){
  const token=sessionToken(request,kind);if(token)responseHeaders.set(responseNames[kind],token);
}
