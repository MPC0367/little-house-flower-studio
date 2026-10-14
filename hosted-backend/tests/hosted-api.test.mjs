import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gate,handleHostedRequest} from '../server/hosted-api.mjs';
import {loadHostedJournal} from '../server/hosted-store.mjs';
import {hash} from '../server/hosted-crypto.mjs';
import {legacy} from '../server/domain.mjs';
import {defaultRecipe} from '../shared/recipes.mjs';
import siteAssetManifest from '../server/hosted-site-assets.json' with {type:'json'};

const initial='Synthetic hosted password 123',changed='Rotated synthetic password 456';
class MemoryD1 {
  row=null;
  prepare(sql){return {bind:(...values)=>({
    first:async()=>this.row?structuredClone(this.row):null,
    run:async()=>{
      if(sql.startsWith('INSERT')){if(this.row)return {meta:{changes:0}};this.row={version:values[1],payload:values[2]};return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE')){if(!this.row||this.row.version!==values[2])return {meta:{changes:0}};this.row={version:this.row.version+1,payload:values[0]};return {meta:{changes:1}};}
      throw Error('Unexpected statement');
    }
  })};}
}
function fixture(envOverrides={}){
  const blobs=new Map(),env={DB:new MemoryD1(),DEMO_PASSWORD:initial,BUCKET:{put:async(key,bytes)=>{blobs.set(key,bytes);},get:async key=>blobs.has(key)?{body:blobs.get(key)}:null,delete:async key=>blobs.delete(key)},...envOverrides};
  async function request(path,{password=initial,method='GET',body,cookie,origin='https://demo.example',headers={},raw}={}){
    const request=new Request('https://demo.example'+path,{method,headers:{...(password===null?{}:{Authorization:'Basic '+Buffer.from('client:'+password).toString('base64')}),Origin:origin,'X-CSRF':'local-preview',...(cookie?{Cookie:cookie}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:raw?{body:raw}:{})});
    const response=await handleHostedRequest(request,env),text=await response.text();let value;try{value=JSON.parse(text);}catch{value=text;}
    return {status:response.status,value,headers:response.headers,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  return {env,request,blobs};
}

test('synchronous Worker hash matches native SHA-256 including Unicode and long input',()=>{
  for(const value of ['', 'abc', 'ดอกไม้🌷', 'x'.repeat(100000)])assert.equal(hash(value),createHash('sha256').update(value).digest('hex'));
});

test('D1 bootstraps only synthetic data and CAS rejects a concurrent stale write',async()=>{
  const {env}=fixture(),[first,second]=await Promise.all([loadHostedJournal(env),loadHostedJournal(env)]);
  assert.ok(first.all('orders').length>=20);assert.ok(first.all('orders').every(order=>order.demo===true));
  assert.equal(JSON.stringify(first.payload).includes(initial),false);
  first.put('meta','race-winner',{value:'saved'});await first.commit();second.put('meta','race-loser',{value:'stale'});
  await assert.rejects(second.commit(),error=>error.status===409);
  const saved=await loadHostedJournal(env);assert.equal(saved.get('meta','race-winner').value,'saved');assert.equal(saved.get('meta','race-loser'),null);
  const missing={DB:new MemoryD1()};await assert.rejects(loadHostedJournal(missing),error=>error.status===503);assert.equal(missing.DB.row,null);
});

test('all paths require the demo gate; cross-origin writes and role-only login cannot bypass it',async()=>{
  const {env,request}=fixture();
  assert.equal((await request('/api/health',{password:null})).status,401);
  const publicAsset=new Request('https://demo.example/img/icon-32.png');assert.equal((await gate(publicAsset,env)).status,401);
  assert.equal((await request('/api/session',{method:'POST',body:{},origin:'https://evil.example'})).status,403);
  assert.equal((await request('/api/session',{method:'POST',body:{},headers:{'X-CSRF':'wrong'}})).status,403);
  assert.equal((await request('/api/admin/login',{method:'POST',body:{role:'owner'}})).status,401);
  assert.deepEqual((await request('/api/admin/auth-config')).value,{passwordProtected:true});
  const login=await request('/api/admin/login',{method:'POST',body:{role:'read-only',password:initial}});
  assert.equal(login.status,200);assert.equal(login.value.role,'owner');assert.match(login.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await request('/api/admin/orders')).status,401);
  assert.equal((await request('/api/admin/orders',{cookie:login.cookie})).status,200);
  const logout=await request('/api/admin/logout',{method:'POST',body:{},cookie:login.cookie});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await request('/api/admin/orders',{cookie:login.cookie})).status,401);
});

test('rotation persists across new requests, revokes stale sessions and invalidates old gate credentials',async()=>{
  const {request,env}=fixture(),login=await request('/api/admin/login',{method:'POST',body:{password:initial}});
  const wrong=await request('/api/admin/password',{method:'POST',cookie:login.cookie,body:{currentPassword:'Wrong current password',newPassword:changed}});assert.equal(wrong.status,401);
  const rotation=await request('/api/admin/password',{method:'POST',cookie:login.cookie,body:{currentPassword:initial,newPassword:changed}});assert.equal(rotation.status,200);
  assert.equal((await request('/api/admin/me',{cookie:login.cookie,password:changed})).status,401);
  assert.equal((await request('/api/admin/me',{cookie:rotation.cookie,password:changed})).status,200);
  assert.equal((await request('/api/health')).status,401);
  assert.equal((await request('/api/health',{password:changed})).status,200);
  const state=await loadHostedJournal(env);assert.equal(JSON.stringify(state.payload).includes(changed),false);
  assert.equal((await request('/api/admin/login',{password:changed,method:'POST',body:{password:initial}})).status,401);
});

test('guest orders persist with exact requested details and owner edits/payments retain idempotency',async()=>{
  const {request,env}=fixture(),guest=await request('/api/session',{method:'POST',body:{}}),staff=await request('/api/admin/login',{method:'POST',body:{password:initial}});
  const date=legacy.util.addDays(legacy.time.today(),3),booking={id:'synthetic-hosted-order-123',type:'product',items:[{productId:'white-rose',qty:1}],date,windowId:'p2',fulfil:'pickup',customer:{name:'Synthetic test customer',phone:'0800000000',line:'fake-handle'},recipient:{name:'Synthetic recipient',phone:'0800000000'},card:{message:'Synthetic card message'},colourNote:'Cream wrapping please',lang:'th',consent:true};
  const sent=await request('/api/orders',{method:'POST',cookie:guest.cookie,body:booking});assert.equal(sent.status,201,JSON.stringify(sent.value));
  const repeated=await request('/api/orders',{method:'POST',cookie:guest.cookie,body:booking});assert.equal(repeated.status,200);assert.equal(repeated.value.ref,sent.value.ref);
  assert.equal((await request('/api/orders/submission/'+booking.id)).status,404);
  const detail=await request('/api/admin/orders/'+booking.id,{cookie:staff.cookie});assert.equal(detail.value.colourNote,booking.colourNote);assert.equal(detail.value.date,date);assert.ok(detail.value.items[0].designSnapshot.wrap);
  const edited=await request('/api/admin/orders/'+booking.id,{method:'PATCH',cookie:staff.cookie,body:{expectedRevision:1,status:'confirmed',confirmedTotal:149000,reason:'Synthetic quote'}});assert.equal(edited.status,200,JSON.stringify(edited.value));
  assert.equal((await request('/api/admin/orders/'+booking.id,{method:'PATCH',cookie:staff.cookie,body:{expectedRevision:1,notes:'stale'}})).status,409);
  const payment={requestId:'synthetic-payment-123',type:'receipt',amount:50000,occurredAt:new Date().toISOString(),method:'cash'};
  assert.equal((await request('/api/admin/orders/'+booking.id+'/payments',{method:'POST',cookie:staff.cookie,body:payment})).status,201);
  assert.equal((await request('/api/admin/orders/'+booking.id+'/payments',{method:'POST',cookie:staff.cookie,body:payment})).status,200);
  const persisted=await loadHostedJournal(env);assert.equal(persisted.get('orders',booking.id).status,'confirmed');assert.equal(persisted.all('payments').filter(row=>row.id===payment.requestId).length,1);
  const revenue=await request('/api/admin/revenue',{cookie:staff.cookie});assert.equal(revenue.status,200);assert.equal(revenue.value.currency,'THB');
});

test('parallel internal sessions retry CAS safely and failed authentication throttles persist',async()=>{
  const {request,env}=fixture();await loadHostedJournal(env);
  const results=await Promise.all([request('/api/session',{method:'POST',body:{}}),request('/api/session',{method:'POST',body:{}})]);assert.ok(results.every(result=>result.status===200));assert.notEqual(results[0].cookie,results[1].cookie);
  let response;for(let i=0;i<9;i++)response=await request('/api/health',{password:'Incorrect synthetic password'});
  assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');
  assert.equal((await request('/api/health')).status,200,'Already verified viewers retain access during failed-attempt throttling');
});

test('private raster upload requires consent and ownership, and deletion persists',async()=>{
  const {request,blobs}=fixture(),guest=await request('/api/session',{method:'POST',body:{}}),other=await request('/api/session',{method:'POST',body:{}});
  const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/aXioAAAAASUVORK5CYII=','base64'));
  assert.equal((await request('/api/uploads',{method:'POST',cookie:guest.cookie,raw:png})).status,422);
  const uploaded=await request('/api/uploads',{method:'POST',cookie:guest.cookie,raw:png,headers:{'X-Upload-Consent':'yes','Content-Type':'image/png'}});assert.equal(uploaded.status,201,JSON.stringify(uploaded.value));
  assert.equal((await request(uploaded.value.url,{cookie:other.cookie})).status,404);
  const downloaded=await request(uploaded.value.url,{cookie:guest.cookie});assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('content-type'),'image/png');
  assert.equal((await request(uploaded.value.url,{method:'DELETE',cookie:guest.cookie,body:{}})).status,200);assert.equal(blobs.size,0);
  assert.equal((await request(uploaded.value.url,{cookie:guest.cookie})).status,404);
});

