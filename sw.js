const C='sitio-amigos-v5-auth';
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./logo.jpg','./apple-touch-icon.png','./manifest.webmanifest'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.url.includes('supabase.co')||e.request.url.includes('jsdelivr.net'))return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
