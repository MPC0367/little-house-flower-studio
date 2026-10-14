import {loadHostedJournal} from './hosted-store.mjs';
import {basicPassword,checkedPassword,checkAttempts,recordAttempt,hasValidPasswordCache} from './hosted-auth.mjs';
import {authError,passwordRecord,validatePassword,randomHex} from './hosted-crypto.mjs';
import {catalog,data,images,legacy,hash,visualKey,estimate,validateOrder,paymentState} from './domain.mjs';
import {productDesignSnapshot} from './product-design.mjs';
import {priceCheck} from './price-check.mjs';
import {filterOrders,compactOrder,patchOrder,recordPayment,reportRevenue} from './staff-service.mjs';
import {HostedPreviewService,getHostedPreviewAsset} from './hosted-preview.mjs';
import {imageMetadata} from './hosted-images.mjs';
import {uploadHostedSiteAsset} from './hosted-site-upload.mjs';
import {permittedApiOrigin,preflight,withApiCors} from './hosted-cors.mjs';
import {session,issueSession,exposeExistingSession,secureAttribute} from './hosted-sessions.mjs';
import siteAssetManifest from './hosted-site-assets.json' with {type:'json'};
import {VERSION} from '../shared/config.mjs';

const contexts=new WeakMap(),now=()=>new Date().toISOString();
const publicPreviewEnabled=(env,db)=>env.LHF_PUBLIC_PREVIEW==='true'&&db.get('meta','hosted-demo')?.synthetic===true;
const deploymentAssetRoute=path=>path==='/api/admin/site-assets'||path.startsWith('/api/admin/site-assets/');
function business(fn){try{return fn();}catch(error){if(!error.status)error.status=422;throw error;}}
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
function errorResponse(error){return json({error:error.status?error.message:'The demo service is unavailable. Please try again.',...(error.current?{current:error.current}:{})},error.status||500,error.status===429?{'Retry-After':'60'}:{});}
const challenge=()=>new Response('Client preview sign-in required.',{status:401,headers:{'WWW-Authenticate':'Basic realm="Little House Flower demo", charset="UTF-8"','Cache-Control':'private, no-store'}});
export async function gate(request,env){const response=await authorizeGate(request,env);return response?withApiCors(request,response):null;}
async function authorizeGate(request,env){
  try{
    const url=new URL(request.url),origin=request.headers.get('origin'),allowedApiOrigin=permittedApiOrigin(request);
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))return json({error:'HTTPS is required.'},403);
    if(origin&&origin!==url.origin&&!allowedApiOrigin)return json({error:'Cross-origin demo request refused.'},403);
    if(!['GET','HEAD','OPTIONS'].includes(request.method)&&origin!==url.origin&&!allowedApiOrigin)return json({error:'Same-origin request required'},403);
    if(request.headers.get('sec-fetch-site')==='cross-site'&&!allowedApiOrigin&&!(request.method==='GET'&&request.headers.get('sec-fetch-mode')==='navigate'))return json({error:'Cross-origin demo request refused.'},403);
    const options=preflight(request);if(options)return options;
    const db=await loadHostedJournal(env),record=db.get('meta','staff-password'),password=basicPassword(request),publicPreview=publicPreviewEnabled(env,db);
    if(publicPreview&&!deploymentAssetRoute(url.pathname)){
      contexts.set(request,{db,authVersion:record?.authVersion,publicPreview:true});return null;
    }
    if(!record||typeof record.authVersion!=='string')return json({error:'Demo password protection is unavailable.'},503);
    if(url.pathname==='/api/demo-login'&&request.method==='POST'){
      contexts.set(request,{db,authVersion:record.authVersion});return null;
    }
    if(url.pathname.startsWith('/api/')&&!deploymentAssetRoute(url.pathname)&&session(db,request,'demo')){
      contexts.set(request,{db,authVersion:record.authVersion});return null;
    }
    if(password===null)return challenge();
    if(!hasValidPasswordCache(password,record))checkAttempts(db,request,'gate');
    if(!await checkedPassword(password,record)){recordAttempt(db,request,'gate');try{await db.commit();}catch{return json({error:'Too many attempts. Please wait a minute and try again.'},429,{'Retry-After':'60'});}return challenge();}
    contexts.set(request,{db,authVersion:record.authVersion});return null;
  }catch(error){return errorResponse(error);}
}

