import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {HostedPreviewService,getHostedPreviewAsset,renderHostedComposition} from '../server/hosted-preview.mjs';
import {compositionPlan as hostedPlan} from '../server/hosted-preview-geometry.mjs';
import {compositionPlan as localPlan} from '../server/local-composition.mjs';
import {defaultRecipe,recipes} from '../shared/recipes.mjs';
import {styles,flowerEvidence,containers,finishFor,originalConfig,visualConfig} from '../shared/config.mjs';
import {catalog} from '../server/domain.mjs';
import originalFixtures from '../fixtures/preview-cache.json' with {type:'json'};
import spriteManifest from '../server/hosted-preview-manifest.json' with {type:'json'};
const root=fileURLToPath(new URL('..',import.meta.url));
const spriteFiles=new Map([...Object.values(spriteManifest.flowers).flatMap(f=>Object.values(f.variants)),...Object.values(spriteManifest.presentation).flatMap(Object.values)].map(meta=>['site-assets/'+meta.hash,meta.url]));
function fixture({arrayBuffer=false}={}){const records=new Map(),objects=new Map(),reads=new Map();let writes=0;const db={get:(c,id)=>records.get(c+':'+id)||null,put:(c,id,value)=>{records.set(c+':'+id,value);return value;},all:c=>[...records].filter(([key])=>key.startsWith(c+':')).map(([,value])=>value)};const env={ASSETS:{fetch:async()=>{throw Error('Published sprite rendering must not call ASSETS');}},BUCKET:{put:async(key,value)=>{writes++;objects.set(key,value);},get:async key=>{reads.set(key,(reads.get(key)||0)+1);const data=spriteFiles.has(key)?fs.readFileSync(path.join(root,'public',spriteFiles.get(key))):objects.get(key);return data===undefined?null:arrayBuffer?{arrayBuffer:async()=>new Response(data).arrayBuffer()}:{body:new Response(data).body};}}};return {db,env,objects,reads,writes:()=>writes,service:new HostedPreviewService({db,env})};}

