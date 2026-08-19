/* settings.js — 设置面板 */
"use strict";

/* ===== settings ===== */
function openSettings(tab){
  tab=validSetTab(tab)?tab:"general";
  var s=state.settings;
  $("#setName").value=s.appName||"";
  $("#setTag").value=s.tagline||"";
  syncMotionUI();
  $("#setSeconds").checked=!!s.clockSeconds;
  if($("#setClock24")) $("#setClock24").checked=!!s.clock24h;
  if(typeof syncSceneUI==="function") syncSceneUI();
  $("#setHolidays").checked=s.showHolidays!==false;
  $("#setLogoPreview").innerHTML=s.logo?'<img src="'+escapeHtml(s.logo)+'" alt=""/>':ICONS.bookmark;
  $all('[data-widget]').forEach(function(cb){ cb.checked=!!s.widgets[cb.getAttribute("data-widget")]; });
  syncWidgetSubRows();
  $all('#langSeg [data-lang]').forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-lang")===s.lang); });
  $all('#catLayoutSeg [data-layout]').forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-layout")===s.categoryLayout); });
  $("#setAiKey").value=s.aiKey||"";
  $all('#aiProvSeg [data-aiprov]').forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-aiprov")===(s.aiProvider||"local")); });
  $("#setGlass").checked=s.glass!==false;
  if($("#setPrivacy")) $("#setPrivacy").checked=!!s.privacy;
  updateStorageUsage();
  if(typeof updateSnapUsage==="function") updateSnapUsage();
  if($("#setMobileCollapse")) $("#setMobileCollapse").checked=state.settings.mobileCollapse!==false;
  if(typeof renderMobileWidgetChips==="function") renderMobileWidgetChips();
  if($("#setHideHeader")) $("#setHideHeader").checked=!!s.hideHeaderOnScroll;
  if(typeof syncMonitorUI==="function") syncMonitorUI();
  if(typeof syncProfileEditor==="function") syncProfileEditor();
  if(typeof syncLogRetentionUI==="function") syncLogRetentionUI();
  if(typeof renderOpLog==="function") renderOpLog();
  if(typeof applyPwaReaderSettingsVisibility==="function") applyPwaReaderSettingsVisibility();
  syncBgUI(); updateSyncUI(); setActiveSetTab(tab); openOverlay("settingsOverlay");
  wireSettingsScrollGuard();
}

/* AI 建议引擎设置 */
$("#aiProvSeg").addEventListener("click", function(e){
  var b=e.target.closest("[data-aiprov]"); if(!b) return;
  state.settings.aiProvider=b.getAttribute("data-aiprov"); save();
  $all('#aiProvSeg [data-aiprov]').forEach(function(x){ x.classList.toggle("on", x===b); });
});
$("#setAiKey").addEventListener("input", function(e){ state.settings.aiKey=e.target.value.trim(); save(); });
if($("#setPrivacy")) $("#setPrivacy").addEventListener("change", function(e){ state.settings.privacy=e.target.checked; save(); render(); toast(e.target.checked?t("privacyOn"):t("privacyOff"), "ok"); });
function updateStorageUsage(){
  if(typeof storageInfo!=="function") return;
  var info=storageInfo(), desc=$("#storageUsageDesc"), fill=$("#storageBarFill"), val=$("#storageUsageVal");
  if(val) val.textContent=info.kb+" KB · "+info.pct+"%";
  if(fill){ fill.style.width=Math.max(2,info.pct)+"%"; fill.className=info.pct>=85?"full":info.pct>=60?"warn":""; }
  if(desc) desc.textContent=t("storageUsageDesc",{kb:info.kb,pct:info.pct});
}
/* 页面存档用量（IndexedDB，不占 localStorage 预算，所以单列一行） */

/* 窄屏组件白名单 + 手机折叠开关 */
function renderMobileWidgetChips(){
  var box=$("#mobileWidgetChips"); if(!box) return;
  var s=state.settings, m=s.widgetsMobile||{};
  var on=WKEYS.filter(function(k){ return s.widgets[k]; });
  if(!on.length){ box.innerHTML='<span class="mw-empty">'+escapeHtml(t("mobileWidgetsNone"))+'</span>'; return; }
  box.innerHTML=on.map(function(k){
    var shown=m[k]!==false;
    return '<button type="button" class="mw-chip'+(shown?" on":"")+'" data-mw="'+k+'" aria-pressed="'+(shown?"true":"false")+'">'+
      escapeHtml(widgetLabel(k))+'</button>';
  }).join("");
}
function widgetLabel(k){
  var map={clock:"clock",search:"webSearch",overview:"overviewTitle",weather:"weather",netinfo:"ipWidget",
           calendar:"calendar",frequent:"frequentlyUsed",recent:"recentlyOpened",notes:"notesTitle",monitor:"monitorTitle"};
  return t(map[k]||k);
}
if($("#mobileWidgetChips")) $("#mobileWidgetChips").addEventListener("click", function(e){
  var c=e.target.closest("[data-mw]"); if(!c) return;
  var k=c.getAttribute("data-mw");
  var m=state.settings.widgetsMobile||(state.settings.widgetsMobile={});
  m[k]=(m[k]===false);                 // false 表示窄屏隐藏
  save(); renderMobileWidgetChips(); renderWidgets();
});
if($("#setMobileCollapse")) $("#setMobileCollapse").addEventListener("change", function(e){
  state.settings.mobileCollapse=e.target.checked;
  if(typeof deviceSet==="function") deviceSet("mobileExpanded", undefined);   // 让新默认立刻生效
  save(); renderWidgets();
});

