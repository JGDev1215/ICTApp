"use strict";
const CACHE='ict-entry-desk-static-95b66b5baf3e';
const ASSETS=['./','./index.html','./styles.css','./browser-log.js','./app.js','./backup-ui.js','./offline.js','./SOURCE_MAP.md','./SOURCE_MAP_IFVG_2026-11-03.3.md'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ict-entry-desk-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!ASSETS.some(path=>url.pathname===new URL(path,self.registration.scope).pathname))return;
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreSearch:true})).then(hit=>hit||fetch(event.request)));
});
