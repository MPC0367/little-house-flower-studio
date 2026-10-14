/* The Studio script (google/studio.gs) served on this computer as if Google ran it, against the
   synthetic test Sheet in .emulator/ (made by google/emulator/fixture.mjs). Connect the Studio to
   http://127.0.0.1:5585/exec with a key from .emulator/keys.json (Settings → Connect the shop's
   Google Sheet; the Studio accepts a local address only when it runs on this computer too).
   Like Google, it answers POST and GET only (no preflight), so a request the real web app would
   refuse is refused here as well.
   Test helpers (this computer only): GET /_test/workbook, POST /_test/reset,
   POST /_test/edit {ref, label, value} (a person changing a cell in the Sheet).
     node scripts/sheet-emulator.mjs [port]   (default 5585) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadScript} from '../google/emulator/apps-script.mjs';
import {makeFixture,SCRIPT} from '../google/emulator/fixture.mjs';

const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(here,'.emulator'),bookFile=path.join(dir,'workbook.json');
const port=Number(process.argv[2]||5585);
if(!fs.existsSync(bookFile))makeFixture(dir);
const app=()=>loadScript(SCRIPT,bookFile);   // fresh each request: the file is the Sheet
const cors={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
const send=(res,status,value)=>{res.writeHead(status,{...cors,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
async function body(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>200000)throw new Error('too large');chunks.push(c);}return Buffer.concat(chunks).toString('utf8');}

http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/exec'&&req.method==='POST')return send(res,200,app().post(await body(req)));
    if(url.pathname==='/exec'&&req.method==='GET')return send(res,200,JSON.parse(app().context.doGet().getContent()));
    if(url.pathname==='/exec')return send(res,405,{error:'Google Apps Script web apps answer GET and POST only'});
    if(url.pathname==='/_test/workbook'&&req.method==='GET')return send(res,200,JSON.parse(fs.readFileSync(bookFile,'utf8')));
    if(url.pathname==='/_test/reset'&&req.method==='POST'){makeFixture(dir);return send(res,200,{ok:true});}
    if(url.pathname==='/_test/edit'&&req.method==='POST'){
      const {ref,label,value}=JSON.parse(await body(req)),a=app(),sh=a.book.getSheetByName('Bookings');
      const head=sh.data[0].map(String),col=head.findIndex(h=>h===label||h.endsWith(' / '+label)),row=sh.data.findIndex(r=>String(r[1])===ref);
      if(col<0||row<1)return send(res,404,{error:'No such cell'});
      sh.data[row][col]=value;a.book.save();return send(res,200,{ok:true});
    }
    send(res,404,{error:'Not found'});
  }catch(error){send(res,500,{error:error.message});}
}).listen(port,'127.0.0.1',()=>console.log(`Studio script emulator: http://127.0.0.1:${port}/exec (test Sheet: ${bookFile})`));
