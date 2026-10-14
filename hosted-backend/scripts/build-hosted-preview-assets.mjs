import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import sharp from 'sharp';
import {recolourPetals,paletteTint} from '../server/local-composition.mjs';
import {flowerEvidence,palettes,styles,containers,finishFor} from '../shared/config.mjs';
import {colours,presentation,compositionPlan} from '../server/hosted-preview-geometry.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),out=path.join(root,'public/img/hosted-sprites');fs.mkdirSync(out,{recursive:true});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function hull(points){const p=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const lower=[],upper=[];for(const v of p){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),v)<=0)lower.pop();lower.push(v);}for(const v of p.toReversed()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),v)<=0)upper.pop();upper.push(v);}return [...lower.slice(0,-1),...upper.slice(0,-1)];}
async function geometry(bytes){const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true}),points=[];for(let y=0;y<info.height;y++){let left=info.width,right=-1;for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>1){left=Math.min(left,x);right=x;}if(right>=left)points.push([left,y],[right+1,y],[left,y+1],[right+1,y+1]);}const alphaHull=hull(points);return {width:info.width,height:info.height,alphaHull,bounds:alphaHull.length?[Math.min(...alphaHull.map(v=>v[0])),Math.min(...alphaHull.map(v=>v[1])),Math.max(...alphaHull.map(v=>v[0])),Math.max(...alphaHull.map(v=>v[1]))]:null};}
const manifest={version:'hosted-botanical-composition-v1',flowers:{},presentation:{},art:{}};
for(const id of Object.keys(flowerEvidence)){
 const source=fs.readFileSync(path.join(root,'public/img/live-flowers',id+'.webp')),raw=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});const variants={};
 for(const [palette]of palettes){const tag=paletteTint(id,palette)?palette:'original';if(variants[tag])continue;const bytes=tag==='original'?source:await sharp(recolourPetals(raw.data,id,palette),{raw:{width:raw.info.width,height:raw.info.height,channels:4}}).webp({quality:96,alphaQuality:100}).toBuffer();const file=id+'-'+tag+'.webp';fs.writeFileSync(path.join(out,file),bytes);variants[tag]={url:'/img/hosted-sprites/'+file,...await geometry(bytes),hash:hash(bytes)};}
 manifest.flowers[id]={palettes:Object.fromEntries(palettes.map(([palette])=>[palette,paletteTint(id,palette)?palette:'original'])),variants};
}
for(const id of ['hatbox','wicker','vase','bow']){
 const source=path.join(root,'public/img/live-presentation',id+'.webp');manifest.presentation[id]={};
 for(const [colour,hex]of Object.entries(colours)){if(id==='wicker'&&colour!=='natural')continue;let pipeline=sharp(source).ensureAlpha();if(id!=='wicker')pipeline=pipeline.linear([...hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255),1],[0,0,0,0]);const bytes=await pipeline.webp({quality:96,alphaQuality:100}).toBuffer(),file=id+'-'+colour+'.webp';fs.writeFileSync(path.join(out,file),bytes);manifest.presentation[id][colour]={url:'/img/hosted-sprites/'+file,...await geometry(bytes),hash:hash(bytes)};}
}
for(const [style]of styles)for(const container of containers[style]){
 const config={style,container,finish:finishFor(container)[0],palette:'florist',flowers:[],ribbon:'cream',size:'reference'},plan=compositionPlan(config),art=presentation(config,{...plan,items:[]},{body:!!manifest.presentation[container],bow:true});
 manifest.art[style+':'+container]={back:(await geometry(Buffer.from(art.back))).bounds,front:(await geometry(Buffer.from(art.front))).bounds};
}
manifest.identity=hash(JSON.stringify(manifest));fs.writeFileSync(path.join(root,'server/hosted-preview-manifest.json'),JSON.stringify(manifest));console.log('Prepared hosted floral assets:',Object.keys(manifest.flowers).length,'species,',Object.keys(manifest.presentation).length,'presentation assets.');
