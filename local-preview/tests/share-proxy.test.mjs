import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {once} from 'node:events';
import {createShareProxy,shareURL} from '../server/share-proxy.mjs';
const customerURL='https://customer-review-example.trycloudflare.com',studioURL='https://studio-review-example.trycloudflare.com',password='test-only review password';
const basic=value=>'Basic '+Buffer.from('client:'+value).toString('base64');
async function fixture(t,options={}){
 let context={customerURL,studioURL},currentPassword=password,version='one',calls=0,protectedMode=true,verifyHook=null;const received=[];
 const auth={getConfig:()=>({passwordProtected:protectedMode}),getVersion:()=>version,verify:async value=>{calls++;if(verifyHook)await verifyHook();return value===currentPassword;}};
 const upstream=http.createServer(async(req,res)=>{const body=[];for await(const chunk of req)body.push(chunk);received.push({url:req.url,method:req.method,headers:req.headers,body:Buffer.concat(body).toString()});
  if(req.url==='/'){const html='<html><head><title>Review</title></head><body><div class="local-banner">LOCAL PREVIEW</div></body></html>';res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':Buffer.byteLength(html)});res.end(html);}
  else if(req.url==='/media/loader.mp4'){const full=Buffer.from([1,2,3,4,5,6]),partial=req.headers.range==='bytes=0-1',data=partial?full.subarray(0,2):full;res.writeHead(partial?206:200,{'Content-Type':'video/mp4','Content-Length':data.length,'Accept-Ranges':'bytes',...(partial?{'Content-Range':'bytes 0-1/6'}:{})});res.end(req.method==='HEAD'?undefined:data);}
  else{res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':['lhf_staff=session; HttpOnly; SameSite=Strict; Path=/','other=second; Secure; HttpOnly'],'Access-Control-Allow-Origin':req.headers.origin||'none','Cache-Control':'public,max-age=300'});res.end(JSON.stringify({ok:true}));}
 });upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const internalPort=upstream.address().port,proxy=createShareProxy({kind:'customer',internalPort,auth,getContext:()=>context,...options});proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
 t.after(async()=>{proxy.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>proxy.close(r)),new Promise(r=>upstream.close(r))]);});
 const request=({url='/',method='GET',headers={},body,authenticate=true}={})=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:proxy.address().port,path:url,method,agent:false,headers:{Host:new URL(customerURL).host,...(authenticate?{Authorization:basic(currentPassword)}:{}),...headers}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',reject);});req.on('error',reject);req.end(body);});
 return {request,received,internalPort,setContext:value=>context=value,setPassword:value=>{currentPassword=value;version+='x';},setProtected:value=>protectedMode=value,setVerify:value=>verifyHook=value,calls:()=>calls};
}

