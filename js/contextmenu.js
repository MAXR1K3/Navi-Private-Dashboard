/* contextmenu.js — 统一上下文操作：右键(桌面) / 长按(触屏) 卡片与分类
   桌面弹出贴近指针的小菜单；触屏/窄屏弹出底部动作面板（大点击区），补齐 PWA 上够不着的操作。 */
"use strict";

/* ===== state ===== */
var ctxState={ open:false, sheet:false, view:"main", ctx:null, items:[], title:"", viewTitle:"", anchor:{x:0,y:0}, lastFocus:null };
var ctxSuppressClickUntil=0;
var ctxLongTimer=null, ctxLongStart=null, ctxLongTarget=null, ctxLongKind=null, ctxLongPointer=null;

/* ===== clipboard ===== */
function copyToClipboard(text){
  text=String(text||"");
  if(navigator.clipboard&&navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text).catch(function(){ ctxFallbackCopy(text); });
  }
  ctxFallbackCopy(text);
}
function ctxFallbackCopy(text){
  try{
    var ta=document.createElement("textarea");
    ta.value=text; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.top="-1000px"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
  }catch(e){}
}

/* ===== move a bookmark to another category（带撤销） ===== */
function moveBookmarkTo(id, cat){
  var b=byId(id); if(!b){ return; }
  if(b.category===cat){ return; }
  var old=b.category;
  b.category=cat;
  if(state.categories.indexOf(cat)===-1) state.categories.push(cat);
  save(); render();
  toastUndo(t("ctxMoved",{cat:catLabel(cat)}), function(){
    var bb=byId(id); if(bb){ bb.category=old; save(); render(); }
  });
}

/* ===== dom ===== */
function ctxEnsureDom(){
  if($("#ctxRoot")) return;
  var root=document.createElement("div");
  root.className="ctx-root"; root.id="ctxRoot";
  root.innerHTML='<div class="ctx-backdrop" id="ctxBackdrop"></div><div class="ctx-menu" id="ctxMenu" role="menu" tabindex="-1"></div>';
  document.body.appendChild(root);
  $("#ctxBackdrop").addEventListener("click", closeContextMenu);
  var menu=$("#ctxMenu");
  menu.addEventListener("click", onCtxClick);
  menu.addEventListener("keydown", onCtxKeydown);
}

/* ===== build the item list for the current context + view ===== */
function ctxBuildItems(){
  var c=ctxState.ctx, items=[];
  ctxState.viewTitle="";
  if(!c){ ctxState.items=items; return; }
  if(c.kind==="card"){
    var b=byId(c.id);
    if(!b){ ctxState.items=items; return; }
    if(ctxState.view==="move"){
      ctxState.viewTitle=t("ctxMoveTo");
      items.push({ icon:ICONS.chevL, label:t("back"), back:true, view:"main" });
      var cats=(state.categories||[]).slice();
      if(cats.indexOf("Uncategorized")===-1) cats.push("Uncategorized");
      cats.forEach(function(cat){
        items.push({ icon:ICONS.folder, label:catLabel(cat), on:(cat===b.category), run:function(){ moveBookmarkTo(c.id, cat); } });
      });
    } else {
      var pinned=!!b.pinned;
      items.push({ icon:ICONS.open,  label:t("ctxOpen"),     run:function(){ openBookmark(c.id); } });
      items.push({ icon:ICONS.edit,  label:t("editBookmark"), run:function(){ openEdit(c.id); } });
      items.push({ icon:(pinned?ICONS.pinOff:ICONS.pin), label:(pinned?t("unpin"):t("pinToTop")), run:function(){ toggleBookmarkPinned(c.id); } });
      items.push({ icon:ICONS.folder, label:t("ctxMoveTo"), view:"move" });
      items.push({ icon:ICONS.link,   label:t("ctxCopyLink"), run:function(){ copyToClipboard(b.url); toast(t("ctxLinkCopied"),"ok"); } });
      items.push({ icon:ICONS.trash,  label:t("delete"), danger:true, run:function(){ deleteBookmark(c.id); } });
    }
  } else if(c.kind==="cat" && ctxState.view==="scene"){
    var scat=c.cat, cur=categoryScene(scat);
    ctxState.viewTitle=t("sceneAssign");
    items.push({ icon:ICONS.chevL, label:t("back"), back:true, view:"main" });
    items.push({ icon:ICONS.clock,  label:t("sceneWork"),    on:cur==="work",    run:function(){ setCategoryScene(scat,"work"); } });
    items.push({ icon:ICONS.star,   label:t("sceneLeisure"), on:cur==="leisure", run:function(){ setCategoryScene(scat,"leisure"); } });
    items.push({ icon:ICONS.x,      label:t("sceneNone"),    on:!cur,            run:function(){ setCategoryScene(scat,""); } });
  } else if(c.kind==="cat"){
    var cat=c.cat;
    var catPinned=!!(state.settings.pinnedCategories&&state.settings.pinnedCategories[cat]);
    items.push({ icon:ICONS.layers, label:t("ctxOpenCat"), run:function(){ setActiveCat(cat); } });
    items.push({ icon:ICONS.edit,   label:t("categorySettings"), run:function(){ renameCategory(cat); } });
    items.push({ icon:(catPinned?ICONS.pinOff:ICONS.pin), label:(catPinned?t("unpinCategory"):t("pinCategory")), run:function(){ toggleCategoryPinned(cat); } });
    if(typeof categoryScene==="function")
      items.push({ icon:ICONS.clock, label:t("sceneAssign"), view:"scene" });
    items.push({ icon:ICONS.trash,  label:t("deleteCategory"), danger:true, run:function(){ deleteCategory(cat); } });
  }
  ctxState.items=items;
}

