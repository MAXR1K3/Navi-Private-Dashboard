/* render.js — 主渲染：分类、卡片网格、空状态 */
"use strict";

/* ===== render ===== */
var contentEl=$("#content"), widgetsEl=$("#widgets"), gridEl=null;

function counts(){ var m={All:state.bookmarks.length}; state.categories.forEach(function(c){ m[c]=0; }); state.bookmarks.forEach(function(b){ m[b.category]=(m[b.category]||0)+1; }); return m; }
function catLabel(c){ return c==="Uncategorized"? t("uncategorized") : c; }

function viewBtnIcon(){ return state.view==="grid"?ICONS.list:state.view==="list"?ICONS.list2:ICONS.grid; }
function render(){
  document.documentElement.setAttribute("data-theme", state.theme);
  $("#themeBtn").innerHTML = state.theme==="dark"?ICONS.sun:ICONS.moon;
  $("#viewBtn").innerHTML = viewBtnIcon();
  // Fallback dropdown -> tabs (dropdown option removed)
  if(state.settings.categoryLayout==="dropdown"){ state.settings.categoryLayout="tabs"; save(); }
  applyAnim(); renderBrand(); renderWidgets(); renderCategories(); renderContent();
}

/* ----- categories (tabs / drawer / dropdown) ----- */
function renderCategories(){
  var mode=state.settings.categoryLayout, layout=$("#layout"), drawer=$("#drawer"), bar=$("#catsBar");
  layout.classList.toggle("drawer-mode", mode==="drawer");
  var c=counts();
  if(mode==="drawer"){
    drawer.style.display="";
    bar.innerHTML='<button class="drawer-toggle" id="drawerToggle">'+ICONS.layers+' '+escapeHtml(ui.activeCat==="All"?t("categoriesTitle"):catLabel(ui.activeCat))+'</button>';
    drawer.innerHTML=drawerInner(c);
  } else if(mode==="dropdown"){
    closeDrawerOverlay(); drawer.style.display="none";
    bar.innerHTML=dropdownHtml(c);
  } else {
    closeDrawerOverlay(); drawer.style.display="none";
    bar.innerHTML='<div class="tabs" id="tabs">'+tabsInner(c)+'</div>';
  }
}
function tabsInner(c){
  var html=tabHtml("All", c.All, ui.activeCat==="All", false);
  state.categories.forEach(function(cat){ html+=tabHtml(cat, c[cat]||0, ui.activeCat===cat, true); });
  html+='<div class="tab add" data-addcat="1">'+ICONS.plus+'<span>'+escapeHtml(t("newCategory"))+'</span></div>';
  return html;
}
function tabHtml(cat,n,active,removable){
  return '<div class="tab'+(active?" active":"")+'" data-cat="'+escapeHtml(cat)+'" title="'+escapeHtml(catLabel(cat))+(removable?" — "+t("renameCat",{cat:catLabel(cat)}):"")+'">'+
    (removable?'<span class="cat-grip" draggable="true" data-cat-grip title="'+escapeHtml(t("dragReorder"))+'">'+ICONS.grip+'</span>':'')+
    '<span class="lbl">'+escapeHtml(cat==="All"?allLabel():catLabel(cat))+'</span>'+
    '<span class="count">'+n+'</span>'+
    (removable?'<span class="x" data-del-cat="'+escapeHtml(cat)+'" title="'+escapeHtml(t("deleteCategory"))+'">'+ICONS.x+'</span>':'')+
  '</div>';
}
function allLabel(){ var l=state.settings.lang; return l==="zh"?"全部":l==="es"?"Todos":"All"; }

