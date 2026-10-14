import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import net from 'node:net';import {fileURLToPath} from 'node:url';import {spawn,execFileSync} from 'node:child_process';
import {Journal} from '../server/store.mjs';import {StaffAuth} from '../server/staff-auth.mjs';import {createShareProxy,shareURL} from '../server/share-proxy.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),entry=fileURLToPath(import.meta.url),dir=path.join(root,'data/client-review'),stateFile=path.join(dir,'share-state.json'),logFile=path.join(dir,'share.log'),cloudflared=process.env.LHF_CLOUDFLARED||'/opt/homebrew/bin/cloudflared';
const ports={customer:5373,admin:5374,api:8987,customerProxy:5383,adminProxy:5384};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const startLock=path.join(dir,'share-start.lock');
function acquireStartLock(token){
 for(let n=0;n<3;n++)try{const fd=fs.openSync(startLock,'wx',0o600);try{fs.writeSync(fd,JSON.stringify({pid:process.pid,token}));}finally{fs.closeSync(fd);}return;}catch(error){
  if(error.code!=='EEXIST')throw error;let owner;try{owner=JSON.parse(fs.readFileSync(startLock,'utf8'));}catch{throw Error('Review startup lock needs inspection before retrying.');}
  let alive=false;try{alive=execFileSync('ps',['-p',String(owner.pid),'-o','command='],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).includes(entry+' start');}catch{}
  if(alive)throw Error('Client review startup is already in progress. Use status.');fs.rmSync(startLock,{force:true});
 }throw Error('Could not acquire client review startup lock.');
}
function releaseStartLock(token){try{if(JSON.parse(fs.readFileSync(startLock,'utf8')).token===token)fs.rmSync(startLock);}catch{}}
function readState(){try{return JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{return null;}}
function owned(state){if(!state?.pid||!state?.token)return false;try{return execFileSync('ps',['-p',String(state.pid),'-o','command='],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).includes(entry+' run '+state.token);}catch{return false;}}
function ownedChild(child){if(!child?.pid||!child?.marker)return false;try{return execFileSync('ps',['-p',String(child.pid),'-o','command='],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).includes(child.marker);}catch{return false;}}
async function cleanupOrphans(state){const children=(state?.children||[]).filter(ownedChild);for(const child of children)try{process.kill(child.pid,'SIGTERM');}catch{}if(children.length)await sleep(350);for(const child of children)if(ownedChild(child))try{process.kill(child.pid,'SIGKILL');}catch{}}
function writeState(state){const temp=stateFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(state,null,2),{mode:0o600});fs.renameSync(temp,stateFile);}
function printState(state){if(!owned(state))return console.log('Client review is offline. Saved review data remains.');if(state.status!=='ready')return console.log('Client review is '+state.status+'.');console.log('Customer: '+state.customerURL+'\nStudio: '+state.studioURL+'\nUsername: client\nPassword: stored privately in '+path.join(dir,'access.txt')+'\nTemporary client preview · demonstration records · Mac must remain online.');}
async function freePort(port){await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(Error('Review port '+port+' is already in use.')));s.listen(port,'127.0.0.1',()=>s.close(resolve));});}
async function waitHealth(){for(let n=0;n<100;n++){try{const responses=await Promise.all([ports.customer,ports.admin,ports.api].map(port=>fetch('http://127.0.0.1:'+port+'/api/health',{signal:AbortSignal.timeout(600)})));if(responses.every(r=>r.ok))return;}catch{}await sleep(150);}throw Error('Isolated review backend did not become ready.');}