async function readBytes(request,limit=300000){
  const length=Number(request.headers.get('content-length')||0);if(!Number.isSafeInteger(length)||length<0||length>limit)throw authError('Payload too large',413);
  if(!request.body)return new Uint8Array();
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw authError('Payload too large',413);}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
async function readJSON(request,limit){try{return JSON.parse(new TextDecoder().decode(await readBytes(request,limit))||'{}');}catch(error){if(error.status)throw error;throw authError('Invalid request body',400);}}
function requireStaff(db,request,publicPreview=false){if(publicPreview)return {id:'public-preview',kind:'admin',role:'owner',publicPreview:true};const s=session(db,request,'admin');if(!s)throw authError('Staff sign-in required',401);return s;}
const requireCustomer=(db,request)=>{const s=session(db,request,'customer');if(!s)throw authError('Session required',401);return s;};
function synchronization(db){return {lastSync:now(),lastSave:db.get('meta','last-save')?.at||db.get('meta','hosted-demo')?.createdAt,pending:0,deadLetters:0,error:null,mode:'Hosted demonstration data · Google disconnected',conflicts:db.all('conflicts').length};}
function saveOrder(db,order){db.put('orders',order.id,{...order,syncState:'synced'});db.put('meta','last-save',{at:now()});}
function acknowledgment(order){const receipt={};for(const key of ['id','ref','type','date','windowId','windowLabel','fulfil','items','custom','subtotal','quoteOnly','hasQuote','priceFrom','createdAt','lang','customer','recipient','address','card','anonymous','colourNote'])if(Object.hasOwn(order,key))receipt[key]=order[key];return {ok:true,id:order.id,ref:order.ref,windowId:order.windowId,windowLabel:order.windowLabel,revision:order.revision,syncState:order.syncState,receipt};}
function reservationReference(db,date){const used=new Set(db.all('orders').map(order=>order.ref));let ref;do{ref='DEMO-'+date.replaceAll('-','').slice(2)+'-'+randomHex(3).toUpperCase();}while(used.has(ref));return ref;}

