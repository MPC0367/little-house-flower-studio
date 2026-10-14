import http from 'node:http';
import crypto from 'node:crypto';
import {isIP} from 'node:net';

const hopHeaders=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
export function shareURL(value){
 if(typeof value!=='string')return null;
 try{const u=new URL(value);return u.protocol==='https:'&&/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(u.hostname)&&!u.port&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash?u.origin:null;}catch{return null;}
}
function reply(res,status,text,headers={}){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(text);}
const challenge=res=>reply(res,401,'Client preview sign-in required.',{'WWW-Authenticate':'Basic realm="Little House Flower client preview", charset="UTF-8"'});
function credentials(header){
 if(typeof header!=='string'||header.length>2048||!/^Basic [a-zA-Z0-9+/]+={0,2}$/.test(header))return null;
 const value=Buffer.from(header.slice(6),'base64').toString('utf8'),colon=value.indexOf(':');
 return colon===6&&value.slice(0,colon)==='client'?value.slice(colon+1):null;
}
function outgoingHeaders(headers){const out={};for(const [k,v]of Object.entries(headers))if(!hopHeaders.has(k)&&k!=='authorization'&&!k.startsWith('x-forwarded-')&&!k.startsWith('cf-')&&k!=='forwarded')out[k]=v;return out;}
function secureCookie(cookie){return /;\s*secure(?:;|$)/i.test(cookie)?cookie:cookie+'; Secure';}
function injectedHTML(body,context){
 const json=JSON.stringify(context).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
 return body.replace('</head>','<script>window.LHF_SHARE_CONTEXT='+json+';</script></head>').replace(/<div class="local-banner">[^<]*<\/div>/,'<div class="local-banner">CLIENT PREVIEW · ตัวอย่างสำหรับลูกค้า · Demo orders only</div>');
}

