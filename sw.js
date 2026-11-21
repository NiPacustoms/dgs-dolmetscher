// Gebärden-Dolmetscher – Service Worker: App offline, Gebärden-Medien zwischenspeichern
const SHELL_V="dgs-shell-v3",MEDIA="dgs-media-v1",FONTS="dgs-fonts-v1";
const SHELL=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(SHELL_V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("dgs-shell")&&k!==SHELL_V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const isMedia=u=>/\.(mp4|gif)(\?|$)/i.test(u.pathname)&&/(sign-lang\.uni-hamburg\.de|wishlephant\.com)$/.test(u.hostname);
async function cacheMedia(url){try{const c=await caches.open(MEDIA);if(await c.match(url))return true;const r=await fetch(url,{mode:"no-cors"});if(r.type==="opaque"||r.ok){await c.put(url,r);return true}}catch(e){}return false}
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);if(e.request.method!=="GET")return;
  if(isMedia(u)){ // Netz zuerst (Safari braucht Range-Antworten), offline aus dem Speicher
    e.respondWith(fetch(e.request).then(r=>{e.waitUntil(cacheMedia(u.href));return r}).catch(()=>caches.open(MEDIA).then(c=>c.match(u.href)).then(r=>r||Response.error())));return}
  if(/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){
    e.respondWith(caches.open(FONTS).then(async c=>{const hit=await c.match(e.request);const net=fetch(e.request).then(r=>{c.put(e.request,r.clone());return r}).catch(()=>hit);return hit||net}));return}
  if(u.origin===location.origin){ // App: Netz zuerst, damit Updates ankommen
    e.respondWith(fetch(e.request).then(r=>{const cl=r.clone();caches.open(SHELL_V).then(c=>c.put(e.request,cl));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("index.html"))))}
});
self.addEventListener("message",async e=>{
  if(!e.data||e.data.cmd!=="pack")return;const port=e.ports[0];let n=0,ok=0;const urls=e.data.urls||[];
  const q=urls.slice();const worker=async()=>{while(q.length){const u=q.shift();if(await cacheMedia(u))ok++;n++;if(n%10===0)port.postMessage({n})}};
  await Promise.all([worker(),worker(),worker(),worker()]);port.postMessage({done:true,ok});
});