async function run(token){
 process.umask(0o077);fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.chmodSync(dir,0o700);let state={pid:process.pid,token,status:'starting',startedAt:new Date().toISOString(),ports},db,stopping=false;const children=[],proxies=[];
 writeState(state);
 const stop=async(code=0)=>{if(stopping)return;stopping=true;for(const child of children)try{child.kill('SIGTERM');}catch{}for(const proxy of proxies){proxy.closeAllConnections();proxy.close();}await sleep(350);for(const child of children)if(child.exitCode===null)try{child.kill('SIGKILL');}catch{}try{db?.db.close();}catch{}writeState({...state,status:'stopped',stoppedAt:new Date().toISOString()});process.exit(code);};
 process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
 function child(binary,args,env=process.env,marker){const p=spawn(binary,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});children.push(p);state={...state,children:[...(state.children||[]),{pid:p.pid,marker}]};writeState(state);p.on('error',()=>{console.error('A required review process failed to start.');void stop(1);});p.on('exit',()=>{if(!stopping){console.error('A required review process stopped. Closing client access.');void stop(1);}});return p;}
 try{
  for(const port of Object.values(ports))await freePort(port);fs.accessSync(cloudflared,fs.constants.X_OK);
  const existing=fs.existsSync(path.join(dir,'journal.sqlite'));db=new Journal(dir);
  if(existing&&db.get('meta','client-review')?.synthetic!==true)throw Error('Existing review database has unknown provenance; refusing to share it.');
  if(db.all('orders').some(order=>order.demo!==true))throw Error('Review data contains records without a demonstration marker; refusing to share it.');
  db.put('meta','client-review',{synthetic:true,createdAt:db.get('meta','client-review')?.createdAt||new Date().toISOString()});
  const auth=new StaffAuth({db});
  if(!auth.getConfig().passwordProtected){const password=crypto.randomBytes(24).toString('base64url');await auth.setPassword(password);fs.writeFileSync(path.join(dir,'access.txt'),'Username: client\nPassword: '+password+'\nInitial password. If changed in Studio Settings, use the new password.\n',{mode:0o600,flag:'w'});fs.chmodSync(path.join(dir,'access.txt'),0o600);}
  const env={...process.env,CUSTOMER_PORT:String(ports.customer),ADMIN_PORT:String(ports.admin),API_PORT:String(ports.api),LHF_DATA_DIR:dir};delete env.LHF_IMAGE_PROVIDER_ENDPOINT;delete env.LHF_IMAGE_PROVIDER_TOKEN;
  const backendMarker=path.join(root,'server/main.mjs')+' --client-review '+token;const backend=child(process.execPath,[path.join(root,'server/main.mjs'),'--client-review',token],env,backendMarker);backend.stdout.on('data',()=>{});backend.stderr.on('data',()=>{});await waitHealth();
  let context={};for(const kind of ['customer','admin']){const proxy=createShareProxy({kind,internalPort:ports[kind],auth,getContext:()=>context});proxies.push(proxy);await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(ports[kind+'Proxy'],'127.0.0.1',resolve);});}
  const tunnelConfig=path.join(dir,'tunnel-config.yml');fs.writeFileSync(tunnelConfig,'{}\n',{mode:0o600});const tunnelEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('TUNNEL_')));
  const discover=kind=>new Promise((resolve,reject)=>{const marker=path.join(dir,'tunnel-'+kind+'-'+token+'.pid'),p=child(cloudflared,['tunnel','--config',tunnelConfig,'--no-autoupdate','--pidfile',marker,'--url','http://127.0.0.1:'+ports[kind+'Proxy'],'--loglevel','info'],tunnelEnv,marker);let tail='',done=false;const timer=setTimeout(()=>{if(!done){done=true;reject(Error('Temporary tunnel startup timed out.'));}},45000);const inspect=chunk=>{tail=(tail+chunk.toString()).slice(-16384);const found=tail.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)?.find(value=>shareURL(value));if(found&&!done){done=true;clearTimeout(timer);resolve(shareURL(found));}};p.stdout.on('data',inspect);p.stderr.on('data',inspect);p.once('exit',()=>{clearTimeout(timer);if(!done){done=true;reject(Error('Temporary tunnel stopped before becoming ready.'));}});});
  const [customerURL,studioURL]=await Promise.all([discover('customer'),discover('admin')]);if(customerURL===studioURL)throw Error('Separate review origins are required.');context={customerURL,studioURL};state={...state,status:'ready',customerURL,studioURL};writeState(state);console.log('Protected client review is ready.');
 }catch(error){console.error(error.message);await stop(1);}
}

const command=process.argv[2],prior=readState();
if(command==='run'){if(!/^[a-f0-9]{32}$/.test(process.argv[3]||''))throw Error('Invalid supervisor identity');await run(process.argv[3]);}
else if(command==='status')printState(prior);
else if(command==='stop'){if(owned(prior)){process.kill(prior.pid,'SIGTERM');for(let n=0;n<30&&owned(prior);n++)await sleep(100);if(owned(prior))throw Error('Review is still stopping; inspect the private log before retrying.');console.log('Client review stopped. Saved review records and password remain.');}else{await cleanupOrphans(prior);console.log('No matching client review supervisor; any matching orphaned review processes were stopped.');}}
else if(command==='start'){
 if(owned(prior)){printState(prior);}else{
  process.umask(0o077);fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.chmodSync(dir,0o700);const token=crypto.randomBytes(16).toString('hex');acquireStartLock(token);
  try{await cleanupOrphans(prior);const out=fs.openSync(logFile,'a',0o600);fs.chmodSync(logFile,0o600);const p=spawn(process.execPath,[entry,'run',token],{cwd:root,detached:true,stdio:['ignore',out,out],env:process.env});p.unref();fs.closeSync(out);let ready=false;
   for(let n=0;n<280;n++){const current=readState();if(current?.token===token&&current.status==='ready'){printState(current);ready=true;break;}if(current?.token===token&&current.status==='stopped')throw Error('Client review could not start. Inspect data/client-review/share.log.');await sleep(200);}if(!ready)throw Error('Client review is still starting; use status or inspect the private log.');
  }finally{releaseStartLock(token);}
 }
}else throw Error('Use start, stop or status.');
