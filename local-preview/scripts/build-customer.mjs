import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function buildCustomer(root){
 const sources=JSON.parse(fs.readFileSync(path.join(root,'scripts/customer-sources.json'),'utf8'));
 const shared=fs.readFileSync(path.join(root,'shared/config.mjs'),'utf8');
 const sharedNames=[...shared.matchAll(/export\s+(?:const|function)\s+(\w+)/g)].map(m=>m[1]);
 const configBlock='\n/* Shared configuration, generated from shared/config.mjs. */\n(function(){\n'+shared.replace(/\bexport\s+/g,'')+'\nLHF.designConfig={'+sharedNames.join(',')+'};\n})();\n';
 const code='/* Generated storefront. Edit the ordered source files, then npm run build. */\n'+sources.map(src=>(src==='/local-bridge.js'?configBlock:'')+'\n/* Source: '+src+' */\n'+fs.readFileSync(path.join(root,'customer',src.slice(1)),'utf8')+'\n;\n').join('');
 const out=path.join(root,'customer/storefront.js'),temp=out+'.'+process.pid+'.tmp';fs.writeFileSync(temp,code);fs.renameSync(temp,out);
 return {sources:sources.length,bytes:Buffer.byteLength(code)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(buildCustomer(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')));