function dropdownHtml(c){
  var cur = ui.activeCat==="All"? allLabel() : catLabel(ui.activeCat);
  var items='<div class="dd-item'+(ui.activeCat==="All"?" active":"")+'" data-cat="All">'+escapeHtml(allLabel())+'<span class="cnt">'+c.All+'</span></div>';
  state.categories.forEach(function(cat){ items+='<div class="dd-item'+(ui.activeCat===cat?" active":"")+'" data-cat="'+escapeHtml(cat)+'">'+escapeHtml(catLabel(cat))+'<span class="cnt">'+(c[cat]||0)+'</span></div>'; });
  items+='<div class="dd-item add" data-addcat="1">'+ICONS.plus+' '+escapeHtml(t("newCategory"))+'</div>';
  return '<div class="dropdown'+(ui.ddOpen?" open":"")+'" id="dropdown"><button class="dd-btn" id="ddBtn">'+ICONS.folder+'<span>'+escapeHtml(cur)+'</span><span class="cnt">'+(ui.activeCat==="All"?c.All:(c[ui.activeCat]||0))+'</span>'+ICONS.caret+'</button><div class="dd-menu">'+items+'</div></div>';
}
function drawerInner(c){
  var h='<div class="drawer-inner"><div class="dh">'+escapeHtml(t("categoriesTitle"))+'</div>';
  h+=drawerItem("All", c.All, ui.activeCat==="All", false);
  state.categories.forEach(function(cat){ h+=drawerItem(cat, c[cat]||0, ui.activeCat===cat, true); });
  h+='<div class="drawer-item add" data-addcat="1">'+ICONS.plus+' '+escapeHtml(t("newCategory"))+'</div></div>';
  return h;
}
function drawerItem(cat,n,active,removable){
  return '<div class="drawer-item'+(active?" active":"")+'" data-cat="'+escapeHtml(cat)+'">'+
    (removable?'<span class="cat-grip" draggable="true" data-cat-grip title="'+escapeHtml(t("dragReorder"))+'">'+ICONS.grip+'</span>':'<span class="cat-grip ghost"></span>')+
    '<div class="left">'+(cat==="All"?ICONS.layers:ICONS.folder)+'<span class="nm">'+escapeHtml(cat==="All"?allLabel():catLabel(cat))+'</span></div>'+
    '<span class="cnt">'+n+'</span>'+
    (removable?'<span class="x" data-del-cat="'+escapeHtml(cat)+'" title="'+escapeHtml(t("deleteCategory"))+'">'+ICONS.x+'</span>':'<span></span>')+
  '</div>';
}

function setActiveCat(cat){ ui.activeCat=cat; ui.ddOpen=false; closeDrawerOverlay(); renderCategories(); renderContent(); }
function closeDrawerOverlay(){ var d=$("#drawer"), bd=$("#drawerBackdrop"); if(d) d.classList.remove("open"); if(bd) bd.classList.remove("show"); }

