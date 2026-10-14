const GITHUB_ORIGIN='https://mpc0367.github.io';
const LOCAL_TEST_ORIGIN='http://127.0.0.1:5590';
const METHODS=['GET','HEAD','POST','PATCH','DELETE','OPTIONS'];
const REQUEST_HEADERS=['authorization','content-type','x-csrf','x-upload-consent','x-lhf-customer-session','x-lhf-staff-session'];
const SESSION_HEADERS='X-LHF-Demo-Session, X-LHF-Customer-Session, X-LHF-Staff-Session';

export function permittedApiOrigin(request){
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(!url.pathname.startsWith('/api/')||!origin)return false;
  return origin===url.origin||origin===GITHUB_ORIGIN||(
    url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&origin===LOCAL_TEST_ORIGIN
  );
}

export function withApiCors(request,response){
  if(!new URL(request.url).pathname.startsWith('/api/'))return response;
  const headers=new Headers(response.headers),vary=new Set((headers.get('Vary')||'').split(',').map(value=>value.trim()).filter(Boolean));
  vary.add('Origin');headers.set('Vary',[...vary].join(', '));
  if(permittedApiOrigin(request)){
    headers.set('Access-Control-Allow-Origin',request.headers.get('origin'));
    headers.set('Access-Control-Expose-Headers',SESSION_HEADERS);
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export function preflight(request){
  if(request.method!=='OPTIONS'||!new URL(request.url).pathname.startsWith('/api/'))return null;
  const requestedMethod=request.headers.get('access-control-request-method');
  const requestedHeaders=(request.headers.get('access-control-request-headers')||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  if(!permittedApiOrigin(request)||(requestedMethod&&!METHODS.includes(requestedMethod))||requestedHeaders.some(header=>!REQUEST_HEADERS.includes(header))){
    return withApiCors(request,new Response(JSON.stringify({error:'Cross-origin demo request refused.'}),{status:403,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}}));
  }
  return withApiCors(request,new Response(null,{status:204,headers:{
    'Access-Control-Allow-Methods':METHODS.join(', '),
    'Access-Control-Allow-Headers':REQUEST_HEADERS.join(', '),
    'Access-Control-Max-Age':'600',
    'Cache-Control':'private, no-store',
    Vary:'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
  }}));
}