test('approved site uploads require owner session and CSRF and never rewrite the D1 document',async()=>{
  const {request,env,blobs}=fixture(),metadata=siteAssetManifest['/favicon.svg'],bytes=new Uint8Array(await readFile(new URL('../public/favicon.svg',import.meta.url))),route='/api/admin/site-assets/'+metadata.hash;
  assert.equal((await request(route,{method:'POST',raw:bytes})).status,401);
  const staff=await request('/api/admin/login',{method:'POST',body:{password:initial}}),version=env.DB.row.version;
  assert.equal((await request(route,{method:'POST',raw:bytes,cookie:staff.cookie,headers:{'X-CSRF':'wrong'}})).status,403);
  assert.equal((await request(route,{method:'POST',raw:bytes,cookie:staff.cookie,origin:'https://evil.example'})).status,403);
  const uploaded=await request(route,{method:'POST',raw:bytes,cookie:staff.cookie});assert.equal(uploaded.status,201,JSON.stringify(uploaded.value));assert.equal(uploaded.value.hash,metadata.hash);
  assert.equal(env.DB.row.version,version);assert.deepEqual(blobs.get('site-assets/'+metadata.hash),bytes);
  assert.equal((await request(route,{method:'PUT',raw:bytes,cookie:staff.cookie})).status,405);
  assert.equal((await request('/api/admin/site-assets/'+('f'.repeat(64)),{method:'POST',raw:bytes,cookie:staff.cookie})).status,404);
});

