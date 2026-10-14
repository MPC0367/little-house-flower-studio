import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import sharp from 'sharp';
import {PreviewService,HttpConceptProvider,generationPrompt} from '../server/preview-service.mjs';
import {catalog,images,visualKey} from '../server/domain.mjs';import {originalConfig} from '../shared/config.mjs';
import {recipes} from '../shared/recipes.mjs';import {Journal} from '../server/store.mjs';
const root=path.resolve(import.meta.dirname,'..');
const config={...recipes[0].config,finish:'pink',ribbon:'pink',flowers:['rose_pink']};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(t,provider,limits={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lhf-preview-'));fs.mkdirSync(path.join(dir,'fixtures'));fs.copyFileSync(path.join(root,'fixtures/preview-cache.json'),path.join(dir,'fixtures/preview-cache.json'));fs.mkdirSync(path.join(dir,'customer/img'),{recursive:true});
 for(const p of catalog){const m=images[p.image];if(m?.src){const dest=path.join(dir,'customer',m.src);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,'customer',m.src),dest);}}
 const db=new Journal(path.join(dir,'data'));const service=new PreviewService({db,root:dir,dir,provider,limits});t.after(async()=>{await pause(50);db.db.close();fs.rmSync(dir,{recursive:true,force:true});});return {service,db,dir};
}
async function terminal(service,id){for(let i=0;i<100;i++){const j=service.get(id);if(!['queued','generating','validating'].includes(j.status))return j;await pause(10);}throw Error('Job did not finish');}
const image=()=>sharp({create:{width:640,height:640,channels:3,background:'#eedaca'}}).png().toBuffer();
test('all eight curated recipes match exact keys across seven styles and quote-only products retain actual photos',async t=>{
 const {service}=await setup(t);assert.equal(service.recipeList().length,8);assert.equal(new Set(recipes.map(r=>r.config.style)).size,7);
 for(const r of recipes){const j=await service.request(r.config,'a');assert.equal(j.status,'ready');assert.equal(j.source,'curated-concept');assert.ok(j.asset.url);assert.equal(j.key,visualKey(r.config));}
 const product=catalog.find(p=>p.pricing==='quote'&&p.image);assert.ok(product);const j=await service.request(originalConfig(product),'a');assert.equal(j.asset.kind,'actual');assert.equal(j.estimate.kind,'quote');
});
test('invalid source flags, flower shape and arbitrary source strings fail before persistence',async t=>{
 const {service,db}=await setup(t);for(const patch of [{sourceProduct:'unknown'},{sourceProduct:{name:'private'}},{unchanged:'true'},{flowers:'rose_red'}])await assert.rejects(service.request({...config,...patch},'a'));
 assert.equal(db.all('previews').length,0);assert.equal(db.all('preview_jobs').length,0);
});
test('disconnected and lookup-only misses do not persist arbitrary unavailable cache records',async t=>{
 const {service,db}=await setup(t);for(const finish of ['pink','cream','black']){const j=await service.request({...config,finish},'a');assert.equal(j.status,'unavailable');assert.equal(j.estimate.kind,'quote');}
 assert.equal(db.all('previews').length,0);assert.equal(db.all('preview_jobs').length,0);
});
test('queue coalesces matching requests, validates output, strips private fields and reuses immutable asset',async t=>{
 const bytes=await image();let calls=0,received;
 const provider={connected:true,identity:'test-v1',estimatedCostCents:5,generate:async args=>{calls++;received=args;return {bytes,qa:{matchesConfiguration:true},provenance:{provider:'test',model:'v1'}};}};
 const {service,db,dir}=await setup(t,provider);const first=await service.request({...config,notes:'secret',referenceUrl:'/api/private'},'a');assert.equal(first.status,'queued');assert.equal(first.owner,undefined);
 const duplicate=await service.request(config,'a');assert.equal(duplicate.id,first.id);const done=await terminal(service,first.id);assert.equal(done.status,'ready');assert.equal(calls,1);assert.ok(done.asset.contentHash);assert.equal(received.config.notes,undefined);assert.ok(received.references.every(r=>r.imageBase64&&r.contentHash&&!r.src));assert.ok(!received.prompt.includes('secret'));
 assert.ok(fs.existsSync(path.join(dir,'customer',done.asset.url)));const cached=await service.request(config,'b');assert.equal(cached.asset.id,done.asset.id);assert.equal(calls,1);assert.equal(db.get('meta','preview-cost').cents,5);
});
test('provider ignoring abort cannot complete after deadline or keep a worker active',async t=>{
 const bytes=await image();const {service,db,dir}=await setup(t,{connected:true,identity:'slow',generate:async()=>{await pause(100);return {bytes,qa:{matchesConfiguration:true}};}},{timeoutMs:10});
 const j=await service.request(config,'a');const done=await terminal(service,j.id);assert.equal(done.status,'failed');assert.match(done.reason,/timed out/);assert.equal(service.live.size,0);await pause(130);assert.equal(service.get(j.id).status,'failed');assert.equal(db.all('previews').length,0);assert.equal(fs.readdirSync(path.join(dir,'customer/img/generated')).length,0);
});
test('visual-QA failure and corrupt bytes never become ready; explicit retries are bounded and reserve budget',async t=>{
 const {service,db}=await setup(t,{connected:true,identity:'bad',estimatedCostCents:10,generate:async()=>({bytes:Buffer.from('corrupt'),qa:{matchesConfiguration:true}})},{retries:1});
 const j=await service.request(config,'a');assert.equal((await terminal(service,j.id)).status,'failed');await service.request(config,'a',{retry:true});assert.equal((await terminal(service,j.id)).status,'failed');await assert.rejects(service.request(config,'a',{retry:true}),/retry limit/);assert.equal(db.get('meta','preview-cost').cents,20);
});
test('concurrency and estimated-cost limits reject additional jobs without phantom queue entries',async t=>{
 const {service,db}=await setup(t,{connected:true,identity:'pending',estimatedCostCents:40,generate:async()=>{await pause(100);return {unavailable:true};}},{activePerSession:1,maxEstimatedCostCents:50});
 const j=await service.request(config,'a');await assert.rejects(service.request({...config,ribbon:'cream'},'a'),/already in progress/);await terminal(service,j.id);await assert.rejects(service.request({...config,ribbon:'cream'},'b'),/budget/);assert.equal(db.all('preview_jobs').length,1);
});
test('provider identity invalidates generated cache while curated keys remain stable',async t=>{
 const {service}=await setup(t,{connected:true,identity:'model-a'});const before=service.keyFor(config),curated=service.keyFor(recipes[0].config);service.provider={connected:true,identity:'model-b'};assert.notEqual(service.keyFor(config),before);assert.equal(service.keyFor(recipes[0].config),curated);
});
test('HTTP provider sends only structured config and transferable approved references, rejects oversized responses',async()=>{
 let sent;const p=new HttpConceptProvider({endpoint:'https://provider.example/generate',modelVersion:'approved-model',fetchImpl:async(u,o)=>{sent=JSON.parse(o.body);return {ok:true,headers:new Headers({'Content-Length':'99999999'}),json:async()=>({})};}});
 await assert.rejects(p.generate({config:{...config,customer:'private'},references:[{imageBase64:'test',contentHash:'abc'}],prompt:generationPrompt(config)}),/size limit/);
 assert.equal(sent.configuration.customer,undefined);assert.equal(sent.configuration.modelVersion,'approved-model');assert.equal(sent.references[0].imageBase64,'test');
});
