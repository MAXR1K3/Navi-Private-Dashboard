/* action-menus.js — 视图选择器与更多操作面板 */
"use strict";

/* ===== card view selector ===== */
var viewBtn=$("#viewBtn"), viewMenu=$("#viewMenu");
function closeViewMenu(restoreFocus){
  if(!viewMenu) return;
  viewMenu.classList.remove("open"); viewBtn.setAttribute("aria-expanded","false");
  if(restoreFocus) viewBtn.focus();
}
function openViewMenu(){
  if(!viewMenu) return;
  closeMenu(); syncViewMenu(); viewMenu.classList.add("open"); viewBtn.setAttribute("aria-expanded","true");
  var selected=$("[aria-checked='true']",viewMenu); if(selected) selected.focus();
}
function setCardView(view){
  state.view=normalizeCardView(view); save(); renderContent(); syncViewButton(); closeViewMenu(true);
}
viewBtn.addEventListener("click", function(e){
  e.stopPropagation();
  if(viewMenu.classList.contains("open")) closeViewMenu(false); else openViewMenu();
});
viewBtn.addEventListener("keydown", function(e){
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); openViewMenu(); }
});
viewMenu.addEventListener("click", function(e){ var option=e.target.closest("[data-view]"); if(option) setCardView(option.getAttribute("data-view")); });
viewMenu.addEventListener("keydown", function(e){
  var options=$all("[data-view]",viewMenu), current=e.target.closest("[data-view]"), i=options.indexOf(current), next=null;
  if(e.key==="Escape"){ e.preventDefault(); closeViewMenu(true); return; }
  if(e.key==="Tab"){ closeViewMenu(false); return; }
  if(e.key==="Home") next=options[0];
  else if(e.key==="End") next=options[options.length-1];
  else if(e.key==="ArrowDown"||e.key==="ArrowRight") next=options[(i+1+options.length)%options.length];
  else if(e.key==="ArrowUp"||e.key==="ArrowLeft") next=options[(i-1+options.length)%options.length];
  else if((e.key==="Enter"||e.key===" ")&&current){ e.preventDefault(); setCardView(current.getAttribute("data-view")); return; }
  if(next){ e.preventDefault(); options.forEach(function(option){ option.setAttribute("tabindex",option===next?"0":"-1"); }); next.focus(); }
});

/* ===== grouped more-actions menu / mobile sheet ===== */
function moreMenuGroup(action){
  if(action==="import"||action==="export") return "transfer";
  if(action==="summaries"||action==="suggest") return "ai";
  if(["widgets","addcat","health","healthIssues","cleanup","trash"].indexOf(action)>-1) return "maintenance";
  return action==="clear"?"danger":"";
}
var moreMenu=$("#moreMenu"), moreBackdrop=$("#moreBackdrop"), moreBtn=$("#moreBtn");
function visibleMoreItems(){ return $all("[data-act]",moreMenu).filter(function(item){ return item.offsetParent!==null; }); }
function closeMenu(restoreFocus){
  moreMenu.classList.remove("open"); moreBackdrop.classList.remove("open"); moreBtn.setAttribute("aria-expanded","false"); document.body.classList.remove("more-sheet-open");
  if(restoreFocus) moreBtn.focus();
}
function openMenu(){
  closeViewMenu(false); $("#widgetsToggleLabel").textContent=state.settings.widgetsHidden?t("showWidgets"):t("hideWidgets");
  moreMenu.classList.add("open"); moreBackdrop.classList.add("open"); moreBtn.setAttribute("aria-expanded","true"); document.body.classList.add("more-sheet-open");
  var first=visibleMoreItems()[0]; if(first) first.focus();
}
moreBtn.addEventListener("click", function(e){ e.stopPropagation(); if(moreMenu.classList.contains("open")) closeMenu(false); else openMenu(); });
moreBackdrop.addEventListener("click", function(){ closeMenu(true); });
document.addEventListener("click", function(e){ if(clickFullyOutside(e,".more-picker")) closeMenu(); if(clickFullyOutside(e,".view-picker")) closeViewMenu(false); });
moreMenu.addEventListener("click", function(e){
  if(e.target.closest("[data-menu-close]")){ closeMenu(true); return; }
  var btn=e.target.closest("[data-act]"); if(!btn) return; closeMenu(true); var act=btn.getAttribute("data-act"); if(act==="import") openImport(); else if(act==="export") exportBookmarks(); else if(act==="addcat") addCategory(); else if(act==="summaries") summarizeMissingDescriptions(); else if(act==="trash") openTrash(); else if(act==="cleanup") openCleanup(); else if(act==="health") healthCheckAll(); else if(act==="healthIssues") openHealthIssues(); else if(act==="suggest") openSuggest(); else if(act==="widgets"){ state.settings.widgetsHidden=!state.settings.widgetsHidden; save(); renderWidgets(); } else if(act==="clear"){ openConfirm(t("clearTitle"), t("clearMsg"), t("deleteAll"), function(){ state.bookmarks=[]; state.categories=[]; ui.activeCat="All"; ui.selected={}; save(); render(); toast(t("allCleared"),"ok"); }); }
});
moreMenu.addEventListener("keydown", function(e){
  if(e.key==="Escape"){ e.preventDefault(); closeMenu(true); return; }
  if(e.key==="Tab"){ closeMenu(false); return; }
  var items=visibleMoreItems(), i=items.indexOf(document.activeElement), next=null;
  if(e.key==="Home") next=items[0]; else if(e.key==="End") next=items[items.length-1];
  else if(e.key==="ArrowDown"||e.key==="ArrowRight") next=items[(i+1+items.length)%items.length];
  else if(e.key==="ArrowUp"||e.key==="ArrowLeft") next=items[(i-1+items.length)%items.length];
  if(next){ e.preventDefault(); next.focus(); }
});
