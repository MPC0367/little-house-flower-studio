import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadHostedSiteAsset,MAX_SITE_ASSET_BYTES} from '../server/hosted-site-upload.mjs';
import {hash} from '../server/hosted-crypto.mjs';

const content=new TextEncoder().encode('<!doctype html><title>Synthetic approved fixture</title>'),digest=hash(content),manifest={'/index.html':{hash:digest,size:content.length,mime:'text/html; charset=utf-8'}};
const request=(body=content,headers={})=>new Request('https://demo.example/api/admin/site-assets/'+digest,{method:'POST',body,headers});

test('immutable asset upload writes exact manifest-approved bytes and server-controlled MIME',async()=>{
  const calls=[],env={BUCKET:{put:async(...args)=>calls.push(args)}};
  const result=await uploadHostedSiteAsset(request(content,{'Content-Type':'application/x-untrusted'}),{env,digest,manifest});
  assert.deepEqual(result,{ok:true,hash:digest,size:content.length});assert.equal(calls.length,1);assert.equal(calls[0][0],'site-assets/'+digest);assert.deepEqual(calls[0][1],content);assert.deepEqual(calls[0][2],{httpMetadata:{contentType:'text/html; charset=utf-8'}});
});

test('unknown, malformed, modified, short, oversized and compressed assets never reach R2',async()=>{
  let writes=0;const env={BUCKET:{put:async()=>writes++}},mutated=new Uint8Array(content);mutated[10]^=1;
  for(const [input,id,approved,status] of [
    [request(),'a'.repeat(64),manifest,404],
    [request(),'../'+digest,manifest,404],
    [request(mutated),digest,manifest,422],
    [request(content.slice(1)),digest,manifest,422],
    [request(new Uint8Array(content.length+1)),digest,manifest,413],
    [request(content,{'Content-Length':String(content.length+1)}),digest,manifest,422],
    [request(content,{'Content-Length':String(MAX_SITE_ASSET_BYTES+1)}),digest,manifest,413],
    [request(content,{'Content-Encoding':'gzip'}),digest,manifest,415],
    [request(),digest,{'/large.mp4':{...manifest['/index.html'],size:MAX_SITE_ASSET_BYTES+1}},404]
  ])await assert.rejects(uploadHostedSiteAsset(input,{env,digest:id,manifest:approved}),error=>error.status===status);
  assert.equal(writes,0);
});