/* ===== render ===== */
function ctxRender(){
  var menu=$("#ctxMenu"); if(!menu) return;
  var html="";
  if(ctxState.sheet){
    html+='<div class="ctx-grip"></div>';
    html+='<div class="ctx-title">'+escapeHtml(ctxState.viewTitle||ctxState.title)+'</div>';
  }
  ctxState.items.forEach(function(it,i){
    var cls="ctx-item"+(it.danger?" danger":"")+(it.on?" on":"")+(it.back?" back":"");
    html+='<button type="button" class="'+cls+'" data-ci="'+i+'" role="menuitem">'+
      '<span class="ctx-ico">'+(it.icon||"")+'</span>'+
      '<span class="ctx-lbl">'+escapeHtml(it.label)+'</span>'+
      (it.on?'<span class="ctx-check">'+ICONS.check+'</span>':'')+
      (it.view&&!it.back?'<span class="ctx-arrow">'+ICONS.chevR+'</span>':'')+
    '</button>';
  });
  if(ctxState.sheet){
    html+='<button type="button" class="ctx-cancel" data-ctx-cancel>'+escapeHtml(t("ctxCancel"))+'</button>';
  }
  menu.innerHTML=html;
  menu.className="ctx-menu"+(ctxState.view==="move"?" view-move":"");
}

/* ===== open / position / close ===== */
function openCardMenu(id, opts){ var b=byId(id); if(!b) return; ctxState.ctx={kind:"card",id:id}; ctxState.view="main"; ctxOpen(opts, b.title||getDomain(b.url)); }
function openCatMenu(cat, opts){ if(!cat||cat==="All") return; ctxState.ctx={kind:"cat",cat:cat}; ctxState.view="main"; ctxOpen(opts, catLabel(cat)); }

function ctxOpen(opts, title){
  ctxEnsureDom();
  opts=opts||{};
  if(typeof closeMenu==="function") closeMenu();
  ctxState.open=true;
  ctxState.title=title||"";
  ctxState.anchor={x:opts.x||0, y:opts.y||0};
  ctxState.lastFocus=document.activeElement;
  var coarse=window.matchMedia&&window.matchMedia("(hover:none)").matches;
  ctxState.sheet=!!opts.sheet||coarse||window.innerWidth<560;
  ctxBuildItems();
  ctxRender();
  var root=$("#ctxRoot");
  root.classList.toggle("sheet", ctxState.sheet);
  root.classList.add("open");
  if(!ctxState.sheet) ctxPosition(ctxState.anchor.x, ctxState.anchor.y);
  setTimeout(function(){ var f=$("#ctxMenu .ctx-item:not(.back)")||$("#ctxMenu .ctx-item"); if(f) f.focus(); }, 20);
}

function ctxPosition(x,y){
  var menu=$("#ctxMenu"); if(!menu) return;
  var r=menu.getBoundingClientRect(), vw=window.innerWidth, vh=window.innerHeight, m=8;
  var left=Math.min(x, vw-r.width-m); left=Math.max(m, left);
  var top=y; if(top+r.height>vh-m) top=Math.max(m, y-r.height); top=Math.max(m, Math.min(top, vh-r.height-m));
  menu.style.left=left+"px"; menu.style.top=top+"px";
}

function closeContextMenu(){
  if(!ctxState.open) return;
  ctxState.open=false; ctxState.view="main";
  var root=$("#ctxRoot"); if(root) root.classList.remove("open");
  if(ctxState.lastFocus&&ctxState.lastFocus.focus&&document.contains(ctxState.lastFocus)){
    try{ ctxState.lastFocus.focus({preventScroll:true}); }catch(e){}
  }
  ctxState.lastFocus=null;
}

