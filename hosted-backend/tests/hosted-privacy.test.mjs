/* Privacy fixes of 15 October 2026: reference photos are stored without location or camera data and
   damaged files are refused; unused uploads go after 36 hours; a booking keeps only the fields a
   booking has; the demo no longer claims a sync that does not happen. */
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {cleanImage} from '../server/hosted-images.mjs';
import {handleHostedRequest} from '../server/hosted-api.mjs';
import {loadHostedJournal} from '../server/hosted-store.mjs';
import {legacy} from '../server/domain.mjs';

const has=(bytes,text)=>Buffer.from(bytes).includes(Buffer.from(text));
const exif={IFD0:{Make:'AUDITCAM',Model:'Location test'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'13/1 51/1 30/1',GPSLongitudeRef:'E',GPSLongitude:'100/1 27/1 41/1'}};
const picture=()=>sharp({create:{width:48,height:32,channels:3,background:'#b0111f'}});
const CRC=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=0xffffffff;for(const x of b)c=CRC[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function pngWithText(png,keyword,text){
  const data=Buffer.concat([Buffer.from(keyword+'\0','latin1'),Buffer.from(text,'latin1')]),type=Buffer.from('tEXt');
  const chunk=Buffer.alloc(12+data.length);chunk.writeUInt32BE(data.length,0);type.copy(chunk,4);data.copy(chunk,8);chunk.writeUInt32BE(crc(Buffer.concat([type,data])),8+data.length);
  return Uint8Array.from(Buffer.concat([png.subarray(0,33),chunk,png.subarray(33)]));   // after IHDR
}

test('JPEG: location and camera data are removed, the picture is unchanged',async()=>{
  const raw=Uint8Array.from(await picture().jpeg().withExif(exif).toBuffer());
  assert.ok(has(raw,'Exif')&&has(raw,'AUDITCAM'),'the test file carries metadata');
  const clean=cleanImage(raw);
  assert.equal(has(clean.bytes,'Exif'),false);assert.equal(has(clean.bytes,'AUDITCAM'),false);
  const meta=await sharp(clean.bytes).metadata();assert.equal(meta.exif,undefined);assert.deepEqual([meta.width,meta.height,clean.width,clean.height],[48,32,48,32]);
  const [a,b]=await Promise.all([sharp(raw).raw().toBuffer(),sharp(clean.bytes).raw().toBuffer()]);assert.ok(a.equals(b),'pixels identical');
});

test('WebP and PNG: metadata chunks are removed and the header no longer announces them',async()=>{
  const webp=Uint8Array.from(await picture().webp({lossless:true}).withExif(exif).toBuffer());
  assert.ok(has(webp,'EXIF')&&has(webp,'AUDITCAM'));
  const cleanWebp=cleanImage(webp);assert.equal(has(cleanWebp.bytes,'AUDITCAM'),false);assert.equal(has(cleanWebp.bytes,'EXIF'),false);
  assert.equal((await sharp(cleanWebp.bytes).metadata()).exif,undefined);await sharp(cleanWebp.bytes).raw().toBuffer();
  const png=pngWithText(await picture().png().toBuffer(),'Location','13.858,100.461 home');
  const cleanPng=cleanImage(png);assert.equal(has(cleanPng.bytes,'13.858'),false);await sharp(cleanPng.bytes).raw().toBuffer();
});

test('damaged files are refused, not stored half-read',async()=>{
  const jpeg=Uint8Array.from(await picture().jpeg().toBuffer()),png=Uint8Array.from(await picture().png().toBuffer());
  assert.throws(()=>cleanImage(jpeg.subarray(0,Math.floor(jpeg.length/2))),e=>e.status===422);   // refused, whichever check sees it first
  assert.throws(()=>cleanImage(jpeg.subarray(0,jpeg.length-20)),/damaged or incomplete/);            // the picture data does not end
  const badCrc=png.slice();badCrc[30]^=0xff;assert.throws(()=>cleanImage(badCrc),/damaged or incomplete/);
  assert.throws(()=>cleanImage(png.subarray(0,png.length-12)),/damaged or incomplete/);
});

/* the API, with an in-memory D1 and R2 as in hosted-api.test.mjs */
class MemoryD1{row=null;prepare(sql){return {bind:(...v)=>({first:async()=>this.row?structuredClone(this.row):null,run:async()=>{if(sql.startsWith('INSERT')){if(this.row)return {meta:{changes:0}};this.row={version:v[1],payload:v[2]};return {meta:{changes:1}};}if(sql.startsWith('UPDATE')){if(!this.row||this.row.version!==v[2])return {meta:{changes:0}};this.row={version:this.row.version+1,payload:v[0]};return {meta:{changes:1}};}throw Error('Unexpected statement');}})};}}
function fixture(){
  const blobs=new Map(),env={DB:new MemoryD1(),DEMO_PASSWORD:'Synthetic hosted password 123',BUCKET:{put:async(k,b)=>{blobs.set(k,new Uint8Array(b));},get:async k=>blobs.has(k)?{body:blobs.get(k)}:null,delete:async k=>blobs.delete(k)}};
  async function request(path,{method='GET',body,cookie,headers={},raw}={}){
    const r=new Request('https://demo.example'+path,{method,headers:{Authorization:'Basic '+Buffer.from('client:'+env.DEMO_PASSWORD).toString('base64'),Origin:'https://demo.example','X-CSRF':'local-preview',...(cookie?{Cookie:cookie}:{}),...headers},...(raw?{body:raw}:body!==undefined?{body:JSON.stringify(body)}:{})});
    const response=await handleHostedRequest(r,env),text=await response.text();let value;try{value=JSON.parse(text);}catch{value=text;}
    return {status:response.status,value,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  return {env,blobs,request};
}

test('an uploaded reference photo is stored clean; an old unused upload is removed after 36 hours',async()=>{
  const {env,blobs,request}=fixture(),guest=await request('/api/session',{method:'POST',body:{}});
  const raw=Uint8Array.from(await picture().jpeg().withExif(exif).toBuffer());
  const up=await request('/api/uploads',{method:'POST',cookie:guest.cookie,raw,headers:{'X-Upload-Consent':'yes','Content-Type':'image/jpeg'}});
  assert.equal(up.status,201,JSON.stringify(up.value));
  const stored=[...blobs.values()][0];assert.equal(has(stored,'AUDITCAM'),false);assert.equal(has(stored,'Exif'),false);
  const truncated=await request('/api/uploads',{method:'POST',cookie:guest.cookie,raw:raw.subarray(0,200),headers:{'X-Upload-Consent':'yes'}});
  assert.equal(truncated.status,422);
  // make the first upload 37 hours old, then upload another: the old one goes, bytes and record
  const db=await loadHostedJournal(env),asset=db.get('assets',up.value.id);db.put('assets',asset.id,{...asset,createdAt:new Date(Date.now()-37*3600000).toISOString()});await db.commit();
  const second=await request('/api/uploads',{method:'POST',cookie:guest.cookie,raw,headers:{'X-Upload-Consent':'yes'}});assert.equal(second.status,201);
  const after=await loadHostedJournal(env);assert.equal(after.get('assets',up.value.id),null);assert.equal(blobs.size,1);
});

test('a booking keeps only the fields a booking has, and nothing claims a sync',async()=>{
  const {env,request}=fixture(),guest=await request('/api/session',{method:'POST',body:{}});
  const date=legacy.util.addDays(legacy.time.today(),3);
  const booking={id:'privacy-shape-test-001',type:'product',items:[{productId:'white-rose',qty:1}],date,windowId:'p2',fulfil:'pickup',
    customer:{name:'Synthetic test customer',phone:'0800000000',line:'fake-handle',padding:'x'.repeat(50000),isAdmin:true},
    recipient:{name:'Synthetic recipient',phone:'0800000000',extra:'y'.repeat(1000)},card:{message:'Synthetic card',font:'z'},lang:'th',consent:true};
  const sent=await request('/api/orders',{method:'POST',cookie:guest.cookie,body:booking});assert.equal(sent.status,201,JSON.stringify(sent.value));
  const db=await loadHostedJournal(env),order=db.get('orders',booking.id);
  assert.deepEqual(Object.keys(order.customer).sort(),['line','name','phone']);assert.deepEqual(Object.keys(order.recipient).sort(),['name','phone']);assert.deepEqual(Object.keys(order.card),['message']);
  assert.equal(JSON.stringify(db.payload).includes('x'.repeat(100)),false);
  assert.equal(order.syncState,'saved');
  const health=await request('/api/health');assert.equal(health.value.sync.lastSync,null);
});

test('six customers booking at the same moment are all saved (the shared document retries its own collisions)',async()=>{
  const {env,request}=fixture();
  const guests=await Promise.all(Array.from({length:6},()=>request('/api/session',{method:'POST',body:{}})));
  const date=legacy.util.addDays(legacy.time.today(),4);
  const results=await Promise.all(guests.map((g,i)=>request('/api/orders',{method:'POST',cookie:g.cookie,body:{id:'parallel-booking-00'+i,type:'product',items:[{productId:'white-rose',qty:1}],date,windowId:'p2',fulfil:'pickup',customer:{name:'Parallel '+i,phone:'0800000000',line:''},recipient:{name:'R',phone:'0800000000'},card:{message:''},lang:'th',consent:true}})));
  assert.deepEqual(results.map(r=>r.status),[201,201,201,201,201,201],JSON.stringify(results.map(r=>r.value?.error||r.status)));
  const db=await loadHostedJournal(env);assert.equal(db.all('orders').filter(o=>o.id.startsWith('parallel-booking-')).length,6);
});
