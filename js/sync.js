/* sync.js — Profiles（数据源管理）+ WebDAV/NAS 读写同步 + 同步状态。
   从远程 bookmarks.json 拉取并展示，失败回退本地缓存；桌面扩展可把当前 bookmarks.json 写回 NAS。
   Profile（⑨）：每个 Profile 一个数据源（local / webdav）。当前 Profile 的数据存主库（KEY），
   其余 Profile 各自缓存在 navi.pdata.<id>。切换 Profile = 交换展示数据（不计入操作日志）。 */
"use strict";

var PDATA_PREFIX="navi.pdata.";
var _syncStatus={state:"local", at:0, msg:""}; // state: local|syncing|remote|cache|failed

/* ----- profiles model ----- */
function getProfiles(){
  var s=state.settings;
  if(!Array.isArray(s.profiles)||!s.profiles.length) s.profiles=[{id:"local",name:"Local",type:"local"}];
  if(!s.profiles.some(function(p){return p.id==="local";})) s.profiles.unshift({id:"local",name:"Local",type:"local"});
  if(!s.activeProfile||!s.profiles.some(function(p){return p.id===s.activeProfile;})) s.activeProfile="local";
  return s.profiles;
}
function getProfile(id){ var ps=getProfiles(); for(var i=0;i<ps.length;i++){ if(ps[i].id===id) return ps[i]; } return null; }
function activeProfile(){ return getProfile(state.settings.activeProfile)||getProfile("local"); }
function profileDisplayName(p){ if(!p) return ""; if(p.id==="local"&&(!p.name||p.name==="Local")) return t("profileLocalName"); return p.name||t("profileUntitled"); }
function deriveCats(items){ var seen={},out=[]; (items||[]).forEach(function(b){ var c=b.category||"Uncategorized"; if(!seen[c]){ seen[c]=1; out.push(c); } }); return out; }

/* ----- per-profile data cache ----- */
function profileDataSnapshot(extra){
  return Object.assign({
    bookmarks:state.bookmarks, categories:state.categories, trash:state.trash, calendarEvents:state.calendarEvents,
    theme:state.theme, view:state.view, settings:state.settings
  }, extra||{});
}
function cacheProfileData(id, data){
  try{
    localStorage.setItem(PDATA_PREFIX+id, JSON.stringify({
      bookmarks:data.bookmarks||[], categories:data.categories||[], trash:Array.isArray(data.trash)?data.trash:[], calendarEvents:Array.isArray(data.calendarEvents)?data.calendarEvents:[],
      theme:data.theme||"light", view:(data.view==="list2"?"list":data.view)||"grid",
      settings:data.settings||null, at:Date.now()
    }));
  }catch(e){}
}
function loadProfileData(id){ try{ var raw=localStorage.getItem(PDATA_PREFIX+id); if(raw){ var d=JSON.parse(raw); if(Array.isArray(d.bookmarks)) return d; } }catch(e){} return null; }
function dropProfileData(id){ try{ localStorage.removeItem(PDATA_PREFIX+id); }catch(e){} }
function applyProfileData(data){
  state.bookmarks=data&&Array.isArray(data.bookmarks)?cloneJson(data.bookmarks):[];
  state.categories=data&&Array.isArray(data.categories)?cloneJson(data.categories):[];
  state.trash=data&&Array.isArray(data.trash)?cloneJson(data.trash):[];
  state.calendarEvents=data&&Array.isArray(data.calendarEvents)?cloneJson(data.calendarEvents):[];
  if(data&&data.theme) state.theme=data.theme;
  if(data&&data.view) state.view=(data.view==="list2"?"list":data.view)||"grid";
  if(data&&data.settings&&typeof mergeDashboardSettings==="function"){
    state.settings=mergeDashboardSettings(state.settings, data.settings, {preserveProfiles:true, preservePrivate:true});
  }
  ui.activeCat="All"; ui.selected={};
  rebuildCategories(); normalizeWidgetOrder();
}

