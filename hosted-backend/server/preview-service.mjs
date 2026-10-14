import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {catalog,legacy,images,estimate,visualKey,hash} from './domain.mjs';
import {validateConfig,visualConfig,originalConfig,VERSION} from '../shared/config.mjs';
import {recipes} from '../shared/recipes.mjs';
import {LocalCompositionRenderer} from './local-composition.mjs';
const activeStates=['queued','generating','validating'];
const fail=(message,status=422)=>Object.assign(Error(message),{status});
export const PREVIEW_LIMITS={activePerSession:2,queue:12,requestsPerHour:30,cacheEntries:250,timeoutMs:45000,retries:1,maxBytes:8*1024*1024,maxPixels:16000000,maxEstimatedCostCents:500,localQueue:64,localRequestsPerHour:600,localCacheEntries:1000};
export function generationPrompt(config){return `Create one photorealistic Little House Flower product concept grounded in approved shop reference photographs. Style: ${config.style}; container/material: ${config.container}; finish: ${config.finish}; flowers: ${(config.flowers||[]).join(', ')||'florist choice, representative seasonal mix'}; flower palette: ${config.palette}; ribbon: ${config.ribbon}; size relative to reference: ${config.size}. Complete arrangement in frame, realistic shop-scale stem density, neutral warm ivory studio background, soft natural light. No invented text, logo, unrelated species, impossible colors, faces or extra containers. Banknotes if requested are illustrative only with no denomination. This is an illustrative concept, not a fulfillment guarantee.`;}
// Only approved public shop references cross this contract. Never send the customer
// upload, names, address, message, occasion, notes or free-text budget.
export class HttpConceptProvider {
 constructor({endpoint,token,fetchImpl=fetch,estimatedCostCents=0,modelVersion='configured-v1'}={}){
  this.endpoint=endpoint;this.token=token;this.fetch=fetchImpl;this.estimatedCostCents=estimatedCostCents;
  this.connected=!!endpoint;this.modelVersion=modelVersion;this.identity=hash({endpoint:endpoint||'disconnected',modelVersion,promptVersion:1});
 }
 async generate({config,signal,references,prompt}){
  if(!this.connected)return {unavailable:true};
  const u=new URL(this.endpoint);if(u.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw fail('Image provider must use HTTPS or loopback');
  const r=await this.fetch(u,{method:'POST',signal,headers:{'Content-Type':'application/json',...(this.token?{Authorization:'Bearer '+this.token}:{})},body:JSON.stringify({configuration:{...visualConfig(config),modelVersion:this.modelVersion},references,prompt})});
  if(!r.ok)throw fail('Image provider could not complete the request',r.status);
  const maximum=Math.ceil(PREVIEW_LIMITS.maxBytes*1.4)+65536;
  if(Number(r.headers?.get('content-length'))>maximum)throw fail('Provider response exceeds the size limit');
  let body;
  if(r.body?.getReader){const reader=r.body.getReader(),chunks=[];let total=0;try{for(;;){const next=await reader.read();if(next.done)break;total+=next.value.byteLength;if(total>maximum){await reader.cancel();throw fail('Provider response exceeds the size limit');}chunks.push(Buffer.from(next.value));}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}finally{reader.releaseLock();}}
  else {body=await r.json();if(JSON.stringify(body).length>maximum)throw fail('Provider response exceeds the size limit');}
  if(typeof body.imageBase64!=='string'||body.imageBase64.length>PREVIEW_LIMITS.maxBytes*1.4||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.imageBase64))throw fail('Invalid provider image');
  return {bytes:Buffer.from(body.imageBase64,'base64'),mime:body.mime,qa:body.qa,provenance:{provider:String(body.provider||'configured-adapter').slice(0,120),model:this.modelVersion}};
 }
}
export class PreviewService {
 constructor({db,root,dir,provider=new HttpConceptProvider(),limits={},localComposition=true}){
  this.db=db;this.root=root;this.dir=dir;this.provider=provider;this.limits={...PREVIEW_LIMITS,...limits};
  this.fixtures=JSON.parse(fs.readFileSync(path.join(root,'fixtures/preview-cache.json'),'utf8'));this.live=new Map();this.requests=new Map();this.localRequests=new Map();this.referenceCache=new Map();
  this.localComposition=localComposition&&fs.existsSync(path.join(root,'customer/img/live-flowers'))?new LocalCompositionRenderer({root}):null;
  fs.mkdirSync(path.join(root,'customer/img/generated'),{recursive:true});
  for(const j of db.all('preview_jobs'))if(activeStates.includes(j.status))db.put('preview_jobs',j.id,{...j,status:'failed',reason:'Preview interrupted by a server restart. Retry explicitly.',updatedAt:new Date().toISOString()});
 }
 recipeList(){return recipes.map(r=>({...r,asset:this.fixtures.find(f=>visualKey(f.config)===visualKey(r.config))?.asset||null}));}
 validate(config){
  if(!config||typeof config!=='object'||Array.isArray(config))throw fail('A complete configuration is required');
  if(typeof config.unchanged!=='boolean'||!(config.sourceProduct===null||typeof config.sourceProduct==='string'&&catalog.some(p=>p.id===config.sourceProduct)))throw fail('Invalid source product or source design flag');
  if(!Array.isArray(config.flowers)||config.flowers.some(f=>typeof f!=='string'))throw fail('Choose supported flower IDs');
  const errors=validateConfig(config,Object.keys(legacy.catalog.flowers).filter(f=>f!=='banknotes'));if(errors.length)throw fail(errors.join(' '));
  return Object.fromEntries(['style','container','finish','palette','flowers','ribbon','size','sourceProduct','unchanged'].map(k=>[k,Array.isArray(config[k])?[...config[k]]:config[k]]));
 }
 actual(config){
  const product=catalog.find(p=>p.id===config.sourceProduct);if(!config.unchanged||!product?.image||!images[product.image])return null;
  if(visualKey(config)!==visualKey(originalConfig(product)))return null;const meta=images[product.image];
  return {id:'catalog-'+product.id,version:VERSION,role:'product',url:'/'+meta.src,srcset:meta.srcset,kind:'actual',label:'Actual shop product',qa:'published-source',mime:'image/webp',width:meta.w,height:meta.h,contentHash:hash(fs.readFileSync(path.join(this.root,'customer',meta.src)).toString('base64')),createdAt:'2026-10-13T00:00:00.000Z'};
 }
 references(config){
  const style=config.style, cached=this.referenceCache.get(style);if(cached)return cached;
  const refs=catalog.filter(p=>p.category===style&&p.image).map(p=>({productId:p.id,src:images[p.image]?.src})).filter(r=>r.src).slice(0,2).map(r=>{
   const bytes=fs.readFileSync(path.join(this.root,'customer',r.src));if(bytes.length>this.limits.maxBytes)throw fail('Approved reference exceeds the size limit');
   return {productId:r.productId,contentHash:hash(bytes.toString('base64')),mime:'image/webp',imageBase64:bytes.toString('base64')};
  });this.referenceCache.set(style,refs);return refs;
 }
 keyFor(config){
  const base=visualKey(config);if(this.actual(config)||this.fixtures.some(f=>visualKey(f.config)===base))return base;
  if(this.localComposition?.available(config))return this.localComposition.key(config);
  return hash({configuration:visualConfig(config),provider:this.provider.identity||this.provider.modelVersion||'disconnected',references:this.references(config).map(r=>r.contentHash)});
 }
 respond(j,config){return {...j,estimate:estimate(config),configurationKey:visualKey(config)};}
 get(jobId){const j=this.db.get('preview_jobs',jobId)||this.db.get('previews',jobId);if(!j)throw fail('Preview job not found',404);return j;}
 async request(raw,owner,{retry=false,mode='update'}={}){
  const config=this.validate(raw),baseKey=visualKey(config),key=this.keyFor(config),actual=this.actual(config),fixture=this.fixtures.find(f=>visualKey(f.config)===baseKey),cached=this.db.get('previews',key);
  const asset=actual||fixture?.asset||(cached?.status==='ready'?cached.asset:null);
  if(asset){const ready={id:key,key,status:'ready',progress:100,asset,estimate:estimate(config),createdAt:cached?.createdAt||new Date().toISOString(),source:actual?'catalogue':fixture?'curated-concept':cached?.source||'generated',reason:null};this.db.put('previews',key,ready);return ready;}
  const existing=this.db.get('preview_jobs',key);
  if(existing&&(activeStates.includes(existing.status)||(!retry&&!this.localComposition?.available(config))))return this.respond(this.publicJob(existing),config);
  // Local composition is a real, complete preview for every supported choice.
  // Its bounded worker queue coalesces matching keys without paid-provider limits.
  // Both lookup and update can use it: a returning draft never needs a button click.
  if(this.localComposition?.available(config)){
   const localJobs=this.db.all('preview_jobs').filter(j=>j.source==='local-composition'),localCache=this.db.all('previews').filter(j=>j.source==='local-composition');
   if(localJobs.filter(j=>activeStates.includes(j.status)).length>=this.limits.localQueue)throw fail('The local preview queue is full. Your choices are saved; retry shortly.',429);
   const keys=new Set([...localJobs,...localCache].map(j=>j.key||j.id));
   if(!keys.has(key)&&keys.size>=this.limits.localCacheEntries)throw fail('Local preview storage is full. Your choices are saved. Ask the local site administrator to increase its preview capacity.',429);
   const now=Date.now(),recent=(this.localRequests.get(owner)||[]).filter(t=>t>now-3600000);
   for(const [session,times]of this.localRequests)if(!times.some(t=>t>now-3600000))this.localRequests.delete(session);
   if(recent.length>=this.limits.localRequestsPerHour)throw fail('The local preview request limit has been reached. Your choices are saved; retry later.',429);
   recent.push(now);this.localRequests.set(owner,recent);
   const j={id:key,key,configuration:config,owner,status:'queued',progress:10,asset:null,attempts:existing?.attempts||0,createdAt:existing?.createdAt||new Date().toISOString(),estimate:estimate(config),source:'local-composition'};
   this.db.put('preview_jobs',key,j);void this.processLocal(j);return this.publicJob(j);
  }
  if(mode==='lookup')return {id:key,key,status:'unavailable',asset:null,estimate:estimate(config),reason:'No matching cached image. Request a preview or continue with a consultation.'};
  if(!this.provider.connected)return {id:key,key,status:'unavailable',asset:null,estimate:estimate(config),reason:'There is no cached concept for these exact choices. Choose an illustrated starting point, or continue with a florist consultation. Live generation is not connected in this local preview.'};
  const now=Date.now(),recent=(this.requests.get(owner)||[]).filter(t=>t>now-3600000);
  for(const [session,times]of this.requests)if(!times.some(t=>t>now-3600000))this.requests.delete(session);
  if(recent.length>=this.limits.requestsPerHour)throw fail('Preview request limit reached. Continue with a consultation.',429);
  const jobs=this.db.all('preview_jobs').filter(j=>j.source!=='local-composition'&&activeStates.includes(j.status));
  if(jobs.length>=this.limits.queue||jobs.filter(j=>j.owner===owner).length>=this.limits.activePerSession)throw fail('A preview is already in progress. Wait before requesting another.',429);
  if(this.db.all('previews').filter(j=>j.source!=='local-composition').length+this.db.all('preview_jobs').filter(j=>j.source!=='local-composition').length>=this.limits.cacheEntries)throw fail('Preview storage limit reached',429);
  if(existing?.attempts>=1+this.limits.retries)throw fail('Preview retry limit reached. Continue with a consultation.',429);
  const unitCost=Math.max(0,Number(this.provider.estimatedCostCents)||0),cost=this.db.get('meta','preview-cost')||{cents:0};
  if(cost.cents+unitCost>this.limits.maxEstimatedCostCents)throw fail('The configured preview budget has been reached',429);
  this.db.put('meta','preview-cost',{cents:cost.cents+unitCost});recent.push(now);this.requests.set(owner,recent);
  const j={id:key,key,configuration:config,owner,status:'queued',progress:10,asset:null,attempts:existing?.attempts||0,createdAt:new Date().toISOString(),estimate:estimate(config)};
  this.db.put('preview_jobs',key,j);setTimeout(()=>this.process(j),25);return this.publicJob(j);
 }
 publicJob(j){const {owner,configuration,...safe}=j;return safe;}
 async processLocal(j){
  const save=patch=>{Object.assign(j,patch,{updatedAt:new Date().toISOString()});this.db.put('preview_jobs',j.id,j);};
  try{
   const asset=await this.localComposition.render(j.configuration,{onStart:()=>save({status:'generating',progress:45,attempts:j.attempts+1})});
   save({status:'ready',progress:100,asset,reason:null});this.db.put('previews',j.key,this.publicJob(j));
  }catch(e){save({status:'failed',progress:0,reason:'The local composition could not be prepared. Your selections are saved; retry the preview.'});}
 }
 async process(j){
  if(this.live.has(j.id))return;
  const control=new AbortController();this.live.set(j.id,control);
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{control.abort();reject(fail('Preview timed out'));},this.limits.timeoutMs);});
  // Race each asynchronous stage against the same deadline. A provider that ignores
  // AbortSignal cannot save a late result or occupy a worker indefinitely.
  const bounded=p=>Promise.race([Promise.resolve(p),timeout]);
  const alive=()=>{if(control.signal.aborted)throw fail('Preview timed out');};
  const save=patch=>{Object.assign(j,patch,{updatedAt:new Date().toISOString()});this.db.put('preview_jobs',j.id,j);};
  try{
   save({status:'generating',progress:30,attempts:j.attempts+1});
   const result=await bounded(this.provider.generate({config:j.configuration,prompt:generationPrompt(j.configuration),references:this.references(j.configuration),signal:control.signal}));
   alive();if(result.unavailable){save({status:'unavailable',progress:0,reason:'Image provider is unavailable. Continue with a consultation.'});return;}
   save({status:'validating',progress:80});
   if(!Buffer.isBuffer(result.bytes)||!result.bytes.length||result.bytes.length>this.limits.maxBytes)throw fail('Provider image exceeds the size limit');
   const decoded=await bounded(sharp(result.bytes,{limitInputPixels:this.limits.maxPixels}).metadata());alive();
   if(!['png','jpeg','webp','avif'].includes(decoded.format)||decoded.width<512||decoded.height<512)throw fail('Provider image failed file validation');
   if(result.qa?.matchesConfiguration!==true)throw fail('This concept needs visual review before it can be shown.');
   const derivatives=[];
   for(const width of [640,1200])derivatives.push(await bounded(sharp(result.bytes,{limitInputPixels:this.limits.maxPixels}).rotate().resize({width,withoutEnlargement:true}).webp({quality:88}).toBuffer()));
   alive();const contentHash=hash(result.bytes.toString('base64')),assetId='generated-'+contentHash.slice(0,24),base=path.join(this.root,'customer/img/generated',assetId);
   if(!fs.existsSync(base+'-original.'+decoded.format))fs.writeFileSync(base+'-original.'+decoded.format,result.bytes);
   for(const [i,width]of [640,1200].entries())if(!fs.existsSync(base+'-'+width+'.webp'))fs.writeFileSync(base+'-'+width+'.webp',derivatives[i]);
   const asset={id:assetId,version:1,role:'concept',kind:'concept',label:'AI concept based on your selections',url:'/img/generated/'+assetId+'-1200.webp',srcset:`/img/generated/${assetId}-640.webp 640w, /img/generated/${assetId}-1200.webp 1200w`,mime:'image/webp',width:decoded.width,height:decoded.height,contentHash,createdAt:new Date().toISOString(),qa:{matchesConfiguration:true,floristApproval:'pending'},provenance:result.provenance};
   save({status:'ready',progress:100,asset,reason:null});this.db.put('previews',j.key,this.publicJob(j));
  }catch(e){save({status:'failed',progress:0,reason:control.signal.aborted?'The preview timed out. Retry explicitly, or continue without it.':'The concept could not be validated. Retry, or continue with a consultation.'});}
  finally{clearTimeout(timer);this.live.delete(j.id);}
 }
}