const githubOrigin='https://mpc0367.github.io';
const sessionHeader=(name,result)=>result.headers.get('X-LHF-'+name+'-Session');
const bearerHeaders=(token,extra={})=>({Authorization:'Bearer '+token,'Sec-Fetch-Site':'cross-site',...extra});

test('GitHub preflights work before authentication, with an exact origin and header allowlist',async()=>{
  const options=(origin=githubOrigin,url='https://demo.example/api/session',extra={})=>new Request(url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Authorization, Content-Type, X-CSRF, X-Upload-Consent, X-LHF-Customer-Session, X-LHF-Staff-Session',...extra}});
  const allowed=await gate(options(),{});assert.equal(allowed.status,204);assert.equal(allowed.headers.get('access-control-allow-origin'),githubOrigin);
  assert.match(allowed.headers.get('access-control-expose-headers'),/X-LHF-Demo-Session/);assert.equal(allowed.headers.has('access-control-allow-credentials'),false);
  for(const origin of ['https://evil.example','https://mpc0367.github.io.evil.example','https://sub.mpc0367.github.io','http://mpc0367.github.io','https://mpc0367.github.io:8443','null','http://127.0.0.1:5590']){
    const refused=await gate(options(origin),{});assert.equal(refused.status,403,origin);assert.equal(refused.headers.has('access-control-allow-origin'),false,origin);
  }
  assert.equal((await gate(options(githubOrigin,undefined,{'Access-Control-Request-Headers':'X-Role'}),{})).status,403);
  assert.equal((await gate(options(githubOrigin,undefined,{'Access-Control-Request-Method':'PUT'}),{})).status,403);
  assert.equal((await gate(options('http://127.0.0.1:5590','http://127.0.0.1:5580/api/session'),{})).status,204);
  assert.equal((await gate(options('http://127.0.0.1:5591','http://127.0.0.1:5580/api/session'),{})).status,403);
  assert.equal((await gate(options(githubOrigin,'https://demo.example/storefront.js'),{})).status,403);
});

test('GitHub demo login issues only a hashed expiring bearer token and errors retain readable CORS',async()=>{
  const {request,env}=fixture(),loginOptions={password:null,origin:githubOrigin,method:'POST'};
  const missing=await request('/api/health',{password:null,origin:githubOrigin});assert.equal(missing.status,401);assert.equal(missing.headers.get('access-control-allow-origin'),githubOrigin);
  assert.equal((await request('/api/demo-login',{...loginOptions,body:{password:initial},headers:{'X-CSRF':'wrong'}})).status,403);
  const wrong=await request('/api/demo-login',{...loginOptions,body:{password:'Incorrect synthetic password'}});assert.equal(wrong.status,401);assert.equal(wrong.headers.get('access-control-allow-origin'),githubOrigin);
  const login=await request('/api/demo-login',{...loginOptions,body:{password:initial}}),token=sessionHeader('Demo',login);
  assert.equal(login.status,200);assert.match(token,/^[a-f0-9]{64}$/);assert.equal(login.value.expiresIn,43200);assert.equal(login.headers.has('set-cookie'),false);
  const state=await loadHostedJournal(env),saved=state.get('sessions',hash(token));assert.equal(saved.kind,'demo');assert.ok(saved.expires>Date.now()+43100000);assert.equal(JSON.stringify(state.payload).includes(token),false);
  const authorized={password:null,origin:githubOrigin,headers:bearerHeaders(token)};
  assert.equal((await request('/api/catalogue',authorized)).status,200);
  assert.equal((await request('/api/admin/orders',authorized)).status,401);
  const asset=await gate(new Request('https://demo.example/img/icon-32.png',{headers:{Authorization:'Bearer '+token}}),env);assert.equal(asset.status,401,'A demo token never opens protected static files');
  const hostile=await request('/api/session',{...authorized,origin:'https://evil.example',method:'POST',body:{}});assert.equal(hostile.status,403);assert.equal(hostile.headers.has('access-control-allow-origin'),false);
  const expired=await loadHostedJournal(env);expired.put('sessions',saved.id,{...saved,expires:Date.now()-1});await expired.commit();assert.equal((await request('/api/health',authorized)).status,401);
});

test('GitHub customer and staff tokens retain ownership, role boundaries and logout revocation without cookies',async()=>{
  const {request}=fixture();
  const login=await request('/api/demo-login',{password:null,origin:githubOrigin,method:'POST',body:{password:initial}}),demo=sessionHeader('Demo',login);
  const base={password:null,origin:githubOrigin,headers:bearerHeaders(demo)},post={...base,method:'POST'};
  const customer=await request('/api/session',{...post,body:{}}),customerToken=sessionHeader('Customer',customer);
  assert.match(customerToken,/^[a-f0-9]{64}$/);
  const customerHeaders=bearerHeaders(demo,{'X-LHF-Customer-Session':customerToken});
  const repeated=await request('/api/session',{...post,headers:customerHeaders,body:{}});assert.equal(sessionHeader('Customer',repeated),customerToken);assert.equal(repeated.value.session,customer.value.session);
  const spoofed=await request('/api/admin/orders',{...base,headers:bearerHeaders(demo,{'X-LHF-Staff-Session':customerToken})});assert.equal(spoofed.status,401);
  assert.equal((await request('/api/admin/login',{...post,body:{role:'owner'}})).status,401);
  const staff=await request('/api/admin/login',{...post,body:{password:initial,role:'read-only'}}),staffToken=sessionHeader('Staff',staff);
  assert.match(staffToken,/^[a-f0-9]{64}$/);assert.equal(staff.value.role,'owner');
  assert.equal((await request('/api/admin/me',{...base,headers:bearerHeaders(staffToken,{'X-LHF-Staff-Session':staffToken})})).status,401,'A staff session cannot substitute for the demo gate');
  const date=legacy.util.addDays(legacy.time.today(),3),booking={id:'synthetic-github-order-123',type:'product',items:[{productId:'white-rose',qty:1}],date,windowId:'p2',fulfil:'pickup',customer:{name:'Synthetic GitHub customer',phone:'0800000000'},recipient:{name:'Synthetic recipient',phone:'0800000000'},card:{message:'Synthetic card'},colourNote:'Pink wrapping please',lang:'th',consent:true};
  const sent=await request('/api/orders',{...post,headers:customerHeaders,body:booking});assert.equal(sent.status,201,JSON.stringify(sent.value));
  assert.equal((await request('/api/orders/submission/'+booking.id,{...base,headers:customerHeaders})).status,200);
  const other=await request('/api/session',{...post,body:{}});
  assert.equal((await request('/api/orders/submission/'+booking.id,{...base,headers:bearerHeaders(demo,{'X-LHF-Customer-Session':sessionHeader('Customer',other)})})).status,404);
  const staffHeaders=bearerHeaders(demo,{'X-LHF-Staff-Session':staffToken});
  assert.equal((await request('/api/admin/orders/'+booking.id,{...base,headers:staffHeaders})).value.colourNote,booking.colourNote);
  assert.equal((await request('/api/admin/orders',{...base,cookie:staff.cookie,headers:bearerHeaders(demo,{'X-LHF-Staff-Session':'invalid'})})).status,401,'Explicit malformed header cannot fall back to a privileged cookie');
  const logout=await request('/api/admin/logout',{...post,headers:staffHeaders,body:{}});assert.equal(logout.status,200);assert.equal(sessionHeader('Staff',logout),'');
  assert.equal((await request('/api/admin/orders',{...base,headers:staffHeaders})).status,401);
  assert.equal((await request('/api/catalogue',base)).status,200);
});

test('GitHub password rotation revokes every old demo/staff token and returns usable replacement tokens',async()=>{
  const {request}=fixture(),login=await request('/api/demo-login',{password:null,origin:githubOrigin,method:'POST',body:{password:initial}}),oldDemo=sessionHeader('Demo',login);
  const base={password:null,origin:githubOrigin,headers:bearerHeaders(oldDemo)},post={...base,method:'POST'};
  const customer=await request('/api/session',{...post,body:{}}),customerToken=sessionHeader('Customer',customer);
  const first=await request('/api/admin/login',{...post,body:{password:initial}}),second=await request('/api/admin/login',{...post,body:{password:initial}});
  const rotated=await request('/api/admin/password',{...post,headers:bearerHeaders(oldDemo,{'X-LHF-Staff-Session':sessionHeader('Staff',first)}),body:{currentPassword:initial,newPassword:changed}});
  assert.equal(rotated.status,200);const demo=sessionHeader('Demo',rotated),staff=sessionHeader('Staff',rotated);assert.match(demo,/^[a-f0-9]{64}$/);assert.match(staff,/^[a-f0-9]{64}$/);assert.notEqual(demo,oldDemo);
  assert.equal((await request('/api/health',base)).status,401);
  const refreshed={...base,headers:bearerHeaders(demo)};
  for(const oldStaff of [sessionHeader('Staff',first),sessionHeader('Staff',second)])assert.equal((await request('/api/admin/me',{...refreshed,headers:bearerHeaders(demo,{'X-LHF-Staff-Session':oldStaff})})).status,401);
  assert.equal((await request('/api/admin/me',{...refreshed,headers:bearerHeaders(demo,{'X-LHF-Staff-Session':staff})})).status,200);
  const continued=await request('/api/session',{...refreshed,method:'POST',headers:bearerHeaders(demo,{'X-LHF-Customer-Session':customerToken}),body:{}});assert.equal(sessionHeader('Customer',continued),customerToken,'The active browser retains ownership of its synthetic requests');
  assert.equal((await request('/api/demo-login',{password:null,origin:githubOrigin,method:'POST',body:{password:initial}})).status,401);
  assert.equal((await request('/api/demo-login',{password:null,origin:githubOrigin,method:'POST',body:{password:changed}})).status,200);
});

test('demo-login failed-attempt throttles persist and return CORS-readable errors',async()=>{
  const {request}=fixture();let result;
  for(let index=0;index<9;index++)result=await request('/api/demo-login',{password:null,origin:githubOrigin,method:'POST',body:{password:'Incorrect synthetic password'}});
  assert.equal(result.status,429);assert.equal(result.headers.get('retry-after'),'60');assert.equal(result.headers.get('access-control-allow-origin'),githubOrigin);
});

test('explicit public preview opens the storefront, customer flow and normal Studio operations without passwords',async()=>{
  const {request,env,blobs}=fixture({LHF_PUBLIC_PREVIEW:'true'}),anonymous={password:null,origin:githubOrigin};
  assert.equal(await gate(new Request('https://demo.example/'),env),null);
  assert.equal(await gate(new Request('https://demo.example/studio/'),env),null);
  const health=await request('/api/health',anonymous);assert.equal(health.status,200);assert.equal(health.value.publicPreview,true);assert.equal(health.headers.get('access-control-allow-origin'),githubOrigin);
  assert.equal((await request('/api/catalogue',anonymous)).status,200);
  assert.deepEqual((await request('/api/admin/auth-config',anonymous)).value,{passwordProtected:false,publicPreview:true});
  assert.deepEqual((await request('/api/admin/me',anonymous)).value,{role:'owner',demo:true,publicPreview:true});
  assert.equal((await request('/api/admin/orders',anonymous)).status,200);
  assert.equal((await request('/api/admin/settings',anonymous)).value.publicPreview,true);
  const login=await request('/api/demo-login',{...anonymous,method:'POST',body:{}});assert.equal(login.status,200);assert.equal(login.value.publicPreview,true);assert.equal(sessionHeader('Demo',login),null);
  const customer=await request('/api/session',{...anonymous,method:'POST',body:{}}),token=sessionHeader('Customer',customer);assert.match(token,/^[a-f0-9]{64}$/);
  const owner={...anonymous,headers:{'X-LHF-Customer-Session':token}};
  for(const [path,metadata]of Object.entries(siteAssetManifest))if(path.startsWith('/img/hosted-sprites/'))blobs.set('site-assets/'+metadata.hash,new Uint8Array(await readFile(new URL('../public'+path,import.meta.url))));
  const config={...defaultRecipe('bouquet').config,flowers:['lisianthus'],palette:'pink-white',finish:'black',ribbon:'burgundy'};
  assert.equal((await request('/api/preview',{...anonymous,method:'POST',body:{config}})).status,401,'The public demo still requires a customer session for previews');
  const preview=await request('/api/preview',{...owner,method:'POST',body:{config}});assert.equal(preview.status,200,JSON.stringify(preview.value));assert.equal(preview.value.status,'ready');assert.equal(preview.value.asset.kind,'composition');
  const previewImage=await request(preview.value.asset.url,anonymous);assert.equal(previewImage.status,200);assert.match(previewImage.value,/<svg/);
  const date=legacy.util.addDays(legacy.time.today(),3),booking={id:'synthetic-public-preview-123',type:'custom',items:[],date,windowId:'p2',fulfil:'pickup',custom:{config,style:'bouquet',budgetTier:'b2',previewAssetId:preview.value.asset.id,notes:'Public synthetic custom order'},customer:{name:'Synthetic public customer',phone:'0800000000'},recipient:{name:'Synthetic recipient',phone:'0800000000'},card:{message:'Synthetic card'},colourNote:'Pink wrapping please',lang:'th',consent:true};
  const sent=await request('/api/orders',{...owner,method:'POST',body:booking});assert.equal(sent.status,201,JSON.stringify(sent.value));
  assert.equal((await request('/api/orders/submission/'+booking.id,anonymous)).status,404);
  assert.equal((await request('/api/orders/submission/'+booking.id,owner)).status,200);
  const detail=await request('/api/admin/orders/'+booking.id,anonymous);assert.equal(detail.status,200);assert.equal(detail.value.custom.config.finish,'black');assert.equal(detail.value.date,date);
  const edited=await request('/api/admin/orders/'+booking.id,{...anonymous,method:'PATCH',body:{expectedRevision:1,status:'confirmed',confirmedTotal:149000,reason:'Synthetic public preview quote'}});assert.equal(edited.status,200,JSON.stringify(edited.value));assert.equal(edited.value.status,'confirmed');
  assert.equal((await request('/api/admin/orders/'+booking.id,anonymous)).value.confirmedTotal,149000);
  assert.equal((await request('/api/admin/logout',{...anonymous,method:'POST',body:{}})).status,200);
});

test('public preview retains origin/CSRF checks, customer upload ownership and disabled password editing',async()=>{
  const {request,env}=fixture({LHF_PUBLIC_PREVIEW:'true'}),anonymous={password:null,origin:githubOrigin};
  assert.equal((await request('/api/admin/orders',{...anonymous,origin:'https://evil.example'})).status,403);
  assert.equal((await request('/api/session',{...anonymous,method:'POST',body:{},origin:'https://mpc0367.github.io.evil.example'})).status,403);
  assert.equal((await request('/api/session',{...anonymous,method:'POST',body:{},headers:{'X-CSRF':'wrong'}})).status,403);
  const before=(await loadHostedJournal(env)).get('meta','staff-password').authVersion;
  const disabled=await request('/api/admin/password',{...anonymous,method:'POST',body:{currentPassword:initial,newPassword:changed}});assert.equal(disabled.status,409);assert.match(disabled.value.error,/disabled/);assert.equal(disabled.headers.get('access-control-allow-origin'),githubOrigin);
  assert.equal((await loadHostedJournal(env)).get('meta','staff-password').authVersion,before);
  const first=await request('/api/session',{...anonymous,method:'POST',body:{}}),second=await request('/api/session',{...anonymous,method:'POST',body:{}});
  const owner={...anonymous,headers:{'X-LHF-Customer-Session':sessionHeader('Customer',first)}};
  const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/aXioAAAAASUVORK5CYII=','base64'));
  assert.equal((await request('/api/uploads',{...anonymous,method:'POST',raw:png,headers:{'X-Upload-Consent':'yes'}})).status,401);
  assert.equal((await request('/api/uploads',{...owner,method:'POST',raw:png})).status,422);
  const uploaded=await request('/api/uploads',{...owner,method:'POST',raw:png,headers:{...owner.headers,'X-Upload-Consent':'yes','Content-Type':'image/png'}});assert.equal(uploaded.status,201,JSON.stringify(uploaded.value));
  assert.equal((await request(uploaded.value.url,anonymous)).status,404);
  assert.equal((await request(uploaded.value.url,{...anonymous,headers:{'X-LHF-Customer-Session':sessionHeader('Customer',second)}})).status,404);
  assert.equal((await request(uploaded.value.url,owner)).status,200);
  assert.equal((await request(uploaded.value.url,{...owner,method:'DELETE',body:{}})).status,200);
});

test('public preview never opens deployment uploads or bypasses the synthetic database guard',async()=>{
  const {request,env,blobs}=fixture(),demoLogin=await request('/api/demo-login',{password:null,origin:githubOrigin,method:'POST',body:{password:initial}}),demo=sessionHeader('Demo',demoLogin);
  env.LHF_PUBLIC_PREVIEW='true';
  const metadata=siteAssetManifest['/favicon.svg'],bytes=new Uint8Array(await readFile(new URL('../public/favicon.svg',import.meta.url))),route='/api/admin/site-assets/'+metadata.hash;
  const anonymous={password:null,origin:githubOrigin,method:'POST',raw:bytes};
  assert.equal((await request(route,anonymous)).status,401);
  assert.equal((await request(route,{...anonymous,headers:bearerHeaders(demo)})).status,401,'A demo token cannot substitute for deployment Basic Auth');
  assert.equal((await request(route,{...anonymous,password:initial})).status,401,'Basic Auth alone cannot substitute for a real staff session');
  assert.equal((await request('/api/admin/login',{password:null,method:'POST',body:{role:'owner'}})).status,401);
  const staff=await request('/api/admin/login',{method:'POST',body:{password:initial}});assert.equal(staff.status,200);
  assert.equal((await request(route,{...anonymous,headers:{'X-LHF-Staff-Session':sessionHeader('Staff',staff)}})).status,401);
  assert.equal((await request(route,{...anonymous,password:initial,headers:{'X-LHF-Staff-Session':sessionHeader('Staff',staff)}})).status,201);
  assert.deepEqual(blobs.get('site-assets/'+metadata.hash),bytes);
  for(const flag of ['false','yes',true,1]){env.LHF_PUBLIC_PREVIEW=flag;assert.equal((await request('/api/health',{password:null})).status,401);}
  env.LHF_PUBLIC_PREVIEW='true';const state=await loadHostedJournal(env);state.put('meta','hosted-demo',{synthetic:false});await state.commit();
  assert.equal((await request('/api/health',{password:null})).status,503);assert.equal((await request('/api/admin/orders',{password:null})).status,503);
});