/* ----- switch active profile（交换展示数据） ----- */
function switchProfile(id){
  var cur=state.settings.activeProfile;
  if(id===cur){ return; }
  // 1) 暂存当前 Profile 的数据到它自己的缓存
  cacheProfileData(cur, profileDataSnapshot());
  // 2) 切换并载入目标 Profile 的数据
  state.settings.activeProfile=id;
  var p=getProfile(id), cached=loadProfileData(id);
  if(cached){ applyProfileData(cached); }
  else { state.bookmarks=[]; state.categories=[]; state.trash=[]; ui.activeCat="All"; ui.selected={}; rebuildCategories(); }
  saveSilently();           // 持久化但不写操作日志
  render();
  if(p && p.type==="webdav"){
    setSyncStatus(cached?"cache":"syncing", cached?cached.at:0);
    if(p.autoSync!==false || !cached) syncProfile(id);
  } else { setSyncStatus("local"); }
}

/* ----- remote read/write ----- */
function webdavHeaders(p, extra){
  var headers=Object.assign({}, extra||{});
  if(p&&p.user){ try{ headers.Authorization="Basic "+btoa(unescape(encodeURIComponent(p.user+":"+(p.pass||"")))); }catch(e){} }
  return headers;
}
function cloneJson(obj){ return JSON.parse(JSON.stringify(obj)); }
function buildWebdavPayload(){
  var payload=typeof buildBackup==="function" ? cloneJson(buildBackup()) : {
    schema:"navi-bookmarks", version:3, app:state.settings.appName||"Navi", exportedAt:new Date().toISOString(),
    bookmarks:state.bookmarks, categories:state.categories, trash:state.trash, settings:state.settings
  };
  payload.syncedAt=new Date().toISOString();
  payload.sync={ direction:"upload", client:"desktop-extension", source:(typeof syncSource==="function"?syncSource():"manual") };
  if(payload.settings){
    payload.settings.aiKey="";
    if(Array.isArray(payload.settings.profiles)){
      payload.settings.profiles.forEach(function(profile){ if(profile) profile.pass=""; });
    }
  }
  return payload;
}
function parseRemote(txt){
  txt=String(txt||"").trim(); if(!txt) return null;
  if(txt.charAt(0)==="{"||txt.charAt(0)==="["){
    try{
      var j=JSON.parse(txt);
      if(Array.isArray(j)) j={bookmarks:j};
      if(typeof normalizeDashboardPayload==="function"){
        return normalizeDashboardPayload(j,{preserveProfiles:true, preservePrivate:true});
      }
      var arr=j.bookmarks;
      if(Array.isArray(arr)){
        var bms=arr.map(function(b){ var out=Object.assign({}, b); out.id=out.id||uid(); out.title=out.title||out.name||getDomain(out.url||"")||""; out.url=normalizeUrl(out.url||out.href||""); out.category=out.category||out.folder||"Uncategorized"; out.description=out.description||""; out.tags=Array.isArray(out.tags)?out.tags:[]; return out; }).filter(function(b){ return b.url; });
        return { bookmarks:bms, categories:Array.isArray(j.categories)?j.categories:deriveCats(bms), trash:Array.isArray(j.trash)?j.trash:[], theme:j.theme||state.theme, view:(j.view==="list2"?"list":j.view)||state.view, settings:j.settings||null };
      }
    }catch(e){}
    return null;
  }
  // 退回：把 Netscape HTML 书签文件里的链接抽出来
  try{ var doc=new DOMParser().parseFromString(txt,"text/html"), items=[];
    $all("a[href]",doc).forEach(function(a){ var href=a.getAttribute("href")||""; if(/^https?:/i.test(href)) items.push({ id:uid(), title:(a.textContent||"").trim()||href, url:href, category:"Uncategorized", description:"", tags:[] }); });
    if(items.length) return { bookmarks:items, categories:deriveCats(items) };
  }catch(e){}
  return null;
}
function syncProfile(id){
  var p=getProfile(id);
  if(!p||p.type!=="webdav"||!p.url){ setSyncStatus("local"); return; }
  setSyncStatus("syncing");
  fetch(p.url, { headers:webdavHeaders(p), cache:"no-store", credentials:"omit" })
    .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.text(); })
    .then(function(txt){
      var data=parseRemote(txt); if(!data) throw new Error(t("syncBadData"));
      if(!Array.isArray(data.calendarEvents)){
        var cached=loadProfileData(id);
        data.calendarEvents=Array.isArray(cached&&cached.calendarEvents)?cached.calendarEvents:(state.settings.activeProfile===id?state.calendarEvents:[]);
      }
      cacheProfileData(id, data);
      if(state.settings.activeProfile===id){ applyProfileData(data); saveSilently(); render(); }
      rememberRemoteFp(id, data.bookmarks);   // 记下这次拉到的远程内容指纹，供上传前比对
      setSyncStatus("remote", Date.now());
      toast(t("syncOk",{n:data.bookmarks.length}),"ok");
    })
    .catch(function(err){
      var hasData=state.bookmarks.length>0 || !!loadProfileData(id);
      setSyncStatus(hasData?"cache":"failed", _syncStatus.at, String(err&&err.message||err));
      toast(t("syncFailed"),"err");
    });
}
function uploadWebdavProfile(id, opts){
  opts=opts||{};
  var p=getProfile(id);
  if(!p||p.type!=="webdav"||!p.url){
    if(!opts.silent) toast(t("syncNoUrl"),"err");
    return Promise.reject(new Error("no-url"));
  }
  setSyncStatus("syncing", _syncStatus.at);
  var payload=buildWebdavPayload();
  var body=JSON.stringify(payload,null,2);
  return fetch(p.url, {
    method:"PUT",
    headers:webdavHeaders(p, {"Content-Type":"application/json; charset=utf-8"}),
    body:body,
    cache:"no-store",
    credentials:"omit"
  }).then(function(r){
    if(!r.ok) throw new Error("HTTP "+r.status);
    cacheProfileData(id, {bookmarks:state.bookmarks, categories:state.categories});
    rememberRemoteFp(id, state.bookmarks);   // 远程现在就是我们刚写上去的内容
    p.lastUpload=Date.now();
    setSyncStatus("remote", p.lastUpload);
    saveSilently();
    syncProfileEditor();
    if(!opts.silent) toast(t("webdavUploadOk",{n:state.bookmarks.length}),"ok");
    return { count:state.bookmarks.length, bytes:body.length };
  }).catch(function(err){
    setSyncStatus("failed", _syncStatus.at, String(err&&err.message||err));
    if(!opts.silent) toast(t("webdavUploadFailed"),"err");
    throw err;
  });
}
function maybeUploadBookmarksAfterBrowserSync(source, res){
  var p=activeProfile();
  if(!p||p.type!=="webdav"||p.autoUpload!==true||!p.url) return Promise.resolve(false);
  // 自动上传也要先查冲突：远程若有别处的新改动，宁可不传也不覆盖
  return pushWithConflictCheck(p.id,{silent:true, source:source, result:res}).then(function(ok){ return !!ok; }).catch(function(){ return false; });
}

