const CACHE='tensai-v5-shell-1';
const SHELL=['/','/styles.css','/app.js','/chart-shim.js','/lang-patch.js','/v5-patch.js','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
  if(u.pathname.startsWith('/api/')){e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return}
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
});
