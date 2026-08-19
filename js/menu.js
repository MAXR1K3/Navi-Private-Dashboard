/* menu.js — 头部菜单与按钮 */
"use strict";

/* ===== header / menu ===== */
$("#addBtn").addEventListener("click", openAdd);
$("#importBtn").addEventListener("click", openImport);
$("#themeBtn").addEventListener("click", function(){
  // Cycle: light → dark → auto → light
  state.theme = state.theme==="light"?"dark":state.theme==="dark"?"auto":"light";
  save(); render();
  if(state.theme==="auto"&&typeof scheduleAutoTheme==="function"){ scheduleAutoTheme(); requestAutoThemeGeo(); }
  else if(typeof _autoThemeTimer!=="undefined"&&_autoThemeTimer){ clearTimeout(_autoThemeTimer); _autoThemeTimer=null; }
});
$("#viewBtn").addEventListener("click", function(){ state.view=state.view==="grid"?"list":"grid"; save(); renderContent(); $("#viewBtn").innerHTML=viewBtnIcon(); });
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

var moreMenu=$("#moreMenu");
function closeMenu(){ moreMenu.classList.remove("open"); }
$("#moreBtn").addEventListener("click", function(e){ e.stopPropagation(); $("#widgetsToggleLabel").textContent=state.settings.widgetsHidden?t("showWidgets"):t("hideWidgets"); moreMenu.classList.toggle("open"); });
document.addEventListener("click", function(e){ if(clickFullyOutside(e,".menu-wrap")) closeMenu(); });
moreMenu.addEventListener("click", function(e){ var btn=e.target.closest("[data-act]"); if(!btn) return; closeMenu(); var act=btn.getAttribute("data-act"); if(act==="import") openImport(); else if(act==="export") exportBookmarks(); else if(act==="addcat") addCategory(); else if(act==="summaries") summarizeMissingDescriptions(); else if(act==="trash") openTrash(); else if(act==="cleanup") openCleanup(); else if(act==="health") healthCheckAll(); else if(act==="healthIssues") openHealthIssues(); else if(act==="suggest") openSuggest(); else if(act==="widgets"){ state.settings.widgetsHidden=!state.settings.widgetsHidden; save(); renderWidgets(); } else if(act==="clear"){ openConfirm(t("clearTitle"), t("clearMsg"), t("deleteAll"), function(){ state.bookmarks=[]; state.categories=[]; ui.activeCat="All"; ui.selected={}; save(); render(); toast(t("allCleared"),"ok"); }); } });

window.addEventListener("focus", function(){
  if(state.settings.widgetsCollapsed || state.settings.widgetsHidden || !anyWidgetOn()) return;
  if(state.settings.widgets.clock) tickClock();
  if(state.settings.widgets.weather) ensureWeather();
});