async function dispatch(request,env,db,cookies,afterCommit,onRollback,responseHeaders){
  const url=new URL(request.url),p=url.pathname,method=request.method,previews=new HostedPreviewService({db,env}),publicPreview=publicPreviewEnabled(env,db);
  if(method==='OPTIONS')return new Response(null,{status:204});
  if(!['GET','HEAD'].includes(method)&&request.headers.get('x-csrf')!=='local-preview')throw authError('Same-origin request required',403);
  if(p==='/api/demo-login'&&method==='POST'){
    if(publicPreview)return json({ok:true,demo:true,passwordProtected:false,publicPreview:true});
    checkAttempts(db,request,'demo-login');const b=await readJSON(request,2048);
    if(!await checkedPassword(b?.password,db.get('meta','staff-password'))){recordAttempt(db,request,'demo-login');return json({error:'Incorrect password. Please try again.'},401);}
    issueSession(db,'demo',cookies,request,responseHeaders);return json({ok:true,demo:true,expiresIn:43200});
  }
  if(p==='/api/health')return json({ok:true,mode:'hosted-demo',demo:true,publicPreview,sync:synchronization(db)});
  if(p==='/api/session'&&method==='POST'){
    const existing=session(db,request,'customer');if(existing)exposeExistingSession(request,'customer',responseHeaders);
    return json({ok:true,session:(existing||issueSession(db,'customer',cookies,request,responseHeaders)).id});
  }
  if(p==='/api/catalogue'&&method==='GET')return json({catalog,images,settings:data.bookingDefaults,version:VERSION});
  if(p==='/api/admin/auth-config'&&method==='GET')return json(publicPreview?{passwordProtected:false,publicPreview:true}:{passwordProtected:true});
  if(p==='/api/admin/login'&&method==='POST'){
    checkAttempts(db,request);const b=await readJSON(request,2048);
    if(!await checkedPassword(b?.password,db.get('meta','staff-password'))){recordAttempt(db,request);return json({error:'Incorrect password. Please try again.'},401);}
    issueSession(db,'admin',cookies,request,responseHeaders);return json({ok:true,role:'owner',demo:true});
  }
  if(p==='/api/admin/password'&&method==='POST'){
    if(publicPreview)throw authError('Password changes are disabled while the public demo is open.',409);
    requireStaff(db,request);checkAttempts(db,request,'change');recordAttempt(db,request,'change');const b=await readJSON(request,2048);validatePassword(b?.newPassword);
    if(!await checkedPassword(b?.currentPassword,db.get('meta','staff-password')))return json({error:'Incorrect current password. Please try again.'},401);
    db.put('meta','staff-password',await passwordRecord(b.newPassword));for(const s of db.all('sessions'))if(s.kind==='admin'||s.kind==='demo')db.remove('sessions',s.id);
    issueSession(db,'admin',cookies,request,responseHeaders);issueSession(db,'demo',cookies,request,responseHeaders);return json({ok:true,passwordProtected:true});
  }
  if(p==='/api/admin/logout'&&method==='POST'){
    const staff=publicPreview?session(db,request,'admin'):requireStaff(db,request);if(staff)db.remove('sessions',staff.id);responseHeaders.set('X-LHF-Staff-Session','');cookies.push(`lhf_staff=; HttpOnly;${secureAttribute(request)} SameSite=Strict; Path=/; Max-Age=0`);return json({ok:true});
  }
  if(p==='/api/price-check'&&method==='POST'){
    requireCustomer(db,request);const b=await readJSON(request);if(b.custom?.config)b.custom.config=previews.validate(b.custom.config);business(()=>validateOrder({...b,consent:true}));return json(business(()=>priceCheck(b)));
  }
  if(p==='/api/preview-recipes'&&method==='GET')return json({recipes:previews.recipeList()});
  if(p==='/api/preview'&&method==='POST'){
    const customer=requireCustomer(db,request),b=await readJSON(request);return json(await previews.request(b.config,customer.id,{retry:!!b.retry,mode:b.mode}));
  }
  if(p.startsWith('/api/preview-jobs/')&&method==='GET')return json(previews.publicJob(previews.get(p.split('/').pop())));
  if(p.startsWith('/api/preview-assets/')&&['GET','HEAD'].includes(method)){
    const response=await getHostedPreviewAsset(p.split('/').pop(),{env});return method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
  }
  if(p==='/api/uploads'&&method==='POST'){
    const customer=requireCustomer(db,request);if(request.headers.get('x-upload-consent')!=='yes')throw authError('Reference-photo consent required');
    if(db.all('assets').filter(asset=>asset.owner===customer.id&&!asset.orderId).length>=5)throw authError('Remove an unused reference before adding another',429);
    const bytes=await readBytes(request,5*1024*1024),metadata=imageMetadata(bytes),id=crypto.randomUUID(),key='references/'+id;
    await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:metadata.mime}});onRollback.push(()=>env.BUCKET.delete(key));
    db.put('assets',id,{id,key,role:'reference',owner:customer.id,createdAt:now(),...metadata,contentHash:hash(bytes),version:1});return json({id,url:'/api/assets/'+id,version:1},201);
  }
  if(p.startsWith('/api/assets/')){
    if(!['GET','HEAD','DELETE'].includes(method))throw authError('Unsupported asset method',405);
    const asset=db.get('assets',p.split('/').pop()),customer=session(db,request,'customer'),staff=session(db,request,'admin');
    if(!asset||!(staff||asset.owner===customer?.id))throw authError('Image unavailable',404);
    if(method==='DELETE'){if(asset.orderId)throw authError('This reference belongs to a saved order',409);db.remove('assets',asset.id);afterCommit.push(()=>env.BUCKET.delete(asset.key));return json({ok:true});}
    const object=await env.BUCKET.get(asset.key);if(!object)throw authError('Image unavailable',404);
    return new Response(method==='HEAD'?null:object.body,{headers:{'Content-Type':asset.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  if(p==='/api/orders'&&method==='POST'){
    const customer=requireCustomer(db,request),b=await readJSON(request);if(!b||typeof b!=='object')throw authError('Invalid order');
    const prior=db.get('orders',b.id);if(prior){if(prior.owner!==customer.id)throw authError('Request ID already used',409);return json(acknowledgment(prior));}
    if(db.all('orders').length>=300||db.all('orders').filter(order=>order.owner===customer.id&&Date.now()-Date.parse(order.createdAt)<3600000).length>=20)throw authError('Demo request limit reached',429);
    if(b.custom?.config){const config=previews.validate(b.custom.config);b.custom={...b.custom,config,style:config.style,flowers:config.flowers,fromProduct:config.sourceProduct||''};}
    business(()=>validateOrder(b));const window=legacy.engine.windowsFor(b.date,b.fulfil,legacy.engine.ctx(data.bookingDefaults),null).find(value=>value.id===b.windowId&&value.ok);if(!window)throw authError('Invalid date or time window');
    let asset=null;if(b.custom?.referenceAssetId){asset=db.get('assets',b.custom.referenceAssetId);if(!asset||asset.owner!==customer.id||asset.orderId)throw authError('Invalid reference asset');}
    if(b.custom&&!data.bookingDefaults.budgetTiers.some(tier=>tier.id===b.custom.budgetTier)&&!(Number(b.custom.budgetCustom)>=250&&Number(b.custom.budgetCustom)<=10000000))throw authError('Invalid budget');
    const config=b.custom?.config,pricing=config?estimate(config):null;
    if(b.priceCheck&&b.priceCheck!==priceCheck(b).signature)throw authError('Price information changed. Review the current price and submit again.',409);
    if(config&&b.custom.previewAssetId){const preview=db.get('previews',previews.keyFor(config));if(!preview||preview.asset?.id!==b.custom.previewAssetId)throw authError('Preview no longer matches selection');}
    const summary=legacy.engine.priceSummary(b),items=summary.items.map(item=>({productId:item.product.id,designSnapshot:productDesignSnapshot(item.product),qty:item.qty,name:item.product.name[b.lang==='en'?'en':'th'],nameTh:item.product.name.th,unit:item.unit,line:item.line,kind:item.kind,image:images[item.product.image]?.src||null,pricingVersion:VERSION,priceValidUntil:item.product.priceValidUntil||null}));
    const order={id:b.id,ref:reservationReference(db,b.date),owner:customer.id,createdAt:now(),date:b.date,windowId:window.id,windowLabel:window.start+'–'+window.end,fulfil:b.fulfil,type:b.type,items,subtotal:summary.subtotal,hasQuote:summary.hasQuote,priceFrom:summary.priceFrom,quoteOnly:summary.quoteOnly,
      custom:config?{style:config.style,occasion:b.custom.occasion||'',fromProduct:config.sourceProduct||'',flowers:config.flowers,feel:b.custom.feel||'',notes:b.custom.notes||'',budgetTier:b.custom.budgetTier||'',budgetCustom:b.custom.budgetCustom||'',banknoteValue:b.custom.banknoteValue||null,referenceAssetId:asset?.id||null,hasReference:!!asset,config,previewAssetId:b.custom.previewAssetId||null,previewVersion:b.custom.previewAssetId?(db.get('previews',previews.keyFor(config))?.asset?.version||null):null,preview:b.custom.previewAssetId?db.get('previews',previews.keyFor(config)):null,estimate:pricing,configHash:visualKey(config),snapshotAt:now()}:null,
      customer:b.customer,recipient:b.recipient,address:b.address,card:b.card,anonymous:!!b.anonymous,colourNote:b.colourNote||'',lang:b.lang,status:'new',confirmedTotal:null,deliveryFee:null,revision:1,syncState:'synced',notes:'',demo:true};
    db.transaction(()=>{saveOrder(db,order);if(asset)db.put('assets',asset.id,{...asset,orderId:order.id});db.event(order.id,'demo customer',{created:true});});return json(acknowledgment(order),201);
  }
  if(p.startsWith('/api/orders/submission/')&&method==='GET'){
    const customer=session(db,request,'customer'),order=db.get('orders',p.split('/').pop());if(!customer||!order||order.owner!==customer.id)throw authError('Not found',404);return json(acknowledgment(order));
  }
  if(p.startsWith('/api/admin/')){
    const staff=requireStaff(db,request,publicPreview&&!deploymentAssetRoute(p));
    if(p.startsWith('/api/admin/site-assets/')){
      if(method!=='POST')throw authError('Unsupported site asset upload method',405);
      return json(await uploadHostedSiteAsset(request,{env,digest:p.slice('/api/admin/site-assets/'.length),manifest:siteAssetManifest}),201);
    }
    if(p==='/api/admin/me'&&method==='GET')return json({role:staff.role,demo:true,...(publicPreview?{publicPreview:true}:{})});
    if(p==='/api/admin/orders'&&method==='GET'){const payments=db.all('payments'),rows=filterOrders(db.all('orders'),payments,url.searchParams);return json({orders:rows.map(order=>compactOrder(order,payments)),total:rows.length,sync:synchronization(db)});}
    if(p==='/api/admin/revenue'&&method==='GET')return json({...business(()=>reportRevenue(db,url.searchParams)),sync:synchronization(db)});
    if(p==='/api/admin/settings'&&method==='GET')return json({sync:synchronization(db),version:VERSION,googleConnected:false,previewProvider:'Hosted composition preview',failure:'',conflicts:db.all('conflicts'),quarantine:[],legacyPaidHistory:'Unknown payment date excluded',notifications:'Disabled',coverage:db.all('coverage'),coverageFixture:db.get('meta','coverage-fixtures-v1'),retention:null,hostedDemo:true,publicPreview});
    if(p==='/api/admin/simulator'&&method==='POST')throw authError('Google Sheets is disconnected in this hosted demo. Demo changes are saved online.',409);
    const match=p.match(/^\/api\/admin\/orders\/([^/]+)(\/payments)?$/);
    if(match){const order=db.get('orders',match[1]);if(!order)throw authError('Order not found',404);
      if(method==='GET')return json({...order,payments:db.all('payments').filter(payment=>payment.orderId===order.id),payment:paymentState(order,db.all('payments')),events:db.all('events').filter(event=>event.orderId===order.id),sync:synchronization(db)});
      const b=await readJSON(request);
      if(match[2]&&method==='POST'){const result=business(()=>recordPayment(db,order,b,staff.role));db.put('payment_sync',result.payment.id,{id:result.payment.id,orderId:order.id,status:'synced',syncedAt:now()});db.put('meta','last-save',{at:now()});return json(result.payment,result.duplicate?200:201);}
      if(method==='PATCH'){business(()=>patchOrder(db,updated=>saveOrder(db,updated),order,b,staff.role));return json(db.get('orders',order.id));}
    }
    throw authError('Unknown staff endpoint',404);
  }
  throw authError('Unknown API endpoint',404);
}

export async function handleHostedRequest(request,env,attempt=0){
  const retryable=request.method==='POST'&&['/api/session','/api/preview','/api/demo-login','/api/admin/login'].includes(new URL(request.url).pathname),retryRequest=retryable&&attempt<2?request.clone():null;
  if(!contexts.has(request)){const denied=await gate(request,env);if(denied)return denied;}
  const {db}=contexts.get(request),cookies=[],afterCommit=[],onRollback=[],responseHeaders=new Headers();let committed=false;
  try{
    let response=await dispatch(request,env,db,cookies,afterCommit,onRollback,responseHeaders);
    await db.commit();committed=true;
    for(const action of afterCommit)try{await action();}catch{/* An unreferenced private object may be cleaned later. */}
    const headers=new Headers(response.headers);for(const cookie of cookies)headers.append('Set-Cookie',cookie);for(const [name,value] of responseHeaders)headers.set(name,value);response=new Response(response.body,{status:response.status,headers});
    return withApiCors(request,response);
  }catch(error){
    if(!committed)for(const action of onRollback)try{await action();}catch{}
    if(error.status===409&&retryRequest)return handleHostedRequest(retryRequest,env,attempt+1);
    if(error.status===409&&!error.current){const match=new URL(request.url).pathname.match(/^\/api\/admin\/orders\/([^/]+)/);if(match){try{error.current=(await loadHostedJournal(env)).get('orders',match[1]);}catch{}}}
    return withApiCors(request,errorResponse(error));
  }finally{contexts.delete(request);}
}