/* ===== ⑩ 双向同步：冲突检测 + 合并 =====
   指纹只看内容（id/url/标题/分类/描述/标签）并排序后计算，与排列顺序无关：
   避免「只是拖动过顺序」被误判成冲突。 */
function syncFingerprint(list){
  var s=(list||[]).map(function(b){
    return [b.id,b.url,b.title,b.category,b.description||"",(b.tags||[]).join("|")].join("");
  }).sort().join("");
  var h=5381;
  for(var i=0;i<s.length;i++){ h=((h*33)^s.charCodeAt(i))>>>0; }
  return String(h)+"."+((list&&list.length)||0);
}
function rememberRemoteFp(id, list){
  var p=getProfile(id); if(!p) return;
  p.remoteFp=syncFingerprint(list);
}
function normUrlKey(u){ return (typeof normForDup==="function")?normForDup(u):normalizeUrl(u||"").replace(/\/+$/,"").toLowerCase(); }

/* 读取远程当前内容；404/不存在 → {missing:true} */
function fetchRemoteData(p){
  return fetch(p.url,{headers:webdavHeaders(p),cache:"no-store",credentials:"omit"}).then(function(r){
    if(r.status===404||r.status===410) return {missing:true};
    if(!r.ok) throw new Error("HTTP "+r.status);
    return r.text().then(function(txt){
      var data=parseRemote(txt);
      if(!data) return {unreadable:true};
      return {data:data};
    });
  });
}

