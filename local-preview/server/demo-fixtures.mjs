import {catalog,images,legacy,estimate,visualKey,hash} from './domain.mjs';
import {recipes} from '../shared/recipes.mjs';
import {VERSION,validateConfig} from '../shared/config.mjs';
export function seedExtendedDemo(db,putOrder,conceptFixtures=[]){
 const today=legacy.time.today(),createdAt=new Date().toISOString();
 if(!db.get('meta','staff-fixtures-v2')){
  const choices=['red-roses-cream','blue-white-box','white-green-basket','bridal-white','jasmine-garland','pastel-wreath','money-rose'].map(id=>recipes.find(r=>r.id===id));
  choices.forEach((recipe,index)=>{
   const config={...recipe.config,flowers:[...recipe.config.flowers]},style=config.style,flowers=config.flowers;
   const errors=validateConfig(config,Object.keys(legacy.catalog.flowers).filter(f=>f!=='banknotes'));if(errors.length)throw Error('Invalid synthetic fixture '+style+': '+errors.join(' '));
   const concept=conceptFixtures.find(p=>visualKey(p.config)===visualKey(config));
   const preview=concept?{key:concept.key,status:'ready',asset:concept.asset}:{key:visualKey(config),status:'unavailable',asset:null,reason:'Consultation requested'};
   const order={id:'demo-custom-'+style,ref:'DEMO-CUSTOM-'+style.toUpperCase(),createdAt,date:legacy.util.addDays(today,index-1),windowId:'p2',windowLabel:'10:00–12:00',fulfil:'pickup',status:index===0?'confirmed':'new',customer:{name:'Demo '+style+' customer',phone:'0800000000',line:'demo-handle'},recipient:{name:'Demo recipient',phone:'0800000000'},address:null,items:[],type:'custom',card:{message:'A little happiness, just for you.'},notes:'Synthetic '+style+' fixture. '+(style==='money'?'Banknotes and arrangement service require separate confirmation.':''),custom:{config,flowers,style,budgetTier:'b3',estimate:estimate(config),preview,previewAssetId:preview.asset?.id||null,previewVersion:preview.asset?.version||null,configHash:visualKey(config),banknoteValue:style==='money'?2000:null},confirmedTotal:index===0?149000:null,revision:1,syncState:'pending',demo:true};
   if(!db.get('orders',order.id))putOrder(order);
  });
  const single=catalog.find(p=>p.id==='single-rose');
  for(const qty of [1,3,4,7,8,11,12]){const price=estimate({sourceProduct:single.id,unchanged:true},qty,today),id='demo-tier-'+qty;const row={id,ref:'DEMO-ROSE-'+qty,createdAt,date:legacy.util.addDays(today,3),windowId:'p2',windowLabel:'10:00–12:00',fulfil:'pickup',status:'confirmed',customer:{name:'Demo tier '+qty,phone:'0800000000'},recipient:{name:'Demo recipient',phone:'0800000000'},items:[{productId:single.id,name:single.name.en,qty,unit:price.low==null?0:price.low/100/qty,line:price.low==null?0:price.low/100,image:images[single.image]?.src||null,kind:price.low==null?'quote':'firm'}],type:'product',confirmedTotal:price.low,revision:1,syncState:'pending',demo:true,notes:'Synthetic published tier-boundary example; no payment recorded.'};if(!db.get('orders',id))putOrder(row);}
  const base=db.get('orders','demo-7');if(base&&!base.fixtureCoverageV2)putOrder({...base,historyIncomplete:true,legacyStatus:'Legacy unknown status',legacyPayment:'Paid — date unknown',fixtureCoverageV2:true,revision:base.revision+1,items:(base.items||[]).map(i=>({...i,image:null}))});
  const broken={...db.get('orders','demo-custom-basket'),id:'demo-broken-preview',ref:'DEMO-IMAGE-FAIL',notes:'Deliberately broken image fixture. The UI must provide a readable fallback.',custom:{...db.get('orders','demo-custom-basket')?.custom,preview:{status:'failed',asset:{id:'fixture-broken',url:'/img/missing-fixture-image.webp',kind:'concept',label:'Synthetic broken-image case'},reason:'Fixture image intentionally missing'}}};if(!db.get('orders',broken.id))putOrder(broken);
  for(const state of ['pending','failed']){const base=db.get('orders','demo-custom-bouquet'),fixture={...base,id:'demo-preview-'+state,ref:'DEMO-PREVIEW-'+state.toUpperCase(),status:'new',confirmedTotal:null,custom:{...base.custom,previewAssetId:null,previewVersion:null,preview:{status:state,asset:null,reason:'Synthetic '+state+' provider example'}},notes:'Synthetic '+state+' generation fixture.'};if(!db.get('orders',fixture.id))putOrder(fixture);}
  db.put('meta','staff-fixtures-v2',{at:createdAt});
 }
 for(const recipe of recipes){const o=db.get('orders','demo-custom-'+recipe.config.style),asset=conceptFixtures.find(p=>visualKey(p.config)===visualKey(o?.custom?.config||{}))?.asset;if(o&&asset&&o.custom.preview?.asset?.id!==asset.id){putOrder({...o,revision:o.revision+1,syncState:'pending',custom:{...o.custom,preview:{key:visualKey(o.custom.config),status:'ready',asset},previewAssetId:asset.id,previewVersion:asset.version}});}}
 // Coverage is explicitly declared for synthetic ledger periods only. Unknown history remains absent.
 if(!db.get('meta','coverage-fixtures-v1')){
  const months=new Set(db.all('payments').filter(p=>p.occurredAt).map(p=>legacy.time.today(new Date(p.occurredAt)).slice(0,7)));
  for(const month of months){const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);db.put('coverage',month,{id:month,from:month+'-01',to:end>today?today:end,status:'complete',source:'Synthetic fixture ledger — never real shop revenue',reviewedAt:createdAt});}
  let zeroMonth=legacy.util.addDays(today.slice(0,7)+'-01',-1).slice(0,7);for(let i=0;months.has(zeroMonth)&&i<36;i++)zeroMonth=legacy.util.addDays(zeroMonth+'-01',-1).slice(0,7);
  const zeroEnd=new Date(Date.UTC(Number(zeroMonth.slice(0,4)),Number(zeroMonth.slice(5)),0)).toISOString().slice(0,10);
  db.put('coverage',zeroMonth,{id:zeroMonth,from:zeroMonth+'-01',to:zeroEnd,status:'complete',source:'Synthetic fixture: reviewed zero activity',reviewedAt:createdAt});
  db.put('meta','coverage-fixtures-v1',{at:createdAt,verifiedZeroMonth:zeroMonth,missingHistoryMonth:'2025-10'});
 }
 return db.get('meta','coverage-fixtures-v1');
}
