import manifest from './hosted-preview-manifest.json' with {type:'json'};
import fixtures from '../fixtures/preview-cache.json' with {type:'json'};
import {catalog,legacy,images,estimate,visualKey,hash} from './domain.mjs';
import {validateConfig,visualConfig,originalConfig,VERSION} from '../shared/config.mjs';
import {recipes} from '../shared/recipes.mjs';
import {compositionPlan,presentation,background,bowPosition} from './hosted-preview-geometry.mjs';

const fail=(message,status=422)=>Object.assign(Error(message),{status});
const spriteStores=new WeakMap(),W=1200;
function base64(bytes){let text='';for(let offset=0;offset<bytes.length;offset+=16384)text+=String.fromCharCode(...bytes.subarray(offset,offset+16384));return btoa(text);}
async function spriteData(env,meta){
 const privateStorage=typeof env.BUCKET?.get==='function',provider=privateStorage?env.BUCKET:env.ASSETS;
 if(!provider||!privateStorage&&typeof provider.fetch!=='function')throw fail('Hosted preview assets are unavailable',503);
 if(!spriteStores.has(provider))spriteStores.set(provider,{cache:new Map(),pending:new Map()});
 const {cache:spriteCache,pending:spritePending}=spriteStores.get(provider);
 if(spriteCache.has(meta.hash))return spriteCache.get(meta.hash);
 if(!spritePending.has(meta.hash)){const task=(async()=>{
  if(!/^[a-f0-9]{64}$/.test(meta.hash)||!/^\/img\/hosted-sprites\/[a-z0-9_-]+\.webp$/.test(meta.url))throw fail('Invalid preview asset',503);
  // Published previews use private R2 only. The ASSETS path supports local fixtures
  // without an R2 reader; a missing private object must never fall through to it.
  let buffer;
  if(privateStorage){const object=await provider.get('site-assets/'+meta.hash);if(!object)throw fail('A preview image could not be loaded',503);if(object.size>1024*1024)throw fail('Invalid preview image',503);buffer=typeof object.arrayBuffer==='function'?await object.arrayBuffer():await new Response(object.body).arrayBuffer();}
  else{const response=await provider.fetch(new Request('https://assets.invalid'+meta.url));if(!response.ok)throw fail('A preview image could not be loaded',503);buffer=await response.arrayBuffer();}
  const bytes=new Uint8Array(buffer);if(!bytes.length||bytes.length>1024*1024||hash(bytes)!==meta.hash)throw fail('Invalid preview image',503);
  const uri='data:image/webp;base64,'+base64(bytes);if(spriteCache.size>=128)spriteCache.delete(spriteCache.keys().next().value);spriteCache.set(meta.hash,uri);return uri;
 })();spritePending.set(meta.hash,task);task.then(()=>spritePending.delete(meta.hash),()=>spritePending.delete(meta.hash));}
 return spritePending.get(meta.hash);
}
function union(boxes){const filtered=boxes.filter(Boolean);return [Math.min(...filtered.map(b=>b[0])),Math.min(...filtered.map(b=>b[1])),Math.max(...filtered.map(b=>b[2])),Math.max(...filtered.map(b=>b[3]))];}
function hullBounds(meta,{x=0,y=0,scale=1,angle=0,centered=false}){const radians=angle*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians),points=meta.alphaHull.map(([px,py])=>{const a=(px-(centered?meta.width/2:0))*scale,b=(py-(centered?meta.height/2:0))*scale;return [x+a*c-b*s,y+a*s+b*c];});return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];}
const rounded=n=>Number(n.toFixed(4));

