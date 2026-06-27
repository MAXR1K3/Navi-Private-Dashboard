/* oplog.js — 操作日志 + 日志等级 + 溯源与撤销。
   单一接入点：所有变更都经过 save()，这里对「数据状态」做差异比对，自动生成带等级的日志，
   并保存变更前快照用于撤销。等级：info（增改/排序/设置）、warn（删除/移入回收站）、danger（永久删除/清空）。 */
"use strict";

var OPLOG_MAX=200;          // 日志条数上限（元数据）
var OPLOG_UNDO_DEPTH=15;    // 仅最近 N 条保留撤销快照，超出则丢弃快照（控制存储体积）
var OPLOG_COALESCE=1600;    // ms：同类连续操作（如连续输入）合并为一条

var _oplogReady=false, _oplogSuspended=false, _committedSnap=null, _olSeq=0;
var _quickUndoId=null, _quickUndoTimer=null;

/* ===== snapshot / restore ===== */
function oplogSnapshotRef(){ return { bookmarks:state.bookmarks, categories:state.categories, trash:state.trash, theme:state.theme, view:state.view, settings:state.settings }; }
function oplogClone(){ return JSON.parse(JSON.stringify(oplogSnapshotRef())); }
function oplogInit(){ if(!Array.isArray(state.opLog)) state.opLog=[]; _committedSnap=oplogClone(); _oplogReady=true; }
function oplogRestore(snap){
  state.bookmarks=JSON.parse(JSON.stringify(snap.bookmarks||[]));
  state.categories=JSON.parse(JSON.stringify(snap.categories||[]));
  state.trash=JSON.parse(JSON.stringify(snap.trash||[]));
  state.theme=snap.theme||"light"; state.view=snap.view||"grid";
  state.settings=JSON.parse(JSON.stringify(snap.settings||{}));
}

/* ===== diff helpers ===== */
var OPLOG_VOLATILE={ engineUsage:1, weather:1, chromeSyncLastSync:1, chromeSyncCount:1, powerProfileVersion:1, lowPower:1, animations:1, widgetsCollapsed:1, widgetsHidden:1 };
function bmContentEq(a,b){
  return a.title===b.title && a.url===b.url && a.category===b.category && a.description===b.description &&
    ((a.tags||[]).join(""))===((b.tags||[]).join(""));
}
function settingsChangedKeys(b,a){
  var keys={}, k, out=[];
  for(k in a) keys[k]=1; for(k in b) keys[k]=1;
  Object.keys(keys).forEach(function(k){ if(OPLOG_VOLATILE[k]) return; if(JSON.stringify(a[k])!==JSON.stringify(b[k])) out.push(k); });
  return out;
}
function motionLabel(v){ return v==="smooth"?t("motionSmooth"):t("motionLow"); }
function langLabel(v){ return v==="zh"?"中文":v==="es"?"Español":"English"; }

function settingChange(keys, s){
  if(keys.length===1){
    var k=keys[0];
    var map={
      motionMode:{key:"logSetMotion",vars:{v:motionLabel(s.motionMode)}}, lang:{key:"logSetLang",vars:{v:langLabel(s.lang)}},
      monitor:{key:"logSetMonitor"}, aiProvider:{key:"logSetAi"}, aiKey:{key:"logSetAi"},
      background:{key:"logSetBg"}, appName:{key:"logSetName"}, tagline:{key:"logSetTag"},
      categoryLayout:{key:"logSetCatLayout"}, clockSeconds:{key:"logSetClock"}, showHolidays:{key:"logSetHolidays"},
      glass:{key:"logSetGlass"}, glassOpacity:{key:"logSetGlass"}, refraction:{key:"logSetGlass"},
      widgets:{key:"logSetWidgets"}, widgetOrder:{key:"logSetWidgetOrder"}, widgetSize:{key:"logSetWidgetSize"},
      trashRetention:{key:"logSetRetention"}, chromeSync:{key:"logSetSync"}, chromeSyncReplace:{key:"logSetSync"}, logo:{key:"logSetLogo"}
    };
    var m=map[k]||{key:"logSetGeneric",vars:{k:k}};
    return { type:"setting:"+k, level:"info", key:m.key, vars:m.vars||{} };
  }
  return { type:"setting", level:"info", key:"logSetMultiple", vars:{n:keys.length} };
}

