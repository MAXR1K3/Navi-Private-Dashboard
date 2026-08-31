/* app.js — 应用启动入口（必须最后加载） */
"use strict";

/* ===== init ===== */
function startNaviRuntime(){
  purgeTrash();
  if(typeof purgeOpLog==="function"){
    var before=Array.isArray(state.opLog)?state.opLog.length:0;
    purgeOpLog();
    if(before!==(Array.isArray(state.opLog)?state.opLog.length:0)) save();
  }
  oplogInit(); applyI18n(); initPerformanceGuards(); render(); initAutoTheme(); initChromeSync();
  if(typeof initSync==="function") initSync();
  if(typeof initCapture==="function") initCapture();
  if(typeof initContextual==="function") initContextual();
  if(typeof initMirror==="function") initMirror();
}
function showRecovery(result){
  document.documentElement.dataset.recovery="true";
  document.documentElement.dataset.recoveryReason=result.reason||"unknown";
}
function bootNavi(){
  var result=load();
  if(result.status==="recovery"){
    showRecovery(result);
    return;
  }
  startNaviRuntime();
}
bootNavi();
