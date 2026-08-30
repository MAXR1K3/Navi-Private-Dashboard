/* render.js — 主渲染：分类、卡片网格、空状态 */
"use strict";

/* ===== render ===== */
var contentEl=$("#content"), widgetsEl=$("#widgets"), gridEl=null, _gridRendered=false;
// 大列表分块渲染：先渲染前 RENDER_BASE 张，滚动到底再追加，避免上千书签一次性入 DOM
var RENDER_BASE=160, RENDER_STEP=120, _renderLimit=160, _lastViewKey="", _gridMoreObserver=null;

function counts(){ var m={All:state.bookmarks.length}; state.categories.forEach(function(c){ m[c]=0; }); state.bookmarks.forEach(function(b){ m[b.category]=(m[b.category]||0)+1; }); return m; }
function catLabel(c){ return c==="Uncategorized"? t("uncategorized") : c; }

function nextCardView(view){ return view==="grid"?"list":view==="list"?"compact":"grid"; }
function cardViewClass(view){ return view==="list"?" list2":view==="compact"?" compact":""; }
function cardViewLabel(view){ return t(view==="list"?"viewList":view==="compact"?"viewCompact":"viewGrid"); }
function viewBtnLabel(view){ return t("switchView",{view:cardViewLabel(nextCardView(view===undefined?state.view:view))}); }
function viewBtnIcon(){ var next=nextCardView(state.view); return next==="list"?ICONS.list2:next==="compact"?ICONS.compact:ICONS.grid; }
function syncViewButton(){
  var btn=$("#viewBtn"), label=viewBtnLabel();
  if(!btn) return;
  btn.innerHTML=viewBtnIcon(); btn.title=label; btn.setAttribute("aria-label",label);
}
function pinnedCats(){ if(!state.settings.pinnedCategories) state.settings.pinnedCategories={}; return state.settings.pinnedCategories; }
function isCatPinned(cat){ return !!pinnedCats()[cat]; }
function categoryColor(cat){
  var c=state.settings.categoryColors&&state.settings.categoryColors[cat];
  return /^#[0-9a-fA-F]{6}$/.test(String(c||"")) ? String(c).toLowerCase() : "";
}
function categoryColorStyle(cat){
  var c=categoryColor(cat);
  return c ? ' style="color:'+c+'"' : "";
}
function themeBtnIcon(){
  if(state.theme==="auto") return ICONS.autoTheme;
  return state.theme==="dark"?ICONS.sun:ICONS.moon;
}
function render(){
  var effectiveTheme = (state.theme==="auto" && typeof resolveTheme==="function") ? resolveTheme() : state.theme;
  document.documentElement.setAttribute("data-theme", effectiveTheme==="auto"?"light":effectiveTheme);
  $("#themeBtn").innerHTML = themeBtnIcon();
  syncViewButton();
  // Fallback dropdown -> tabs (dropdown option removed)
  if(state.settings.categoryLayout==="dropdown"){ state.settings.categoryLayout="tabs"; save(); }
  // Sync auto-theme checkbox in settings panel
  var atChk=document.getElementById("setAutoTheme"); if(atChk) atChk.checked=(state.theme==="auto");
  applyPerformanceMode(); applyGlass(); applyBackground(); applyAnim(); renderBrand(); renderWidgets(); renderCategories(); renderContent();
}