function oplogDiff(b,a){
  var ch=[];
  if(b.theme!==a.theme) ch.push({type:"theme",level:"info",key:"logTheme",vars:{v:a.theme}});
  if(b.view!==a.view) ch.push({type:"view",level:"info",key:"logView",vars:{v:a.view}});

  var clearAll=(a.bookmarks.length===0 && b.bookmarks.length>0 && a.categories.length===0 && b.categories.length>0);
  if(clearAll) ch.push({type:"clear",level:"danger",key:"logClearAll",vars:{}});

  var renameFrom=null, renameTo=null, deletedCat=null;
  if(!clearAll){
    var catB=b.categories||[], catA=a.categories||[];
    var catRemoved=catB.filter(function(c){return catA.indexOf(c)===-1;});
    var catAdded=catA.filter(function(c){return catB.indexOf(c)===-1;});
    if(catRemoved.length===1 && catAdded.length===1){ renameFrom=catRemoved[0]; renameTo=catAdded[0]; ch.push({type:"catRename",level:"info",key:"logCatRename",vars:{from:renameFrom,to:renameTo}}); }
    else if(catAdded.length===1 && catRemoved.length===0){ ch.push({type:"catAdd",level:"info",key:"logCatAdd",vars:{name:catAdded[0]}}); }
    else if(catRemoved.length===1 && catAdded.length===0){ deletedCat=catRemoved[0]; ch.push({type:"catDelete",level:"warn",key:"logCatDelete",vars:{name:deletedCat}}); }
    else if(!catAdded.length && !catRemoved.length && catB.length===catA.length && catB.join("")!==catA.join("")){ ch.push({type:"catReorder",level:"info",key:"logCatReorder",vars:{}}); }
    else if(catAdded.length||catRemoved.length){ ch.push({type:"catChange",level:"info",key:"logCatChange",vars:{}}); }
  }

  if(!clearAll){
    var bById={}, aById={}, tbIds={}, taIds={};
    b.bookmarks.forEach(function(x){bById[x.id]=x;}); a.bookmarks.forEach(function(x){aById[x.id]=x;});
    (b.trash||[]).forEach(function(it){ if(it&&it.bm) tbIds[it.bm.id]=it.bm; });
    (a.trash||[]).forEach(function(it){ if(it&&it.bm) taIds[it.bm.id]=it.bm; });
    var bmAdded=[], bmRemoved=[], bmChanged=[];
    Object.keys(aById).forEach(function(id){ if(!bById[id]) bmAdded.push(aById[id]); });
    Object.keys(bById).forEach(function(id){ if(!aById[id]) bmRemoved.push(bById[id]); });
    Object.keys(aById).forEach(function(id){ if(bById[id] && !bmContentEq(bById[id],aById[id])) bmChanged.push({b:bById[id],a:aById[id]}); });
    var tAdded=Object.keys(taIds).filter(function(id){return !tbIds[id];});
    var tRemoved=Object.keys(tbIds).filter(function(id){return !taIds[id];});

    var toTrash=tAdded.filter(function(id){ return bmRemoved.some(function(x){return x.id===id;}); });
    if(toTrash.length){
      bmRemoved=bmRemoved.filter(function(x){ return toTrash.indexOf(x.id)===-1; });
      if(toTrash.length===1) ch.push({type:"trashAdd",level:"warn",key:"logTrashAdd1",vars:{name:(taIds[toTrash[0]]||{}).title||""}});
      else ch.push({type:"trashAdd",level:"warn",key:"logTrashAddN",vars:{n:toTrash.length}});
    }
    var restored=tRemoved.filter(function(id){ return bmAdded.some(function(x){return x.id===id;}); });
    if(restored.length){
      bmAdded=bmAdded.filter(function(x){ return restored.indexOf(x.id)===-1; });
      if(restored.length===1) ch.push({type:"restore",level:"info",key:"logRestore1",vars:{name:tbIds[restored[0]].title}});
      else ch.push({type:"restore",level:"info",key:"logRestoreN",vars:{n:restored.length}});
    }
    var permDel=tRemoved.filter(function(id){ return restored.indexOf(id)===-1; });
    if(permDel.length){
      if(Object.keys(taIds).length===0 && permDel.length>1) ch.push({type:"trashEmpty",level:"danger",key:"logTrashEmpty",vars:{}});
      else if(permDel.length===1) ch.push({type:"trashDelete",level:"danger",key:"logTrashDelete1",vars:{name:tbIds[permDel[0]].title}});
      else ch.push({type:"trashDelete",level:"danger",key:"logTrashDeleteN",vars:{n:permDel.length}});
    }
    if(bmAdded.length>=3) ch.push({type:"import",level:"info",key:"logImport",vars:{n:bmAdded.length}});
    else bmAdded.forEach(function(x){ ch.push({type:"bmAdd",level:"info",key:"logBmAdd",vars:{name:x.title}}); });
    if(bmRemoved.length){
      if(bmRemoved.length===1) ch.push({type:"bmDelete",level:"warn",key:"logBmDelete1",vars:{name:bmRemoved[0].title}});
      else ch.push({type:"bmDelete",level:"warn",key:"logBmDeleteN",vars:{n:bmRemoved.length}});
    }
    // Bookmark edits — drop ones that are purely category rename/delete side-effects (already logged at category level)
    var realChanged=bmChanged.filter(function(p){
      var sameRest=(p.b.title===p.a.title && p.b.url===p.a.url && p.b.description===p.a.description);
      if(renameFrom && sameRest && p.b.category===renameFrom && p.a.category===renameTo) return false;
      if(deletedCat && sameRest && p.b.category===deletedCat && p.a.category==="Uncategorized") return false;
      return true;
    });
    if(realChanged.length){
      if(realChanged.length===1) ch.push({type:"bmEdit",level:"info",key:"logBmEdit1",vars:{name:realChanged[0].a.title},subject:"bm:"+realChanged[0].a.id});
      else ch.push({type:"bmEdit",level:"info",key:"logBmEditN",vars:{n:realChanged.length}});
    } else if(!bmAdded.length && !bmRemoved.length && !toTrash.length && !restored.length && !permDel.length){
      var ib=b.bookmarks.map(function(x){return x.id;}).join(""), ia=a.bookmarks.map(function(x){return x.id;}).join("");
      if(ib!==ia && b.bookmarks.length===a.bookmarks.length) ch.push({type:"bmReorder",level:"info",key:"logBmReorder",vars:{}});
    }
  }

  var sk=settingsChangedKeys(b.settings,a.settings);
  if(sk.length) ch.push(settingChange(sk,a.settings));
  return ch;
}

