/* The demo back end (hosted-backend/server/hosted-api.mjs): orders, payments and reports as the
   website saves them. On GitHub Pages, /little-house-flower-studio/api/ is relayed to it by pages-sw.js. Every write sends the
   X-CSRF header the server requires and the revision the edit was based on. */
export class ApiError extends Error{
  constructor(message,{status=0,current=null,network=false}={}){super(message);this.status=status;this.current=current;this.network=network;}
}
async function call(path,{method='GET',body,timeout=15000}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  let response;
  try{
    response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,
      headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF':'local-preview'}:{})},
      ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  }catch(error){throw new ApiError(error.name==='AbortError'?'The request took too long.':'No connection.',{network:true});}
  finally{clearTimeout(timer);}
  let data=null;try{data=await response.json();}catch{}
  if(!response.ok)throw new ApiError(data?.error||('Request failed ('+response.status+')'),{status:response.status,current:data?.current||null});
  return data;
}

export const demoSource={
  kind:'demo',
  async authConfig(){return call('/little-house-flower-studio/api/admin/auth-config');},
  async signIn(password){return call('/little-house-flower-studio/api/admin/login',{method:'POST',body:{password}});},
  async signOut(){return call('/little-house-flower-studio/api/admin/logout',{method:'POST',body:{}});},
  async me(){const me=await call('/little-house-flower-studio/api/admin/me');return {role:me.role,name:null,publicPreview:!!me.publicPreview,demo:true};},
  /** compact rows; search runs on the server because only it can see phone numbers */
  async orders({q=''}={}){
    const data=await call('/little-house-flower-studio/api/admin/orders'+(q?'?q='+encodeURIComponent(q):''));
    // the demo server reports the time of each request as its "last sync"; it has no Sheet, so the
    // Studio shows only when it last loaded and when the server last saved
    return {orders:data.orders,lastSave:data.sync?.lastSave||null,pending:0,conflicts:data.sync?.conflicts||0};
  },
  async order(id){return call(`/little-house-flower-studio/api/admin/orders/${encodeURIComponent(id)}`);},
  /** fields: status, notes, confirmedTotal, deliveryFee, needsDetails, deliveryIssue; plus reason, correction */
  async update(id,{revision,fields,reason,correction=false,operationId}){
    return call(`/little-house-flower-studio/api/admin/orders/${encodeURIComponent(id)}`,{method:'PATCH',body:{...fields,expectedRevision:revision,...(reason?{reason}:{}),...(correction?{correction:true}:{}),operationId}});
  },
  async addPayment(id,payment){return call(`/little-house-flower-studio/api/admin/orders/${encodeURIComponent(id)}/payments`,{method:'POST',body:payment});},
  async revenue({from,to,group}){return call(`/little-house-flower-studio/api/admin/revenue?from=${from}&to=${to}&group=${group}`);},
  async settings(){return call('/little-house-flower-studio/api/admin/settings');},
  /** private customer reference photos: the server opens them only for a signed-in staff session */
  referenceURL(order){return order.custom?.referenceAssetId?`/little-house-flower-studio/api/assets/${order.custom.referenceAssetId}`:null;},
  describe(){return {kind:'demo'};},
};