/* ----- categories (tabs / drawer / dropdown) ----- */
function renderCategories(){
  var mode=state.settings.categoryLayout, layout=$("#layout"), drawer=$("#drawer"), bar=$("#catsBar");
  layout.classList.toggle("drawer-mode", mode==="drawer");
  var c=counts();
  if(mode==="drawer"){
    drawer.style.display="";
    var dtLabel=ui.activeCat==="All"?t("categoriesTitle"):catLabel(ui.activeCat);
    bar.innerHTML='<button class="drawer-toggle" id="drawerToggle" title="'+escapeHtml(dtLabel)+'">'+ICONS.layers+'<span class="dt-label"'+categoryColorStyle(ui.activeCat)+'>'+escapeHtml(dtLabel)+'</span></button>';
    drawer.innerHTML=drawerInner(c);
  } else {
    closeDrawerOverlay(); drawer.style.display="none";
    bar.innerHTML='<div class="tabs" id="tabs">'+tabsInner(c)+'</div>';
  }
}
function tabsInner(c){
  var html=tabHtml("All", c.All, ui.activeCat==="All", false);
  state.categories.forEach(function(cat){ html+=tabHtml(cat, c[cat]||0, ui.activeCat===cat, true); });
  html+='<div class="tab add" data-addcat="1" tabindex="0" role="button" title="'+escapeHtml(t("newCategory"))+'">'+ICONS.plus+'<span>'+escapeHtml(t("newCategory"))+'</span></div>';
  return html;
}
function tabHtml(cat,n,active,removable){
  return '<div class="tab'+(active?" active":"")+'" data-cat="'+escapeHtml(cat)+'" tabindex="0" role="tab" aria-selected="'+(active?"true":"false")+'" title="'+escapeHtml(catLabel(cat))+(removable?" — "+t("renameCat",{cat:catLabel(cat)}):"")+'">'+
    (removable?'<span class="cat-grip" data-cat-grip title="'+escapeHtml(t("dragReorder"))+'">'+ICONS.grip+'</span>':'')+
    '<span class="lbl"'+categoryColorStyle(cat)+'>'+escapeHtml(cat==="All"?allLabel():catLabel(cat))+'</span>'+
    '<span class="count">'+n+'</span>'+
    (removable?'<span class="cat-rename" data-rename-cat="'+escapeHtml(cat)+'" title="'+escapeHtml(t("renameCat",{cat:catLabel(cat)}))+'">'+ICONS.edit+'</span>':'')+
    (removable?'<span class="x" data-del-cat="'+escapeHtml(cat)+'" title="'+escapeHtml(t("deleteCategory"))+'">'+ICONS.x+'</span>':'')+
  '</div>';
}
function allLabel(){ var l=state.settings.lang; return l==="zh"?"全部":l==="es"?"Todos":"All"; }

function drawerInner(c){
  var h='<div class="drawer-inner"><div class="dh">'+escapeHtml(t("categoriesTitle"))+'</div>';
  h+=drawerItem("All", c.All, ui.activeCat==="All", false);
  state.categories.forEach(function(cat){ h+=drawerItem(cat, c[cat]||0, ui.activeCat===cat, true); });
  h+='<div class="drawer-item add" data-addcat="1">'+ICONS.plus+' '+escapeHtml(t("newCategory"))+'</div></div>';
  return h;
}
function drawerItem(cat,n,active,removable){
  var nm=cat==="All"?allLabel():catLabel(cat);
  return '<div class="drawer-item'+(active?" active":"")+'" data-cat="'+escapeHtml(cat)+'" title="'+escapeHtml(nm)+'">'+
    (removable?'<span class="cat-grip" data-cat-grip title="'+escapeHtml(t("dragReorder"))+'">'+ICONS.grip+'</span>':'<span class="cat-grip ghost"></span>')+
    '<div class="left">'+(cat==="All"?ICONS.layers:ICONS.folder)+'<span class="nm"'+categoryColorStyle(cat)+'>'+escapeHtml(nm)+'</span></div>'+
    '<span class="cnt">'+n+'</span>'+
    (removable?'<span class="cat-rename" data-rename-cat="'+escapeHtml(cat)+'" title="'+escapeHtml(t("renameCat",{cat:catLabel(cat)}))+'">'+ICONS.edit+'</span>':'<span></span>')+
    (removable?'<span class="x" data-del-cat="'+escapeHtml(cat)+'" title="'+escapeHtml(t("deleteCategory"))+'">'+ICONS.x+'</span>':'<span></span>')+
  '</div>';
}

function setActiveCat(cat){ ui.activeCat=cat; closeDrawerOverlay(); renderCategories(); renderContent(); }
function closeDrawerOverlay(){ var d=$("#drawer"), bd=$("#drawerBackdrop"); if(d) d.classList.remove("open"); if(bd) bd.classList.remove("show"); }

