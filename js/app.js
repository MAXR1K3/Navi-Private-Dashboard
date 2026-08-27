/* app.js — 应用启动入口（必须最后加载） */
"use strict";

/* ===== init ===== */
load(); purgeTrash();
if(typeof purgeOpLog==="function"){
  var _logN=Array.isArray(state.opLog)?state.opLog.length:0;
  purgeOpLog();
  if(_logN!==(Array.isArray(state.opLog)?state.opLog.length:0)) save();
}
oplogInit(); applyI18n(); initPerformanceGuards(); render(); initAutoTheme(); initChromeSync();
if(typeof initSync==="function") initSync();
if(typeof initCapture==="function") initCapture();
if(typeof initContextual==="function") initContextual();
if(typeof initMirror==="function") initMirror();
