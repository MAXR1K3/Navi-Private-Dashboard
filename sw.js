/* sw.js — PWA Service Worker：缓存应用外壳，离线可用。
   改动任何 js/css 后请把 CACHE 版本号 +1，用户下次打开即自动更新。 */
"use strict";

var CACHE = "navi-v1";
var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/i18n.js",
  "./js/state.js",
  "./js/icons.js",
  "./js/utils.js",
  "./js/render.js",
  "./js/widgets.js",
  "./js/ui-core.js",
  "./js/bookmarks.js",
  "./js/categories.js",
  "./js/dragdrop.js",
  "./js/import-export.js",
  "./js/settings.js",
  "./js/menu.js",
  "./js/chrome-sync.js",
  "./js/trash.js",
  "./js/health.js",
  "./js/suggest.js",
  "./js/pwa.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

// 同源 GET：缓存优先 + 后台更新（stale-while-revalidate）；跨域请求不拦截
self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);
  if(url.origin !== location.origin) return;
  e.respondWith(
    caches.match(req).then(function(cached){
      var fresh = fetch(req).then(function(res){
        if(res && res.ok){ var copy=res.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); }); }
        return res;
      }).catch(function(){ return cached; });
      return cached || fresh;
    })
  );
});