// delegated category events on stable containers
["catsBar","drawer"].forEach(function(cid){
  var el=$("#"+cid);
  el.addEventListener("click", function(e){
    if(Date.now()<catDragSuppressClickUntil){ e.preventDefault(); e.stopPropagation(); return; }
    var del=e.target.closest("[data-del-cat]"); if(del){ e.stopPropagation(); deleteCategory(del.getAttribute("data-del-cat")); return; }
    var ren=e.target.closest("[data-rename-cat]"); if(ren){ e.stopPropagation(); renameCategory(ren.getAttribute("data-rename-cat")); return; }
    var add=e.target.closest("[data-addcat]"); if(add){ addCategory(); return; }
    if(e.target.closest("#drawerToggle")){ var d=$("#drawer"); d.classList.add("open"); $("#drawerBackdrop").classList.add("show"); return; }
    var item=e.target.closest("[data-cat]"); if(item){ setActiveCat(item.getAttribute("data-cat")); }
  });
  el.addEventListener("dblclick", function(e){ var it=e.target.closest("[data-cat]"); if(it){ var c=it.getAttribute("data-cat"); if(c!=="All") renameCategory(c); } });
  // 键盘可达：Enter/Space 激活；方向键在标签/抽屉项之间移动焦点
  el.addEventListener("keydown", function(e){
    var item=e.target.closest("[data-cat],[data-addcat]"); if(!item) return;
    if(e.key==="Enter"||e.key===" "){
      e.preventDefault();
      if(item.hasAttribute("data-addcat")) addCategory();
      else setActiveCat(item.getAttribute("data-cat"));
    } else if(e.key==="ArrowRight"||e.key==="ArrowDown"||e.key==="ArrowLeft"||e.key==="ArrowUp"){
      var foc=$all("[data-cat],[data-addcat]",el), i=foc.indexOf(item); if(i<0) return;
      var next=(e.key==="ArrowRight"||e.key==="ArrowDown")?foc[i+1]:foc[i-1];
      if(next){ e.preventDefault(); next.focus(); }
    }
  });
});
// Track where a press began so a text-selection drag that ends outside a panel
// doesn't count as an "outside click" and close the panel.
var _pressEl=null;
document.addEventListener("mousedown", function(e){ _pressEl=e.target; }, true);
document.addEventListener("pointerdown", function(e){ _pressEl=e.target; }, true);
// True only when the press both started and ended outside the given selector.
// (Don't clear _pressEl — several handlers inspect it for the same click; mousedown refreshes it.)
function clickFullyOutside(e, sel){ var p=_pressEl; if(p && p.closest && p.closest(sel)) return false; return !e.target.closest(sel); }

$("#drawerBackdrop").addEventListener("click", function(e){ if(e.target===this && _pressEl===this) closeDrawerOverlay(); });

