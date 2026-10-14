/* Network-only studio worker. Authenticated records and protected shells are never cached. */
const OLD_CACHE_PREFIX='lhf-studio-shell-';
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys()
  .then(names=>Promise.all(names.filter(name=>name.startsWith(OLD_CACHE_PREFIX)).map(name=>caches.delete(name))))
  .then(()=>self.clients.claim()));
});