/* 合并：以 URL 为键取并集，同一 URL 本地优先；本地回收站充当墓碑，避免已删除的条目被远程复活 */
function mergeRemoteIntoLocal(remote){
  var out=state.bookmarks.slice(), have={}, trashed={};
  out.forEach(function(b){ have[normUrlKey(b.url)]=true; });
  (state.trash||[]).forEach(function(tr){ var u=tr&&tr.bm&&tr.bm.url; if(u) trashed[normUrlKey(u)]=true; });
  var added=0;
  (remote.bookmarks||[]).forEach(function(rb){
    var k=normUrlKey(rb.url); if(!k||have[k]||trashed[k]) return;
    have[k]=true; out.push(rb); added++;
  });
  var cats=state.categories.slice(), hc={};
  cats.forEach(function(c){ hc[c]=true; });
  (remote.categories||[]).forEach(function(c){ if(c&&!hc[c]){ hc[c]=true; cats.push(c); } });
  return { bookmarks:out, categories:cats, added:added };
}

/* 上传前先比对远程指纹：一致（或远程还不存在）才直接写，否则交给用户决定 */
function pushWithConflictCheck(id, opts){
  opts=opts||{};
  var p=getProfile(id);
  if(!p||p.type!=="webdav"||!p.url){ if(!opts.silent) toast(t("syncNoUrl"),"err"); return Promise.resolve(false); }
  return fetchRemoteData(p).then(function(r){
    if(r.missing||!p.remoteFp) return uploadWebdavProfile(id,opts).then(function(){ return true; });
    if(r.unreadable) return openSyncConflict(id,null,opts);
    var fp=syncFingerprint(r.data.bookmarks);
    if(fp===p.remoteFp) return uploadWebdavProfile(id,opts).then(function(){ return true; });
    return openSyncConflict(id, r.data, opts);
  }).catch(function(err){
    setSyncStatus("failed",_syncStatus.at,String(err&&err.message||err));
    if(!opts.silent) toast(t("webdavUploadFailed"),"err");
    return false;
  });
}

var _conflictCtx=null;
function openSyncConflict(id, remoteData, opts){
  _conflictCtx={id:id, remote:remoteData, opts:opts||{}};
  if((opts||{}).silent){
    // 自动上传遇冲突：不擅自覆盖，提示用户手动处理
    setSyncStatus("cache",_syncStatus.at,t("syncConflictShort"));
    toast(t("syncConflictAuto"),"err");
    return Promise.resolve(false);
  }
  var body=$("#conflictBody");
  if(body){
    var rn=remoteData?((remoteData.bookmarks||[]).length):0;
    body.textContent=remoteData?t("syncConflictMsg",{local:state.bookmarks.length,remote:rn}):t("syncConflictUnreadable");
  }
  var mergeBtn=$("#conflictMerge"); if(mergeBtn) mergeBtn.style.display=remoteData?"":"none";
  openOverlay("conflictOverlay");
  return Promise.resolve(false);
}
function resolveConflict(choice){
  var ctx=_conflictCtx; if(!ctx) return;
  closeOverlay("conflictOverlay");
  var id=ctx.id, remote=ctx.remote;
  _conflictCtx=null;
  if(choice==="local"){                       // 用本地覆盖远程
    uploadWebdavProfile(id,{force:true});
    return;
  }
  if(choice==="remote"){                      // 用远程覆盖本地
    if(!remote) return;
    cacheProfileData(id, remote);
    if(state.settings.activeProfile===id){ applyProfileData(remote); saveSilently(); render(); }
    rememberRemoteFp(id, remote.bookmarks); save();
    setSyncStatus("remote", Date.now());
    toast(t("syncOk",{n:(remote.bookmarks||[]).length}),"ok");
    return;
  }
  if(choice==="merge"&&remote){               // 合并后回传
    var m=mergeRemoteIntoLocal(remote);
    state.bookmarks=m.bookmarks; state.categories=m.categories;
    rebuildCategories(); saveSilently(); render();
    toast(t("syncMerged",{n:m.added}),"ok");
    uploadWebdavProfile(id,{force:true});
  }
}

