import assets from './hosted-site-assets.json' with {type:'json'};
export async function getSiteFile(request,env){
 const url=new URL(request.url);let path=url.pathname;
 if(path==='/')path='/index.html';if(path==='/studio/')path='/studio/index.html';
 const asset=Object.hasOwn(assets,path)?assets[path]:null;
 if(!asset)return new Response('Not found',{status:404});
 const headers=new Headers({'Content-Type':asset.mime,'Content-Length':String(asset.size),'Cache-Control':'private, no-store','ETag':'"'+asset.hash+'"','Accept-Ranges':'bytes'});
 let range=null,status=200;const raw=request.headers.get('range'),ifRange=request.headers.get('if-range');
 if(request.method==='GET'&&raw&&(!ifRange||ifRange===headers.get('etag'))){
  const match=/^bytes=(\d*)-(\d*)$/.exec(raw);
  if(match&&(match[1]||match[2])){
   const start=match[1]?Number(match[1]):Math.max(0,asset.size-Number(match[2]));
   const end=match[1]?(match[2]?Math.min(asset.size-1,Number(match[2])):asset.size-1):asset.size-1;
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=asset.size||end<start){headers.set('Content-Range',`bytes */${asset.size}`);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}
   range={offset:start,length:end-start+1};status=206;headers.set('Content-Range',`bytes ${start}-${end}/${asset.size}`);headers.set('Content-Length',String(range.length));
  }
 }
 const key='site-assets/'+asset.hash;
 const object=request.method==='HEAD'?await env.BUCKET.head(key):await env.BUCKET.get(key,range?{range}:undefined);
 if(!object)return new Response('This demo is being prepared. Please try again shortly.',{status:503,headers:{'Retry-After':'30'}});
 return new Response(request.method==='HEAD'?null:object.body,{status,headers});
}
