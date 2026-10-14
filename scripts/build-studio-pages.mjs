/* Exports the Studio (the staff app) to docs/, which GitHub Pages publishes for this repo at
   https://mpc0367.github.io/little-house-flower-studio/
   The Studio's photographs are not copied: they stay on the website's address
   (/Little-House-Flower/img/ and /media/), which is the same origin.
     node scripts/build-studio-pages.mjs [source]   (default: hosted-backend/public) */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(process.argv[2]||path.join(here,'hosted-backend/public'));
const out=path.join(here,'docs');
const base='/little-house-flower-studio';
const website='/Little-House-Flower';
const release='studio-20261014-1';
const textTypes=new Set(['.html','.css','.js','.mjs','.json','.webmanifest','.txt']);

function rewrite(text,rel){
  // the API and the Studio's own files live here; photographs live on the website
  text=text.replace(/(["'`(=\s])\/(api|shared)\//g,`$1${base}/$2/`);
  text=text.replace(/(["'`(=\s])\/studio\//g,`$1${base}/`);
  text=text.replace(/(["'`(=\s])\/(img|media)\//g,`$1${website}/$2/`);
  text=text.replace(/(["'`(])img\//g,`$1${website}/img/`);
  text=text.replaceAll('../shared/','./shared/');
  // the narrow allowlists keep their exact meaning under the new prefixes
  text=text.replaceAll('^\\/img\\/','^\\/Little-House-Flower\\/img\\/').replaceAll('^\\/api\\/','^\\/little-house-flower-studio\\/api\\/');
  if(rel==='app-shell.mjs')text=text.replace("&& !window.LHF_NATIVE_APP)","&& !window.LHF_NATIVE_APP && !window.LHF_PAGES_APP)");
  if(rel==='index.html'){
    text=text.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g,'');
    text=text.replace('</head>',`<script defer src="${base}/pages-access.js?v=${release}"></script></head>`);
    text=text.replace(/(href="\/little-house-flower-studio\/[^"?]+\.css)"/g,`$1?v=${release}"`);
  }
  if(['.js','.mjs'].includes(path.extname(rel)))text=text.replace(/(from\s+['"]|import\(['"])([^'"?]+\.m?js)(['"])/g,`$1$2?v=${release}$3`);
  return text;
}
async function exportDirectory(from,to,relBase=''){
  await fs.mkdir(to,{recursive:true});
  for(const entry of await fs.readdir(from,{withFileTypes:true})){
    const src=path.join(from,entry.name),dst=path.join(to,entry.name),rel=path.join(relBase,entry.name);
    if(entry.isDirectory()){await exportDirectory(src,dst,rel);continue;}
    if(!textTypes.has(path.extname(entry.name))){await fs.copyFile(src,dst);continue;}
    await fs.writeFile(dst,rewrite(await fs.readFile(src,'utf8'),rel));
  }
}

await fs.rm(out,{recursive:true,force:true});
await exportDirectory(path.join(source,'studio'),out);
await exportDirectory(path.join(source,'shared'),path.join(out,'shared'),'shared');
for(const name of ['pages-access.js','pages-sw.js']){
  const text=(await fs.readFile(path.join(here,'scripts','pages',name),'utf8')).replaceAll('__BASE__',base).replaceAll('__WEBSITE__',website).replaceAll('__RELEASE__',release);
  await fs.writeFile(path.join(out,name),text);
}
await fs.writeFile(path.join(out,'.nojekyll'),'');
await fs.writeFile(path.join(out,'404.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Little House Flower · The Studio</title><body style="font:16px/1.6 system-ui,sans-serif;padding:24px"><p>This page does not exist. <a href="${base}/">Open the Studio</a> · <a href="${website}/">Open the website</a></p></body></html>\n`);
await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
console.log('Exported the Studio to docs/ for '+base+'/');
