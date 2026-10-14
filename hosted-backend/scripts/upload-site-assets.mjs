import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import manifest from '../server/hosted-site-assets.json' with {type:'json'};
const base=(process.argv[2]||'http://127.0.0.1:5580').replace(/\/$/,'');
const password=process.env.LHF_UPLOAD_PASSWORD||fs.readFileSync('.dev.vars','utf8').match(/^DEMO_PASSWORD=(.+)$/m)[1];
const headers={Authorization:'Basic '+Buffer.from('client:'+password).toString('base64'),Origin:base,'X-CSRF':'local-preview',...(process.env.LHF_SITE_BYPASS?{'OAI-Sites-Authorization':'Bearer '+process.env.LHF_SITE_BYPASS}:{})};
const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({password})});
if(!login.ok)throw Error('Staff sign-in failed ('+login.status+'): '+(await login.text()).slice(0,200));
const cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');if(!cookie)throw Error('Staff cookie missing');
const unique=new Map();for(const [url,meta]of Object.entries(manifest))if(!unique.has(meta.hash))unique.set(meta.hash,{url,...meta});
const queue=[...unique.values()];let done=0;
async function worker(){for(;;){const asset=queue.shift();if(!asset)return;const bytes=fs.readFileSync(path.join('public',asset.url));if(bytes.length!==asset.size||createHash('sha256').update(bytes).digest('hex')!==asset.hash)throw Error('Regenerate manifest before publishing '+asset.url);let successful=false;
for(let attempt=0;attempt<3;attempt++){const response=await fetch(base+'/api/admin/site-assets/'+asset.hash,{method:'POST',headers:{...headers,Cookie:cookie,'Content-Type':'application/octet-stream'},body:bytes});if(response.ok){successful=true;await response.arrayBuffer();break;}const details=(await response.text()).slice(0,200);if(response.status<500&&response.status!==429)throw Error('Asset upload failed '+asset.url+' ('+response.status+'): '+details);if(attempt===2)throw Error('Asset upload unavailable '+asset.url+' ('+response.status+')');await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));}
if(successful){done++;if(done%25===0||done===unique.size)console.log('Uploaded '+done+'/'+unique.size+' approved private files');}}}
try{await Promise.all(Array.from({length:4},worker));console.log(JSON.stringify({ok:true,base,files:done,storage:'private R2'}));}finally{await fetch(base+'/api/admin/logout',{method:'POST',headers:{...headers,Cookie:cookie,'Content-Type':'application/json'},body:'{}'}).catch(()=>{});}