test('only exact HTTPS quick-tunnel origins are accepted as trusted context',()=>{
 assert.equal(shareURL(customerURL),customerURL);
 for(const url of ['http://x.trycloudflare.com','https://trycloudflare.com','https://x.trycloudflare.com.attacker.test','https://x.trycloudflare.com/path','https://user:x@x.trycloudflare.com','https://x.trycloudflare.com:8443','https://x.trycloudflare.com/?redirect=x','https://x.trycloudflare.com/#x'])assert.equal(shareURL(url),null,url);
});
test('all routes fail closed without configured password, discovered origins or credentials',async t=>{
 const f=await fixture(t);for(const url of ['/','/api/admin/orders','/media/loader.mp4']){const r=await f.request({url,authenticate:false});assert.equal(r.status,401);assert.match(r.headers['www-authenticate'],/^Basic /);}
 f.setContext({});assert.equal((await f.request()).status,401);f.setContext({customerURL,studioURL});f.setProtected(false);assert.equal((await f.request()).status,401);assert.equal(f.received.length,0);
});
test('wrong host and foreign or absent mutation origins cannot reach the backend',async t=>{
 const f=await fixture(t);
 for(const headers of [{Host:'localhost:5383'},{Host:'attacker.test'},{Origin:studioURL},{Origin:'null'},{Origin:'https://attacker.test'}])assert.equal((await f.request({headers})).status,403);
 assert.equal((await f.request({method:'POST',url:'/api/orders',body:'{}'})).status,403);
 assert.equal((await f.request({headers:{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'no-cors'}})).status,403);assert.equal(f.received.length,0);
 assert.equal((await f.request({headers:{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate'}})).status,200);
});
test('authenticated forwarding rewrites only the trusted origin and strips credentials and spoofed proxy headers',async t=>{
 const f=await fixture(t),r=await f.request({method:'POST',url:'/api/session',body:'{}',headers:{Origin:customerURL,'Content-Type':'application/json','X-CSRF':'local-preview','X-Forwarded-Host':'attacker.test',Forwarded:'host=attacker.test','CF-Connecting-IP':'192.0.2.1',Referer:customerURL+'/custom'}});
 assert.equal(r.status,200);const sent=f.received[0];assert.equal(sent.headers.host,'127.0.0.1:'+f.internalPort);assert.equal(sent.headers.origin,'http://127.0.0.1:'+f.internalPort);assert.equal(sent.headers.referer,'http://127.0.0.1:'+f.internalPort+'/custom');assert.equal(sent.headers.authorization,undefined);assert.equal(sent.headers['x-forwarded-host'],undefined);assert.equal(sent.headers.forwarded,undefined);assert.equal(sent.headers['cf-connecting-ip'],undefined);assert.equal(sent.headers['x-csrf'],'local-preview');assert.equal(sent.body,'{}');
 assert.match(r.headers['set-cookie'][0],/; Secure$/);assert.equal(r.headers['set-cookie'][1].match(/Secure/g).length,1);assert.equal(r.headers['access-control-allow-origin'],undefined);assert.equal(r.headers['cache-control'],'private, no-store');assert.equal(r.headers['x-robots-tag'],'noindex, nofollow');
});
test('HTML gets trusted client URLs and demonstration label, while Safari ranges remain exact',async t=>{
 const f=await fixture(t),page=await f.request();assert.equal(page.status,200);const html=page.body.toString();assert.match(html,/window\.LHF_SHARE_CONTEXT=/);assert.ok(html.includes(JSON.stringify({customerURL,studioURL})));assert.match(html,/CLIENT PREVIEW/);assert.equal(Number(page.headers['content-length']),page.body.length);
 const media=await f.request({url:'/media/loader.mp4',headers:{Range:'bytes=0-1'}});assert.equal(media.status,206);assert.equal(media.headers['content-range'],'bytes 0-1/6');assert.equal(media.headers['accept-ranges'],'bytes');assert.deepEqual(media.body,Buffer.from([1,2]));
 const head=await f.request({url:'/media/loader.mp4',method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers['content-length'],'6');assert.equal(head.body.length,0);
});
test('successful credential caching expires and password rotation immediately rejects the old password',async t=>{
 let at=1000;const f=await fixture(t,{now:()=>at,cacheMs:100});assert.equal((await f.request()).status,200);assert.equal((await f.request()).status,200);assert.equal(f.calls(),1);at+=101;assert.equal((await f.request()).status,200);assert.equal(f.calls(),2);
 f.setPassword('a different test-only password');assert.equal((await f.request({headers:{Authorization:basic(password)}})).status,401);assert.equal((await f.request()).status,200);assert.equal(f.calls(),4);
});
test('parallel asset requests share one password derivation when the success cache expires',async t=>{
 let at=1000;const f=await fixture(t,{now:()=>at,cacheMs:100});await f.request();assert.equal(f.calls(),1);at+=101;let release;f.setVerify(()=>new Promise(resolve=>release=resolve));
 const requests=Array.from({length:12},()=>f.request({url:'/media/loader.mp4'}));while(f.calls()<2)await new Promise(resolve=>setTimeout(resolve,5));await new Promise(resolve=>setTimeout(resolve,15));assert.equal(f.calls(),2);release();const results=await Promise.all(requests);assert.ok(results.every(r=>r.status===200));assert.equal(f.calls(),2);
});
test('failed authentication and concurrent verification are bounded without forwarding',async t=>{
 const f=await fixture(t);for(let n=0;n<8;n++)assert.equal((await f.request({headers:{Authorization:basic('incorrect password')}})).status,401);assert.equal((await f.request({headers:{Authorization:basic('incorrect password')}})).status,429);assert.equal(f.calls(),8);assert.equal(f.received.length,0);
 const g=await fixture(t);let release;g.setVerify(()=>new Promise(r=>release=r));const first=g.request();while(g.calls()===0)await new Promise(r=>setTimeout(r,5));g.setPassword('rotated while verification pending');release();assert.equal((await first).status,401);assert.equal(g.received.length,0);
});
test('oversized and encoded mutation bodies are rejected before backend work',async t=>{
 const f=await fixture(t,{maxBodyBytes:16});assert.equal((await f.request({method:'POST',url:'/api/uploads',headers:{Origin:customerURL,'Content-Length':'17'},body:'12345678901234567'})).status,413);
 assert.equal((await f.request({method:'POST',url:'/api/uploads',headers:{Origin:customerURL,'Content-Encoding':'gzip'},body:'abc'})).status,415);assert.equal(f.received.length,0);
});
