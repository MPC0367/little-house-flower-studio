/* The shop's Google Sheet, through the Studio script (google/studio.gs), the way O2's own dashboard
   app works with its Sheet: the Sheet stays the record people can open and edit; the script is the
   only thing that writes to it for the Studio; each person signs in with a personal key the owner
   issued; every write is logged in the Sheet's _Activity tab.
   Requests are POSTed as text/plain (no preflight); Apps Script answers with JSON after a redirect.
   The key travels in the body, never in the address. */
import {ApiError} from './source-demo.mjs?v=studio-20261015-1';

const STORE='lhf.studio.sheet.v1';
export function savedSheet(){
  for(const store of [sessionStorage,localStorage]){
    try{const value=JSON.parse(store.getItem(STORE)||'null');if(value?.url&&value?.key)return {...value,remember:store===localStorage};}catch{}
  }
  return null;
}
export function saveSheet({url,key,remember}){
  forgetSheet();
  try{(remember?localStorage:sessionStorage).setItem(STORE,JSON.stringify({url,key}));}catch{}
}
export function forgetSheet(){for(const store of [sessionStorage,localStorage])try{store.removeItem(STORE);}catch{}}
export const validScriptURL=url=>{
  try{const u=new URL(url);
    if(u.protocol==='https:'&&u.hostname==='script.google.com'&&/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)&&!u.search&&!u.hash)return true;
    // the local emulator (scripts/sheet-emulator.mjs) only on this computer
    return u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)&&/\/exec$/.test(u.pathname)&&['127.0.0.1','localhost'].includes(location.hostname);
  }catch{return false;}
};

export function sheetSource({url,key}){
  async function call(action,params={},{timeout=20000}={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    let response;
    try{
      response=await fetch(url,{method:'POST',redirect:'follow',cache:'no-store',credentials:'omit',signal:controller.signal,
        headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({studio:1,v:1,key,action,...params})});
    }catch(error){throw new ApiError(error.name==='AbortError'?'The Sheet took too long to answer.':'No connection to the Sheet.',{network:true});}
    finally{clearTimeout(timer);}
    let data=null;try{data=await response.json();}catch{}
    if(!response.ok||!data)throw new ApiError('The Studio script did not answer properly ('+response.status+').',{status:response.status||502});
    if(!data.ok)throw new ApiError(data.error||'The Sheet refused the request.',{status:data.status||400,current:data.current||null});
    return data;
  }
  return {
    kind:'sheet',
    async authConfig(){return {passwordProtected:false};},
    async me(){const me=await call('whoami');return {role:me.role,name:me.name,sheetName:me.sheetName,publicPreview:false,demo:false,version:me.version};},
    async orders({q=''}={}){const data=await call('orders',{q});return {orders:data.orders,lastSave:data.lastSave||null,pending:0,conflicts:data.conflicts||0,readAt:data.readAt};},
    async order(id){return (await call('order',{id})).order;},
    async update(id,{revision,fields,reason,correction=false,operationId}){return (await call('update',{id,expectedRevision:revision,fields,reason:reason||'',correction,operationId})).order;},
    async addPayment(id,payment){return (await call('addPayment',{id,payment})).payment;},
    async revenue({from,to,group}){return (await call('revenue',{from,to,group})).report;},
    async settings(){return (await call('settings')).settings;},
    referenceURL(){return null;},
    describe(){return {kind:'sheet',url};},
  };
}