test('all seven styles preserve the local placement plan and render only selected flowers',async()=>{
 const f=fixture();for(const [style]of styles){const config={...defaultRecipe(style).config,flowers:style==='garland'?['jasmine']:['rose_red','eucalyptus'],palette:'florist',ribbon:'burgundy',size:'smaller'};assert.deepEqual(hostedPlan(config),localPlan(config));const result=await f.service.request(config,'test-session');assert.equal(result.status,'ready');assert.equal(result.asset.kind,'composition');assert.equal(result.source,'hosted-composition');assert.deepEqual(result.asset.configuration,visualConfig(config));const svg=f.objects.get('preview-assets/'+result.asset.id+'.svg');assert.ok(svg.startsWith('<svg'));assert.match(svg,/data:image\/webp;base64,/);assert.match(svg,/viewBox="0 0 1200 1200"/);assert.ok(!svg.includes('<script'));const used=new Set([...svg.matchAll(/data-flower="([a-z_]+)"/g)].map(m=>m[1]));assert.deepEqual(used,new Set(config.flowers));assert.ok(svg.length<1500000);}
});
test('every supported flower and container has a hosted asset; colors, ribbon and size change output',async()=>{
 const f=fixture(),base={...defaultRecipe('bouquet').config,flowers:['lisianthus'],palette:'pink-white'};for(const id of Object.keys(flowerEvidence)){const {svg}=await renderHostedComposition({...base,flowers:[id],palette:'florist'},{env:f.env});assert.ok(svg.includes('data-flower="'+id+'"'));}
 for(const [style]of styles)for(const container of containers[style]){const config={...defaultRecipe(style).config,container,finish:finishFor(container)[0],flowers:style==='garland'?['jasmine']:['lisianthus'],palette:'florist',ribbon:'pink'};const {svg,crop,scale}=await renderHostedComposition(config,{env:f.env});assert.ok(svg.length>10000);assert.ok(crop.every(Number.isFinite));assert.ok(scale>0&&scale<3);}
 const variants=[base,{...base,palette:'white-green'},{...base,finish:'black'},{...base,ribbon:'burgundy'},{...base,size:'smaller'},{...base,size:'larger'}],results=await Promise.all(variants.map(c=>renderHostedComposition(c,{env:f.env})));assert.equal(new Set(results.map(r=>r.svg)).size,variants.length);assert.ok(results[4].scale<results[0].scale);assert.ok(results[5].scale>results[0].scale);
});
test('existing catalogue photographs and eight curated concepts retain their assets without R2 writes',async()=>{
 const f=fixture();assert.equal(recipes.length,8);assert.equal(f.service.recipeList().filter(r=>r.asset).length,8);for(const recipe of recipes){const result=await f.service.request(recipe.config,'test-session');assert.equal(result.asset.kind,'concept');assert.equal(result.source,'curated-concept');assert.ok(originalFixtures.some(fixture=>fixture.asset.url===result.asset.url));}
 const product=catalog.find(p=>p.id==='white-rose'),actual=await f.service.request(originalConfig(product),'test-session');assert.equal(actual.asset.kind,'actual');assert.equal(actual.asset.id,'catalog-white-rose');assert.equal(f.writes(),0);
});
test('automatic previews remain cacheable, current, private and retrievable through the existing job contract',async()=>{
 const f=fixture(),config={...defaultRecipe('bouquet').config,flowers:['rose_red'],finish:'black'},first=await f.service.request(config,'test-session');assert.equal(f.writes(),1);const repeat=await f.service.request(config,'test-session',{mode:'lookup'});assert.equal(repeat.asset.id,first.asset.id);assert.equal(f.writes(),1);assert.equal(f.service.publicJob(f.service.get(first.id)).status,'ready');const changed=await f.service.request({...config,ribbon:'burgundy'},'test-session');assert.notEqual(changed.asset.id,first.asset.id);assert.equal(f.writes(),2);
 const response=await getHostedPreviewAsset(first.asset.id,{env:f.env});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/svg+xml');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.match(await response.text(),/<svg/);assert.equal((await getHostedPreviewAsset('../../private',{env:f.env})).status,404);assert.equal((await getHostedPreviewAsset('hosted-composition-'+'f'.repeat(24),{env:f.env})).status,404);
});
test('unsupported or injected selections are rejected before storage; reference data never enters preview art',async()=>{
 const f=fixture(),base=defaultRecipe('bouquet').config;for(const bad of [{...base,flowers:['<script>']},{...base,palette:'red',flowers:['rose_white']},{...base,container:'<svg onload=alert(1)>'},{...base,sourceProduct:'unverified'},{...base,flowers:['rose_red','rose_red']}])await assert.rejects(f.service.request(bad,'test-session'));assert.equal(f.writes(),0);
 const result=await f.service.request({...base,flowers:['rose_red'],customerName:'PRIVATE NAME',referenceUrl:'https://private.invalid/private.jpg',notes:'PRIVATE NOTES'},'test-session');const svg=f.objects.get('preview-assets/'+result.asset.id+'.svg');assert.ok(!svg.includes('PRIVATE'));assert.ok(!svg.includes('private.invalid'));assert.equal(result.asset.configuration.customerName,undefined);
});
test('private R2 sprites support arrayBuffer and body objects, preserve pixels and deduplicate reads',async()=>{
 const config={...defaultRecipe('bouquet').config,flowers:['rose_red'],ribbon:'burgundy'},a=fixture({arrayBuffer:true}),b=fixture();
 const [first,concurrent]=await Promise.all([renderHostedComposition(config,{env:a.env}),renderHostedComposition(config,{env:a.env})]),body=await renderHostedComposition(config,{env:b.env});
 assert.equal(first.svg,concurrent.svg);assert.equal(first.svg,body.svg);assert.ok(a.reads.size>0);assert.ok([...a.reads].every(([key,count])=>/^site-assets\/[a-f0-9]{64}$/.test(key)&&count===1));
 const fallbackReads=[];const local={ASSETS:{fetch:async request=>{const pathname=new URL(request.url).pathname;assert.ok([...spriteFiles.values()].includes(pathname));fallbackReads.push(pathname);return new Response(fs.readFileSync(path.join(root,'public',pathname)));}}};
 assert.equal((await renderHostedComposition(config,{env:local})).svg,first.svg);assert.ok(fallbackReads.length>0);
});
test('missing or corrupt private sprites fail closed without ASSETS fallback or caching failures',async()=>{
 const config={...defaultRecipe('bouquet').config,flowers:['rose_red']};let fallbackReads=0,missing=true,corrupt=false;
 const env={ASSETS:{fetch:async()=>{fallbackReads++;throw Error('Unexpected public fallback');}},BUCKET:{get:async key=>{assert.ok(spriteFiles.has(key));if(missing)return null;const bytes=corrupt?new Uint8Array([1,2,3]):fs.readFileSync(path.join(root,'public',spriteFiles.get(key)));return {body:new Response(bytes).body};}}};
 await assert.rejects(renderHostedComposition(config,{env}),error=>error.status===503);missing=false;corrupt=true;
 await assert.rejects(renderHostedComposition(config,{env}),error=>error.status===503);corrupt=false;
 assert.match((await renderHostedComposition(config,{env})).svg,/data:image\/webp;base64,/);assert.equal(fallbackReads,0);
});