// delegated category events on stable containers
["catsBar","drawer"].forEach(function(cid){
  var el=$("#"+cid);
  el.addEventListener("click", function(e){
    var del=e.target.closest("[data-del-cat]"); if(del){ e.stopPropagation(); deleteCategory(del.getAttribute("data-del-cat")); return; }
    var add=e.target.closest("[data-addcat]"); if(add){ addCategory(); return; }
    if(e.target.closest("#ddBtn")){ ui.ddOpen=!ui.ddOpen; renderCategories(); return; }
    if(e.target.closest("#drawerToggle")){ var d=$("#drawer"); d.classList.add("open"); $("#drawerBackdrop").classList.add("show"); return; }
    var item=e.target.closest("[data-cat]"); if(item){ setActiveCat(item.getAttribute("data-cat")); }
  });
  el.addEventListener("dblclick", function(e){ var it=e.target.closest("[data-cat]"); if(it){ var c=it.getAttribute("data-cat"); if(c!=="All") renameCategory(c); } });
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
document.addEventListener("click", function(e){ if(ui.ddOpen && clickFullyOutside(e,"#dropdown")){ ui.ddOpen=false; renderCategories(); } });

var dragCatEl=null, dragCatContainer=null;
["catsBar","drawer"].forEach(function(cid){
  var el=$("#"+cid);
  el.addEventListener("dragstart", function(e){
    var grip=e.target.closest("[data-cat-grip]"), item=grip&&grip.closest("[data-cat]");
    if(!item||item.getAttribute("data-cat")==="All"){ e.preventDefault(); return; }
    dragCatEl=item; dragCatContainer=el; e.dataTransfer.effectAllowed="move";
    try{ e.dataTransfer.setData("text/plain", item.getAttribute("data-cat")); }catch(_){}
    setTimeout(function(){ if(dragCatEl) dragCatEl.classList.add("cat-dragging"); },0);
  });
  el.addEventListener("dragover", function(e){
    if(!dragCatEl||dragCatContainer!==el) return; e.preventDefault();
    var pos=catAfter(el,e.clientX,e.clientY);
    if(!pos.el){ var add=el.querySelector("[data-addcat]"); if(add&&add.parentNode===dragCatEl.parentNode) dragCatEl.parentNode.insertBefore(dragCatEl,add); }
    else if(pos.before){ if(pos.el!==dragCatEl) pos.el.parentNode.insertBefore(dragCatEl,pos.el); }
    else { pos.el.parentNode.insertBefore(dragCatEl,pos.el.nextSibling); }
  });
  el.addEventListener("drop", function(e){ if(dragCatEl) e.preventDefault(); });
  el.addEventListener("dragend", function(){ if(dragCatEl) dragCatEl.classList.remove("cat-dragging"); commitCategoryOrder(dragCatContainer); dragCatEl=null; dragCatContainer=null; });
});
function catAfter(container,x,y){
  var items=$all("[data-cat]",container).filter(function(el){ return el.getAttribute("data-cat")!=="All" && !el.classList.contains("cat-dragging"); });
  var best={el:null,before:true,score:Infinity}, vertical=state.settings.categoryLayout==="drawer";
  items.forEach(function(el){ var b=el.getBoundingClientRect(), mid=vertical?(b.top+b.height/2):(b.left+b.width/2), main=vertical?y:x, cross=vertical?Math.abs(x-(b.left+b.width/2)):Math.abs(y-(b.top+b.height/2)), score=Math.abs(main-mid)+cross*.2; if(score<best.score){ best={el:el,before:main<mid,score:score}; } });
  return best;
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
function fuzzyScore(q, hay){
  var cq=compactSearch(q), ch=compactSearch(hay); if(!cq) return 1; if(!ch) return 0;
  var exact=ch.indexOf(cq); if(exact>-1) return 1000-exact;
  var qt=looseText(q).split(/\s+/).filter(Boolean), ht=looseText(hay).split(/\s+/).filter(Boolean), tokenScore=0;
  if(qt.length){ var all=true; qt.forEach(function(t){ var hit=false; for(var i=0;i<ht.length;i++){ if(ht[i].indexOf(t)>-1 || (t.length>2 && editDistance(t,ht[i].slice(0,Math.max(t.length,ht[i].length)),2)<=2)){ hit=true; break; } } if(hit) tokenScore+=120; else all=false; }); if(all) return 780+tokenScore; }
  var qi=0,gaps=0,last=-1; for(var k=0;k<ch.length&&qi<cq.length;k++){ if(ch.charAt(k)===cq.charAt(qi)){ if(last>-1) gaps+=k-last-1; last=k; qi++; } }
  if(qi===cq.length) return Math.max(120,520-gaps);
  if(cq.length>=3){ for(var x=0;x<ht.length;x++){ if(editDistance(cq,ht[x],2)<=2) return 360; } }
  return 0;
}
function bookmarkHaystack(b){ return [b.title,b.url,prettyUrl(b.url),getDomain(b.url),b.category,b.description,(b.tags||[]).join(" ")].join(" "); }
function visibleBookmarks(){
  var q=ui.query.trim();
  var base=state.bookmarks.filter(function(b){ return ui.activeCat==="All" || b.category===ui.activeCat; });
  if(!q) return base;
  return base.map(function(b,idx){ return {b:b,idx:idx,score:fuzzyScore(q,bookmarkHaystack(b))}; }).filter(function(x){ return x.score>0; }).sort(function(a,b){ return (b.score-a.score)||(a.idx-b.idx); }).map(function(x){ return x.b; });
}
function renderContent(){
  var list=visibleBookmarks(), total=state.bookmarks.length, tt=$("#resultTitle");
  if(total===0){ tt.textContent=""; }
  else if(ui.query){ tt.innerHTML=nResults(list.length, escapeHtml(ui.query)); }
  else if(ui.activeCat==="All"){ tt.innerHTML="<b>"+list.length+"</b> "+nBookmarks(list.length).replace(/^\d+\s?/,""); }
  else { tt.innerHTML=nInCat(list.length, escapeHtml(catLabel(ui.activeCat))); }

  if(total===0){ return renderEmpty("first"); }
  if(list.length===0){ return renderEmpty("none"); }
  var cls="grid"+(state.view==="list"?" list":state.view==="list2"?" list list2":"")+(ui.query?" searching":"");
  var inner='<div class="'+cls+'" id="grid">';
  list.forEach(function(b,i){ inner+=cardHtml(b,i); });
  inner+='</div>';
  contentEl.innerHTML=inner; gridEl=$("#grid"); syncSelectionUI();
}
function cardHtml(b,i){
  var dom=getDomain(b.url), hue=hashHue(dom||b.title), letter=(b.title||dom||"?").trim().charAt(0)||"?", fav=faviconUrl(b.url);
  var canDrag=(!ui.selectMode && !ui.query);
  var delay=state.settings.animations?(' style="animation-delay:'+(Math.min(i,28)*0.022).toFixed(3)+'s"'):'';
  return '<div class="card'+(ui.selected[b.id]?" selected":"")+'" data-id="'+escapeHtml(b.id)+'"'+delay+'>'+
    '<div class="check">'+ICONS.check+'</div>'+
    '<div class="fav" style="--c:'+hue+'"><span class="letter">'+escapeHtml(letter)+'</span>'+(fav?'<img class="fav-img" loading="lazy" alt="" src="'+escapeHtml(fav)+'"/>':'')+'</div>'+
    '<div class="meta">'+
      '<div class="name">'+
        (b.health&&b.health.status&&b.health.status!=="unknown"?'<span class="hdot '+b.health.status+'" title="'+escapeHtml(healthTip(b))+'"></span>':'')+
        escapeHtml(b.title||dom)+'</div>'+
      '<div class="url">'+escapeHtml(prettyUrl(b.url))+'</div>'+
      (b.description?'<div class="desc">'+escapeHtml(b.description)+'</div>':'')+
      (ui.activeCat==="All"?'<span class="cat-chip">'+escapeHtml(catLabel(b.category))+'</span>':'')+
      (b.tags&&b.tags.length?b.tags.slice(0,3).map(function(tg){ return '<span class="tag-chip">#'+escapeHtml(String(tg))+'</span>'; }).join(""):'')+
    '</div>'+      (canDrag?'<span class="card-grip" title="'+escapeHtml(t("dragReorder"))+'">'+ICONS.grip+'</span>':'')+
    '<div class="card-actions"><button data-edit="'+escapeHtml(b.id)+'" title="'+escapeHtml(t("editBookmark"))+'">'+ICONS.edit+'</button><button class="del" data-del="'+escapeHtml(b.id)+'" title="'+escapeHtml(t("delete"))+'">'+ICONS.trash+'</button></div>'+
  '</div>';
}
function renderEmpty(kind){
  var h;
  if(kind==="first"){ h='<div class="empty"><div class="ico">'+ICONS.bookmark+'</div><h3>'+escapeHtml(t("emptyTitle"))+'</h3><p>'+escapeHtml(t("emptyDesc"))+'</p><div class="row"><button class="btn primary" data-empty-add>'+escapeHtml(t("addFirst"))+'</button><button class="btn" data-empty-import>'+escapeHtml(t("importFile"))+'</button></div></div>'; }
  else { h='<div class="empty"><div class="ico">'+ICONS.info+'</div><h3>'+escapeHtml(t("nothingHere"))+'</h3><p>'+escapeHtml(ui.query?t("noMatch"):t("noInCat"))+'</p><div class="row"><button class="btn" data-empty-add>'+escapeHtml(t("addBookmarkBtn"))+'</button></div></div>'; }
  contentEl.innerHTML=h; gridEl=null;
}