var dragCatEl=null, dragCatPh=null, dragCatParent=null, dragCatPointer=null, dragCatOffset={x:0,y:0}, dragCatPoint=null, dragCatRAF=0, dragCatMoved=false, dragCatLastMove=null, catDragSuppressClickUntil=0;
["catsBar","drawer"].forEach(function(cid){
  var el=$("#"+cid);
  el.addEventListener("pointerdown", function(e){
    var grip=e.target.closest("[data-cat-grip]"), item=grip&&grip.closest("[data-cat]");
    if(!item||item.getAttribute("data-cat")==="All"||e.button!==0) return;
    e.preventDefault(); e.stopPropagation();
    startCatPointerDrag(e,item,grip);
  });
});
function startCatPointerDrag(e,item,grip){
  dragCatEl=item; dragCatParent=item.parentNode; dragCatPointer=e.pointerId; dragCatMoved=false; dragCatPoint={x:e.clientX,y:e.clientY}; dragCatLastMove=null;
  var r=item.getBoundingClientRect();
  dragCatOffset={x:e.clientX-r.left,y:e.clientY-r.top};
  dragCatPh=document.createElement("div");
  dragCatPh.className=(item.classList.contains("drawer-item")?"drawer-item":"tab")+" cat-placeholder";
  dragCatPh.style.width=r.width+"px"; dragCatPh.style.height=r.height+"px";
  dragCatParent.insertBefore(dragCatPh,item);
  item.classList.add("cat-dragging");
  item.style.width=r.width+"px"; item.style.height=r.height+"px"; item.style.left=r.left+"px"; item.style.top=r.top+"px";
  dragCatParent.classList.add("cat-dragging-active");
  document.body.classList.add("no-select");
  try{ var s=window.getSelection&&window.getSelection(); if(s&&s.removeAllRanges) s.removeAllRanges(); }catch(_){}
  try{ grip.setPointerCapture(e.pointerId); }catch(_){}
  window.addEventListener("pointermove", onCatPointerMove, {passive:false});
  window.addEventListener("pointerup", endCatPointerDrag, {once:true});
  window.addEventListener("pointercancel", cancelCatPointerDrag, {once:true});
}
function onCatPointerMove(e){
  if(!dragCatEl||e.pointerId!==dragCatPointer) return;
  e.preventDefault(); dragCatMoved=true; dragCatPoint={x:e.clientX,y:e.clientY};
  dragCatEl.style.left=(e.clientX-dragCatOffset.x)+"px";
  dragCatEl.style.top=(e.clientY-dragCatOffset.y)+"px";
  if(!dragCatRAF) dragCatRAF=requestAnimationFrame(applyCatPlaceholder);
}
function applyCatPlaceholder(){
  dragCatRAF=0; if(!dragCatEl||!dragCatPh||!dragCatParent||!dragCatPoint) return;
  if(dragCatLastMove&&Math.hypot(dragCatPoint.x-dragCatLastMove.x,dragCatPoint.y-dragCatLastMove.y)<5) return;
  var pos=catAfter(dragCatParent,dragCatPoint.x,dragCatPoint.y);
  var ref=null;
  if(pos.el){
    ref=pos.before?pos.el:pos.el.nextSibling;
    while(ref===dragCatEl) ref=ref.nextSibling;
  } else {
    ref=$("[data-addcat]",dragCatParent)||null;
  }
  if(ref===dragCatPh) return;
  var probe=dragCatPh.nextElementSibling; while(probe===dragCatEl) probe=probe.nextElementSibling;
  if(probe===ref||(ref===null&&probe===null)) return;
  if(ref) dragCatParent.insertBefore(dragCatPh,ref); else dragCatParent.appendChild(dragCatPh);
  dragCatLastMove={x:dragCatPoint.x,y:dragCatPoint.y};
}
function endCatPointerDrag(e){
  if(e&&dragCatPointer!=null&&e.pointerId!==dragCatPointer) return;
  cleanupCatPointerListeners();
  finishCatPointerDrag(true);
}
function cancelCatPointerDrag(){ cleanupCatPointerListeners(); finishCatPointerDrag(false); }
function cleanupCatPointerListeners(){
  window.removeEventListener("pointermove", onCatPointerMove);
  if(dragCatRAF){ cancelAnimationFrame(dragCatRAF); dragCatRAF=0; }
}
function finishCatPointerDrag(shouldCommit){
  var parent=dragCatParent, moved=dragCatMoved;
  if(dragCatEl&&dragCatPh&&dragCatPh.parentNode) dragCatPh.parentNode.insertBefore(dragCatEl,dragCatPh);
  if(dragCatEl){
    dragCatEl.classList.remove("cat-dragging");
    dragCatEl.style.width=""; dragCatEl.style.height=""; dragCatEl.style.left=""; dragCatEl.style.top="";
  }
  if(dragCatPh&&dragCatPh.parentNode) dragCatPh.parentNode.removeChild(dragCatPh);
  if(parent) parent.classList.remove("cat-dragging-active");
  document.body.classList.remove("no-select");
  dragCatEl=null; dragCatPh=null; dragCatParent=null; dragCatPointer=null; dragCatPoint=null; dragCatLastMove=null; dragCatMoved=false;
  if(moved) catDragSuppressClickUntil=Date.now()+220;
  if(shouldCommit&&moved) commitCategoryOrder(parent);
}
function catAfter(container,x,y){
  var items=$all("[data-cat]",container).filter(function(el){ return el.getAttribute("data-cat")!=="All" && el!==dragCatEl && !el.classList.contains("cat-placeholder"); });
  if(!items.length) return {el:null,before:true};
  var vertical=!!container.closest("#drawer");
  if(vertical){
    for(var i=0;i<items.length;i++){ var b=items[i].getBoundingClientRect(); if(y<b.top+b.height/2) return {el:items[i],before:true}; }
    return {el:items[items.length-1],before:false};
  }
  var rows=[], cur=null;
  items.map(function(el){ var b=el.getBoundingClientRect(); return {el:el,b:b,cx:b.left+b.width/2,cy:b.top+b.height/2}; })
    .sort(function(a,b){ return a.b.top-b.b.top||a.cx-b.cx; })
    .forEach(function(it){
      if(!cur||it.b.top>cur.bottom-it.b.height*.45){ cur={top:it.b.top,bottom:it.b.bottom,items:[]}; rows.push(cur); }
      cur.top=Math.min(cur.top,it.b.top); cur.bottom=Math.max(cur.bottom,it.b.bottom); cur.items.push(it);
    });
  var row=rows[rows.length-1];
  for(var r=0;r<rows.length;r++){ if(y<=rows[r].bottom+6){ row=rows[r]; break; } }
  row.items.sort(function(a,b){ return a.cx-b.cx; });
  for(var k=0;k<row.items.length;k++){ if(x<row.items[k].cx) return {el:row.items[k].el,before:true}; }
  return {el:row.items[row.items.length-1].el,before:false};
}
function commitCategoryOrder(container){
  if(!container) return; var names=$all("[data-cat]",container).map(function(el){return el.getAttribute("data-cat");}).filter(function(c){return c&&c!=="All";});
  if(!names.length) return; var seen={}, ordered=[]; names.forEach(function(c){ if(state.categories.indexOf(c)>-1&&!seen[c]){ seen[c]=true; ordered.push(c); } });
  state.categories.forEach(function(c){ if(!seen[c]) ordered.push(c); }); state.categories=ordered; save(); renderCategories();
}