/* ----- 同步状态（④） ----- */
function setSyncStatus(stt, at, msg){ _syncStatus={ state:stt, at:(at||(_syncStatus&&_syncStatus.at)||0), msg:msg||"" }; renderSyncChip(); renderSyncStatusLine(); }
function syncRelTime(ts){ if(!ts) return ""; var s=Math.floor((Date.now()-ts)/1000); if(s<60) return t("justNow"); var m=Math.floor(s/60); if(m<60) return m+"m"; var h=Math.floor(m/60); if(h<24) return h+"h"; return Math.floor(h/24)+"d"; }
function syncStateLabel(){ var st=_syncStatus.state; return st==="remote"?t("syncStateRemote"):st==="cache"?t("syncStateCache"):st==="failed"?t("syncStateFailed"):st==="syncing"?t("syncStateSyncing"):t("syncStateLocal"); }
function renderSyncChip(){
  var chip=$("#syncChip"); if(!chip) return;
  var p=activeProfile(), remote=p&&p.type==="webdav";
  if(!remote){ chip.hidden=true; chip.className="sync-chip"; chip.innerHTML=""; return; }
  chip.hidden=false;
  var cls=_syncStatus.state==="remote"?"ok":_syncStatus.state==="cache"?"cache":_syncStatus.state==="failed"?"fail":_syncStatus.state==="syncing"?"syncing":"";
  chip.className="sync-chip "+cls;
  var rel=syncRelTime(_syncStatus.at);
  chip.title=t("syncTapToSync");
  chip.innerHTML='<span class="dot"></span><span>'+escapeHtml(syncStateLabel())+(rel?(' · '+escapeHtml(rel)):'')+'</span>';
}
function renderSyncStatusLine(){
  var line=$("#syncStatusLine"); if(!line) return;
  var rel=syncRelTime(_syncStatus.at), txt=syncStateLabel()+(rel?(" · "+rel):"");
  // 失败原因、以及「远程有改动待处理」这类提示都要带出来
  if((_syncStatus.state==="failed"||_syncStatus.state==="cache")&&_syncStatus.msg) txt+=" — "+_syncStatus.msg;
  line.textContent=txt;
}

/* ----- 设置面板：Profiles 编辑 ----- */
function fillProfileSelect(){
  var sel=$("#profileSelect"); if(!sel) return;
  sel.innerHTML=getProfiles().map(function(p){ return '<option value="'+escapeHtml(p.id)+'"'+(p.id===state.settings.activeProfile?" selected":"")+'>'+escapeHtml(profileDisplayName(p))+'</option>'; }).join("");
}
function syncProfileEditor(){
  var p=activeProfile(); if(!p) return;
  fillProfileSelect();
  var nm=$("#profileName"); if(nm) nm.value=(p.id==="local"&&(!p.name||p.name==="Local"))?profileDisplayName(p):(p.name||"");
  $all('#profileTypeSeg [data-ptype]').forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-ptype")===(p.type||"local")); });
  var wf=$("#webdavFields"); if(wf) wf.style.display=(p.type==="webdav")?"":"none";
  if($("#webdavUrl")) $("#webdavUrl").value=p.url||"";
  if($("#webdavUser")) $("#webdavUser").value=p.user||"";
  if($("#webdavPass")) $("#webdavPass").value=p.pass||"";
  if($("#webdavAuto")) $("#webdavAuto").checked=p.autoSync!==false;
  if($("#webdavAutoUpload")) $("#webdavAutoUpload").checked=p.autoUpload===true;
  var del=$("#profileDelete"); if(del) del.disabled=getProfiles().length<=1;
  renderSyncStatusLine();
}
function updateActiveProfile(patch){ var p=activeProfile(); if(!p) return; Object.keys(patch).forEach(function(k){ p[k]=patch[k]; }); save(); syncProfileEditor(); renderSyncChip(); }
function deleteActiveProfile(){
  var p=activeProfile(); if(!p||getProfiles().length<=1) return;
  var delId=p.id;
  state.settings.profiles=getProfiles().filter(function(x){ return x.id!==delId; });
  dropProfileData(delId);
  var nextId=getProfiles()[0].id; state.settings.activeProfile=nextId;
  var cached=loadProfileData(nextId);
  if(cached) applyProfileData(cached);
  else { state.bookmarks=[]; state.categories=[]; state.trash=[]; ui.activeCat="All"; ui.selected={}; rebuildCategories(); }
  saveSilently(); render();
  var np=getProfile(nextId);
  if(np&&np.type==="webdav"){ setSyncStatus(cached?"cache":"syncing", cached?cached.at:0); if(np.autoSync!==false||!cached) syncProfile(nextId); }
  else setSyncStatus("local");
  syncProfileEditor();
}

