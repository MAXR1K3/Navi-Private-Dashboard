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
$("#viewBtn").addEventListener("click", function(){ state.view=state.view==="grid"?"list":state.view==="list"?"list2":"grid"; save(); renderContent(); $("#viewBtn").innerHTML=viewBtnIcon(); });
$("#langBtn").addEventListener("click", function(){ var i=LANGS.indexOf(state.settings.lang); setLang(LANGS[(i+1)%LANGS.length]); });
$("#search").addEventListener("input", function(e){ ui.query=e.target.value; renderContent(); });
$("#widgetsToggle").addEventListener("click", function(){ state.settings.widgetsCollapsed=!state.settings.widgetsCollapsed; save(); renderWidgets(); });

var moreMenu=$("#moreMenu");
function closeMenu(){ moreMenu.classList.remove("open"); }
$("#moreBtn").addEventListener("click", function(e){ e.stopPropagation(); $("#widgetsToggleLabel").textContent=state.settings.widgetsHidden?t("showWidgets"):t("hideWidgets"); moreMenu.classList.toggle("open"); });
document.addEventListener("click", function(e){ if(clickFullyOutside(e,".menu-wrap")) closeMenu(); });
moreMenu.addEventListener("click", function(e){ var btn=e.target.closest("[data-act]"); if(!btn) return; closeMenu(); var act=btn.getAttribute("data-act"); if(act==="import") openImport(); else if(act==="export") exportBookmarks(); else if(act==="addcat") addCategory(); else if(act==="summaries") summarizeMissingDescriptions(); else if(act==="trash") openTrash(); else if(act==="health") healthCheckAll(); else if(act==="suggest") openSuggest(); else if(act==="widgets"){ state.settings.widgetsHidden=!state.settings.widgetsHidden; save(); renderWidgets(); } else if(act==="clear"){ openConfirm(t("clearTitle"), t("clearMsg"), t("deleteAll"), function(){ state.bookmarks=[]; state.categories=[]; ui.activeCat="All"; ui.selected={}; save(); render(); toast(t("allCleared"),"ok"); }); } });

window.addEventListener("focus", function(){
  if(state.settings.widgetsCollapsed || state.settings.widgetsHidden || !anyWidgetOn()) return;
  if(state.settings.widgets.clock) tickClock();
  if(state.settings.widgets.weather) ensureWeather();
});