/* ----- content ----- */
function stripMarks(s){ try{ return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,""); }catch(e){ return String(s||""); } }
function compactSearch(s){ return stripMarks(s).toLowerCase().replace(/https?:\/\//g," ").replace(/www\./g," ").replace(/[^\p{L}\p{N}]+/gu,""); }
function looseText(s){ return stripMarks(s).toLowerCase().replace(/https?:\/\//g," ").replace(/www\./g," ").replace(/[^\p{L}\p{N}]+/gu," ").trim(); }
function editDistance(a,b,max){ var m=a.length,n=b.length; if(Math.abs(m-n)>max) return max+1; var prev=[]; for(var j=0;j<=n;j++) prev[j]=j; for(var i=1;i<=m;i++){ var cur=[i], best=cur[0]; for(j=1;j<=n;j++){ var cost=a.charAt(i-1)===b.charAt(j-1)?0:1; cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost); if(cur[j]<best) best=cur[j]; } if(best>max) return max+1; prev=cur; } return prev[n]; }
/* 每条书签的检索派生数据。以前每次按键都要为每条书签重跑两遍正则（compactSearch/looseText）
   再 split 一次——书签多了就是纯浪费，内容没变结果必然一样。
   缓存挂在书签对象上，用内容签名判失效；属性设为不可枚举，JSON.stringify 不会把它写进
   localStorage 和导出文件。 */
function charMask(s){
  var m=0;
  for(var i=0;i<s.length;i++){
    var c=s.charCodeAt(i);
    if(c>=97&&c<=122) m|=1<<(c-97);
    else if(c>=48&&c<=57) m|=1<<(26+(c-48)%6);
    // 中日韩等字符不进掩码：掩码只用来"提前否掉不可能的比较"，
    // 少记几个字符只会让过滤变宽松，不会漏掉真正的匹配
  }
  return m;
}
function popcount(x){ x=x-((x>>1)&0x55555555); x=(x&0x33333333)+((x>>2)&0x33333333);
  x=(x+(x>>4))&0x0f0f0f0f; return (x*0x01010101)>>24; }
function bookmarkSearchData(b){
  var sig=(b.title||"")+"\u0000"+(b.url||"")+"\u0000"+(b.category||"")+"\u0000"+
          (b.description||"")+"\u0000"+((b.tags||[]).join(","));
  var c=b._sx;
  if(c&&c.sig===sig) return c;
  var hay=bookmarkHaystack(b);
  c={ sig:sig, ch:compactSearch(hay), ht:looseText(hay).split(/\s+/).filter(Boolean) };
  c.hm=c.ht.map(charMask);
  try{ Object.defineProperty(b,"_sx",{value:c,writable:true,configurable:true,enumerable:false}); }
  catch(e){ /* 冻结对象等极端情况：不缓存也能正常工作 */ }
  return c;
}
/* 查询侧的派生也只算一次——它在每条书签上被重复算了 N 遍 */
var _qCache={q:null};
function queryData(q){
  if(_qCache.q===q) return _qCache;
  var cq=compactSearch(q), qt=looseText(q).split(/\s+/).filter(Boolean);
  _qCache={ q:q, cq:cq, qt:qt, qm:qt.map(charMask) };
  return _qCache;
}
function fuzzyScore(q, hay){ return fuzzyScoreData(queryData(q), { ch:compactSearch(hay), ht:looseText(hay).split(/\s+/).filter(Boolean), hm:null }); }
function fuzzyScoreData(qd, d){
  var cq=qd.cq, ch=d.ch; if(!cq) return 1; if(!ch) return 0;
  var exact=ch.indexOf(cq); if(exact>-1) return 1000-exact;
  var qt=qd.qt, ht=d.ht, hm=d.hm, tokenScore=0;
  if(qt.length){ var all=true; qt.forEach(function(t,ti){ var hit=false, tm=qd.qm[ti];
      for(var i=0;i<ht.length;i++){ var maxd=t.length<=3?0:(t.length<=6?1:2);   /* 3 字以内不给容错：URL 里到处是 com/net/org，"cod"↔"com" 距离 1 就能全表命中，而 3 个字母本来也不值得容错 */
        if(ht[i].indexOf(t)>-1){ hit=true; break; }
        // 掩码预筛：查询里有 maxd+1 个字符在这个 token 里根本不存在时，
        // 编辑距离必然超标，不必进 O(m×n) 的 DP。这一步占了原来七成开销。
        if(t.length>2 && (!hm || popcount(tm&~hm[i])<=maxd) &&
           editDistance(t,ht[i].slice(0,Math.max(t.length,ht[i].length)),maxd)<=maxd){ hit=true; break; }
      } if(hit) tokenScore+=120; else all=false; }); if(all) return 780+tokenScore; }
  // 子序列匹配：要求命中区间足够紧凑，否则像 "code" 这种常见字母组合会在
  // 长 haystack（标题+URL+分类+描述拼接）里到处"碰巧"命中，把无关书签全捞出来。
  // 区间上限 2n+2：拼写容错（githb→github）本来就走上面的 token 编辑距离分支，
  // 不靠这里放宽，所以这里只需容下 gh→github 这类紧凑缩写。
  var qi=0,gaps=0,last=-1,first=-1; for(var k=0;k<ch.length&&qi<cq.length;k++){ if(ch.charAt(k)===cq.charAt(qi)){ if(last>-1) gaps+=k-last-1; else first=k; last=k; qi++; } }
  if(qi===cq.length && (last-first+1)<=cq.length*2+2) return Math.max(120,520-gaps);
  // 整体编辑距离兜底：同样 4 个字符起步。只在多词查询时才跑——单词查询时
  // cq 就等于 qt[0]，容错上限也一样，这里做的事和上面的 token 分支逐字重复，
  // 而它占掉了每次按键里一半的 editDistance 调用。
  if(cq.length>=4&&qt.length>1){ var md=cq.length<=6?1:2; for(var x=0;x<ht.length;x++){ if(editDistance(cq,ht[x],md)<=md) return 360; } }
  return 0;
}
var _conceptHits=0;
function bookmarkHaystack(b){ return [b.title,b.url,prettyUrl(b.url),getDomain(b.url),b.category,b.description,(b.tags||[]).join(" ")].join(" "); }
function bookmarkHasTag(b,tag){ if(!b.tags||!b.tags.length) return false; tag=String(tag).toLowerCase(); for(var i=0;i<b.tags.length;i++){ if(String(b.tags[i]).toLowerCase()===tag) return true; } return false; }
function visibleBookmarks(){
  var q=ui.query.trim(), tag=ui.tagFilter;
  var base=state.bookmarks.filter(function(b){
    if(ui.activeCat!=="All" && b.category!==ui.activeCat) return false;
    if(tag && !bookmarkHasTag(b,tag)) return false;
    return true;
  });
  // 浏览态：置顶书签浮到顶部（稳定排序保留组内原有顺序）；搜索态保持相关度排序
  if(!q){
    // 排序优先级：置顶 > 当前时段的分类 > 原有顺序（稳定排序保留组内次序）
    var boost=(typeof inActiveScene==="function");
    return base.slice().sort(function(a,b){
      var p=(b.pinned?1:0)-(a.pinned?1:0); if(p) return p;
      if(boost){ var sc=(inActiveScene(b)?1:0)-(inActiveScene(a)?1:0); if(sc) return sc; }
      return 0;
    });
  }
  var groups=(typeof conceptMatchGroups==="function")?conceptMatchGroups(q):[];
  var qd=queryData(q);
  var scored=base.map(function(b,idx){
    var sc=fuzzyScoreData(qd,bookmarkSearchData(b));
    // 概念命中给一个低于任何直接匹配的分值，保证直接匹配始终排在前面
    if(!sc && groups.length && bookmarkInConcepts(b,groups)) sc=60;
    return {b:b,idx:idx,score:sc};
  }).filter(function(x){ return x.score>0; });
  _conceptHits=scored.filter(function(x){ return x.score===60; }).length;
  return scored.sort(function(a,b){ return (b.score-a.score)||(a.idx-b.idx); }).map(function(x){ return x.b; });
}
function setTagFilter(tag){ ui.tagFilter=(ui.tagFilter===tag)?"":tag; renderContent(); }
function clearTagFilter(){ if(ui.tagFilter){ ui.tagFilter=""; renderContent(); } }
$("#resultTitle").addEventListener("click", function(e){ if(e.target.closest("[data-clear-tag]")) clearTagFilter(); });
function renderContent(){
  if(typeof renderSceneChip==="function") renderSceneChip();
  var list=visibleBookmarks(), total=state.bookmarks.length, tt=$("#resultTitle");
  if(total===0){ tt.textContent=""; }
  else if(ui.query){
    // 概念命中要说明来由，否则"我没搜这个词它为什么出现"会很困惑
    tt.innerHTML=nResults(list.length, escapeHtml(ui.query))+
      (_conceptHits?' <span class="concept-note" title="'+escapeHtml(t("conceptTip"))+'">'+escapeHtml(t("conceptNote",{n:_conceptHits}))+'</span>':'');
  }
  else if(ui.activeCat==="All"){ tt.innerHTML="<b>"+list.length+"</b> "+nBookmarks(list.length).replace(/^\d+\s?/,""); }
  else { tt.innerHTML=nInCat(list.length, escapeHtml(catLabel(ui.activeCat))); }
  if(total!==0 && ui.tagFilter){ tt.innerHTML+=' <button class="tag-filter-chip" data-clear-tag="1" title="'+escapeHtml(t("tagFilterClear"))+'">#'+escapeHtml(ui.tagFilter)+ICONS.x+'</button>'; }

  if(total===0){ return renderEmpty("first"); }
  // 一条卡片都没匹配上时，正文检索反而最该出场——所以空态也要挂上补充区
  if(list.length===0){ renderEmpty("none"); return appendSnapResults(list); }
  var isFirst=!_gridRendered;
  // 视图（分类/搜索/标签/网格模式）变化时重置渲染上限
  var viewKey=ui.activeCat+"|"+ui.query+"|"+ui.tagFilter+"|"+state.view;
  if(viewKey!==_lastViewKey){ _renderLimit=RENDER_BASE; _lastViewKey=viewKey; }
  var shown=list.length>_renderLimit?list.slice(0,_renderLimit):list;
  var cls="grid"+cardViewClass(state.view)+(ui.query?" searching":"")+(isFirst?" fresh":"");
  if(!isFirst) contentEl.style.opacity="0";
  var inner='<div class="'+cls+'" id="grid">';
  shown.forEach(function(b,i){ inner+=cardHtml(b,i); });
  inner+='</div>';
  if(list.length>shown.length) inner+='<div class="grid-more" id="gridMore" role="button" tabindex="0"></div>';
  contentEl.innerHTML=inner; gridEl=$("#grid"); syncSelectionUI();
  wireGridMore(list.length, shown.length);
  appendSnapResults(list);
  if(!isFirst) requestAnimationFrame(function(){ contentEl.style.opacity=""; });
  _gridRendered=true;
}
function gridLoadMore(){ _renderLimit+=RENDER_STEP; renderContent(); }
function wireGridMore(total, shownN){
  if(_gridMoreObserver){ _gridMoreObserver.disconnect(); _gridMoreObserver=null; }
  var s=$("#gridMore"); if(!s) return;
  s.textContent=t("showMore",{n:total-shownN});
  if(window.IntersectionObserver){
    _gridMoreObserver=new IntersectionObserver(function(es){ if(es[0]&&es[0].isIntersecting) gridLoadMore(); }, {rootMargin:"600px"});
    _gridMoreObserver.observe(s);
  }
}
function cardHtml(b,i){
  var dom=getDomain(b.url), hue=hashHue(dom||b.title), letter=(b.title||dom||"?").trim().charAt(0)||"?", fav=faviconUrl(b.url);
  var canDrag=(!ui.selectMode && !ui.query);
  var delay=state.settings.animations?(' style="animation-delay:'+(Math.min(i,28)*0.022).toFixed(3)+'s"'):'';
  var desc=b.description||"", pinned=!!b.pinned;
  return '<div class="card'+(ui.selected[b.id]?" selected":"")+(pinned?" pinned":"")+'" data-id="'+escapeHtml(b.id)+'" data-desc="'+escapeHtml(desc)+'" tabindex="0" role="link" aria-label="'+escapeHtml(b.title||dom)+'"'+delay+'>'+
    '<div class="check">'+ICONS.check+'</div>'+
    '<button class="card-pin'+(pinned?" on":"")+'" data-pin="'+escapeHtml(b.id)+'" title="'+escapeHtml(pinned?t("unpin"):t("pinToTop"))+'" aria-label="'+escapeHtml(pinned?t("unpin"):t("pinToTop"))+'" aria-pressed="'+(pinned?"true":"false")+'">'+(pinned?ICONS.pinFill:ICONS.pin)+'</button>'+
    '<div class="fav" style="--c:'+hue+'"><span class="letter">'+escapeHtml(letter)+'</span>'+(fav?'<img class="fav-img" loading="lazy" alt="" src="'+escapeHtml(fav)+'"/>':'')+'</div>'+
    '<div class="meta">'+
      '<div class="name">'+
        (b.health&&b.health.status&&b.health.status!=="unknown"?'<span class="hdot '+b.health.status+'" title="'+escapeHtml(healthTip(b))+'"></span>':'')+
        escapeHtml(b.title||dom)+'</div>'+
      '<div class="url">'+escapeHtml(prettyUrl(b.url))+'</div>'+
      (b.description?'<div class="desc">'+escapeHtml(b.description)+'</div>':'')+
      ((typeof hasSnapshot==="function"&&hasSnapshot(b.url))?'<button class="snap-badge" data-snap-open="'+escapeHtml(b.id)+'" title="'+escapeHtml(t("snapRead"))+'" aria-label="'+escapeHtml(t("snapRead"))+'">'+ICONS.archive+escapeHtml(t("snapBadge"))+'</button>':'')+
      (ui.activeCat==="All"?'<span class="cat-chip">'+escapeHtml(catLabel(b.category))+'</span>':'')+
      (b.tags&&b.tags.length?b.tags.slice(0,3).map(function(tg){ tg=String(tg); return '<span class="tag-chip'+(ui.tagFilter&&ui.tagFilter.toLowerCase()===tg.toLowerCase()?" on":"")+'" data-tag="'+escapeHtml(tg)+'" title="'+escapeHtml(t("filterByTag",{tag:tg}))+'">#'+escapeHtml(tg)+'</span>'; }).join(""):'')+
    '</div>'+      (canDrag?'<span class="card-grip" title="'+escapeHtml(t("dragReorder"))+'">'+ICONS.grip+'</span>':'')+
    '<div class="card-actions">'+
      '<button data-edit="'+escapeHtml(b.id)+'" title="'+escapeHtml(t("editBookmark"))+'">'+ICONS.edit+'</button>'+
      '<button class="del" data-del="'+escapeHtml(b.id)+'" title="'+escapeHtml(t("delete"))+'">'+ICONS.trash+'</button>'+
    '</div>'+
  '</div>';
}
/* 存档正文检索走异步：查到了才补在下面，查不到这块一直是空的（CSS :empty 隐藏） */
function appendSnapResults(list){
  if(!ui.query||typeof scheduleSnapSearch!=="function") return;
  var box=document.createElement("div");
  box.className="snap-results"; box.id="snapResults";
  contentEl.appendChild(box);
  scheduleSnapSearch(ui.query, list);
}
function renderEmpty(kind){
  var h;
  if(kind==="first"){ h='<div class="empty"><div class="ico">'+ICONS.bookmark+'</div><h3>'+escapeHtml(t("emptyTitle"))+'</h3><p>'+escapeHtml(t("emptyDesc"))+'</p><div class="row"><button class="btn primary" data-empty-add>'+escapeHtml(t("addFirst"))+'</button><button class="btn" data-empty-import>'+escapeHtml(t("importFile"))+'</button></div></div>'; }
  else { h='<div class="empty"><div class="ico">'+ICONS.info+'</div><h3>'+escapeHtml(t("nothingHere"))+'</h3><p>'+escapeHtml(ui.query?t("noMatch"):t("noInCat"))+'</p><div class="row"><button class="btn" data-empty-add>'+escapeHtml(t("addBookmarkBtn"))+'</button></div></div>'; }
  contentEl.innerHTML=h; gridEl=null;
}