/** Loopback-only tunnel target. A validated tunnel hostname and password are mandatory. */
export function createShareProxy({kind,internalPort,auth,getContext,maxBodyBytes=6*1024*1024,cacheMs=5000,now=Date.now,requestTimeoutMs=15000}){
 if(!['customer','admin'].includes(kind)||!Number.isInteger(internalPort)||internalPort<1||internalPort>65535)throw Error('Invalid review proxy configuration');
 const internalOrigin='http://127.0.0.1:'+internalPort,cache=new Map(),failures=new Map(),pending=new Map();let version=null,verifying=0,active=0;
 const server=http.createServer({maxHeaderSize:16384},async(req,res)=>{
  if(++active>64){active--;return reply(res,503,'Preview is busy. Try again shortly.');}
  let finished=false;const release=()=>{if(!finished){finished=true;active--;}};res.once('close',release);res.once('finish',release);
  try{
   const supplied=getContext?.()||{},customerURL=shareURL(supplied.customerURL),studioURL=shareURL(supplied.studioURL),externalOrigin=kind==='customer'?customerURL:studioURL;
   // Tunnels may become reachable before discovery. Nothing is forwarded then.
   if(!customerURL||!studioURL||!auth.getConfig().passwordProtected)return challenge(res);
   if(req.headers.host!==new URL(externalOrigin).host)return reply(res,403,'Unrecognized preview host.');
   if(!req.url?.startsWith('/')||req.url.startsWith('//'))return reply(res,400,'Invalid request target.');
   const origin=req.headers.origin;
   if(origin&&origin!==externalOrigin)return reply(res,403,'Cross-origin preview request refused.');
   if(!['GET','HEAD','OPTIONS'].includes(req.method)&&origin!==externalOrigin)return reply(res,403,'Same-origin preview request required.');
   if(req.headers['sec-fetch-site']==='cross-site'&&!(req.method==='GET'&&req.headers['sec-fetch-mode']==='navigate'))return reply(res,403,'Cross-site preview request refused.');
   const current=auth.getVersion();if(current!==version){cache.clear();version=current;}
   const password=credentials(req.headers.authorization);if(password===null)return challenge(res);
   const digest=crypto.createHash('sha256').update(password).digest('hex'),at=now();
   const remote=isIP(String(req.headers['cf-connecting-ip']||''))?String(req.headers['cf-connecting-ip']):req.socket.remoteAddress;
   for(const [key,entry]of failures)if(at-entry.at>60000)failures.delete(key);
   const recent=failures.get(remote),global=failures.get('*');
   if(!(cache.get(digest)>at)){
    const pendingKey=current+':'+digest;
    if((recent?.count||0)>=8||(global?.count||0)>=50||!pending.has(pendingKey)&&verifying>=2)return reply(res,429,'Too many sign-in attempts. Try again shortly.',{'Retry-After':'60'});
    if(!pending.has(pendingKey)){verifying++;const task=Promise.resolve().then(()=>auth.verify(password)).finally(()=>{verifying--;pending.delete(pendingKey);});pending.set(pendingKey,task);}
    let valid=false;try{valid=await pending.get(pendingKey);}catch(e){if(e.status===429)return reply(res,429,'Sign-in is busy. Try again shortly.',{'Retry-After':'2'});throw e;}
    if(!valid||auth.getVersion()!==current){for(const key of [remote,'*']){const f=failures.get(key);failures.set(key,{at:f?.at||at,count:(f?.count||0)+1});}return challenge(res);}
    if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(digest,at+cacheMs);
   }
   if(req.headers['content-encoding']&&req.headers['content-encoding']!=='identity')return reply(res,415,'Compressed request bodies are unsupported.');
   const length=Number(req.headers['content-length']||0);if(!Number.isSafeInteger(length)||length<0||length>maxBodyBytes)return reply(res,413,'Request body is too large.');
   let size=0;const chunks=[];req.setTimeout(requestTimeoutMs,()=>req.destroy());
   for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>maxBodyBytes){req.resume();reply(res,413,'Request body is too large.');return;}chunks.push(chunk);}
   const body=Buffer.concat(chunks),headers=outgoingHeaders(req.headers);headers.host='127.0.0.1:'+internalPort;headers['content-length']=String(body.length);delete headers['accept-encoding'];
   if(origin)headers.origin=internalOrigin;
   if(req.headers.referer){try{const ref=new URL(req.headers.referer);if(ref.origin===externalOrigin)headers.referer=internalOrigin+ref.pathname+ref.search;else delete headers.referer;}catch{delete headers.referer;}}
   const upstream=http.request({host:'127.0.0.1',port:internalPort,path:req.url,method:req.method,headers,timeout:30000},incoming=>{
    const responseHeaders=outgoingHeaders(incoming.headers);responseHeaders['cache-control']='private, no-store';responseHeaders['x-robots-tag']='noindex, nofollow';
    delete responseHeaders['access-control-allow-origin'];delete responseHeaders['access-control-allow-credentials'];
    if(incoming.headers['set-cookie'])responseHeaders['set-cookie']=incoming.headers['set-cookie'].map(secureCookie);
    if(responseHeaders.location?.startsWith(internalOrigin))responseHeaders.location=externalOrigin+responseHeaders.location.slice(internalOrigin.length);
    if(req.method!=='HEAD'&&String(incoming.headers['content-type']).includes('text/html')){
     let bytes=0;const html=[];incoming.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024){incoming.destroy();if(!res.headersSent)reply(res,502,'Preview document is too large.');}else html.push(chunk);});
     incoming.on('end',()=>{if(res.writableEnded)return;const output=Buffer.from(injectedHTML(Buffer.concat(html).toString('utf8'),{customerURL,studioURL}));responseHeaders['content-length']=String(output.length);delete responseHeaders.etag;res.writeHead(incoming.statusCode,responseHeaders);res.end(output);});
    }else{res.writeHead(incoming.statusCode,responseHeaders);incoming.pipe(res);}
    incoming.on('error',()=>{if(!res.headersSent)reply(res,502,'Preview response unavailable.');else res.destroy();});
   });
   upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)reply(res,502,'Preview service unavailable.');else res.destroy();});res.once('close',()=>upstream.destroy());upstream.end(body);
  }catch{if(!res.headersSent&&!res.writableEnded)reply(res,502,'Preview service unavailable.');else res.destroy();}
 });
 server.headersTimeout=15000;server.requestTimeout=20000;server.keepAliveTimeout=5000;return server;
}
