/* categories.js — 分类管理 + 内容区交互 + 多选模式 */
"use strict";

/* ===== categories mgmt ===== */
function addCategory(){ openPrompt(t("newCategory"),"",function(v){ v=uniqueCatName(v); if(!v){ toast(t("categoryInvalid"),"err"); return; } state.categories.push(v); save(); setActiveCat(v); }); }
function renameCategory(cat){ openPrompt(t("renameCat",{cat:catLabel(cat)}), cat, function(v){ v=uniqueCatName(v,cat); if(!v||v===cat) return; var i=state.categories.indexOf(cat); if(i>-1) state.categories[i]=v; state.bookmarks.forEach(function(b){ if(b.category===cat) b.category=v; }); if(ui.activeCat===cat) ui.activeCat=v; save(); render(); toast(t("categoryRenamed"),"ok"); }); }
// 删除分类（书签移入 Uncategorized）—— 完成后提供撤销入口
function deleteCategory(cat){
  if(!cat||cat==="All") return;
  var n=state.bookmarks.filter(function(b){return b.category===cat;}).length;
  var msg=n?t("delCatMove",{n:n}):t("delCatEmpty");
  openConfirm(t("deleteCategory"), msg, t("delete"), function(){
    var idx=state.categories.indexOf(cat), prevActive=ui.activeCat, movedIds=[];
    state.categories=state.categories.filter(function(c){return c!==cat;});
    state.bookmarks.forEach(function(b){ if(b.category===cat){ movedIds.push(b.id); b.category="Uncategorized"; } });
    var addedUncat=false;
    if(movedIds.length&&state.categories.indexOf("Uncategorized")===-1){ state.categories.push("Uncategorized"); addedUncat=true; }
    if(ui.activeCat===cat) ui.activeCat="All";
    closeDrawerOverlay(); save(); render();
    toastUndo(t("categoryDeleted"), function(){
      if(state.categories.indexOf(cat)===-1) state.categories.splice(Math.max(0,Math.min(idx,state.categories.length)),0,cat);
      if(addedUncat&&!state.bookmarks.some(function(b){ return b.category==="Uncategorized"&&movedIds.indexOf(b.id)===-1; }))
        state.categories=state.categories.filter(function(c){ return c!=="Uncategorized"; });
      var set={}; movedIds.forEach(function(id){ set[id]=true; });
      state.bookmarks.forEach(function(b){ if(set[b.id]) b.category=cat; });
      ui.activeCat=prevActive; save(); render();
    });
  });
}

/* ===== content interactions ===== */
contentEl.addEventListener("click", function(e){
  if(e.target.closest("[data-empty-add]")){ openAdd(); return; }
  if(e.target.closest("[data-empty-import]")){ openImport(); return; }
  if(e.target.closest(".card-grip")){ e.stopPropagation(); return; }
  var edit=e.target.closest("[data-edit]"); if(edit){ e.stopPropagation(); openEdit(edit.getAttribute("data-edit")); return; }
  var del=e.target.closest("[data-del]"); if(del){ e.stopPropagation(); deleteBookmark(del.getAttribute("data-del")); return; }
  var card=e.target.closest(".card"); if(!card) return; var id=card.getAttribute("data-id");
  if(ui.selectMode){ toggleSelect(id); return; } openBookmark(id);
});
contentEl.addEventListener("error", function(e){ var tg=e.target; if(tg&&tg.classList&&tg.classList.contains("fav-img")) tg.classList.add("hide"); }, true);

/* ===== selection ===== */
function setSelectMode(on){ ui.selectMode=on; document.body.classList.toggle("select-mode",on); $("#selectBtn").classList.toggle("active",on); if(!on){ ui.selected={}; } renderContent(); syncSelectionUI(); }
function toggleSelect(id){ if(ui.selected[id]) delete ui.selected[id]; else ui.selected[id]=true; var card=gridEl&&gridEl.querySelector('.card[data-id="'+cssEscape(id)+'"]'); if(card) card.classList.toggle("selected",!!ui.selected[id]); syncSelectionUI(); }
function selectedIds(){ return Object.keys(ui.selected); }
function syncSelectionUI(){ var n=selectedIds().length; $("#selCount").textContent=n; $("#selbar").classList.toggle("show",ui.selectMode); $("#selDelete").disabled=n===0; $("#selDelete").style.opacity=n===0?.5:1; }
$("#selectBtn").addEventListener("click", function(){ setSelectMode(!ui.selectMode); });
$("#selDone").addEventListener("click", function(){ setSelectMode(false); });
$("#selNone").addEventListener("click", function(){ ui.selected={}; if(gridEl) gridEl.querySelectorAll(".card.selected").forEach(function(c){ c.classList.remove("selected"); }); syncSelectionUI(); });
$("#selAll").addEventListener("click", function(){ visibleBookmarks().forEach(function(b){ ui.selected[b.id]=true; }); if(gridEl) gridEl.querySelectorAll(".card").forEach(function(c){ c.classList.add("selected"); }); syncSelectionUI(); });
// 批量删除 = 软删除入回收站 + 撤销入口
$("#selDelete").addEventListener("click", function(){
  var ids=selectedIds(); if(!ids.length) return;
  var undo=moveToTrash(ids);
  ui.selected={}; render(); syncSelectionUI();
  toastUndo(t("movedNToTrash",{n:ids.length}), function(){ undo(); syncSelectionUI(); });
});
