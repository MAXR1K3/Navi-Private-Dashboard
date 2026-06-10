/* trash.js — 回收站：软删除、保留期（立即/1/3/7/14 天）、恢复/永久删除/清空、到期自动清理 */
"use strict";

function trashRetentionDays(){ var v=Number(state.settings.trashRetention); return isNaN(v)?7:v; }

// 启动与每次打开回收站时调用：清掉过期项
function purgeTrash(){
  if(!Array.isArray(state.trash)) state.trash=[];
  if(!state.trash.length) return;
  var days=trashRetentionDays();
  if(days<=0){ state.trash=[]; save(); return; }
  var ms=days*86400000, now=Date.now(), before=state.trash.length;
  state.trash=state.trash.filter(function(it){ return it&&it.bm&&(now-(it.deletedAt||0))<ms; });
  if(state.trash.length!==before) save();
}

// 把若干书签移入回收站；返回撤销函数（保留期为“立即”时也支持在 toast 时限内撤销）
function moveToTrash(ids){
  var set={}; ids.forEach(function(id){ set[id]=true; });
  var removed=[];
  state.bookmarks.forEach(function(b,i){ if(set[b.id]) removed.push({bm:b,index:i}); });
  state.bookmarks=state.bookmarks.filter(function(b){ return !set[b.id]; });
  var keep=trashRetentionDays()>0;
  if(keep){ removed.forEach(function(r){ state.trash.unshift({bm:r.bm,deletedAt:Date.now()}); }); }
  save();
  return function(){
    if(keep){ var ts={}; removed.forEach(function(r){ ts[r.bm.id]=true; }); state.trash=state.trash.filter(function(it){ return !ts[it.bm.id]; }); }
    removed.sort(function(a,b){ return a.index-b.index; }).forEach(function(r){
      state.bookmarks.splice(Math.min(r.index,state.bookmarks.length),0,r.bm);
    });
    save(); render();
    if($("#trashOverlay").classList.contains("open")) renderTrash();
  };
}

function trashExpLabel(it){
  var days=trashRetentionDays(); if(days<=0) return "";
  var left=Math.ceil((it.deletedAt+days*86400000-Date.now())/86400000);
  return left<=0?t("expToday"):t("expDays",{d:left});
}

function renderTrash(){
  purgeTrash();
  var listEl=$("#trashList"), sel=$("#trashRet");
  sel.innerHTML=[0,1,3,7,14].map(function(d){
    return '<option value="'+d+'">'+escapeHtml(d===0?t("retImmediate"):t("retDays",{n:d}))+'</option>';
  }).join("");
  sel.value=String(trashRetentionDays());
  $("#trashEmptyBtn").disabled=!state.trash.length;
  if(!state.trash.length){ listEl.innerHTML='<div class="w-empty">'+escapeHtml(t("trashEmptyMsg"))+'</div>'; return; }
  listEl.innerHTML=state.trash.map(function(it,i){
    var b=it.bm, dom=getDomain(b.url), hue=hashHue(dom||b.title), letter=(b.title||dom||"?").trim().charAt(0)||"?";
    var exp=trashExpLabel(it);
    return '<div class="trash-item">'+
      '<div class="fav" style="--c:'+hue+'"><span class="letter">'+escapeHtml(letter)+'</span></div>'+
      '<div class="min0"><div class="tt">'+escapeHtml(b.title||dom)+'</div>'+
        '<div class="tu">'+escapeHtml(prettyUrl(b.url))+'</div>'+
        '<div class="texp">'+escapeHtml(catLabel(b.category))+(exp?" · "+escapeHtml(exp):"")+'</div></div>'+
      '<div class="acts">'+
        '<button class="btn sm" data-restore="'+i+'">'+escapeHtml(t("restore"))+'</button>'+
        '<button class="btn sm danger" data-zap="'+i+'">'+escapeHtml(t("deleteForever"))+'</button>'+
      '</div></div>';
  }).join("");
}

function openTrash(){ renderTrash(); openOverlay("trashOverlay"); }

$("#trashList").addEventListener("click", function(e){
  var r=e.target.closest("[data-restore]"), z=e.target.closest("[data-zap]");
  if(r){
    var it=state.trash.splice(Number(r.getAttribute("data-restore")),1)[0];
    if(it&&it.bm){
      if(it.bm.category&&state.categories.indexOf(it.bm.category)===-1&&!isReservedCat(it.bm.category)) state.categories.push(it.bm.category);
      state.bookmarks.unshift(it.bm);
      save(); render(); renderTrash(); toast(t("restored"),"ok");
    }
    return;
  }
  if(z){ state.trash.splice(Number(z.getAttribute("data-zap")),1); save(); renderTrash(); toast(t("bookmarkDeleted"),"ok"); }
});
$("#trashRet").addEventListener("change", function(e){
  state.settings.trashRetention=Number(e.target.value); save(); renderTrash();
});
$("#trashEmptyBtn").addEventListener("click", function(){
  if(!state.trash.length) return;
  openConfirm(t("emptyTrash"), t("emptyTrashMsg",{n:state.trash.length}), t("emptyTrash"), function(){
    state.trash=[]; save(); toast(t("trashEmptied"),"ok"); openTrash();
  });
});