/** Selected, pre-tinted photographic cutouts composed with the original arrangement geometry. */
export async function renderHostedComposition(config,{env}){
 const plan=compositionPlan(config),definitions=[],bounds=[],back=[],flowers=[],front=[],bow=[];const ids=new Map();
 const define=async meta=>{if(ids.has(meta.hash))return ids.get(meta.hash);const id='sprite'+ids.size;ids.set(meta.hash,id);definitions.push(`<image id="${id}" width="${meta.width}" height="${meta.height}" href="${await spriteData(env,meta)}"/>`);return id;};
 const photo=(id,transform,extra='')=>`<use href="#${id}" transform="${transform}" ${extra}/>`;
 const geometry={hatbox:{width:590,top:604,cut:.23},wicker:{width:620,top:635,cut:.35},vase:{width:240,top:615,cut:.045}}[config.container];
 if(geometry){const variants=manifest.presentation[config.container],meta=variants[config.container==='wicker'?'natural':config.finish]||variants.cream,id=await define(meta),scale=geometry.width/meta.width,height=Math.round(meta.height*scale),left=Math.round((W-geometry.width)/2),top=geometry.top,cut=Math.round(height*geometry.cut),transform=`translate(${left} ${top}) scale(${rounded(scale)})`;
  back.push(photo(id,transform));definitions.push(`<clipPath id="containerFront"><rect x="${left}" y="${top+cut}" width="${geometry.width}" height="${height-cut}"/></clipPath>`);front.push(`<g clip-path="url(#containerFront)">${photo(id,transform)}</g>`);bounds.push(hullBounds(meta,{x:left,y:top,scale}));
 }
 const art=presentation(config,plan,{body:!!geometry,bow:true}),artBounds=manifest.art[config.style+':'+config.container];bounds.push(artBounds.back,artBounds.front);
 // Stems share the original path endpoints and remain inside the same arrangement crop.
 if(!['wreath','garland'].includes(config.style))for(const item of plan.items.filter(item=>item.layer!==0))bounds.push([Math.min(item.cx,585)-4,Math.min(item.cy+70,655)-4,Math.max(item.cx,619)+4,(config.style==='wedding'?930:855)+4]);
 for(const item of plan.items){const source=manifest.flowers[item.id];if(!source)throw fail('Unsupported flower image');const meta=source.variants[source.palettes[config.palette]],id=await define(meta),angle=Math.round(item.rotation/5)*5,radians=angle*Math.PI/180;let scale=Math.min(item.width/meta.width,Math.round(item.width*1.3)/meta.height);const rw=Math.abs(Math.cos(radians))*meta.width*scale+Math.abs(Math.sin(radians))*meta.height*scale,rh=Math.abs(Math.sin(radians))*meta.width*scale+Math.abs(Math.cos(radians))*meta.height*scale;scale*=Math.min(1,(2*Math.min(item.cx,W-item.cx)-20)/rw,(2*Math.min(item.cy,W-item.cy)-20)/rh);
  flowers.push(photo(id,`translate(${rounded(item.cx)} ${rounded(item.cy)}) rotate(${angle}) scale(${rounded(scale)}) translate(${-meta.width/2} ${-meta.height/2})`,`data-flower="${item.id}"`));bounds.push(hullBounds(meta,{x:item.cx,y:item.cy,scale,angle,centered:true}));
 }
 const [bx,by,bscale]=bowPosition(config),bowMeta=manifest.presentation.bow[config.ribbon]||manifest.presentation.bow.cream,bowId=await define(bowMeta),bowWidth=Math.round(226*bscale),bowScale=bowWidth/bowMeta.width,bowHeight=Math.round(bowMeta.height*bowScale),bowLeft=Math.round(bx-bowWidth/2),bowTop=Math.round(by-bowHeight*.32);bow.push(photo(bowId,`translate(${bowLeft} ${bowTop}) scale(${rounded(bowScale)})`));bounds.push(hullBounds(bowMeta,{x:bowLeft,y:bowTop,scale:bowScale}));
 const raw=union(bounds),crop=[Math.max(0,Math.floor(raw[0])),Math.max(0,Math.floor(raw[1])),Math.min(W,Math.ceil(raw[2])),Math.min(W,Math.ceil(raw[3]))],width=crop[2]-crop[0],height=crop[3]-crop[1],scale=Math.min(Math.round(870*plan.size)/width,Math.round(920*plan.size)/height),x=(W-width*scale)/2-crop[0]*scale,y=1070-height*scale-crop[1]*scale;
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><title>Little House Flower illustrative design preview</title><defs>${definitions.join('')}<clipPath id="originalCanvas"><rect width="1200" height="1200"/></clipPath></defs>${background(config.palette)}<g transform="translate(${rounded(x)} ${rounded(y)}) scale(${rounded(scale)})"><g clip-path="url(#originalCanvas)">${back.join('')}${art.back}${flowers.join('')}${art.front}${front.join('')}${bow.join('')}</g></g></svg>`,plan,crop,scale};
}

export class HostedPreviewService{
 constructor({db,env}){this.db=db;this.env=env;}
 recipeList(){return recipes.map(recipe=>({...recipe,asset:fixtures.find(f=>visualKey(f.config)===visualKey(recipe.config))?.asset||null}));}
 validate(config){if(!config||typeof config!=='object'||Array.isArray(config))throw fail('A complete configuration is required');if(typeof config.unchanged!=='boolean'||!(config.sourceProduct===null||typeof config.sourceProduct==='string'&&catalog.some(p=>p.id===config.sourceProduct)))throw fail('Invalid source product or source design flag');if(!Array.isArray(config.flowers)||config.flowers.some(f=>typeof f!=='string'))throw fail('Choose supported flower IDs');const errors=validateConfig(config,Object.keys(legacy.catalog.flowers).filter(f=>f!=='banknotes'));if(errors.length)throw fail(errors.join(' '));return Object.fromEntries(['style','container','finish','palette','flowers','ribbon','size','sourceProduct','unchanged'].map(key=>[key,Array.isArray(config[key])?[...config[key]]:config[key]]));}
 actual(config){const product=catalog.find(p=>p.id===config.sourceProduct),meta=product?.image&&images[product.image];if(!config.unchanged||!meta||visualKey(config)!==visualKey(originalConfig(product)))return null;return {id:'catalog-'+product.id,version:VERSION,role:'product',url:'/'+meta.src.replace(/^\//,''),srcset:meta.srcset,kind:'actual',label:'Actual shop product',qa:'published-source',mime:'image/webp',width:meta.w,height:meta.h,contentHash:hash(meta),createdAt:'2026-10-13T00:00:00.000Z'};}
 keyFor(config){const base=visualKey(config);return this.actual(config)||fixtures.some(f=>visualKey(f.config)===base)?base:hash({configuration:visualConfig(config),renderer:manifest.identity});}
 publicJob(job){const {owner,configuration,...safe}=job;return safe;}
 get(id){const result=this.db.get('previews',id)||this.db.get('preview_jobs',id);if(!result)throw fail('Preview job not found',404);return result;}
 async request(raw,owner,options={}){
  const config=this.validate(raw),key=this.keyFor(config),actual=this.actual(config),fixture=fixtures.find(f=>visualKey(f.config)===visualKey(config)),cached=this.db.get('previews',key);let asset=actual||fixture?.asset||cached?.asset,source=actual?'catalogue':fixture?'curated-concept':'hosted-composition';
  if(!asset){
   if(!this.env.BUCKET?.put)throw fail('Hosted preview storage is unavailable',503);
   if(this.db.all('previews').filter(p=>p.source==='hosted-composition').length>=1000)throw fail('Preview capacity reached. Your choices are saved; contact the demo owner.',429);
   const clock=Date.now(),rateKey='preview:'+owner,rate=this.db.get('rates',rateKey),recent=(rate?.times||[]).filter(time=>time>clock-3600000);if(recent.length>=600)throw fail('Preview request limit reached. Retry later.',429);recent.push(clock);this.db.put('rates',rateKey,{times:recent});
   const {svg,plan}=await renderHostedComposition(config,{env:this.env}),id='hosted-composition-'+key.slice(0,24);await this.env.BUCKET.put('preview-assets/'+id+'.svg',svg,{httpMetadata:{contentType:'image/svg+xml'}});
   asset={id,version:manifest.version,role:'concept',kind:'composition',label:'Live composition preview — illustrative',url:'/api/preview-assets/'+id,mime:'image/svg+xml',width:1200,height:1200,contentHash:hash(svg),createdAt:new Date().toISOString(),configuration:visualConfig(config),qa:{matchesConfiguration:true,floristApproval:'pending',scope:'Selected species, presentation, colour and relative size. Illustrative placement; no stem count or fulfillment guarantee.'},provenance:{provider:'hosted-botanical-compositor',renderer:manifest.version,source:'Approved transparent botanical cutouts composed privately; no external generation request',botanicals:plan.flowers,representativeFloristMix:plan.representative,assetVersion:manifest.identity}};
  }
  const ready={id:key,key,status:'ready',progress:100,asset,estimate:estimate(config),configurationKey:visualKey(config),createdAt:cached?.createdAt||new Date().toISOString(),source,reason:null};this.db.put('previews',key,ready);return ready;
 }
}

/** The caller must enforce the client-demo gate before exposing these non-personal images. */
export async function getHostedPreviewAsset(id,{env}){if(!/^hosted-composition-[a-f0-9]{24}$/.test(id))return new Response('Preview not found',{status:404});const object=await env.BUCKET.get('preview-assets/'+id+'.svg');if(!object)return new Response('Preview not found',{status:404});return new Response(object.body,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox"}});}
