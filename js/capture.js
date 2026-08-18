/* capture.js — 捕获入口：把「当下正在看的页面」收进 Navi。
   两条来源：
   1) 桌面扩展：右键菜单 / 快捷键把页面写进 chrome.storage 的 naviCaptures 队列，面板打开或获得焦点时取走；
   2) PWA 分享目标：手机上从任意 App 分享链接 → index.html?url=...&title=... 直接入库。 */
"use strict";

function captureApi(){
  try{
    if(typeof chrome!=="undefined"&&chrome&&chrome.storage&&chrome.storage.local) return chrome;
    if(typeof browser!=="undefined"&&browser&&browser.storage&&browser.storage.local) return browser;
  }catch(e){}
  return null;
}
function captureNorm(u){ return (typeof normForDup==="function")?normForDup(u):normalizeUrl(u||"").replace(/\/+$/,"").toLowerCase(); }

/* 把捕获项写入书签；返回 {added, dup} */
function applyCaptures(list){
  if(!list||!list.length) return {added:0,dup:0};
  var have={};
  state.bookmarks.forEach(function(b){ have[captureNorm(b.url)]=true; });
  var added=0, dup=0, lastTitle="";
  list.forEach(function(item){
    var url=normalizeUrl(item&&item.url||"");
    if(!isWebUrl(url)) return;
    var k=captureNorm(url);
    if(have[k]){ dup++; return; }
    have[k]=true;
    var title=String(item.title||"").trim()||getDomain(url)||url;
    var cat="Uncategorized";
    var desc=(typeof smartSummary==="function")?smartSummary(url,title,cat,""):"";
    if(state.categories.indexOf(cat)===-1) state.categories.push(cat);
    state.bookmarks.unshift({ id:uid(), title:title, url:url, category:cat, description:desc, tags:[], clicks:0, lastOpened:0, favorite:false });
    added++; lastTitle=title;
  });
  if(added){
    save(); render();
    toast(added===1?t("captureSavedOne",{title:clipCaptureTitle(lastTitle)}):t("captureSaved",{n:added}), "ok");
  } else if(dup){
    toast(t("captureDup"), "");
  }
  return {added:added,dup:dup};
}
function clipCaptureTitle(s){ s=String(s||""); return s.length>32?(s.slice(0,32)+"…"):s; }

/* ----- 扩展队列 ----- */
var _draining=false;
function drainCaptures(){
  var api=captureApi(); if(!api||_draining) return;
  _draining=true;
  try{
    api.storage.local.get("naviCaptures", function(d){
      _draining=false;
      var q=(d&&d.naviCaptures)||[];
      if(!q.length) return;
      try{ api.storage.local.set({naviCaptures:[]}); }catch(e){}
      applyCaptures(q);
      // 正文快照体积大，走 IndexedDB，不进 localStorage
      if(typeof snapPut==="function"){
        var snaps=q.filter(function(x){ return x&&x.snap&&x.snap.text; });
        if(snaps.length){
          Promise.all(snaps.map(function(x){ return snapPut(x.url,x.snap); })).then(function(){
            if(typeof refreshSnapKeys==="function") refreshSnapKeys().then(function(){ renderContent(); });
            toast(t("snapSaved",{n:snaps.length}),"ok");
          });
        }
      }
    });
  }catch(e){ _draining=false; }
}
/* 把当前语言告诉扩展，右键菜单文案才能跟着切换 */
function pushLangToExt(){
  var api=captureApi(); if(!api) return;
  try{ api.storage.local.set({ naviLang: state.settings.lang||"en" }); }catch(e){}
}

/* ----- PWA 分享目标 ----- */
function handleShareTarget(){
  var sp; try{ sp=new URLSearchParams(location.search); }catch(e){ return; }
  var url=sp.get("url")||"", text=sp.get("text")||"", title=sp.get("title")||"";
  // 安卓等平台常把链接塞在 text 里：抽出链接，并把链接从标题中剔除，避免标题里重复一串 URL
  if(!url&&text){ var m=text.match(/https?:\/\/\S+/); if(m){ url=m[0]; if(!title) title=text.replace(m[0],"").trim(); } }
  if(!url) return;
  applyCaptures([{ url:url, title:title }]);
  try{ history.replaceState(null,"",location.pathname); }catch(e){}
}

function initCapture(){
  if(typeof refreshSnapKeys==="function") refreshSnapKeys().then(function(){
    renderContent();
    // 删书签的路径太多，启动时统一扫掉对不上号的存档（见 snapPruneOrphans 注释）
    if(typeof snapPruneOrphans==="function") setTimeout(snapPruneOrphans, 1500);
    // v1 时期存的存档没有词向量，补算一次（相关页面要用）
    if(typeof snapEnsureTerms==="function") setTimeout(snapEnsureTerms, 2500);
  });
  handleShareTarget();
  var api=captureApi(); if(!api) return;
  pushLangToExt();
  drainCaptures();
  try{
    if(api.storage.onChanged) api.storage.onChanged.addListener(function(ch,area){
      if(area==="local"&&ch&&ch.naviCaptures&&((ch.naviCaptures.newValue||[]).length)) drainCaptures();
    });
  }catch(e){}
  window.addEventListener("focus", drainCaptures);
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) drainCaptures(); });
}
