import {t,getLanguage,locale} from './i18n.mjs';
import {styles,materials,finishes,palettes,ribbonLabels,sizeLabels,statusLabels,colorSwatches} from '../shared/config.mjs';
const groups=new Set();
window.addEventListener('lhf:languagechange',()=>{for(const ref of groups){const root=ref.deref();if(!root){groups.delete(ref);continue;}if(root.isConnected)root.refreshLanguage();}});
const node=(tag,attrs={},...children)=>{const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs))if(v!=null)el.setAttribute(k,v);for(const child of children.flat(Infinity))if(child!=null)el.append(child instanceof Node?child:document.createTextNode(String(child)));return el;};
const title=s=>String(s||'').replaceAll('_',' ').replaceAll('-',' ').replace(/\b[a-z]/g,c=>c.toUpperCase());
const flowerName=id=>t(({rose_white:'White Rose',rose_red:'Red Rose',rose_pink:'Pink Rose',babys_breath:"Baby's Breath"})[id]||title(id));
const languageValue=value=>typeof value==='object'&&value?value[getLanguage()]||value.en||value.th||'':value||'';
const baht=value=>value==null?t('Price confirmation needed'):new Intl.NumberFormat(locale(),{style:'currency',currency:'THB',currencyDisplay:'narrowSymbol',maximumFractionDigits:2}).format(value/100);
export const safeOrderImagePath=source=>{if(typeof source!=='string'||!source)return null;try{const url=new URL(source.startsWith('/')?source:'/'+source,location.origin);if(url.origin!==location.origin||url.search||url.hash||url.pathname.includes('..'))return null;return /^\/img\/[a-z0-9_./-]+$/i.test(url.pathname)||/^\/api\/assets\/[a-z0-9-]+$/i.test(url.pathname)||/^\/api\/preview-assets\/hosted-composition-[a-f0-9]{24}$/i.test(url.pathname)?url.pathname:null;}catch{return null;}};
function bindings(root){const callbacks=[];root.refreshLanguage=()=>callbacks.forEach(fn=>fn());groups.add(new WeakRef(root));return (el,fn,attr)=>{const update=()=>attr?el.setAttribute(attr,String(fn())):el.textContent=String(fn());callbacks.push(update);update();return el;};}
function imageViewer(source,description,trigger){
 const dialog=node('dialog',{class:'order-image-viewer','aria-label':t('Enlarged product image')}),bind=bindings(dialog);
 bind(dialog,()=>t('Enlarged product image'),'aria-label');
 const label=bind(node('h2'),()=>t('Enlarged product image'));
 const close=bind(node('button',{type:'button',class:'btn small'}),()=>t('Close image'));
 const smaller=bind(node('button',{type:'button',class:'btn small'}),()=>t('Zoom out'));
 const larger=bind(node('button',{type:'button',class:'btn small'}),()=>t('Zoom in'));
 const value=node('output',{'aria-live':'polite'},'100%');
 const photo=node('img',{src:source,alt:description,class:'order-image-full'}),stage=node('div',{class:'order-image-stage',tabindex:'0'},photo);
 const fallback=bind(node('p',{class:'image-fallback',hidden:''}),()=>t('Image unavailable · configuration and notes are preserved.'));
 let zoom=1;function resize(delta){zoom=Math.min(3,Math.max(1,zoom+delta));photo.style.width=zoom*100+'%';photo.style.maxHeight=zoom===1?'100%':'none';photo.style.height=zoom===1?'100%':'auto';value.value=Math.round(zoom*100)+'%';smaller.disabled=zoom===1;larger.disabled=zoom===3;}
 resize(0);smaller.addEventListener('click',()=>resize(-.5));larger.addEventListener('click',()=>resize(.5));
 const exit=()=>{dialog.close();dialog.remove();trigger?.focus();};close.addEventListener('click',exit);dialog.addEventListener('cancel',event=>{event.preventDefault();exit();});
 photo.addEventListener('error',()=>{photo.hidden=true;fallback.hidden=false;smaller.disabled=larger.disabled=true;});
 dialog.append(node('header',{class:'order-image-toolbar'},label,node('div',{class:'row'},smaller,value,larger,close)),stage,fallback);
 document.body.append(dialog);dialog.showModal();close.focus();
}
export function buildOrderDesign(order,{catalog=[],budgets=[]}={}){
 const root=node('div',{class:'order-design-overview'}),bind=bindings(root);
 const ui=(tag,key,attrs={})=>bind(node(tag,attrs),()=>t(key));
 const row=(dl,label,value)=>{const dt=ui('dt',label),dd=node('dd');if(typeof value==='function')bind(dd,value);else dd.textContent=value||t('Not specified — confirm with customer');dl.append(dt,dd);};
 const photo=(source,description)=>{
  const src=safeOrderImagePath(source),figure=node('figure',{class:'order-design-figure'}),fallback=ui('p','Image unavailable · configuration and notes are preserved.',{class:'image-fallback'});
  if(!src){figure.append(fallback);return figure;}
  const button=bind(node('button',{type:'button',class:'order-image-trigger'}),()=>t('Enlarge product image'),'aria-label');
  const image=node('img',{src,alt:description,class:'order-design-image',decoding:'async'});button.append(image);button.addEventListener('click',()=>imageViewer(src,description,button));
  const caption=ui('figcaption','Enlarge product image');fallback.hidden=true;
  image.addEventListener('error',()=>{image.hidden=true;button.hidden=true;caption.hidden=true;fallback.hidden=false;});
  figure.append(button,caption,fallback);return figure;
 };
 const glance=node('section',{class:'order-glance'},ui('h3','Order at a glance'));
 const dates=node('dl');row(dates,'Requested date',()=>order.date?new Intl.DateTimeFormat(locale(),{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(order.date+'T12:00:00Z')):t('Unscheduled'));row(dates,'Requested time',()=>order.windowLabel||t('Time to confirm'));row(dates,'Delivery / collection',()=>t(order.fulfil==='delivery'?'Delivery':'Pick-up'));row(dates,'Status',()=>t(statusLabels[order.status]||'Needs review'));glance.append(dates);root.append(glance);
 for(const item of order.items||[]){
  const saved=item.designSnapshot,reference=catalog.find(p=>p.id===item.productId),product=saved||reference,section=node('section',{class:'order-product-design'});
  section.append(bind(node('h3'),()=>saved?.name?languageValue(saved.name):getLanguage()==='th'?item.nameTh||item.name:item.name));
  section.append(photo(item.image||reference?.imageMeta?.src,item.name||t('Actual shop product')));
  section.append(ui('p','Actual shop product',{class:'image-role'}));
  const details=node('dl');row(details,'Quantity',String(item.qty));
  row(details,'Flowers',()=>product?.flowers?.length?product.flowers.map(flowerName).join(', '):t('Not specified — confirm with customer'));
  // The catalogue's black colour is explicitly a wrapping tag, not black flowers.
  row(details,'Flower colours',()=>product?.colors?.filter(c=>c!=='black').map(c=>colorSwatches[c]?.[getLanguage()==='th'?0:1]||t(title(c))).join(', ')||t('Not specified — confirm with customer'));
  row(details,'Wrapping / container',()=>languageValue(product?.wrap)||t('Not specified — confirm with customer'));
  if(product?.size)row(details,'Size',()=>[product.size.w,product.size.h].filter(Boolean).join(' × ')+' '+t('cm'));
  section.append(details,ui('p',saved?'Saved order design':'Catalogue reference',{class:'design-provenance'}));
  if(!saved)section.append(ui('p','These are catalogue details. Confirm any requested changes with the customer.',{class:'muted'}));root.append(section);
 }
 if(order.custom){
  const custom=order.custom,c=custom.config||{},section=node('section',{class:'order-custom-design'}),asset=custom.preview?.asset;
  section.append(ui('h3','Custom design snapshot'));
  if(asset?.url)section.append(photo(asset.url,asset.label||'Arrangement concept'));else section.append(ui('p','No preview available',{class:'image-fallback'}));
  section.append(bind(node('p',{class:'image-role'}),()=>t(!asset?'No final florist photo':asset.kind==='actual'?'Actual shop product':asset.kind==='composition'?'Live composition preview':'AI generated concept')));
  const dl=node('dl'),idx=()=>getLanguage()==='th'?1:2;
  row(dl,'Style',()=>styles.find(s=>s[0]===c.style)?.[idx()]||t(title(custom.style)));
  row(dl,'Flowers',()=>c.flowers?.length?c.flowers.map(flowerName).join(', '):t('Florist’s choice'));
  row(dl,'Flower colours',()=>palettes.find(p=>p[0]===c.palette)?.[idx()]||t('Not specified — confirm with customer'));
  row(dl,'Wrapping / container',()=>materials[c.container]?.[getLanguage()==='th'?0:1]||t('Not specified — confirm with customer'));
  row(dl,'Wrapping colour',()=>finishes.find(f=>f[0]===c.finish)?.[idx()]||t('Not specified — confirm with customer'));
  row(dl,'Ribbon',()=>ribbonLabels[c.ribbon]?.[getLanguage()==='th'?0:1]||t('Not specified — confirm with customer'));
  row(dl,'Size',()=>sizeLabels[c.size]?.[getLanguage()==='th'?0:1]||t('Not specified — confirm with customer'));
  row(dl,'Requested budget',()=>{const budget=budgets.find(b=>b.id===(custom.budgetTier||c.budgetTier));return custom.budgetCustom?baht(Number(custom.budgetCustom)*100):budget?baht(budget.min*100)+(budget.max?'–'+baht(budget.max*100):'+'):t('Not specified');});
  row(dl,'Estimated price',()=>custom.estimate?.low!=null?baht(custom.estimate.low)+(custom.estimate.high!=null&&custom.estimate.high!==custom.estimate.low?'–'+baht(custom.estimate.high):''):t('Price confirmation needed'));
  if(custom.banknoteValue!=null)row(dl,'Banknote face value',()=>baht(Number(custom.banknoteValue)*100));
  if(c.sourceProduct)row(dl,'Based on',()=>languageValue(catalog.find(p=>p.id===c.sourceProduct)?.name)||c.sourceProduct);
  section.append(dl);
  if(custom.occasion){const occasion=node('dl');row(occasion,'Occasion',custom.occasion);section.append(occasion);}
  if(custom.feel){const feeling=node('dl');row(feeling,'Design preferences',custom.feel);section.append(feeling);}
  if(custom.notes)section.append(ui('h4','Customer instructions'),node('p',{class:'customer-instructions'},custom.notes));
  if(custom.referenceAssetId)section.append(ui('h4','Reference photo'),ui('p','Private customer reference · never sent to a provider by default',{class:'muted'}),photo('/api/assets/'+custom.referenceAssetId,'Private customer reference'));
  root.append(section);
 }
 if(order.colourNote){const section=node('section',{class:'order-customer-colour'},ui('h3','Customer colour request'),node('p',{class:'customer-instructions'},order.colourNote));root.append(section);}
 return root;
}
