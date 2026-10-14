/* Local stand-in for mpc0367.github.io: the website (../site) and the Studio (docs/) on one origin, as GitHub
   Pages serves them, with byte ranges so Safari plays the opening film. It does not relay /api/ anywhere:
   the website and Studio find no back end on 127.0.0.1:5580 unless you start one, so nothing here can reach
   the hosted demo data.
     node scripts/serve-pages.mjs [port]   (default 5590) → http://127.0.0.1:5590/Little-House-Flower/ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.argv[2]||5590);
const roots={'/Little-House-Flower/':path.join(here,'..','site'),'/little-house-flower-studio/':path.join(here,'docs')};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.mp4':'video/mp4','.txt':'text/plain; charset=utf-8','.ico':'image/x-icon'};

http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400).end();return;}
  const base=Object.keys(roots).find(prefix=>pathname.startsWith(prefix));
  if(!base){res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');return;}
  const root=roots[base],relative=pathname.slice(base.length);
  if(relative.split('/').some(part=>part.startsWith('.'))){res.writeHead(404).end();return;}
  let file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}
  try{
    if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    const size=fs.statSync(file).size;let start=0,end=size-1,status=200;
    const headers={'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
    if(req.headers.range){
      const match=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
      if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}
      if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
      else{start=Math.max(0,size-Number(match[2]));}
      if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
    }
    headers['Content-Length']=end-start+1;res.writeHead(status,headers);
    if(req.method==='HEAD'){res.end();return;}
    fs.createReadStream(file,{start,end}).pipe(res);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Website: http://127.0.0.1:${port}/Little-House-Flower/  Studio: http://127.0.0.1:${port}/little-house-flower-studio/`));