function updateSnapUsage(){
  var val=$("#snapUsageVal"); if(!val||typeof snapStats!=="function") return;
  snapStats().then(function(st){ val.textContent=t("snapStorageVal",{n:st.count,kb:st.kb}); });
}
if($("#snapExportBtn")) $("#snapExportBtn").addEventListener("click", function(){
  if(typeof snapExportBundle!=="function") return;
  snapExportBundle().then(function(bundle){
    if(!bundle.count){ toast(t("snapNothingToExport"),""); return; }
    var stamp=new Date().toISOString().slice(0,10);
    downloadBlob(JSON.stringify(bundle), "application/json",
      (state.settings.appName||"navi").toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-archives-"+stamp+".json");
    toast(t("snapExported",{n:bundle.count}),"ok");
  });
});
if($("#snapImportBtn")) $("#snapImportBtn").addEventListener("click", function(){ $("#snapInput").click(); });
if($("#snapInput")) $("#snapInput").addEventListener("change", function(e){
  var f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f) return;
  var r=new FileReader();
  r.onload=function(){
    var obj=null; try{ obj=JSON.parse(String(r.result||"")); }catch(err){}
    if(!obj){ toast(t("snapImportBad"),"err"); return; }
    snapImportBundle(obj).then(function(res){
      if(!res){ toast(t("snapImportBad"),"err"); return; }
      updateSnapUsage(); renderContent();
      toast(t("snapImported",{added:res.added,replaced:res.replaced,skipped:res.skipped}),"ok");
    });
  };
  r.onerror=function(){ toast(t("couldntRead"),"err"); };
  r.readAsText(f);
});
if($("#snapClearBtn")) $("#snapClearBtn").addEventListener("click", function(){
  openConfirm(t("snapClear"), t("snapClearMsg"), t("delete"), function(){
    snapClearAll().then(function(){
      refreshSnapKeys().then(function(){ renderContent(); });
      updateSnapUsage(); toast(t("snapCleared"),"ok");
    });
  });
});
$("#customizeWidgets").addEventListener("click", function(){ openSettings("dashboard"); });
$("#brand").addEventListener("click", function(){ openSettings("general"); });
$("#setName").addEventListener("input", function(e){ state.settings.appName=e.target.value; renderBrand(); save(); });
$("#setTag").addEventListener("input", function(e){ state.settings.tagline=e.target.value; renderBrand(); save(); });
$("#motionSeg").addEventListener("click", function(e){ var b=e.target.closest("[data-motion]"); if(!b) return; setMotionMode(b.getAttribute("data-motion")); });
$("#setSeconds").addEventListener("change", function(e){ state.settings.clockSeconds=e.target.checked; save(); startClockTimer(); });
function syncSceneUI(){
  if(typeof ctxCfg!=="function") return;
  var c=ctxCfg();
  var on=$("#setContextual"); if(on) on.checked=!!c.on;
  if($("#setSceneStart")) $("#setSceneStart").value=c.workStart;
  if($("#setSceneEnd")) $("#setSceneEnd").value=c.workEnd;
  $all("[data-subof-scene]").forEach(function(r){ if(c.on) r.removeAttribute("hidden"); else r.setAttribute("hidden",""); });
}
if($("#setContextual")) $("#setContextual").addEventListener("change", function(e){
  ctxCfg().on=e.target.checked; save(); syncSceneUI(); renderContent();
  if(typeof scheduleSceneCheck==="function") scheduleSceneCheck();
});
[["setSceneStart","workStart"],["setSceneEnd","workEnd"]].forEach(function(p){
  var el=$("#"+p[0]); if(!el) return;
  el.addEventListener("change", function(e){
    var v=parseInt(e.target.value,10);
    if(isFinite(v)&&v>=0&&v<=24){ ctxCfg()[p[1]]=v; if(p[1]==="workEnd") ctxCfg().eveStart=v; save(); renderContent(); }
  });
});
$("#setClock24").addEventListener("change", function(e){ state.settings.clock24h=e.target.checked; save(); if(typeof tickClock==="function") tickClock(); });
$("#setHideHeader").addEventListener("change", function(e){ state.settings.hideHeaderOnScroll=e.target.checked; state.settings.hideHeaderOnScrollUserSet=true; save(); if(typeof syncHeaderHidePreference==="function") syncHeaderHidePreference(); });
$("#setHolidays").addEventListener("change", function(e){ state.settings.showHolidays=e.target.checked; save(); refreshCalDom(); });
$all('[data-widget]').forEach(function(cb){ cb.addEventListener("change", function(){ state.settings.widgets[cb.getAttribute("data-widget")]=cb.checked; save(); renderWidgets(); syncWidgetSubRows(); }); });
// 渐进式披露：某组件关闭时，它的子设置项（如「显示秒」依附于时钟）一并隐藏，
// 避免仪表盘页把 14 行开关平铺成一堵墙。
function syncWidgetSubRows(){
  $all(".set-row.sub[data-subof]").forEach(function(row){
    var on=!!(state.settings.widgets||{})[row.getAttribute("data-subof")];
    if(on) row.removeAttribute("hidden"); else row.setAttribute("hidden","");
  });
}
$("#langSeg").addEventListener("click", function(e){ var b=e.target.closest("[data-lang]"); if(!b) return; setLang(b.getAttribute("data-lang")); $all('#langSeg [data-lang]').forEach(function(x){ x.classList.toggle("on", x===b); }); });
$("#catLayoutSeg").addEventListener("click", function(e){ var b=e.target.closest("[data-layout]"); if(!b) return; state.settings.categoryLayout=b.getAttribute("data-layout"); save(); $all('#catLayoutSeg [data-layout]').forEach(function(x){ x.classList.toggle("on", x===b); }); renderCategories(); });
$("#setLogoUpload").addEventListener("click", function(){ $("#logoInput").click(); });
$("#setLogoRemove").addEventListener("click", function(){ state.settings.logo=null; save(); renderBrand(); $("#setLogoPreview").innerHTML=ICONS.bookmark; toast(t("logoReset"),"ok"); });
function applyLogo(data){ state.settings.logo=data; save(); renderBrand(); $("#setLogoPreview").innerHTML='<img src="'+escapeHtml(data)+'" alt=""/>'; toast(t("logoUpdated"),"ok"); }
$("#logoInput").addEventListener("change", function(e){
  var f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f) return;
  if(!/^image\//.test(f.type)){ toast(t("chooseImage"),"err"); return; }
  var reader=new FileReader();
  reader.onload=function(){
    var raw=String(reader.result);
    // GIF（含动图）与 SVG（矢量）保留原始数据 —— 用 canvas 栅格化会丢失动画/清晰度
    if(f.type==="image/gif"||f.type==="image/svg+xml"){
      if(raw.length>2200000){ toast(t("logoTooBig"),"err"); return; }
      applyLogo(raw); return;
    }
    // 其它位图（PNG/JPG/WebP…）缩放到 128px 以内以节省本地存储
    var img=new Image();
    img.onload=function(){
      try{
        var max=128, scale=Math.min(1,max/Math.max(img.width,img.height));
        var w=Math.max(1,Math.round(img.width*scale)), h=Math.max(1,Math.round(img.height*scale));
        var cv=document.createElement("canvas"); cv.width=w; cv.height=h;
        cv.getContext("2d").drawImage(img,0,0,w,h);
        applyLogo(cv.toDataURL("image/png"));
      }catch(err){ applyLogo(raw); }
    };
    img.onerror=function(){ toast(t("couldntImage"),"err"); };
    img.src=raw;
  };
  reader.readAsDataURL(f);
});

