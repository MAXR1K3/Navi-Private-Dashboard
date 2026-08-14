/* cleanup.js — 书签整理：把「该清掉的」挑出来集中处理。
   四类：重复 URL / 从未打开 / 长期未打开 / 失效链接（复用 health 的检测结果）。
   处理动作统一走 moveToTrash()，可撤销，不做永久删除。 */
"use strict";

var cleanupFilter="all", cleanupStaleDays=365, cleanupSel={};
var CLEAN_STALE_OPTS=[90,180,365];

function cleanupNormUrl(u){ return (typeof normForDup==="function")?normForDup(u):normalizeUrl(u||"").replace(/\/+$/,"").toLowerCase(); }

/* 扫描：每条书签最多归入一类，重复优先（否则同一条会在多个分组里重复出现） */
function cleanupScan(){
  var now=Date.now(), cut=now-cleanupStaleDays*86400000;
  var byUrl={}, dupIds={}, out={dup:[],never:[],stale:[],dead:[]};
  state.bookmarks.forEach(function(b){
    var k=cleanupNormUrl(b.url); if(!k) return;
    (byUrl[k]=byUrl[k]||[]).push(b);
  });
  Object.keys(byUrl).forEach(function(k){
    var g=byUrl[k]; if(g.length<2) return;
    // 保留最有价值的一条：点击多 → 最近打开 → 描述更全
    var sorted=g.slice().sort(function(a,b){
      return (b.clicks||0)-(a.clicks||0) ||
             (b.lastOpened||0)-(a.lastOpened||0) ||
             String(b.description||"").length-String(a.description||"").length;
    });
    sorted.slice(1).forEach(function(b){ dupIds[b.id]=true; out.dup.push({b:b, keep:sorted[0]}); });
  });
  state.bookmarks.forEach(function(b){
    if(dupIds[b.id]) return;
    if((b.health&&b.health.status)==="bad"){ out.dead.push({b:b}); return; }
    if(!(b.clicks||0) && !(b.lastOpened||0)){ out.never.push({b:b}); return; }
    if((b.lastOpened||0)>0 && b.lastOpened<cut) out.stale.push({b:b, days:Math.floor((now-b.lastOpened)/86400000)});
  });
  return out;
}
function cleanupList(groups){
  if(cleanupFilter==="all") return groups.dup.concat(groups.dead,groups.never,groups.stale);
  return groups[cleanupFilter]||[];
}
function cleanupReason(it){
  if(it.keep) return t("cleanReasonDup",{name:clipSummary(it.keep.title||getDomain(it.keep.url),28)});
  if((it.b.health&&it.b.health.status)==="bad") return t("cleanReasonDead");
  if(it.days!=null) return t("cleanReasonStale",{days:it.days});
  return t("cleanReasonNever");
}
function renderCleanup(){
  var listEl=$("#cleanList"); if(!listEl) return;
  var g=cleanupScan(), list=cleanupList(g);
  var counts={ all:g.dup.length+g.dead.length+g.never.length+g.stale.length,
               dup:g.dup.length, dead:g.dead.length, never:g.never.length, stale:g.stale.length };
  $all("#cleanFilter [data-clean-filter]").forEach(function(btn){
    var f=btn.getAttribute("data-clean-filter");
    btn.classList.toggle("on", f===cleanupFilter);
    var lab={all:"cleanAll",dup:"cleanDup",dead:"cleanDead",never:"cleanNever",stale:"cleanStale"}[f];
    btn.innerHTML='<span>'+escapeHtml(t(lab))+'</span><span class="health-count">'+counts[f]+'</span>';
  });
  $all("#cleanStaleSeg [data-clean-days]").forEach(function(btn){
    btn.classList.toggle("on", +btn.getAttribute("data-clean-days")===cleanupStaleDays);
  });
  // 清掉已不在列表里的勾选，避免误删
  var alive={}; list.forEach(function(it){ alive[it.b.id]=true; });
  Object.keys(cleanupSel).forEach(function(id){ if(!alive[id]) delete cleanupSel[id]; });

  if(!counts.all){ listEl.innerHTML='<div class="w-empty">'+escapeHtml(t("cleanEmpty"))+'</div>'; syncCleanupFoot(0); return; }
  if(!list.length){ listEl.innerHTML='<div class="w-empty">'+escapeHtml(t("cleanFilteredEmpty"))+'</div>'; syncCleanupFoot(0); return; }

  listEl.innerHTML=list.map(function(it){
    var b=it.b, dom=getDomain(b.url), hue=hashHue(dom||b.title), letter=(b.title||dom||"?").trim().charAt(0)||"?";
    return '<label class="clean-item'+(cleanupSel[b.id]?" on":"")+'">'+
      '<input type="checkbox" data-clean-cb="'+escapeHtml(b.id)+'"'+(cleanupSel[b.id]?" checked":"")+' aria-label="'+escapeHtml(b.title||dom)+'">'+
      '<div class="fav" style="--c:'+hue+'"><span class="letter">'+escapeHtml(letter)+'</span></div>'+
      '<div class="min0">'+
        '<div class="tt">'+escapeHtml(b.title||dom)+'</div>'+
        '<div class="tu">'+escapeHtml(prettyUrl(b.url))+'</div>'+
        '<div class="texp">'+escapeHtml(cleanupReason(it))+' · '+escapeHtml(catLabel(b.category))+'</div>'+
      '</div>'+
      '<button type="button" class="btn sm" data-clean-open="'+escapeHtml(b.id)+'">'+escapeHtml(t("healthIssueOpen"))+'</button>'+
    '</label>';
  }).join("");
  syncCleanupFoot(list.length);
}
function syncCleanupFoot(total){
  var n=Object.keys(cleanupSel).length;
  var btn=$("#cleanTrashBtn"); if(btn){ btn.disabled=!n; btn.textContent=n?t("cleanTrashN",{n:n}):t("cleanTrash"); }
  var all=$("#cleanSelectAll"); if(all) all.disabled=!total;
}
function openCleanup(){
  cleanupFilter="all"; cleanupSel={};
  renderCleanup();
  openOverlay("cleanOverlay");
}
function cleanupTrashSelected(){
  var ids=Object.keys(cleanupSel); if(!ids.length) return;
  function go(){
    var undo=moveToTrash(ids);
    cleanupSel={}; render(); renderCleanup();
    if(typeof toastUndo==="function") toastUndo(t("cleanTrashed",{n:ids.length}), undo);
    else toast(t("cleanTrashed",{n:ids.length}),"ok");
  }
  // 回收站保留天数为 0 时是永久删除 —— 这种情况必须先确认
  if(typeof trashRetentionDays==="function" && trashRetentionDays()<=0)
    openConfirm(t("cleanTrash"), t("cleanPermanentMsg",{n:ids.length}), t("delete"), go);
  else go();
}

