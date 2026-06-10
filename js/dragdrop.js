/* dragdrop.js — 书签卡片拖拽排序 */
"use strict";

/* ===== drag reorder (bookmarks) ===== */
var dragEl=null, dragPh=null, dragMoved=false, dragPointer=null, dragOffset={x:0,y:0}, dragRAF=0, dragPoint=null, dragLastMove=null;

contentEl.addEventListener("pointerdown", function(e){
  var grip=e.target.closest(".card-grip"), card=grip&&grip.closest(".card");
  if(!grip||!card||ui.selectMode||ui.query||e.button!==0) return;
  e.preventDefault();
  startCardPointerDrag(e,card,grip);
});

function startCardPointerDrag(e,card,grip){
  if(!gridEl) return;
  dragEl=card; dragMoved=false; dragPointer=e.pointerId; dragLastMove=null;
  var r=card.getBoundingClientRect();
  dragOffset={x:e.clientX-r.left,y:e.clientY-r.top};
  dragPh=document.createElement("div"); dragPh.className="drag-placeholder";
  dragPh.style.height=r.height+"px"; dragPh.style.gridColumn=getComputedStyle(card).gridColumn;
  gridEl.insertBefore(dragPh,card);
  card.classList.add("dragging");
  card.style.width=r.width+"px"; card.style.height=r.height+"px"; card.style.left=r.left+"px"; card.style.top=r.top+"px";
  gridEl.classList.add("dragging-active");
  try{ grip.setPointerCapture(e.pointerId); }catch(_){}
  window.addEventListener("pointermove", onCardPointerMove, {passive:false});
  window.addEventListener("pointerup", endCardPointerDrag, {once:true});
  window.addEventListener("pointercancel", cancelCardPointerDrag, {once:true});
}

function onCardPointerMove(e){
  if(!dragEl||e.pointerId!==dragPointer) return;
  e.preventDefault(); dragMoved=true; dragPoint={x:e.clientX,y:e.clientY};
  dragEl.style.left=(e.clientX-dragOffset.x)+"px";
  dragEl.style.top=(e.clientY-dragOffset.y)+"px";
  if(!dragRAF) dragRAF=requestAnimationFrame(applyPointerPlaceholder);
}

function applyPointerPlaceholder(){
  dragRAF=0; if(!dragEl||!dragPh||!gridEl||!dragPoint) return;
  // 抖动抑制：placeholder 每次移动后，指针需再移动一段距离才重新判定，
  // 既能用实时坐标（落点准确），又不会陷入重排反馈循环
  if(dragLastMove&&Math.hypot(dragPoint.x-dragLastMove.x,dragPoint.y-dragLastMove.y)<6) return;
  var els=$all(".card",gridEl).filter(function(c){ return c!==dragEl; });
  if(!els.length){ if(dragPh.parentNode!==gridEl) gridEl.appendChild(dragPh); return; }
  // 实时测量（拖拽中的卡片是 fixed 定位不占布局，placeholder 占据当前槽位）
  var items=els.map(function(c){ var b=c.getBoundingClientRect(); return {el:c,b:b,cx:b.left+b.width/2,cy:b.top+b.height/2}; });
  var x=dragPoint.x, y=dragPoint.y, target=null, before=true;
  if(state.view==="list"){
    // 列表模式：按 Y 轴找第一个中心点在指针下方的卡片
    for(var i=0;i<items.length;i++){ if(y<items[i].cy){ target=items[i]; before=true; break; } }
  } else {
    // 网格模式：先按行分组定位指针所在行，再在行内按 X 轴判定插入点
    items.sort(function(a,b){ return a.b.top-b.b.top||a.cx-b.cx; });
    var rows=[], cur=null;
    items.forEach(function(it){
      if(!cur||it.b.top>=cur.bottom-it.b.height*0.5){ cur={top:it.b.top,bottom:it.b.bottom,items:[]}; rows.push(cur); }
      cur.top=Math.min(cur.top,it.b.top); cur.bottom=Math.max(cur.bottom,it.b.bottom); cur.items.push(it);
    });
    var row=rows[rows.length-1];
    for(var k=0;k<rows.length;k++){ if(y<=rows[k].bottom+5){ row=rows[k]; break; } }
    row.items.sort(function(a,b){ return a.cx-b.cx; });
    for(var m=0;m<row.items.length;m++){ if(x<row.items[m].cx){ target=row.items[m]; before=true; break; } }
    if(!target){ target=row.items[row.items.length-1]; before=false; }
  }
  // 计算目标参照节点；若 placeholder 已在目标位置则不动
  var ref=null;
  if(target){
    if(before){ ref=target.el; }
    else { ref=target.el.nextElementSibling; while(ref===dragEl) ref=ref.nextElementSibling; }
  }
  if(ref===dragPh) return;
  var probe=dragPh.nextElementSibling; while(probe===dragEl) probe=probe.nextElementSibling;
  if(probe===ref||(ref===null&&probe===null)) return;
  if(ref){ gridEl.insertBefore(dragPh,ref); } else { gridEl.appendChild(dragPh); }
  dragLastMove={x:x,y:y};
}

function endCardPointerDrag(e){
  if(e&&dragPointer!=null&&e.pointerId!==dragPointer) return;
  cleanupPointerListeners();
  if(dragEl&&dragPh&&dragPh.parentNode){ dragPh.parentNode.insertBefore(dragEl,dragPh); }
  finishCardPointerDrag(true);
}
function cancelCardPointerDrag(){ cleanupPointerListeners(); finishCardPointerDrag(false); }
function cleanupPointerListeners(){
  window.removeEventListener("pointermove", onCardPointerMove);
  if(dragRAF){ cancelAnimationFrame(dragRAF); dragRAF=0; }
}
function finishCardPointerDrag(shouldCommit){
  if(dragEl){
    dragEl.classList.remove("dragging");
    dragEl.style.width=""; dragEl.style.height=""; dragEl.style.left=""; dragEl.style.top=""; dragEl.style.gridColumn="";
  }
  if(dragPh&&dragPh.parentNode) dragPh.parentNode.removeChild(dragPh);
  if(gridEl) gridEl.classList.remove("dragging-active");
  if(shouldCommit&&dragMoved) commitOrderFromDom();
  dragEl=null; dragPh=null; dragMoved=false; dragPointer=null; dragPoint=null; dragLastMove=null;
}

function commitOrderFromDom(){ if(!gridEl) return; var domIds=$all(".card",gridEl).map(function(c){ return c.getAttribute("data-id"); }); if(!domIds.length) return; var vis={}; domIds.forEach(function(id){ vis[id]=true; }); var queue=domIds.slice(); var out=state.bookmarks.map(function(b){ return vis[b.id]?null:b; }); var qi=0; for(var i=0;i<out.length;i++){ if(out[i]===null){ out[i]=byId(queue[qi++]); } } state.bookmarks=out.filter(Boolean); save(); }
