/* pwa.js — PWA：Service Worker 注册。仅在 http(s) 环境生效（手机端可“添加到主屏幕”安装为 App）；
   file:// 与 chrome-extension:// 环境自动跳过，不影响扩展用法。 */
"use strict";
(function(){
  if(!("serviceWorker" in navigator)) return;
  if(!/^https?:$/.test(location.protocol)) return;
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").catch(function(){});
  });
})();