/* ===== menu interaction ===== */
function onCtxClick(e){
  if(e.target.closest("[data-ctx-cancel]")){ closeContextMenu(); return; }
  var el=e.target.closest(".ctx-item"); if(!el) return;
  var it=ctxState.items[+el.getAttribute("data-ci")]; if(!it) return;
  if(it.view){
    ctxState.view=it.view; ctxBuildItems(); ctxRender();
    if(!ctxState.sheet) ctxPosition(ctxState.anchor.x, ctxState.anchor.y);
    var f=$("#ctxMenu .ctx-item:not(.back)")||$("#ctxMenu .ctx-item"); if(f) f.focus();
    return;
  }
  var run=it.run; closeContextMenu(); if(run) run();
}
function onCtxKeydown(e){
  var items=$all(".ctx-item", this); if(!items.length) return;
  var i=items.indexOf(document.activeElement);
  if(e.key==="ArrowDown"){ e.preventDefault(); (items[i+1]||items[0]).focus(); }
  else if(e.key==="ArrowUp"){ e.preventDefault(); (items[i-1]||items[items.length-1]).focus(); }
  else if(e.key==="Home"){ e.preventDefault(); items[0].focus(); }
  else if(e.key==="End"){ e.preventDefault(); items[items.length-1].focus(); }
}

/* ===== long-press (touch) ===== */
var CTX_IGNORE=".card-grip,.card-pin,.tag-chip,.card-actions,.cat-grip,.cat-rename,[data-del-cat],[data-rename-cat],[data-addcat],.x,.count,.cnt";
function ctxPointerDown(e){
  if(e.pointerType==="mouse") return;            // 鼠标走右键，不走长按
  if(ctxState.open||ui.selectMode) return;
  if(e.target.closest(CTX_IGNORE)) return;
  var kind=null, target=null;
  var card=e.target.closest(".card");
  if(card){ kind="card"; target=card; }
  else {
    var catEl=e.target.closest("#catsBar [data-cat],#drawer [data-cat]");
    if(catEl){ var cat=catEl.getAttribute("data-cat"); if(cat&&cat!=="All"){ kind="cat"; target=catEl; } }
  }
  if(!target) return;
  ctxLongTarget=target; ctxLongKind=kind; ctxLongPointer=e.pointerId; ctxLongStart={x:e.clientX,y:e.clientY};
  clearTimeout(ctxLongTimer);
  ctxLongTimer=setTimeout(function(){
    ctxLongTimer=null;
    if(!ctxLongTarget) return;
    var tgt=ctxLongTarget, k=ctxLongKind, x=ctxLongStart.x, y=ctxLongStart.y;
    ctxLongTarget=null;
    ctxSuppressClickUntil=Date.now()+700;       // 吞掉长按后尾随的 click，避免顺带打开书签
    if(navigator.vibrate){ try{ navigator.vibrate(12); }catch(_){ } }
    if(k==="card") openCardMenu(tgt.getAttribute("data-id"), {x:x,y:y,sheet:true});
    else openCatMenu(tgt.getAttribute("data-cat"), {x:x,y:y,sheet:true});
  }, 470);
}
function ctxPointerMove(e){
  if(!ctxLongTimer||e.pointerId!==ctxLongPointer) return;
  if(Math.hypot(e.clientX-ctxLongStart.x, e.clientY-ctxLongStart.y)>10) ctxCancelLong();
}
function ctxCancelLong(){ if(ctxLongTimer){ clearTimeout(ctxLongTimer); ctxLongTimer=null; } ctxLongTarget=null; }

/* ===== wiring ===== */
(function wireCtx(){
  if(typeof contentEl!=="undefined"&&contentEl){
    contentEl.addEventListener("contextmenu", function(e){
      var card=e.target.closest(".card"); if(!card||ui.selectMode) return;
      e.preventDefault(); openCardMenu(card.getAttribute("data-id"), {x:e.clientX,y:e.clientY});
    });
  }
  ["catsBar","drawer"].forEach(function(cid){
    var el=$("#"+cid); if(!el) return;
    el.addEventListener("contextmenu", function(e){
      var it=e.target.closest("[data-cat]"); if(!it) return;
      var cat=it.getAttribute("data-cat"); if(cat==="All") return;
      e.preventDefault(); openCatMenu(cat, {x:e.clientX,y:e.clientY});
    });
  });
  document.addEventListener("pointerdown", ctxPointerDown, true);
  document.addEventListener("pointermove", ctxPointerMove, true);
  document.addEventListener("pointerup", ctxCancelLong, true);
  document.addEventListener("pointercancel", ctxCancelLong, true);
  window.addEventListener("scroll", ctxCancelLong, true);
  document.addEventListener("click", function(e){ if(Date.now()<ctxSuppressClickUntil){ e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener("keydown", function(e){ if(e.key==="Escape"&&ctxState.open){ e.preventDefault(); e.stopPropagation(); closeContextMenu(); } }, true);
})();
