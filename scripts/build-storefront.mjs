/* Writes hosted-backend/public/storefront.js from the storefront's ordered source files
   (the list is scripts/storefront-sources.json, the same order as local-preview's build).
   Edit the sources, never storefront.js, then run this before build-github-pages.mjs.
     node scripts/build-storefront.mjs [public folder]   (default: hosted-backend/public) */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function buildStorefront(root=path.join(here,'hosted-backend/public')){
  const sources=JSON.parse(fs.readFileSync(path.join(here,'scripts/storefront-sources.json'),'utf8'));
  const shared=fs.readFileSync(path.join(root,'shared/config.mjs'),'utf8');
  const sharedNames=[...shared.matchAll(/export\s+(?:const|function)\s+(\w+)/g)].map(m=>m[1]);
  const configBlock='\n/* Shared configuration, generated from shared/config.mjs. */\n(function(){\n'+shared.replace(/\bexport\s+/g,'')+'\nLHF.designConfig={'+sharedNames.join(',')+'};\n})();\n';
  const code='/* Generated storefront. Edit the ordered source files, then npm run build. */\n'+sources.map(src=>(src==='/local-bridge.js'?configBlock:'')+'\n/* Source: '+src+' */\n'+fs.readFileSync(path.join(root,src.slice(1)),'utf8')+'\n;\n').join('');
  const out=path.join(root,'storefront.js'),temp=out+'.'+process.pid+'.tmp';
  fs.writeFileSync(temp,code);fs.renameSync(temp,out);
  return {sources:sources.length,bytes:Buffer.byteLength(code)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(buildStorefront(process.argv[2]?path.resolve(process.argv[2]):undefined));
