"use strict";
const CACHE='ict-entry-desk-static-b8f7feb4f7d6';
const CORE_ASSETS=['./','./index.html','./styles.css','./browser-log.js','./app.js','./backup-ui.js','./offline.js'];
const OPTIONAL_ASSETS=['./SOURCE_MAP.md','./SOURCE_MAP_IFVG_2026-11-03.3.md'];
const ASSETS=[...CORE_ASSETS,...OPTIONAL_ASSETS];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await cache.addAll(CORE_ASSETS);
    await Promise.all(OPTIONAL_ASSETS.map(path=>cache.add(path).catch(()=>{})));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ict-entry-desk-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!ASSETS.some(path=>url.pathname===new URL(path,self.registration.scope).pathname))return;
  const cached=()=>caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreSearch:true}));
  event.respondWith(fetch(new Request(event.request,{cache:'reload'})).then(async response=>{
    if(response.ok){
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));
      return response;
    }
    if(response.status===404||response.status>=500)return await cached()||response;
    return response;
  }).catch(async()=>await cached()||Response.error()));
});