function setLang(lang){ if(LANGS.indexOf(lang)===-1) lang="en"; state.settings.lang=lang; save(); applyI18n(); render(); updateSyncUI(); if(typeof syncLogRetentionUI==="function") syncLogRetentionUI(); if(typeof renderOpLog==="function") renderOpLog(); if(typeof pushLangToExt==="function") pushLangToExt(); }

/* 设置页分类切换 */
function validSetTab(tab){
  return ["general","sync","appearance","dashboard","services","log"].indexOf(tab)>-1;
}
function setActiveSetTab(tab){
  tab=validSetTab(tab)?tab:"general";
  $all("#setTabs [data-settab]").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-settab")===tab); });
  $all(".set-tab").forEach(function(p){ p.classList.toggle("on", p.getAttribute("data-tab")===tab); });
  var wrap=$(".set-tab-wrap"); if(wrap) wrap.scrollTop=0;
  if(tab==="log" && typeof renderOpLog==="function") renderOpLog();
  if(tab==="sync" && typeof syncProfileEditor==="function") syncProfileEditor();
}
$("#setTabs").addEventListener("click", function(e){ var b=e.target.closest("[data-settab]"); if(b) setActiveSetTab(b.getAttribute("data-settab")); });

var _settingsScrollGuardReady=false;
function wireSettingsScrollGuard(){
  if(_settingsScrollGuardReady) return; _settingsScrollGuardReady=true;
  var wrap=$(".set-tab-wrap");
  if(wrap && typeof markPowerBusy==="function"){
    wrap.addEventListener("scroll", markPowerBusy, {passive:true});
    wrap.addEventListener("touchmove", markPowerBusy, {passive:true});
  }
}
