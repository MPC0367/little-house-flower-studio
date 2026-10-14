import fs from 'node:fs';import {gzipSync} from 'node:zlib';
const encodedCache=new Map();
export function acceptsGzip(value=''){return String(value).split(',').some(part=>{const [encoding,...parameters]=part.trim().split(';');const quality=parameters.find(p=>p.trim().startsWith('q='));return encoding.toLowerCase()==='gzip'&&(!quality||Number(quality.trim().slice(2))>0);});}
function singleByteRange(value,size){
 const match=/^bytes=(\d*)-(\d*)$/i.exec(String(value||'').trim());
 // Unsupported units, malformed ranges and multipart requests use the full response.
 if(!match||!match[1]&&!match[2])return null;
 const length=BigInt(size);let start,end;
 if(!match[1]){const suffix=BigInt(match[2]);if(!suffix||!length)return {unsatisfiable:true};start=suffix>=length?0n:length-suffix;end=length-1n;}
 else{start=BigInt(match[1]);end=match[2]?BigInt(match[2]):length-1n;if(match[2]&&end<start)return null;if(start>=length)return {unsatisfiable:true};if(end>=length)end=length-1n;}
 return {start:Number(start),end:Number(end)};
}
export function sendStaticFile(req,res,file,mime){
 const stat=fs.statSync(file),video=mime.split(';')[0].trim()==='video/mp4',compressible=/^(?:text\/|application\/(?:javascript|json))/.test(mime)||mime==='image/svg+xml',gzip=compressible&&stat.size>=512&&acceptsGzip(req.headers['accept-encoding']);
 if(video){
  res.setHeader('Accept-Ranges','bytes');
  // Range applies only to GET. Without a validator, If-Range safely falls back to 200.
  const range=req.method==='GET'&&!req.headers['if-range']?singleByteRange(req.headers.range,stat.size):null;
  if(range?.unsatisfiable){res.writeHead(416,{'Content-Type':mime,'Cache-Control':'no-cache','Content-Range':`bytes */${stat.size}`,'Content-Length':0});return res.end();}
  if(range){res.writeHead(206,{'Content-Type':mime,'Cache-Control':'no-cache','Content-Range':`bytes ${range.start}-${range.end}/${stat.size}`,'Content-Length':range.end-range.start+1});return fs.createReadStream(file,range).pipe(res);}
 }
 let bytes;if(gzip){const old=encodedCache.get(file);if(old&&old.mtime===stat.mtimeMs&&old.size===stat.size)bytes=old.bytes;else{bytes=gzipSync(fs.readFileSync(file),{level:6});encodedCache.set(file,{mtime:stat.mtimeMs,size:stat.size,bytes});if(encodedCache.size>200)encodedCache.delete(encodedCache.keys().next().value);}}
 const vary=String(res.getHeader('Vary')||'').split(',').map(v=>v.trim()).filter(Boolean);if(compressible&&!vary.includes('Accept-Encoding'))vary.push('Accept-Encoding');if(vary.length)res.setHeader('Vary',vary.join(', '));
 res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','Content-Length':gzip?bytes.length:stat.size,...(gzip?{'Content-Encoding':'gzip'}:{})});
 if(req.method==='HEAD')return res.end();if(gzip)return res.end(bytes);fs.createReadStream(file).pipe(res);
}