(function wireCleanup(){
  var f=$("#cleanFilter");
  if(f) f.addEventListener("click", function(e){
    var b=e.target.closest("[data-clean-filter]"); if(!b) return;
    cleanupFilter=b.getAttribute("data-clean-filter")||"all"; renderCleanup();
  });
  var s=$("#cleanStaleSeg");
  if(s) s.addEventListener("click", function(e){
    var b=e.target.closest("[data-clean-days]"); if(!b) return;
    cleanupStaleDays=+b.getAttribute("data-clean-days")||365; renderCleanup();
  });
  var l=$("#cleanList");
  if(l){
    l.addEventListener("change", function(e){
      var cb=e.target.closest("[data-clean-cb]"); if(!cb) return;
      var id=cb.getAttribute("data-clean-cb");
      if(cb.checked) cleanupSel[id]=true; else delete cleanupSel[id];
      var row=cb.closest(".clean-item"); if(row) row.classList.toggle("on", cb.checked);
      syncCleanupFoot(document.querySelectorAll("#cleanList .clean-item").length);
    });
    l.addEventListener("click", function(e){
      var o=e.target.closest("[data-clean-open]"); if(!o) return;
      e.preventDefault(); openBookmark(o.getAttribute("data-clean-open"));
    });
  }
  var all=$("#cleanSelectAll");
  if(all) all.addEventListener("click", function(){
    var boxes=$all("#cleanList [data-clean-cb]");
    var everyOn=boxes.length&&boxes.every(function(cb){ return cb.checked; });
    boxes.forEach(function(cb){
      cb.checked=!everyOn;
      var id=cb.getAttribute("data-clean-cb");
      if(cb.checked) cleanupSel[id]=true; else delete cleanupSel[id];
      var row=cb.closest(".clean-item"); if(row) row.classList.toggle("on", cb.checked);
    });
    syncCleanupFoot(boxes.length);
  });
  var tb=$("#cleanTrashBtn");
  if(tb) tb.addEventListener("click", cleanupTrashSelected);
})();
