import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {gunzipSync} from 'node:zlib';
import {sendStaticFile} from '../server/static-files.mjs';

async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lhf-media-range-'));
 const video=Buffer.from(Array.from({length:1024},(_,index)=>index%251));
 const script='const brand = "Little House Flower";\n'.repeat(100);
 fs.writeFileSync(path.join(dir,'loader.mp4'),video);fs.writeFileSync(path.join(dir,'empty.mp4'),Buffer.alloc(0));fs.writeFileSync(path.join(dir,'script.js'),script);
 const server=http.createServer((req,res)=>{res.setHeader('Vary','Origin');const text=req.url==='/script.js',file=req.url==='/empty.mp4'?'empty.mp4':text?'script.js':'loader.mp4';sendStaticFile(req,res,path.join(dir,file),text?'text/javascript; charset=utf-8':'video/mp4');});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});});
 const request=({method='GET',headers={},url='/loader.mp4'}={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:url,method,headers,agent:false},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',reject);});req.on('error',reject);req.end();});
 return {request,video,script};
}

test('MP4 requests expose the correct media type and Safari byte probes return exact partial bytes',async t=>{
 const {request,video}=await fixture(t),full=await request({headers:{'accept-encoding':'gzip'}});
 assert.equal(full.status,200);assert.equal(full.headers['content-type'],'video/mp4');assert.equal(full.headers['accept-ranges'],'bytes');assert.equal(full.headers['content-encoding'],undefined);assert.equal(Number(full.headers['content-length']),video.length);assert.deepEqual(full.body,video);
 for(const [range,start,end]of [['bytes=0-1',0,1],['bytes=128-255',128,255],['bytes=1000-',1000,1023],['bytes=-16',1008,1023],['bytes=-90071992547409930000',0,1023],['bytes=1020-90071992547409930000',1020,1023]]){
  const response=await request({headers:{Range:range}});assert.equal(response.status,206,range);assert.equal(response.headers['content-range'],`bytes ${start}-${end}/${video.length}`);assert.equal(Number(response.headers['content-length']),end-start+1);assert.deepEqual(response.body,video.subarray(start,end+1));
 }
});

test('unsatisfiable video ranges return 416 with the complete length and no body',async t=>{
 const {request,video}=await fixture(t);
 for(const range of ['bytes=1024-','bytes=999999999999999999999-','bytes=-0']){const response=await request({headers:{Range:range}});assert.equal(response.status,416,range);assert.equal(response.headers['content-range'],`bytes */${video.length}`);assert.equal(response.headers['accept-ranges'],'bytes');assert.equal(response.headers['content-length'],'0');assert.equal(response.body.length,0);}
 const empty=await request({url:'/empty.mp4',headers:{Range:'bytes=0-1'}});assert.equal(empty.status,416);assert.equal(empty.headers['content-range'],'bytes */0');
});

test('HEAD and unsupported range forms retain complete-response semantics',async t=>{
 const {request,video}=await fixture(t);
 for(const range of [undefined,'bytes=0-1','bytes=999999-']){const response=await request({method:'HEAD',headers:range?{Range:range}:{}});assert.equal(response.status,200);assert.equal(Number(response.headers['content-length']),video.length);assert.equal(response.headers['content-range'],undefined);assert.equal(response.headers['accept-ranges'],'bytes');assert.equal(response.body.length,0);}
 for(const range of ['items=0-1','bytes=0-1,4-5','bytes=','bytes=8-4','bytes=abc-def']){const response=await request({headers:{Range:range}});assert.equal(response.status,200,range);assert.deepEqual(response.body,video);assert.equal(response.headers['content-range'],undefined);}
 const conditional=await request({headers:{Range:'bytes=0-1','If-Range':'"unknown-validator"'}});assert.equal(conditional.status,200);assert.deepEqual(conditional.body,video);
});

test('video range support leaves text gzip negotiation, Vary and HEAD unchanged',async t=>{
 const {request,script}=await fixture(t),headers={Range:'bytes=0-1','Accept-Encoding':'gzip'};
 const response=await request({url:'/script.js',headers});assert.equal(response.status,200);assert.equal(response.headers['content-type'],'text/javascript; charset=utf-8');assert.equal(response.headers['content-encoding'],'gzip');assert.equal(response.headers.vary,'Origin, Accept-Encoding');assert.equal(response.headers['accept-ranges'],undefined);assert.equal(response.headers['content-range'],undefined);assert.equal(gunzipSync(response.body).toString(),script);
 const head=await request({url:'/script.js',method:'HEAD',headers});assert.equal(head.status,200);assert.equal(head.headers['content-length'],response.headers['content-length']);assert.equal(head.headers['content-encoding'],'gzip');assert.equal(head.body.length,0);
});
