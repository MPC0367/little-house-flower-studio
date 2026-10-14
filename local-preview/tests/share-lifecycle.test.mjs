import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import net from 'node:net';import {fileURLToPath} from 'node:url';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {Journal} from '../server/store.mjs';
const exec=promisify(execFile),source=fileURLToPath(new URL('..',import.meta.url));
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lhf-share-lifecycle-'));for(const folder of ['scripts','server'])fs.mkdirSync(path.join(dir,folder));
 for(const file of ['scripts/share-preview.mjs','server/share-proxy.mjs','server/staff-auth.mjs','server/store.mjs'])fs.copyFileSync(path.join(source,file),path.join(dir,file));
 fs.writeFileSync(path.join(dir,'server/main.mjs'),`import http from 'node:http';import {Journal} from './store.mjs';const db=new Journal(process.env.LHF_DATA_DIR);db.put('orders','synthetic',{id:'synthetic',demo:true});for(const name of ['CUSTOMER_PORT','ADMIN_PORT','API_PORT'])http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}));}).listen(Number(process.env[name]),'127.0.0.1');`);
 const fake=path.join(dir,'fake-cloudflared');fs.writeFileSync(fake,'#!'+process.execPath+'\n'+`const args=process.argv.slice(2);if(!args.includes('--config')||!args.includes('--pidfile'))process.exit(2);const port=args[args.indexOf('--url')+1].split(':').pop();console.error('https://'+(port==='5383'?'customer':'studio')+'-lifecycle-example.trycloudflare.com');setInterval(()=>{},1000);`,{mode:0o700});
 const command=verb=>exec(process.execPath,[path.join(dir,'scripts/share-preview.mjs'),verb],{env:{...process.env,LHF_CLOUDFLARED:fake},timeout:20000,maxBuffer:1024*1024});
 t.after(async()=>{await command('stop').catch(()=>{});fs.rmSync(dir,{recursive:true,force:true});});
 return {dir,command,data:path.join(dir,'data/client-review'),state:()=>JSON.parse(fs.readFileSync(path.join(dir,'data/client-review/share-state.json'),'utf8'))};
}
async function portFree(port){await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(resolve));});}
function probe(password){return new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port:5383,path:'/api/health',headers:{Host:'customer-lifecycle-example.trycloudflare.com',Authorization:'Basic '+Buffer.from('client:'+password).toString('base64')}},res=>{res.resume();res.once('end',()=>resolve(res.statusCode));});req.once('error',reject);});}

test('share lifecycle uses a separate private database, one supervisor and protected proxies; stop preserves data',async t=>{
 const f=await fixture(t),starts=await Promise.allSettled([f.command('start'),f.command('start')]);assert.ok(starts.some(result=>result.status==='fulfilled'));
 const state=f.state();assert.equal(state.status,'ready');assert.equal(state.children.length,3);assert.notEqual(state.customerURL,state.studioURL);assert.equal(state.ports.customer,5373);assert.equal(state.ports.admin,5374);
 const access=fs.readFileSync(path.join(f.data,'access.txt'),'utf8'),password=access.match(/^Password: (.+)$/m)[1];assert.equal(fs.statSync(f.data).mode&0o777,0o700);assert.equal(fs.statSync(path.join(f.data,'access.txt')).mode&0o777,0o600);assert.ok(password.length>=24);
 for(const result of starts)if(result.status==='fulfilled')assert.equal(result.value.stdout.includes(password),false);assert.equal(fs.readFileSync(path.join(f.data,'share.log'),'utf8').includes(password),false);
 assert.equal(await probe(password),200);assert.equal(await probe('incorrect test password'),401);assert.match((await f.command('status')).stdout,/Customer: https:/);await f.command('start');assert.equal(f.state().pid,state.pid);
 await f.command('stop');assert.equal(f.state().status,'stopped');const db=new Journal(f.data);assert.equal(db.get('meta','client-review').synthetic,true);assert.equal(db.get('orders','synthetic').demo,true);db.db.close();assert.equal(fs.readFileSync(path.join(f.data,'access.txt'),'utf8'),access);for(const port of [5373,5374,8987,5383,5384])await portFree(port);
});
test('an existing database with unknown provenance is refused even if its orders have demo flags',async t=>{
 const f=await fixture(t),db=new Journal(f.data);db.put('orders','unverified',{id:'unverified',demo:true});db.db.close();await assert.rejects(f.command('start'));assert.equal(f.state().status,'stopped');assert.match(fs.readFileSync(path.join(f.data,'share.log'),'utf8'),/unknown provenance/);assert.equal(fs.existsSync(path.join(f.data,'access.txt')),false);assert.equal(f.state().children,undefined);
});
test('stop identifies and cleans up only this review supervisor’s orphan children after an abrupt exit',async t=>{
 const f=await fixture(t);await f.command('start');const state=f.state();process.kill(state.pid,'SIGKILL');await new Promise(resolve=>setTimeout(resolve,100));await f.command('stop');for(const port of [5373,5374,8987,5383,5384])await portFree(port);assert.match((await f.command('status')).stdout,/offline/);assert.ok(fs.existsSync(path.join(f.data,'journal.sqlite')));
});
