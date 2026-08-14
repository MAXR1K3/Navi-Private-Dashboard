/* categories.js — 分类管理 + 内容区交互 + 多选模式 */
"use strict";

/* ===== categories mgmt ===== */
function addCategory(){ openPrompt(t("newCategory"),"",function(v){ v=uniqueCatName(v); if(!v){ toast(t("categoryInvalid"),"err"); return; } state.categories.push(v); save(); setActiveCat(v); }); }
function toggleCategoryPinned(cat){
  if(!cat||cat==="All") return;
  if(!state.settings.pinnedCategories) state.settings.pinnedCategories={};
  if(state.settings.pinnedCategories[cat]) delete state.settings.pinnedCategories[cat];
  else state.settings.pinnedCategories[cat]=true;
  save(); renderCategories();
}
function toggleBookmarkPinned(id){
  var b=byId(id); if(!b) return;
  b.pinned=!b.pinned;
  save(); renderContent();
}
function validCategoryColor(v){
  v=String(v||"").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : "";
}
function renameCategory(cat){
  openPrompt(t("categorySettings"), cat, function(v,pinned,color){
    v=uniqueCatName(v,cat); if(!v) return;
    if(!state.settings.pinnedCategories) state.settings.pinnedCategories={};
    if(!state.settings.categoryColors) state.settings.categoryColors={};
    var renamed=v!==cat, i=state.categories.indexOf(cat);
    if(renamed){
      if(i>-1) state.categories[i]=v;
      state.bookmarks.forEach(function(b){ if(b.category===cat) b.category=v; });
      if(ui.activeCat===cat) ui.activeCat=v;
      delete state.settings.pinnedCategories[cat];
      delete state.settings.categoryColors[cat];
    }
    if(pinned) state.settings.pinnedCategories[v]=true;
    else delete state.settings.pinnedCategories[v];
    color=validCategoryColor(color);
    if(color) state.settings.categoryColors[v]=color;
    else delete state.settings.categoryColors[v];
    save(); render(); toast(renamed?t("categoryRenamed"):t("categorySettingsSaved"),"ok");
  }, {
    pin:true,
    pinChecked:isCatPinned(cat),
    pinTitle:t("pinCategory"),
    pinDesc:t("pinCategoryDesc"),
    color:true,
    colorValue:(state.settings.categoryColors&&state.settings.categoryColors[cat])||"",
    colorTitle:t("categoryColor"),
    colorDesc:t("categoryColorDesc")
  });
}
// 删除分类（书签移入 Uncategorized）—— 完成后提供撤销入口
function deleteCategory(cat){
  if(!cat||cat==="All") return;
  var n=state.bookmarks.filter(function(b){return b.category===cat;}).length;
  var msg=n?t("delCatMove",{n:n}):t("delCatEmpty");
  openConfirm(t("deleteCategory"), msg, t("delete"), function(){
    var idx=state.categories.indexOf(cat), prevActive=ui.activeCat, movedIds=[], wasPinned=!!(state.settings.pinnedCategories&&state.settings.pinnedCategories[cat]);
    var oldColor=state.settings.categoryColors&&state.settings.categoryColors[cat];
    state.categories=state.categories.filter(function(c){return c!==cat;});
    if(state.settings.pinnedCategories) delete state.settings.pinnedCategories[cat];
    if(state.settings.categoryColors) delete state.settings.categoryColors[cat];
    state.bookmarks.forEach(function(b){ if(b.category===cat){ movedIds.push(b.id); b.category="Uncategorized"; } });
    var addedUncat=false;
    if(movedIds.length&&state.categories.indexOf("Uncategorized")===-1){ state.categories.push("Uncategorized"); addedUncat=true; }
    if(ui.activeCat===cat) ui.activeCat="All";
    closeDrawerOverlay(); save(); render();
    toastUndo(t("categoryDeleted"), function(){
      if(state.categories.indexOf(cat)===-1) state.categories.splice(Math.max(0,Math.min(idx,state.categories.length)),0,cat);
      if(wasPinned){ if(!state.settings.pinnedCategories) state.settings.pinnedCategories={}; state.settings.pinnedCategories[cat]=true; }
      if(oldColor){ if(!state.settings.categoryColors) state.settings.categoryColors={}; state.settings.categoryColors[cat]=oldColor; }
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
  if(e.target.closest("#gridMore")){ gridLoadMore(); return; }
  if(e.target.closest(".card-grip")){ e.stopPropagation(); return; }
  var tag=e.target.closest("[data-tag]"); if(tag){ e.stopPropagation(); setTagFilter(tag.getAttribute("data-tag")); return; }
  var pin=e.target.closest("[data-pin]"); if(pin){ e.stopPropagation(); toggleBookmarkPinned(pin.getAttribute("data-pin")); return; }
  var edit=e.target.closest("[data-edit]"); if(edit){ e.stopPropagation(); openEdit(edit.getAttribute("data-edit")); return; }
  var del=e.target.closest("[data-del]"); if(del){ e.stopPropagation(); deleteBookmark(del.getAttribute("data-del")); return; }
  var card=e.target.closest(".card"); if(!card) return; var id=card.getAttribute("data-id");
  if(ui.selectMode){ toggleSelect(id); return; }
  if(e.metaKey||e.ctrlKey){ openBookmark(id,{background:true}); return; }   // ⌘/Ctrl 点击：后台新标签页
  openBookmark(id);
});
// 中键点击卡片：在后台新标签页打开（可连开多个而不离开面板）
contentEl.addEventListener("auxclick", function(e){
  if(e.button!==1) return;
  var card=e.target.closest(".card"); if(!card||ui.selectMode) return;
  if(e.target.closest(".card-pin,.tag-chip,.card-actions,.card-grip")) return;
  e.preventDefault(); openBookmark(card.getAttribute("data-id"),{background:true});
});
// 阻止中键在卡片上触发浏览器自动滚动
contentEl.addEventListener("mousedown", function(e){
  if(e.button===1){ var c=e.target.closest(".card"); if(c && !ui.selectMode && !e.target.closest(".card-pin,.tag-chip,.card-actions,.card-grip")) e.preventDefault(); }
});
contentEl.addEventListener("error", function(e){ var tg=e.target; if(tg&&tg.classList&&tg.classList.contains("fav-img")) tg.classList.add("hide"); }, true);
// 键盘可达：聚焦卡片后 Enter/Space 打开（多选模式则切换勾选），方向键在网格内移动焦点
contentEl.addEventListener("keydown", function(e){
  if(e.target.id==="gridMore" && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); gridLoadMore(); return; }
  var card=e.target.closest(".card"); if(!card||e.target!==card) return; // 仅在卡片本体聚焦时响应，避免与编辑/删除按钮冲突
  var id=card.getAttribute("data-id");
  if(e.key==="Enter"||e.key===" "){
    e.preventDefault();
    if(ui.selectMode) toggleSelect(id); else openBookmark(id);
  } else if(e.key.indexOf("Arrow")===0){
    e.preventDefault(); focusAdjacentCard(card, e.key);
  }
});
function focusAdjacentCard(cur, key){
  if(!gridEl) return;
  var cards=$all(".card",gridEl); if(cards.length<2) return;
  var cr=cur.getBoundingClientRect(), cx=cr.left+cr.width/2, cy=cr.top+cr.height/2;
  var best=null, bestScore=Infinity;
  cards.forEach(function(c){
    if(c===cur) return;
    var r=c.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2, dx=x-cx, dy=y-cy, ok=false, primary=0, cross=0;
    if(key==="ArrowRight"){ ok=dx>4; primary=dx; cross=Math.abs(dy); }
    else if(key==="ArrowLeft"){ ok=dx<-4; primary=-dx; cross=Math.abs(dy); }
    else if(key==="ArrowDown"){ ok=dy>4; primary=dy; cross=Math.abs(dx); }
    else { ok=dy<-4; primary=-dy; cross=Math.abs(dx); }
    if(!ok) return;
    var score=primary+cross*2; // 同行/同列优先
    if(score<bestScore){ bestScore=score; best=c; }
  });
  if(best) best.focus();
}

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
