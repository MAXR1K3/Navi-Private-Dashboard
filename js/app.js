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
var _recoveryResult=null;
var _recoveryLastGood=null;

function setRecoveryBusy(message){
  $("#recoveryRestore").disabled=true;
  $("#recoveryDownload").disabled=true;
  $("#recoveryReset").disabled=true;
  $("#recoveryStatus").textContent=message;
}
function showRecovery(result){
  _recoveryResult=result;
  document.documentElement.dataset.recovery="true";
  document.documentElement.dataset.recoveryReason=result.reason||"unknown";
  ["#bgLayer","header","#widgetsWrap",".layout","#selbar","#quickUndoBar"].forEach(function(selector){
    var element=$(selector);
    if(element){ element.inert=true; element.setAttribute("aria-hidden","true"); }
  });
  applyI18n(); openOverlay("recoveryOverlay");
  var restore=$("#recoveryRestore"),status=$("#recoveryStatus");
  restore.disabled=true;
  NaviStorage.getLastGood().then(function(revision){
    _recoveryLastGood=revision;
    restore.disabled=!revision;
    var locale=state.settings.lang==="zh"?"zh-CN":state.settings.lang==="es"?"es-ES":"en-US";
    status.textContent=revision
      ?t("recoveryReady",{date:new Date(revision.savedAt).toLocaleString(locale)})
      :t("recoveryUnavailable");
    (revision?restore:$("#recoveryDownload")).focus();
  });
}
function downloadRecoveryRaw(){
  var stamp=new Date().toISOString().replace(/[:.]/g,"-");
  downloadBlob(_recoveryResult.raw||"","text/plain;charset=utf-8","navi-corrupt-data-"+stamp+".txt");
}
$("#recoveryRestore").addEventListener("click",function(){
  if(!_recoveryLastGood) return;
  setRecoveryBusy(t("recoveryRestoring"));
  NaviStorage.restore(_recoveryLastGood.raw).then(function(ok){
    if(ok){ location.reload(); return; }
    $("#recoveryDownload").disabled=false; $("#recoveryReset").disabled=false; $("#recoveryRestore").disabled=false;
    $("#recoveryStatus").textContent=t("recoveryRestoreFailed");
    toast(t("recoveryRestoreFailed"),"err");
  });
});
$("#recoveryDownload").addEventListener("click",downloadRecoveryRaw);
$("#recoveryReset").addEventListener("click",function(){
  openConfirm(t("recoveryResetTitle"),t("recoveryResetMsg"),t("recoveryResetOk"),function(){
    setRecoveryBusy(t("recoveryResetting"));
    NaviStorage.clearAll().then(function(){ location.reload(); });
  });
});
function bootNavi(){
  var result=load();
  if(result.status==="recovery"){
    showRecovery(result);
    return;
  }
  startNaviRuntime();
}
bootNavi();
