import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/* Exports the storefront into the WEBSITE repo (MPC0367/Little-House-Flower). The Studio is no longer part of it:
   it is published from this repo's docs/ by build-studio-pages.mjs.
     node scripts/build-github-pages.mjs [source] [website repo folder]   (default: ../site beside this repo) */
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(process.argv[2]||path.join(here,'hosted-backend/public'));
const root=path.resolve(process.argv[3]||path.join(here,'..','site'));
const studioURL='/little-house-flower-studio/';
const base='/Little-House-Flower';
const release='intro-natural-20261014-2';
const textTypes=new Set(['.html','.css','.js','.mjs','.json','.webmanifest','.txt']);
const filenames=['site.css','upgrade.css','polish.css','customizer.css','customizer.mjs','logo-intro.css','hosted-context.js','storefront.js'];

async function exportDirectory(directory,relative=''){
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    const rel=path.join(relative,entry.name),from=path.join(directory,entry.name),to=path.join(root,rel);
    // Preserve the shop's legacy configuration; the demo only uses its own API.
    if(rel==='sheet.json')continue;
    // the Studio has its own repo and address now
    if(rel==='studio')continue;
    if(entry.isDirectory()){await fs.mkdir(to,{recursive:true});await exportDirectory(from,rel);continue;}
    if(!textTypes.has(path.extname(entry.name))){await fs.copyFile(from,to);continue;}
    let text=await fs.readFile(from,'utf8');
    // Only asset/API literals change; hash-router route names remain unchanged.
    text=text.replace(/(["'`(=\s])\/(api|img|media|shared|studio)\//g,`$1${base}/$2/`);
    text=text.replace(/(["'`(])img\//g,`$1${base}/img/`);
    for(const name of filenames)text=text.replaceAll('/'+name,base+'/'+name);
    // Preserve the narrow image allowlists with the GitHub project prefix.
    text=text.replaceAll('^\\/img\\/','^\\/Little-House-Flower\\/img\\/').replaceAll('^\\/api\\/','^\\/Little-House-Flower\\/api\\/');
    if(rel==='studio/app-shell.mjs')text=text.replace("&& !window.LHF_NATIVE_APP)","&& !window.LHF_NATIVE_APP && !window.LHF_PAGES_APP)");
    if(rel==='hosted-context.js')text=`window.LHF_SHARE_CONTEXT=Object.freeze({mode:'github-pages',customerURL:'${base}/',studioURL:'${studioURL}'});\n`;
    if(rel==='index.html'){
      text=text.replace('</head>',`<script defer src="${base}/pages-access.js?v=${release}"></script></head>`);
      text=text.replace(/<script[^>]+src="[^\"]*(?:hosted-context|storefront)\.js"[^>]*><\/script>/g,'');
    }
    if(rel==='studio/index.html'){
      text=text.replace(/<script[^>]+src="[^\"]+"[^>]*><\/script>/g,'');
      text=text.replace('</head>',`<script defer src="${base}/pages-access.js?v=${release}"></script></head>`);
    }
    if(path.extname(rel)==='.html')text=text.replace(/(href="\/Little-House-Flower\/[^"?]+\.css)"/g,`$1?v=${release}"`);
    if(['.js','.mjs'].includes(path.extname(rel)))text=text.replace(/(from\s+['"]|import\(['"])([^'"?]+\.m?js)(['"])/g,`$1$2?v=${release}$3`);
    await fs.writeFile(to,text);
  }
}
await exportDirectory(source);
await fs.writeFile(path.join(root,'.nojekyll'),'');
await fs.writeFile(path.join(root,'404.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Little House Flower</title><body><p>This page has moved. <a href="${base}/">Open Little House Flower</a></p></body></html>\n`);
// people still have the old Studio link: send them to its new address
await fs.mkdir(path.join(root,'studio'),{recursive:true});
await fs.writeFile(path.join(root,'studio','index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>The Studio has moved</title><meta http-equiv="refresh" content="0; url=${studioURL}"><script>location.replace(${JSON.stringify(studioURL)}+location.hash)</script><body style="font:16px/1.6 system-ui,sans-serif;padding:24px"><p>The Studio has moved to <a href="${studioURL}">${studioURL}</a>.</p></body></html>\n`);
console.log('Exported the storefront to '+root+' for '+base+'/');