/* ----- init + 事件 ----- */
function initSync(){
  getProfiles();
  var p=activeProfile();
  if(p&&p.type==="webdav"){
    var cached=loadProfileData(p.id);
    setSyncStatus(cached?"cache":"syncing", cached?cached.at:0);
    if(p.autoSync!==false) syncProfile(p.id); else if(!cached) setSyncStatus("failed",0,t("syncNoData"));
  } else { setSyncStatus("local"); }
  renderSyncChip();
}

(function wireSync(){
  var chip=$("#syncChip"); if(chip) chip.addEventListener("click", function(){ var p=activeProfile(); if(p&&p.type==="webdav") syncProfile(p.id); });
  var sel=$("#profileSelect"); if(sel) sel.addEventListener("change", function(e){ switchProfile(e.target.value); syncProfileEditor(); });
  var add=$("#profileAdd"); if(add) add.addEventListener("click", function(){
    var id="p"+Date.now().toString(36); getProfiles().push({ id:id, name:t("profileNewName"), type:"webdav", url:"", user:"", pass:"", autoSync:true });
    save(); switchProfile(id); syncProfileEditor();
  });
  var del=$("#profileDelete"); if(del) del.addEventListener("click", function(){
    var p=activeProfile(); if(!p||getProfiles().length<=1) return;
    openConfirm(t("profileDeleteTitle"), t("profileDeleteMsg",{name:profileDisplayName(p)}), t("deleteBtn"), deleteActiveProfile);
  });
  var nm=$("#profileName"); if(nm) nm.addEventListener("input", function(e){ updateActiveProfile({name:e.target.value}); });
  var seg=$("#profileTypeSeg"); if(seg) seg.addEventListener("click", function(e){ var b=e.target.closest("[data-ptype]"); if(!b) return; updateActiveProfile({type:b.getAttribute("data-ptype")}); renderSyncChip(); setSyncStatus(b.getAttribute("data-ptype")==="webdav"?(loadProfileData(activeProfile().id)?"cache":"failed"):"local"); });
  var url=$("#webdavUrl"); if(url) url.addEventListener("input", function(e){ updateActiveProfile({url:e.target.value.trim()}); });
  var usr=$("#webdavUser"); if(usr) usr.addEventListener("input", function(e){ updateActiveProfile({user:e.target.value}); });
  var pw=$("#webdavPass"); if(pw) pw.addEventListener("input", function(e){ updateActiveProfile({pass:e.target.value}); });
  var auto=$("#webdavAuto"); if(auto) auto.addEventListener("change", function(e){ updateActiveProfile({autoSync:e.target.checked}); });
  var autoUpload=$("#webdavAutoUpload"); if(autoUpload) autoUpload.addEventListener("change", function(e){ updateActiveProfile({autoUpload:e.target.checked}); });
  var now=$("#syncNowBtn"); if(now) now.addEventListener("click", function(){ var p=activeProfile(); if(p&&p.type==="webdav"){ if(!p.url){ toast(t("syncNoUrl"),"err"); return; } syncProfile(p.id); } });
  var upload=$("#webdavUploadBtn"); if(upload) upload.addEventListener("click", function(){
    var p=activeProfile(); if(!p||p.type!=="webdav"||!p.url){ toast(t("syncNoUrl"),"err"); return; }
    var btn=this; btn.disabled=true; btn.textContent=t("syncing");
    pushWithConflictCheck(p.id).finally(function(){ btn.disabled=false; btn.textContent=t("webdavUploadNow"); });
  });
  var cf=$("#conflictOverlay");
  if(cf) cf.addEventListener("click", function(e){
    var b=e.target.closest("[data-conflict]"); if(!b) return;
    resolveConflict(b.getAttribute("data-conflict"));
  });
})();
