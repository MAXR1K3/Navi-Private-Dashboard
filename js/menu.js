/* menu.js — 头部主操作、搜索与小组件开关 */
"use strict";

/* ===== header controls ===== */
$("#addBtn").addEventListener("click", openAdd);
$("#importBtn").addEventListener("click", openImport);
$("#themeBtn").addEventListener("click", function(){
  // Cycle: light → dark → auto → light
  state.theme = state.theme==="light"?"dark":state.theme==="dark"?"auto":"light";
  save(); render();
  if(state.theme==="auto"&&typeof scheduleAutoTheme==="function"){ scheduleAutoTheme(); requestAutoThemeGeo(); }
  else if(typeof _autoThemeTimer!=="undefined"&&_autoThemeTimer){ clearTimeout(_autoThemeTimer); _autoThemeTimer=null; }
});
$("#langBtn").addEventListener("click", function(){ var i=LANGS.indexOf(state.settings.lang); setLang(LANGS[(i+1)%LANGS.length]); });
$("#search").addEventListener("input", function(e){ ui.query=e.target.value; renderContent(); });
// 回车直达：有结果则打开第一个，无结果但有输入则用当前引擎在网页搜索；↓ 进入卡片网格；Esc 清空
$("#search").addEventListener("keydown", function(e){
  if(e.key==="Enter"){
    var q=ui.query.trim(); if(!q) return;
    var list=visibleBookmarks();
    if(list.length){ openBookmark(list[0].id); }
    else if(typeof runWebSearch==="function"){ runWebSearch(q); }
  } else if(e.key==="ArrowDown"){
    var first=gridEl&&gridEl.querySelector(".card");
    if(first){ e.preventDefault(); first.focus(); }
  } else if(e.key==="Escape"){
    if(ui.query){ e.preventDefault(); e.stopPropagation(); this.value=""; ui.query=""; renderContent(); }
  }
});
$("#widgetsToggle").addEventListener("click", function(){
  // 窄屏下用户的展开/折叠只记在这台设备，不写进会同步的 settings
  if(typeof isNarrowScreen==="function" && isNarrowScreen()){
    var nowCollapsed=widgetsCollapsedNow();
    deviceSet("mobileExpanded", nowCollapsed);
    if(nowCollapsed){ renderWidgets(); return; }
    animateWidgetsCollapse(); return;
  }
  if(state.settings.widgetsCollapsed){ state.settings.widgetsCollapsed=false; save(); renderWidgets(); return; }
  animateWidgetsCollapse();
});
function animateWidgetsCollapse(){
  var el=widgetsEl, head=$("#widgetsHead");
  if(!el || !el.children.length || document.body.classList.contains("low-power")){
    state.settings.widgetsCollapsed=true; save(); renderWidgets(); return;
  }
  if(head) head.classList.add("collapsed"); // 立即旋转箭头
  el.style.maxHeight=el.scrollHeight+"px"; el.classList.add("collapsing");
  void el.offsetHeight; // 强制回流，确保从当前高度起算
  el.style.maxHeight="0px"; el.style.opacity="0";
  setTimeout(function(){
    el.classList.remove("collapsing"); el.style.maxHeight=""; el.style.opacity="";
    state.settings.widgetsCollapsed=true; save(); renderWidgets();
  }, 340);
}

window.addEventListener("focus", function(){
  if(state.settings.widgetsCollapsed || state.settings.widgetsHidden || !anyWidgetOn()) return;
  if(state.settings.widgets.clock) tickClock();
  if(state.settings.widgets.weather) ensureWeather();
});