/* ===== capture / trim ===== */
function oplogEntry(c, snap){
  return { id:"L"+Date.now().toString(36)+(_olSeq++).toString(36), ts:Date.now(), level:c.level, type:c.type, ckey:(c.subject||c.type), key:c.key, vars:c.vars||{}, snap:snap };
}
function oplogTrim(){
  for(var i=OPLOG_UNDO_DEPTH;i<state.opLog.length;i++){ if(state.opLog[i].snap) state.opLog[i].snap=null; }
  if(state.opLog.length>OPLOG_MAX) state.opLog.length=OPLOG_MAX;
}
function oplogDropSnaps(){ for(var i=0;i<state.opLog.length;i++) state.opLog[i].snap=null; }
function oplogCapture(){
  if(!_oplogReady || _oplogSuspended) return;
  var cur=oplogClone();
  var changes=oplogDiff(_committedSnap, cur);
  if(changes.length){
    var snap=_committedSnap;
    if(changes.length===1){
      var c=changes[0], last=state.opLog[0];
      if(last && last.type!=="undo" && last.ckey===(c.subject||c.type) && (Date.now()-last.ts)<OPLOG_COALESCE){
        last.ts=Date.now(); last.key=c.key; last.vars=c.vars||{}; last.level=c.level; // keep last.snap (original before-state)
      } else {
        state.opLog.unshift(oplogEntry(c, snap));
      }
    } else {
      changes.forEach(function(c){ state.opLog.unshift(oplogEntry(c, snap)); });
    }
    oplogTrim();
  }
  _committedSnap=cur;
  if(typeof refreshLogBadge==="function") refreshLogBadge();
  if(changes.length && state.opLog[0] && state.opLog[0].snap && state.opLog[0].type!=="undo"){
    showQuickUndo(state.opLog[0]);
  }
}

