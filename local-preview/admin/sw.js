/* Shell-only local PWA support. Customer/order/API responses are NEVER cached. */
const CACHE='lhf-studio-shell-v2';
const SHELL=['/index.html','/admin.css','/admin.mjs','/i18n.mjs','/order-design.mjs','/app-shell.css','/app-shell.mjs','/manifest.webmanifest','/icons/app-192.png','/icons/app-512.png','/shared/config.mjs'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('lhf-studio-shell-')&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 const document=request.mode==='navigate';if(!document&&!SHELL.includes(url.pathname))return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok&&response.type==='basic'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(document?'/index.html':url.pathname,copy)));}
  return response;
 }).catch(async()=>{const cached=await caches.match(document?'/index.html':url.pathname);return cached||new Response('Local workspace unavailable. Start the Little House Flower desktop app to reconnect.',{status:503,headers:{'Content-Type':'text/plain'}});}));
});
