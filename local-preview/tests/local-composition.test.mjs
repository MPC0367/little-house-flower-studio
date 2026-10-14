import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {LocalCompositionRenderer,compositionPlan,BOTANICAL_IDS,COMPOSITION_VERSION,paletteTint,recolourPetals} from '../server/local-composition.mjs';
import {PreviewService} from '../server/preview-service.mjs';
import {Journal} from '../server/store.mjs';
import {recipes} from '../shared/recipes.mjs';
import {containers,finishFor,visualConfig} from '../shared/config.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const root=path.resolve(import.meta.dirname,'..');
const config={...recipes[0].config,flowers:['lily','eucalyptus'],finish:'pink',ribbon:'burgundy'};
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lhf-composition-'));const assetDir=path.join(dir,'customer/img/live-flowers');fs.mkdirSync(assetDir,{recursive:true});fs.mkdirSync(path.join(dir,'fixtures'));fs.writeFileSync(path.join(dir,'fixtures/preview-cache.json'),'[]');
 // Transparent photographic assets are checked separately. These distinguishable
 // stand-ins exercise alpha composition, bounded layout and cache contracts.
 for(const [i,id]of BOTANICAL_IDS.entries())await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="260" height="310"><path d="M130 290Q128 190 130 140" stroke="#54744e" stroke-width="9"/><ellipse cx="160" cy="219" rx="40" ry="14" fill="#739166" transform="rotate(-25 160 219)"/><g fill="hsl(${i*31%360},48%,73%)">${Array.from({length:7},(_,n)=>`<ellipse cx="130" cy="84" rx="32" ry="65" transform="rotate(${n*360/7} 130 134)"/>`).join('')}</g><circle cx="130" cy="134" r="25" fill="#d9ba74"/></svg>`)).webp().toFile(path.join(assetDir,id+'.webp'));
 const presentation=path.join(root,'customer/img/live-presentation');if(fs.existsSync(presentation)){fs.mkdirSync(path.join(dir,'customer/img/live-presentation'));for(const id of ['wicker','hatbox','vase','bow'])if(fs.existsSync(path.join(presentation,id+'.webp')))fs.copyFileSync(path.join(presentation,id+'.webp'),path.join(dir,'customer/img/live-presentation',id+'.webp'));}
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;
}
test('plans use exactly the selected species across all eighteen botanicals and all seven styles',()=>{
 for(const id of BOTANICAL_IDS)for(const style of Object.keys(containers)){
  const p=compositionPlan({...config,flowers:[id],style,container:containers[style][0]});assert.deepEqual(p.flowers,[id]);assert.ok(p.items.length>0);assert.deepEqual([...new Set(p.items.map(x=>x.id))],[id]);assert.equal(p.representative,false);
 }
 for(const palette of ['florist','white-green','pink-white','red','yellow-white','blue-white']){const p=compositionPlan({...config,flowers:[],palette});assert.equal(p.representative,true);assert.ok(p.flowers.length);assert.ok(p.flowers.every(id=>BOTANICAL_IDS.includes(id)));}
});
test('petal palette changes preserve green leaves, pollen, alpha and fixed natural species',()=>{
 const pixels=Buffer.from([230,231,228,255,73,122,69,255,177,143,65,255,216,217,218,0,115,150,210,255]);
 for(const id of ['rose_white','rose_red','rose_pink','sunflower','eucalyptus','jasmine','chamomile','babys_breath'])assert.deepEqual(recolourPetals(pixels,id,'pink-white'),pixels,id+' must keep its natural colour');
 const pink=recolourPetals(pixels,'lily','pink-white');assert.notDeepEqual(pink.subarray(0,4),pixels.subarray(0,4));assert.ok(pink[0]>pink[1]);assert.deepEqual(pink.subarray(4),pixels.subarray(4));assert.equal(paletteTint('lily','blue-white'),null);assert.equal(paletteTint('soap_rose','red'),null);
 const hydrangea=recolourPetals(pixels,'hydrangea','pink-white');assert.ok(hydrangea[16]>hydrangea[17]);assert.equal(hydrangea[19],255);assert.deepEqual(hydrangea.subarray(4,16),pixels.subarray(4,16));
});
test('a partial botanical install cannot enable only some customization choices',async t=>{
 const dir=await fixture(t);fs.unlinkSync(path.join(dir,'customer/img/live-flowers/soap_rose.webp'));const renderer=new LocalCompositionRenderer({root:dir});assert.equal(renderer.available(config),false);await assert.rejects(renderer.render(config),/still being prepared/);
});
test('local composition produces valid immutable derivatives for every style and container',async t=>{
 const dir=await fixture(t),renderer=new LocalCompositionRenderer({root:dir});const assets=[];
 for(const [style,options]of Object.entries(containers))for(const container of options){const c={...config,style,container,finish:finishFor(container)[0]};const asset=await renderer.render(c);const meta=await sharp(path.join(dir,'customer',asset.url)).metadata();assert.equal(meta.width,1200);assert.equal(meta.height,1200);assert.equal(meta.format,'webp');assert.equal(asset.kind,'composition');assert.equal(asset.version,COMPOSITION_VERSION);assert.deepEqual(asset.configuration,visualConfig(c));assert.deepEqual(asset.provenance.botanicals,c.flowers);assert.equal((await sharp(path.join(dir,'customer',asset.url.replace('1200','640'))).metadata()).width,640);assets.push(asset.contentHash);}
 assert.equal(new Set(assets).size,assets.length);const first=await renderer.render(config),file=path.join(dir,'customer',first.url),mtime=fs.statSync(file).mtimeMs;const second=await renderer.render({...config});assert.deepEqual(second,first);assert.equal(fs.statSync(file).mtimeMs,mtime);
});
test('flowers, palette, finish, ribbon and size change the visible composition and versioned key',async t=>{
 const dir=await fixture(t),renderer=new LocalCompositionRenderer({root:dir});const variants=[config,{...config,flowers:['rose_white']},{...config,palette:'blue-white'},{...config,finish:'black'},{...config,ribbon:'pink'},{...config,size:'smaller'},{...config,size:'larger'}];const results=[];
 for(const c of variants)results.push(await renderer.render(c));assert.equal(new Set(results.map(x=>x.id)).size,variants.length);assert.equal(new Set(results.map(x=>x.contentHash)).size,variants.length);assert.equal(compositionPlan({...config,size:'smaller'}).size,.81);assert.equal(compositionPlan({...config,size:'larger'}).size,1.11);
});
test('bridal stem binding finish changes pixels independently of its ribbon colour',async t=>{
 const dir=await fixture(t),renderer=new LocalCompositionRenderer({root:dir}),base={...config,style:'wedding',container:'hand-tied',ribbon:'burgundy'};
 const cream=await renderer.render({...base,finish:'cream'}),pink=await renderer.render({...base,finish:'pink'});assert.notEqual(cream.contentHash,pink.contentHash);assert.equal(cream.configuration.ribbon,pink.configuration.ribbon);
});
test('queue coalesces same configurations and never exceeds its worker bound',async t=>{
 const dir=await fixture(t),renderer=new LocalCompositionRenderer({root:dir,concurrency:2});let active=0,maxActive=0,calls=0;renderer.renderNow=async c=>{calls++;active++;maxActive=Math.max(maxActive,active);await pause(20);active--;return {key:renderer.key(c)};};
 const a=renderer.render(config),same=renderer.render({...config});assert.equal(a,same);await Promise.all([a,same,...Array.from({length:10},(_,n)=>renderer.render({...config,size:n%2?'smaller':'larger',ribbon:n%3?'pink':'cream'}))]);assert.equal(maxActive,2);assert.equal(renderer.active,0);assert.equal(renderer.queue.length,0);assert.ok(calls<12);
});
test('local preview supports automatic cache misses without external requests or paid-provider limits',async t=>{
 const dir=await fixture(t),db=new Journal(path.join(dir,'data'));t.after(()=>db.db.close());let external=0;
 const service=new PreviewService({root:dir,dir,db,provider:{connected:true,identity:'unused',generate:()=>{external++;throw Error('Do not call external providers');}},limits:{requestsPerHour:0,activePerSession:0,maxEstimatedCostCents:0}});
 const first=await service.request(config,'a',{mode:'lookup'});assert.equal(first.status,'queued');assert.equal(first.owner,undefined);const second=await service.request(config,'a');assert.equal(second.id,first.id);
 let done;for(let n=0;n<150;n++){done=service.get(first.id);if(done.status==='ready'||done.status==='failed')break;await pause(20);}assert.equal(done.status,'ready',done.reason);assert.equal(done.asset.kind,'composition');assert.equal(done.key,service.keyFor(config));assert.equal(external,0);assert.equal(db.get('meta','preview-cost'),null);const cached=await service.request(config,'b');assert.equal(cached.status,'ready');assert.equal(cached.asset.id,done.asset.id);
});
test('local queue, request and cache caps reject before creating phantom jobs, without removing saved assets',async t=>{
 const dir=await fixture(t),db=new Journal(path.join(dir,'data'));t.after(()=>db.db.close());const service=new PreviewService({root:dir,dir,db,limits:{localQueue:1}});let release;
 service.localComposition.render=()=>new Promise(resolve=>{release=resolve;});const first=await service.request(config,'a');assert.equal((await service.request(config,'a')).id,first.id);
 await assert.rejects(service.request({...config,finish:'black'},'a'),/queue is full/);assert.equal(db.all('preview_jobs').length,1);release({id:'saved-composition',version:1,url:'/img/saved.webp'});await pause(5);
 service.limits.localCacheEntries=1;await assert.rejects(service.request({...config,finish:'black'},'a'),/storage is full/);assert.equal(db.all('preview_jobs').length,1);assert.equal(db.get('previews',first.key).asset.id,'saved-composition');
 service.limits.localCacheEntries=10;service.limits.localRequestsPerHour=1;await assert.rejects(service.request({...config,finish:'black'},'a'),/request limit/);assert.equal(db.all('preview_jobs').length,1);
});
test('actual botanical assets are transparent, bounded, and complete when the asset set is installed',async t=>{
 const dir=path.join(root,'customer/img/live-flowers');if(!fs.existsSync(dir))return t.skip('Botanical asset generation is still in progress');
 for(const id of BOTANICAL_IDS){const file=path.join(dir,id+'.webp');assert.ok(fs.existsSync(file),'Missing '+id);const m=await sharp(file).metadata();assert.equal(m.hasAlpha,true,id+' needs transparency');assert.ok(m.width<=480&&m.height<=480,id+' exceeds cutout limit');assert.ok(m.width>30&&m.height>30,id+' is empty');}
});