/* ===== quick undo bar ===== */
function showQuickUndo(entry){
  var bar=$("#quickUndoBar"), msg=$("#quickUndoMsg"); if(!bar||!msg) return;
  _quickUndoId=entry.id;
  msg.textContent=t(entry.key, entry.vars);
  bar.classList.add("show");
  if(_quickUndoTimer) clearTimeout(_quickUndoTimer);
  _quickUndoTimer=setTimeout(hideQuickUndo, 5000);
}
function hideQuickUndo(){
  var bar=$("#quickUndoBar"); if(bar) bar.classList.remove("show");
  _quickUndoTimer=null; _quickUndoId=null;
}

/* ===== undo ===== */
function oplogUndo(id){
  hideQuickUndo();
  var e=null; for(var i=0;i<state.opLog.length;i++){ if(state.opLog[i].id===id){ e=state.opLog[i]; break; } }
  if(!e || !e.snap) return;
  _oplogSuspended=true;
  var redoSnap=oplogClone();          // current (post-op) state, so the undo itself stays reversible
  oplogRestore(e.snap);
  state.opLog.unshift({ id:"L"+Date.now().toString(36)+(_olSeq++).toString(36), ts:Date.now(), level:"info", type:"undo", ckey:"undo"+_olSeq, key:"logUndo", vars:{msg:t(e.key,e.vars)}, snap:redoSnap });
  oplogTrim();
  _committedSnap=oplogClone();
  save();
  _oplogSuspended=false;
  render();
  if(typeof renderOpLog==="function") renderOpLog();
  toast(t("undone"),"ok");
}

/* ===== log panel render ===== */
var _opLogFilter="all";
function renderOpLog(){
  var box=$("#opLogList"); if(!box) return;
  var items=state.opLog.filter(function(e){ return _opLogFilter==="all" || e.level===_opLogFilter; });
  if(!items.length){ box.innerHTML='<div class="w-empty">'+escapeHtml(t("logEmpty"))+'</div>'; return; }
  box.innerHTML=items.map(function(e){
    var canUndo=!!e.snap && e.type!=="undo";
    var when=new Date(e.ts).toLocaleString(LOCALE[state.settings.lang]);
    return '<div class="log-row '+escapeHtml(e.level)+'">'+
      '<span class="log-dot"></span>'+
      '<div class="log-main"><div class="log-msg">'+escapeHtml(t(e.key,e.vars))+'</div>'+
      '<div class="log-meta"><span class="log-lvl">'+escapeHtml(t("logLevel_"+e.level))+'</span> · <span title="'+escapeHtml(when)+'">'+escapeHtml(timeAgo(e.ts))+'</span></div></div>'+
      (canUndo?'<button class="btn log-undo" data-logundo="'+escapeHtml(e.id)+'" title="'+escapeHtml(t("logUndoTip"))+'">'+ICONS.undo+'<span>'+escapeHtml(t("undo"))+'</span></button>':'')+
    '</div>';
  }).join("");
}
function refreshLogBadge(){ var el=$("#logCount"); if(el) el.textContent=state.opLog.length?String(state.opLog.length):""; }

/* ===== settings-tab wiring ===== */
(function oplogWire(){
  var seg=$("#logFilterSeg");
  if(seg) seg.addEventListener("click", function(e){ var b=e.target.closest("[data-logfilter]"); if(!b) return; _opLogFilter=b.getAttribute("data-logfilter"); $all("#logFilterSeg [data-logfilter]").forEach(function(x){ x.classList.toggle("on", x===b); }); renderOpLog(); });
  var list=$("#opLogList");
  if(list) list.addEventListener("click", function(e){ var u=e.target.closest("[data-logundo]"); if(u) oplogUndo(u.getAttribute("data-logundo")); });
  var clr=$("#logClearBtn");
  if(clr) clr.addEventListener("click", function(){
    openConfirm(t("logClearTitle"), t("logClearMsg"), t("logClear"), function(){ state.opLog=[]; _oplogSuspended=true; save(); _oplogSuspended=false; renderOpLog(); refreshLogBadge(); toast(t("logCleared"),"ok"); });
  });
  var qBtn=$("#quickUndoBtn");
  if(qBtn) qBtn.addEventListener("click", function(){ var id=_quickUndoId; hideQuickUndo(); if(id) oplogUndo(id); });
  var qClose=$("#quickUndoClose");
  if(qClose) qClose.addEventListener("click", hideQuickUndo);
})();
