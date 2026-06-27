/* settings.js — 设置面板 */
"use strict";

/* ===== settings ===== */
function openSettings(){
  var s=state.settings;
  $("#setName").value=s.appName||"";
  $("#setTag").value=s.tagline||"";
  syncMotionUI();
  $("#setSeconds").checked=!!s.clockSeconds;
  $("#setHolidays").checked=s.showHolidays!==false;
  $("#setLogoPreview").innerHTML=s.logo?'<img src="'+escapeHtml(s.logo)+'" alt=""/>':ICONS.bookmark;
  $all('[data-widget]').forEach(function(cb){ cb.checked=!!s.widgets[cb.getAttribute("data-widget")]; });
  $all('#langSeg [data-lang]').forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-lang")===s.lang); });
  $all('#catLayoutSeg [data-layout]').forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-layout")===s.categoryLayout); });
  $("#setAiKey").value=s.aiKey||"";
  $all('#aiProvSeg [data-aiprov]').forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-aiprov")===(s.aiProvider||"local")); });
  $("#setGlass").checked=s.glass!==false;
  if(typeof syncMonitorUI==="function") syncMonitorUI();
  if(typeof renderOpLog==="function") renderOpLog();
  syncBgUI(); updateSyncUI(); openOverlay("settingsOverlay");
}

/* AI 建议引擎设置 */
$("#aiProvSeg").addEventListener("click", function(e){
  var b=e.target.closest("[data-aiprov]"); if(!b) return;
  state.settings.aiProvider=b.getAttribute("data-aiprov"); save();
  $all('#aiProvSeg [data-aiprov]').forEach(function(x){ x.classList.toggle("on", x===b); });
});
$("#setAiKey").addEventListener("input", function(e){ state.settings.aiKey=e.target.value.trim(); save(); });
$("#settingsBtn").addEventListener("click", openSettings); $("#customizeWidgets").addEventListener("click", openSettings); $("#brand").addEventListener("click", openSettings);
$("#setName").addEventListener("input", function(e){ state.settings.appName=e.target.value; renderBrand(); save(); });
$("#setTag").addEventListener("input", function(e){ state.settings.tagline=e.target.value; renderBrand(); save(); });
$("#motionSeg").addEventListener("click", function(e){ var b=e.target.closest("[data-motion]"); if(!b) return; setMotionMode(b.getAttribute("data-motion")); });
$("#setSeconds").addEventListener("change", function(e){ state.settings.clockSeconds=e.target.checked; save(); startClockTimer(); });
$("#setHolidays").addEventListener("change", function(e){ state.settings.showHolidays=e.target.checked; save(); refreshCalDom(); });
$all('[data-widget]').forEach(function(cb){ cb.addEventListener("change", function(){ state.settings.widgets[cb.getAttribute("data-widget")]=cb.checked; save(); renderWidgets(); }); });
$("#langSeg").addEventListener("click", function(e){ var b=e.target.closest("[data-lang]"); if(!b) return; setLang(b.getAttribute("data-lang")); $all('#langSeg [data-lang]').forEach(function(x){ x.classList.toggle("on", x===b); }); });
$("#catLayoutSeg").addEventListener("click", function(e){ var b=e.target.closest("[data-layout]"); if(!b) return; state.settings.categoryLayout=b.getAttribute("data-layout"); ui.ddOpen=false; save(); $all('#catLayoutSeg [data-layout]').forEach(function(x){ x.classList.toggle("on", x===b); }); renderCategories(); });
$("#setLogoUpload").addEventListener("click", function(){ $("#logoInput").click(); });
$("#setLogoRemove").addEventListener("click", function(){ state.settings.logo=null; save(); renderBrand(); $("#setLogoPreview").innerHTML=ICONS.bookmark; toast(t("logoReset"),"ok"); });
$("#logoInput").addEventListener("change", function(e){ var f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f) return; if(!/^image\//.test(f.type)){ toast(t("chooseImage"),"err"); return; } var reader=new FileReader(); reader.onload=function(){ var img=new Image(); img.onload=function(){ try{ var max=128, scale=Math.min(1,max/Math.max(img.width,img.height)); var w=Math.max(1,Math.round(img.width*scale)), h=Math.max(1,Math.round(img.height*scale)); var cv=document.createElement("canvas"); cv.width=w; cv.height=h; cv.getContext("2d").drawImage(img,0,0,w,h); var data=cv.toDataURL("image/png"); state.settings.logo=data; save(); renderBrand(); $("#setLogoPreview").innerHTML='<img src="'+escapeHtml(data)+'" alt=""/>'; toast(t("logoUpdated"),"ok"); }catch(err){ state.settings.logo=String(reader.result); save(); renderBrand(); $("#setLogoPreview").innerHTML='<img src="'+escapeHtml(String(reader.result))+'" alt=""/>'; toast(t("logoUpdated"),"ok"); } }; img.onerror=function(){ toast(t("couldntImage"),"err"); }; img.src=String(reader.result); }; reader.readAsDataURL(f); });

function setLang(lang){ if(LANGS.indexOf(lang)===-1) lang="en"; state.settings.lang=lang; save(); applyI18n(); render(); updateSyncUI(); if(typeof renderOpLog==="function") renderOpLog(); }

/* 设置页分类切换 */
function setActiveSetTab(tab){
  $all("#setTabs [data-settab]").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-settab")===tab); });
  $all(".set-tab").forEach(function(p){ p.classList.toggle("on", p.getAttribute("data-tab")===tab); });
  var wrap=$(".set-tab-wrap"); if(wrap) wrap.scrollTop=0;
  if(tab==="log" && typeof renderOpLog==="function") renderOpLog();
}
$("#setTabs").addEventListener("click", function(e){ var b=e.target.closest("[data-settab]"); if(b) setActiveSetTab(b.getAttribute("data-settab")); });
