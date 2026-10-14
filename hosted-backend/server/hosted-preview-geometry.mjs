/* Pure composition geometry, ported unchanged from local-composition-v4. */
const W=1200;
export const colours={white:'#f5f1e8',cream:'#dfcfb1',pink:'#dba9b9',black:'#302b31',blue:'#9bbac9',natural:'#b59267',burgundy:'#813b51',florist:'#d9c9ab'};
const paletteColours={florist:'#dac4b8','white-green':'#bdc8b2','pink-white':'#d6a6bc',red:'#b96f79','yellow-white':'#e0c685','blue-white':'#a6c2cf'};
const flowerScale={eucalyptus:1.08,babys_breath:1.15,wax_flower:1.1,forget_me_not:.82,jasmine:.75,hydrangea:1.15,stock:1.25,sunflower:1.05,chamomile:.8,pompon:.84};
const defaultFlowers={florist:['rose_pink','lisianthus','eucalyptus'],'white-green':['rose_white','lisianthus','eucalyptus'],'pink-white':['rose_pink','rose_white','eucalyptus'],red:['rose_red','eucalyptus'],'yellow-white':['sunflower','chamomile','eucalyptus'],'blue-white':['hydrangea','rose_white','eucalyptus']};
const seasonalPalettes={lily:['pink-white','white-green'],lisianthus:['pink-white','white-green'],carnation:['pink-white','white-green','red','yellow-white'],stock:['pink-white','white-green'],gerbera:['pink-white','white-green','red','yellow-white'],pompon:['pink-white','white-green','yellow-white'],soap_rose:['pink-white','white-green'],wax_flower:['pink-white','white-green'],forget_me_not:['pink-white','white-green','blue-white'],hydrangea:['pink-white','white-green','blue-white']};
const petalColours={'pink-white':[242,157,184],'white-green':[250,249,244],red:[180,49,72],'yellow-white':[245,213,119],'blue-white':[157,192,226]};
export function paletteTint(id,palette){return seasonalPalettes[id]?.includes(palette)?petalColours[palette]:null;}
const svg=body=>(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${body}</svg>`);
const shade=(hex,amount)=>'#'+hex.slice(1).match(/../g).map(s=>{const v=parseInt(s,16);return Math.round(amount>=0?v+(255-v)*amount:v*(1+amount)).toString(16).padStart(2,'0');}).join('');
const defs=(finish,ribbon)=>`<defs><linearGradient id="surface" x1="0" x2="1"><stop stop-color="${shade(finish,-.19)}"/><stop offset=".28" stop-color="${finish}"/><stop offset=".66" stop-color="${shade(finish,.17)}"/><stop offset="1" stop-color="${shade(finish,-.12)}"/></linearGradient><linearGradient id="crease" x1="0" x2="1"><stop stop-color="#ffffff" stop-opacity=".24"/><stop offset=".48" stop-color="#ffffff" stop-opacity=".04"/><stop offset="1" stop-color="#241d28" stop-opacity=".19"/></linearGradient><linearGradient id="ribbon" x1="0" x2="1"><stop stop-color="${shade(ribbon,-.16)}"/><stop offset=".44" stop-color="${ribbon}"/><stop offset=".72" stop-color="${shade(ribbon,.23)}"/><stop offset="1" stop-color="${shade(ribbon,-.12)}"/></linearGradient><filter id="bowShadow" x="-.3" y="-.3" width="1.6" height="1.6"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#352b2b" flood-opacity=".15"/></filter></defs>`;
function bow(x,y,scale=1){return `<g transform="translate(${x} ${y}) scale(${scale})" filter="url(#bowShadow)"><path d="M-5 0C-45-76-130-60-108-4C-98 21-43 26-5 0M5 0C45-76 130-60 108-4C98 21 43 26 5 0" fill="url(#ribbon)"/><path d="M-9 7L-69 144-31 126-18 156 17 12M9 7L69 144 31 126 18 156-17 12" fill="url(#ribbon)"/><path d="M-16-15Q0-28 16-15L18 12Q0 24-18 12Z" fill="url(#ribbon)"/><path d="M-15-10L-13 11M13-11L15 9" stroke="#fff" opacity=".28" stroke-width="3"/></g>`;}
export function background(palette){return svg(`<defs><radialGradient id="bg"><stop stop-color="#fffdf7"/><stop offset="1" stop-color="#ebe5dc"/></radialGradient><radialGradient id="wash"><stop stop-color="${paletteColours[palette]||paletteColours.florist}" stop-opacity=".25"/><stop offset="1" stop-color="${paletteColours[palette]||paletteColours.florist}" stop-opacity="0"/></radialGradient><radialGradient id="shadow"><stop stop-color="#594b47" stop-opacity=".17"/><stop offset="1" stop-color="#594b47" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="1200" fill="url(#bg)"/><ellipse cx="830" cy="410" rx="520" ry="540" fill="url(#wash)"/><ellipse cx="600" cy="1070" rx="430" ry="64" fill="url(#shadow)"/>`);}
const jitter=(n,salt=0)=>(Math.sin(n*91.917+salt*23.417)*43758.5453)%1;

// Positions are deterministic, deliberately irregular, and use only the chosen
// species. The empty selection is explicitly a representative florist mix.
export function compositionPlan(config){
 const flowers=config.flowers.length?[...config.flowers]:config.style==='garland'?['jasmine']:[...(defaultFlowers[config.palette]||defaultFlowers.florist)];
 const foliage=flowers.filter(f=>f==='eucalyptus'),blooms=flowers.filter(f=>f!=='eucalyptus'),items=[];
 const head=(id,cx,cy,width,rotation,index)=>items.push({id,cx,cy,width:Math.round(width*(flowerScale[id]||1)),rotation,index,layer:id==='eucalyptus'?0:1});
 const size=config.size==='smaller'?.81:config.size==='larger'?1.11:1;
 if(config.style==='wreath'){
  const species=blooms.length?blooms:foliage;
  for(let n=0;n<32;n++){const a=n/32*Math.PI*2;head(species[n%species.length],600+Math.cos(a)*(310+jitter(n)*19),540+Math.sin(a)*(372+jitter(n,1)*13),170+jitter(n,2)*25,n*17%45-22,n);}
  for(let n=0;n<(foliage.length&&blooms.length?15:0);n++){const a=n/15*Math.PI*2;head('eucalyptus',600+Math.cos(a)*325,540+Math.sin(a)*386,155,a*180/Math.PI+95,n);}
 }else if(config.style==='garland'){
  const species=blooms.length?blooms:foliage;
  for(let n=0;n<52;n++){const a=n/52*Math.PI*2;head(species[n%species.length],600+Math.cos(a)*198,445+Math.sin(a)*245,92+jitter(n)*8,a*180/Math.PI+90,n);}
  for(let side of [-1,1])for(let n=0;n<11;n++)head(species[n%species.length],600+side*(75+n*2),672+n*27,93+jitter(n,side)*8,side*8+jitter(n)*12,n);
  for(let n=0;n<(foliage.length&&blooms.length?12:0);n++){const a=n/12*Math.PI*2;head('eucalyptus',600+Math.cos(a)*213,445+Math.sin(a)*260,115,a*180/Math.PI+95,n);}
 }else{
  const centerY=config.container==='vase'?385:config.style==='wedding'?405:config.style==='box'?432:config.style==='basket'?440:415;
  const rx=config.style==='box'||config.style==='basket'?292:config.style==='wedding'?272:280,ry=config.container==='vase'?197:config.style==='box'?167:config.style==='basket'?174:203;
  for(let n=0;n<(foliage.length?10:0);n++){const a=n/10*Math.PI*2;head('eucalyptus',600+Math.cos(a)*(rx*.82),centerY+Math.sin(a)*ry*.88,185,a*180/Math.PI+85,n);}
  const species=blooms.length?blooms:foliage;
  const total=blooms.length?species.every(f=>['babys_breath','wax_flower','forget_me_not'].includes(f))?16:19:13;
  for(let n=0;n<total;n++){
   const radius=Math.sqrt((n+.5)/total),a=n*2.399963229728653;
   const id=species[n%species.length],width=(id==='lily'||id==='hydrangea'?203:184)+(1-radius)*38+jitter(n,2)*16;
   head(id,600+Math.cos(a)*rx*radius+jitter(n)*15,centerY+Math.sin(a)*ry*radius+jitter(n,1)*14,width,jitter(n,3)*28,n);
  }
 }
 items.sort((a,b)=>a.layer-b.layer||a.cy-b.cy||a.index-b.index);
 return {flowers,representative:!config.flowers.length,size,items};
}
export function presentation(config,plan,options={}){
 const drawBow=(...args)=>options.bow?'':bow(...args);
 const finish=colours[config.finish]||colours.cream,ribbon=colours[config.ribbon]||colours.cream,definition=defs(finish,ribbon);
 let back='',front='',stems='';
 if(!['wreath','garland'].includes(config.style)){
  stems=plan.items.filter(i=>i.layer!==0).map((i,n)=>`<path d="M${i.cx.toFixed(1)} ${(i.cy+70).toFixed(1)}Q${(i.cx*.35+600*.65).toFixed(1)} 655 ${585+n%7*5} ${config.style==='wedding'?930:855}" fill="none" stroke="${n%2?'#637349':'#7b885b'}" stroke-width="${n%3+5}"/>`).join('');
 }
 if(['paper','foam'].includes(config.container)){
  back=`<path d="M220 348L430 276 632 590 780 278 1008 393 798 806 660 1029 475 958Z" fill="${finish}"/><path d="M220 348L430 276 632 590 780 278 1008 393 798 806 660 1029 475 958Z" fill="url(#crease)"/>`;
  if(config.style==='money')back+=Array.from({length:7},(_,i)=>`<g transform="translate(${420+i*60} ${175+Math.abs(3-i)*45}) rotate(${(i-3)*13})"><rect x="-70" y="-120" width="140" height="210" rx="3" fill="#b7c0ad"/><rect x="-60" y="-108" width="120" height="184" fill="none" stroke="#dfe5d8" stroke-width="3"/><path d="M-43 52L43-72M-43 64L43-60" stroke="#d5ddcc" stroke-width="3"/></g>`).join('');
  front=config.container==='foam'?`<path d="M290 610Q437 623 600 727 737 630 924 588L762 921 649 1023 493 966Z" fill="${finish}"/><path d="M322 650L605 812 868 653 760 942 646 1025 498 966Z" fill="url(#crease)"/><path d="M388 728L604 847 798 727" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="7"/>`:`<path d="M271 569L602 759 923 560 798 848 666 1018 491 947Z" fill="url(#surface)"/><path d="M271 569L602 759 491 947Z" fill="url(#crease)"/><path d="M602 759L923 560 666 1018 594 865Z" fill="url(#crease)"/><path d="M600 759L641 950M491 947L595 871" fill="none" stroke="#574e48" stroke-opacity=".14" stroke-width="3"/>`;
  front+=bow(610,846,.81);
 }else if(config.container==='hatbox'){
  back=`<ellipse cx="600" cy="625" rx="290" ry="84" fill="${finish}"/>`;
  front=`<path d="M310 624L321 870Q600 1005 879 870L890 624Q600 752 310 624" fill="url(#surface)"/><path d="M321 865Q600 1000 879 865" fill="none" stroke="#57494a" stroke-opacity=".18" stroke-width="9"/><path d="M596 690L596 942" stroke="url(#ribbon)" stroke-width="38"/><path d="M320 638Q600 758 880 638" fill="none" stroke="#fff" stroke-opacity=".36" stroke-width="8"/>${drawBow(602,777,.71)}`;
 }else if(config.container==='wicker'){
  back=`<path d="M324 691C255 144 945 144 876 691" fill="none" stroke="#977249" stroke-width="36"/><path d="M324 691C255 144 945 144 876 691" fill="none" stroke="#c9aa7e" stroke-width="17"/>`;
  front=`<defs><pattern id="weave" width="29" height="22" patternUnits="userSpaceOnUse"><rect width="29" height="22" fill="#ba9466"/><path d="M0 5H29M0 16H29" stroke="#e0c397" stroke-width="5"/><path d="M7 0V22M22 0V22" stroke="#947045" stroke-width="3" opacity=".64"/></pattern><clipPath id="basket"><path d="M296 637Q600 734 904 637L835 903Q600 994 365 903Z"/></clipPath></defs><path d="M296 637Q600 734 904 637L835 903Q600 994 365 903Z" fill="url(#weave)"/><path d="M296 637Q600 734 904 637" fill="none" stroke="#987143" stroke-width="25"/><path d="M303 632Q600 727 897 632" fill="none" stroke="#dec095" stroke-width="10"/><path d="M296 637Q600 734 904 637L835 903Q600 994 365 903Z" fill="url(#crease)"/>${drawBow(601,752,.72)}`;
 }else if(config.container==='vase'){
  back=`<ellipse cx="600" cy="624" rx="131" ry="30" fill="#5c6666" opacity=".15"/>`;
  front=`<path d="M461 615Q482 703 441 884C421 1027 779 1027 759 884Q718 703 739 615Z" fill="${finish}" fill-opacity=".64"/><path d="M461 615Q482 703 441 884C421 1027 779 1027 759 884Q718 703 739 615Z" fill="url(#crease)"/><ellipse cx="600" cy="615" rx="139" ry="29" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="8"/><path d="M489 681Q501 763 477 887Q472 933 507 947" fill="none" stroke="#fff" stroke-opacity=".52" stroke-width="13"/>${drawBow(600,724,.68)}`;
 }else if(config.container==='hand-tied'){
  front=`<path d="M552 660L647 660 652 789 547 789Z" fill="${finish}"/><path d="M552 660L647 660 652 789 547 789Z" fill="url(#crease)"/><path d="M550 692L649 692M549 752L650 752" stroke="url(#ribbon)" stroke-width="13"/>${drawBow(600,724,.85)}`;
 }else if(config.container==='wreath-frame'){
  back=`<path d="M570 845L393 1073M630 845L807 1073M600 830L600 1092" stroke="#8f7858" stroke-width="13"/><ellipse cx="600" cy="540" rx="309" ry="366" fill="none" stroke="${finish}" stroke-width="81"/>`;
  front=bow(600,917,.8);
 }else if(config.container==='garland-thread'){
  back=`<path d="M600 166C319 166 326 705 600 705S881 166 600 166M530 697L505 990M670 697L695 990" fill="none" stroke="${finish}" stroke-width="24"/>`;
  front=bow(600,175,.52);
 }
 if(options.body){front=options.bow?'':bow(...bowPosition(config));if(config.container!=='wicker')back='';}
 return {back:svg(definition+back+stems),front:svg(definition+front)};
}

export const bowPosition=config=>({paper:[610,846,.81],foam:[610,846,.81],hatbox:[602,777,.71],wicker:[601,752,.72],vase:[600,724,.68],'hand-tied':[600,724,.85],'wreath-frame':[600,917,.8],'garland-thread':[600,175,.52]}[config.container]||[600,800,.75]);
