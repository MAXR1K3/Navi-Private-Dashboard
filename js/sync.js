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
    syncMeta:state.syncMeta, theme:state.theme, view:state.view, settings:state.settings
  }, extra||{});
}
function cacheProfileData(id, data){
  try{
    localStorage.setItem(PDATA_PREFIX+id, JSON.stringify({
      bookmarks:data.bookmarks||[], categories:data.categories||[], trash:Array.isArray(data.trash)?data.trash:[], calendarEvents:Array.isArray(data.calendarEvents)?data.calendarEvents:[],
      syncMeta:data.syncMeta&&Array.isArray(data.syncMeta.tombstones)?data.syncMeta:{tombstones:[]},
      theme:data.theme||"light", view:(data.view==="list2"?"list":data.view)||"grid",
      settings:data.settings||null, at:Date.now()
    }));
    return true;
  }catch(e){ return false; }
}
function loadProfileData(id){ try{ var raw=localStorage.getItem(PDATA_PREFIX+id); if(raw){ var d=JSON.parse(raw); if(Array.isArray(d.bookmarks)) return d; } }catch(e){} return null; }
function dropProfileData(id){ try{ localStorage.removeItem(PDATA_PREFIX+id); }catch(e){} }
function applyProfileData(data){
  state.bookmarks=data&&Array.isArray(data.bookmarks)?cloneJson(data.bookmarks):[];
  state.categories=data&&Array.isArray(data.categories)?cloneJson(data.categories):[];
  state.trash=data&&Array.isArray(data.trash)?cloneJson(data.trash):[];
  state.calendarEvents=data&&Array.isArray(data.calendarEvents)?cloneJson(data.calendarEvents):[];
  state.syncMeta=data&&data.syncMeta&&Array.isArray(data.syncMeta.tombstones)?cloneJson(data.syncMeta):{tombstones:[]};
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
  else { state.bookmarks=[]; state.categories=[]; state.trash=[]; state.syncMeta={tombstones:[]}; ui.activeCat="All"; ui.selected={}; rebuildCategories(); }
  saveSilently({tracking:"remote"});           // Profile 整体替换，不把上一 Profile 的 ID 记成删除
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
function buildWebdavPayload(snapshot){
  var canonical=snapshot&&typeof SyncMerge==="object"?SyncMerge.canonicalize(snapshot):null;
  if(snapshot&&!canonical) return null;
  var payload=canonical?{
    schema:"navi-bookmarks",version:4,app:state.settings.appName||"Navi",exportedAt:new Date().toISOString(),
    bookmarks:cloneJson(canonical.bookmarks),categories:cloneJson(canonical.categories),trash:[],calendarEvents:cloneJson(canonical.calendarEvents),
    theme:canonical.theme,view:canonical.view,settings:cloneJson(canonical.settings||{}),
    sync:{protocol:1,tombstones:cloneJson(canonical.tombstones)}
  }:(typeof buildBackup==="function" ? cloneJson(buildBackup()) : {
    schema:"navi-bookmarks", version:4, app:state.settings.appName||"Navi", exportedAt:new Date().toISOString(),
    bookmarks:state.bookmarks, categories:state.categories, trash:state.trash, settings:state.settings,
    sync:{protocol:1,tombstones:cloneJson(state.syncMeta&&state.syncMeta.tombstones||[])}
  });
  payload.syncedAt=new Date().toISOString();
  payload.sync=Object.assign({},payload.sync||{},{ protocol:1,direction:"upload", client:"desktop-extension", source:(typeof syncSource==="function"?syncSource():"manual") });
  if(payload.settings){
    payload.settings.aiKey="";
    if(Array.isArray(payload.settings.profiles)){
      payload.settings.profiles.forEach(function(profile){ if(profile) profile.pass=""; });
    }
  }
  return payload;
}
/* 带超时的 fetch。没有超时的话，NAS 睡着了或者防火墙把包丢了（TCP 连上但不回应）
   时，请求会一直挂着——状态栏永远停在"同步中"，上传按钮也一直是禁用的，
   用户完全不知道发生了什么。实测挂 6 秒后确实还卡着。 */
var SYNC_TIMEOUT=20000, SYNC_UPLOAD_TIMEOUT=45000;   // 上传体积可能不小，给宽一点
function syncFetch(url, opts, ms){
  opts=Object.assign({}, opts||{});
  if(typeof AbortController==="undefined") return fetch(url, opts);
  var ctrl=new AbortController(), timedOut=false;
  var timer=setTimeout(function(){ timedOut=true; try{ ctrl.abort(); }catch(e){} }, ms||SYNC_TIMEOUT);
  opts.signal=ctrl.signal;
  return fetch(url, opts).then(function(r){ clearTimeout(timer); return r; },
    function(err){
      clearTimeout(timer);
      throw timedOut ? new Error(t("syncTimeout",{s:Math.round((ms||SYNC_TIMEOUT)/1000)})) : err;
  });
}
function strongSyncEtag(value){
  value=String(value||"").trim();
  return value&&!/^W\//i.test(value)&&/^"[\s\S]*"$/.test(value)?value:"";
}
function syncConditionalHeaders(remote){
  if(remote&&remote.missing) return {"If-None-Match":"*"};
  if(remote&&remote.strongEtag) return {"If-Match":remote.strongEtag};
  return null;
}
function conditionalPut(profile,body,remote){
  var conditional=syncConditionalHeaders(remote);
  if(!conditional){
    var error=new Error("unsafe-precondition"); error.code="unsafe-precondition";
    return Promise.reject(error);
  }
  return syncFetch(profile.url,{
    method:"PUT",
    headers:webdavHeaders(profile,Object.assign({"Content-Type":"application/json; charset=utf-8"},conditional)),
    body:body,
    cache:"no-store",
    credentials:"omit"
  },SYNC_UPLOAD_TIMEOUT);
}
function compatibilityPutConfirmed(profile,body,userConfirmed){
  if(userConfirmed!==true){
    var error=new Error("compatibility-confirmation-required"); error.code="compatibility-confirmation-required";
    return Promise.reject(error);
  }
  return syncFetch(profile.url,{
    method:"PUT",headers:webdavHeaders(profile,{"Content-Type":"application/json; charset=utf-8"}),
    body:body,cache:"no-store",credentials:"omit"
  },SYNC_UPLOAD_TIMEOUT);
}
function syncReconcileDecision(input){
  input=input||{};
  var remote=input.remote,base=input.base;
  if(!remote||remote.unreadable||(!remote.missing&&!remote.data)) return "invalid";
  if(remote.missing) return "merge";
  if(!base||!base.snapshot) return "bootstrap";
  if(Number(base.snapshot.version)>=4&&Number(remote.sourceVersion)>0&&Number(remote.sourceVersion)<4) return "downgrade";
  if(input.write===true&&!remote.strongEtag) return "compatibility";
  return "merge";
}
function fetchRemoteData(profile){
  return syncFetch(profile.url,{headers:webdavHeaders(profile),cache:"no-store",credentials:"omit"}).then(function(response){
    var etag=response.headers&&typeof response.headers.get==="function"?(response.headers.get("ETag")||""):"";
    var strongEtag=strongSyncEtag(etag);
    if(response.status===404||response.status===410){
      return response.text().catch(function(){return "";}).then(function(raw){
        return {missing:true,unreadable:false,data:null,raw:raw,etag:etag,strongEtag:strongEtag,sourceVersion:0,status:404};
      });
    }
    if(!response.ok) throw new Error("HTTP "+response.status);
    return response.text().then(function(raw){
      var data=parseRemote(raw);
      return {missing:false,unreadable:!data,data:data,raw:raw,etag:etag,strongEtag:strongEtag,
        sourceVersion:data&&Number(data.sourceVersion)||0,status:response.status};
    });
  });
}

/* 这份 HTML 是不是浏览器导出的书签文件？
   浏览器导出的文件一定带 NETSCAPE-Bookmark 声明，或者是 <DT><A HREF> 这种结构；
   登录页、错误页、目录列表都不具备。纯函数，便于在 tools/test.js 里直接断言。 */
function looksLikeBookmarkExport(txt){
  txt=String(txt||"");
  if(/NETSCAPE-Bookmark-file/i.test(txt)) return true;
  return /<DT>\s*<A\s+[^>]*HREF/i.test(txt);
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
        return { bookmarks:bms, categories:Array.isArray(j.categories)?j.categories:deriveCats(bms), trash:Array.isArray(j.trash)?j.trash:[], syncMeta:{tombstones:[]}, sourceVersion:Number(j.version)||3, theme:j.theme||state.theme, view:(j.view==="list2"?"list":j.view)||state.view, settings:j.settings||null };
      }
    }catch(e){}
    return null;
  }
  // 退回：把 Netscape HTML 书签文件里的链接抽出来。
  // 但必须先确认这确实是一份书签导出文件 —— NAS 的反向代理在会话过期时
  // 常常对任何请求都回一个 200 的登录页，而登录页里也有 <a href>。
  // 不加这道判断的话，一次过期就会把整个书签库替换成登录页上的几个链接，
  // 而且状态还显示"同步成功"。
  if(!looksLikeBookmarkExport(txt)) return null;
  try{ var doc=new DOMParser().parseFromString(txt,"text/html"), items=[];
    $all("a[href]",doc).forEach(function(a){ var href=a.getAttribute("href")||""; if(/^https?:/i.test(href)) items.push({ id:uid(), title:(a.textContent||"").trim()||href, url:href, category:"Uncategorized", description:"", tags:[] }); });
    if(items.length) return { bookmarks:items, categories:deriveCats(items),syncMeta:{tombstones:[]},sourceVersion:3 };
  }catch(e){}
  return null;
}
function syncProfile(id){
  var p=getProfile(id);
  if(!p||p.type!=="webdav"||!p.url){ setSyncStatus("local"); return Promise.resolve(false); }
  setSyncStatus("syncing");
  return reconcileWebdavProfile(id,{write:false}).then(function(outcome){
    return presentSyncOutcome(id,outcome,{write:false});
  }).catch(function(err){
      var hasData=state.bookmarks.length>0 || !!loadProfileData(id);
      setSyncStatus(hasData?"cache":"failed", _syncStatus.at, String(err&&err.message||err));
      diagnoseFetchFailure(p.url, err).then(function(better){
        if(better) setSyncStatus(_syncStatus.state, _syncStatus.at, better);
      }).catch(function(){});
      toast(t("syncFailed"),"err");
      return false;
    });
}
function uploadWebdavProfile(id, opts){
  opts=opts||{};
  return reconcileWebdavProfile(id,{write:true,silent:!!opts.silent,compatibilityConfirmed:opts.compatibilityConfirmed===true}).then(function(outcome){
    return presentSyncOutcome(id,outcome,Object.assign({},opts,{write:true})).then(function(ok){
      if(!ok) throw new Error(outcome.status||"sync-not-complete");
      return {count:(outcome.candidate&&outcome.candidate.bookmarks||[]).length,bytes:outcome.bytes||0,outcome:outcome};
    });
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
  // 必须落盘：这个指纹是冲突判断的基准。以前拉取路径上 saveSilently() 跑在
  // 这一行之前，指纹只存在于内存里，一刷新就退化成"没有基准"——
  // 而没有基准的推送会直接覆盖远程。
  if(typeof saveSilently==="function") saveSilently();
}
function normUrlKey(u){ return (typeof normForDup==="function")?normForDup(u):normalizeUrl(u||"").replace(/\/+$/,"").toLowerCase(); }

/* fetch 抛 TypeError 时浏览器不会告诉你到底是主机不通、还是被跨域策略挡了 ——
   出于安全，这两种情况对页面是不可区分的，都只给一句 "Failed to fetch"。
   但对着 NAS 调试时，这两者的处理办法完全不同，所以这里主动探一下：
     · https 页面访问 http 地址 → 混合内容，浏览器直接拦，跟服务器无关；
     · no-cors 探测能通 → 主机活着，问题在跨域配置（多半是反代没放行 OPTIONS 预检，
       浏览器发 PUT 前的预检请求是不带认证的，被挡住 PUT 就永远发不出去）；
     · 探测也不通 → 地址或网络本身的问题。 */
function diagnoseFetchFailure(url, err){
  var msg=String((err&&err.message)||err||"");
  if(!/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return Promise.resolve("");
  try{
    if(location.protocol==="https:"&&/^http:\/\//i.test(url)) return Promise.resolve(t("syncMixedContent"));
  }catch(e){}
  // no-cors 不受响应头限制：只要主机有应答（哪怕 401/403）就会 resolve
  return fetch(url,{mode:"no-cors",cache:"no-store"})
    .then(function(){ return t("syncCorsBlocked"); })
    .catch(function(){ return t("syncUnreachable"); });
}
/* 失败后把状态栏那句话换成更有用的解释（异步补，不影响调用方的控制流） */
function explainSyncFailure(url, err){
  diagnoseFetchFailure(url, err).then(function(better){
    if(better&&_syncStatus.state==="failed") setSyncStatus("failed", _syncStatus.at, better);
  }).catch(function(){});
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

/* 推送前的决策：直接写，还是停下来交给用户。
   单独抽成纯函数是因为这条判断错一次的代价是"另一台设备的数据被无声抹掉"，
   而它埋在异步链路里很难测；抽出来后 tools/test.js 可以直接断言每种组合。
     · 远程不存在        → 写（不可能覆盖到谁）
     · 远程读不懂        → 交给用户（可能是登录页，也可能是别的东西）
     · 没有基准指纹      → 交给用户。新设备刚填好地址时就是这种状态，
                          此时无从判断本地是否更新，直接写等于抹掉对方
     · 指纹和上次一致    → 写（这期间没人动过远程）
     · 指纹变了          → 交给用户 */
function syncPushDecision(r, remoteFp){
  if(!r) return "conflict";
  if(r.missing) return "upload";
  if(r.unreadable) return "conflict";
  if(!remoteFp) return "conflict";
  return syncFingerprint((r.data||{}).bookmarks)===remoteFp ? "upload" : "conflict";
}

function syncOutcome(status,extra){ return Object.assign({ok:false,status:status,attempts:0},extra||{}); }
function syncSnapshotForProfile(id){
  var source=state.settings.activeProfile===id?state:loadProfileData(id);
  return source&&typeof SyncMerge==="object"?SyncMerge.fromState(source):null;
}
function syncProfileDataFromSnapshot(id,snapshot){
  var existing=state.settings.activeProfile===id?profileDataSnapshot():(loadProfileData(id)||{});
  return {
    bookmarks:cloneJson(snapshot.bookmarks),categories:cloneJson(snapshot.categories),
    trash:Array.isArray(existing.trash)?cloneJson(existing.trash):[],calendarEvents:cloneJson(snapshot.calendarEvents),
    syncMeta:{tombstones:cloneJson(snapshot.tombstones)},theme:snapshot.theme,view:snapshot.view,
    settings:snapshot.settings||existing.settings||state.settings
  };
}
function applySyncSnapshot(id,snapshot){
  var canonical=typeof SyncMerge==="object"?SyncMerge.canonicalize(snapshot):null;
  if(!canonical) return false;
  var data=syncProfileDataFromSnapshot(id,canonical);
  if(state.settings.activeProfile!==id) return cacheProfileData(id,data);
  var current=SyncMerge.fromState(state);
  if(!SyncMerge.same(current,canonical)&&typeof snapshotPrev==="function") snapshotPrev();
  applyProfileData(data);
  if(!saveSilently({tracking:"remote"})) return false;
  cacheProfileData(id,profileDataSnapshot());
  render();
  return true;
}
function syncResponseEtag(response){
  return strongSyncEtag(response&&response.headers&&typeof response.headers.get==="function"?response.headers.get("ETag"):"");
}
function storeConfirmedSyncBase(profile,candidate,etag,extra){
  function result(saved){
    var status=saved?(extra&&extra.status||"synced"):"base-warning";
    return syncOutcome(status,Object.assign({},extra||{},{
      ok:true,status:status,candidate:candidate,etag:etag||"",attempts:extra&&extra.attempts||0
    }));
  }
  return NaviStorage.putSyncBase(profile.id,profile.url,etag||"",candidate).then(result,function(){ return result(false); });
}
function confirmWrittenSnapshot(profile,candidate,response,extra){
  var responseEtag=syncResponseEtag(response);
  if(responseEtag) return storeConfirmedSyncBase(profile,candidate,responseEtag,extra);
  return fetchRemoteData(profile).then(function(confirmed){
    var actual=confirmed&&!confirmed.missing&&!confirmed.unreadable?SyncMerge.canonicalize(confirmed.data):null;
    if(!actual||!SyncMerge.same(actual,candidate)) return syncOutcome("unconfirmed",Object.assign({candidate:candidate},extra||{}));
    return storeConfirmedSyncBase(profile,candidate,confirmed.strongEtag||"",Object.assign({},extra||{}, {
      status:confirmed.strongEtag?(extra&&extra.status||"synced"):"compatibility"
    }));
  });
}
function reviewExhaustedSyncRace(profile,candidate,base,attempts){
  return fetchRemoteData(profile).then(function(remote){
    var remoteSnapshot=remote&&!remote.missing&&!remote.unreadable&&SyncMerge.canonicalize(remote.data);
    var baseSnapshot=SyncMerge.canonicalize(base&&base.snapshot);
    var mergeResult=remoteSnapshot?(baseSnapshot?SyncMerge.merge(baseSnapshot,candidate,remoteSnapshot):SyncMerge.bootstrap(candidate,remoteSnapshot)):null;
    return syncOutcome("race-conflict",{
      local:candidate,remote:remote,base:base,mergeResult:mergeResult,
      candidate:mergeResult&&mergeResult.candidate,attempts:attempts
    });
  });
}
function writeSyncCandidate(profile,id,candidate,remote,base,opts,attempts){
  opts=opts||{}; attempts=Number(attempts)||0;
  candidate=SyncMerge.canonicalize(candidate);
  if(!candidate) return Promise.resolve(syncOutcome("invalid-local",{attempts:attempts}));
  if(!applySyncSnapshot(id,candidate)) return Promise.resolve(syncOutcome("local-save-failed",{candidate:candidate,attempts:attempts}));
  var payload=buildWebdavPayload(candidate);
  if(!payload) return Promise.resolve(syncOutcome("invalid-local",{candidate:candidate,attempts:attempts}));
  var body=JSON.stringify(payload,null,2),compatibility=!remote.missing&&!remote.strongEtag;
  var request=compatibility
    ?compatibilityPutConfirmed(profile,body,opts.compatibilityConfirmed===true)
    :conditionalPut(profile,body,remote);
  attempts++;
  return request.then(function(response){
    if(response.status===409||response.status===412){
      if(compatibility||attempts>=3) return reviewExhaustedSyncRace(profile,candidate,base,attempts);
      return reconcileWebdavAttempt(profile,id,candidate,base,opts,attempts);
    }
    if(!response.ok) throw new Error("HTTP "+response.status);
    return confirmWrittenSnapshot(profile,candidate,response,{attempts:attempts,bytes:body.length,status:compatibility?"compatibility":"synced"});
  });
}
function reconcileWebdavAttempt(profile,id,local,base,opts,attempts){
  opts=opts||{}; attempts=Number(attempts)||0;
  return fetchRemoteData(profile).then(function(remote){
    var decision=syncReconcileDecision({remote:remote,base:base,write:opts.write===true});
    if(decision==="invalid") return syncOutcome("invalid",{remote:remote,base:base,attempts:attempts});
    if(decision==="downgrade") return syncOutcome("downgrade",{remote:remote,base:base,attempts:attempts});
    if(decision==="compatibility"&&opts.compatibilityConfirmed!==true){
      return syncOutcome("compatibility",{remote:remote,base:base,candidate:local,attempts:attempts});
    }
    if(remote.missing){
      if(opts.write!==true) return syncOutcome("local-pending",{ok:true,candidate:local,remote:remote,base:base,attempts:attempts});
      return writeSyncCandidate(profile,id,local,remote,base,opts,attempts);
    }
    var remoteSnapshot=SyncMerge.canonicalize(remote.data);
    if(!remoteSnapshot) return syncOutcome("invalid",{remote:remote,base:base,attempts:attempts});
    if(decision==="bootstrap"){
      var bootstrap=SyncMerge.bootstrap(local,remoteSnapshot);
      return syncOutcome("bootstrap",{candidate:bootstrap.candidate,mergeResult:bootstrap,local:local,remote:remote,base:null,attempts:attempts});
    }
    var baseSnapshot=SyncMerge.canonicalize(base&&base.snapshot);
    if(!baseSnapshot) return syncOutcome("bootstrap",{candidate:null,local:local,remote:remote,base:null,attempts:attempts});
    var merged=SyncMerge.merge(baseSnapshot,local,remoteSnapshot);
    if(!merged.candidate) return syncOutcome("invalid",{mergeResult:merged,remote:remote,base:base,attempts:attempts});
    if(merged.conflicts.length) return syncOutcome("conflict",{candidate:merged.candidate,mergeResult:merged,local:local,remote:remote,base:base,attempts:attempts});
    var candidate=SyncMerge.canonicalize(merged.candidate);
    if(!applySyncSnapshot(id,candidate)) return syncOutcome("local-save-failed",{candidate:candidate,remote:remote,base:base,attempts:attempts});
    if(opts.write!==true){
      if(!SyncMerge.same(candidate,remoteSnapshot)) return syncOutcome("local-pending",{ok:true,candidate:candidate,remote:remote,base:base,attempts:attempts});
      return storeConfirmedSyncBase(profile,candidate,remote.strongEtag||"",{attempts:attempts,status:remote.strongEtag?"synced":"compatibility"});
    }
    if(SyncMerge.same(candidate,remoteSnapshot)){
      return storeConfirmedSyncBase(profile,candidate,remote.strongEtag||"",{attempts:attempts,status:remote.strongEtag?"synced":"compatibility"});
    }
    return writeSyncCandidate(profile,id,candidate,remote,base,opts,attempts);
  });
}
function reconcileWebdavProfile(id,opts){
  opts=opts||{};
  var profile=getProfile(id),local=syncSnapshotForProfile(id);
  if(!profile||profile.type!=="webdav"||!profile.url) return Promise.resolve(syncOutcome("no-url"));
  if(!local) return Promise.resolve(syncOutcome("invalid-local"));
  return NaviStorage.getSyncBase(id,profile.url).then(function(base){
    return reconcileWebdavAttempt(profile,id,local,base,opts,0);
  },function(){ return syncOutcome("base-unavailable",{candidate:local}); });
}
function continueSyncCandidate(id,candidate,context){
  context=context||{};
  var profile=getProfile(id);
  if(!profile||profile.type!=="webdav"||!profile.url) return Promise.resolve(syncOutcome("no-url"));
  return writeSyncCandidate(profile,id,candidate,context.remote||{},context.base||null,context.opts||{},context.attempts||0);
}
function compatibilityWriteSelectedCandidate(id,candidate,context){
  context=context||{};
  var profile=getProfile(id),previousRemote=context.remote||{};
  if(!profile||profile.type!=="webdav"||!profile.url) return Promise.resolve(syncOutcome("no-url"));
  return fetchRemoteData(profile).then(function(fresh){
    if(!fresh||fresh.missing||fresh.unreadable||!fresh.data) return syncOutcome("invalid",{local:candidate,remote:fresh,base:context.base});
    var before=previousRemote.data&&SyncMerge.canonicalize(previousRemote.data),after=SyncMerge.canonicalize(fresh.data);
    if(!after) return syncOutcome("invalid",{local:candidate,remote:fresh,base:context.base});
    if(before&&!SyncMerge.same(before,after)){
      var baseSnapshot=SyncMerge.canonicalize(context.base&&context.base.snapshot),merged=baseSnapshot&&SyncMerge.merge(baseSnapshot,candidate,after);
      return syncOutcome("conflict",{local:candidate,remote:fresh,base:context.base,mergeResult:merged,candidate:merged&&merged.candidate});
    }
    return writeSyncCandidate(profile,id,candidate,fresh,context.base,{write:true,compatibilityConfirmed:true},context.attempts||0);
  });
}

function presentSyncOutcome(id,outcome,opts){
  opts=opts||{}; outcome=outcome||syncOutcome("failed");
  var profile=getProfile(id);
  if(outcome.ok){
    var safe=outcome.status==="synced",warning=outcome.status==="base-warning"||outcome.status==="compatibility"||outcome.status==="local-pending";
    if(profile&&opts.write&&safe){ profile.lastUpload=Date.now(); saveSilently({tracking:"remote"}); syncProfileEditor(); }
    setSyncStatus(warning?"cache":"remote",Date.now(),warning?outcome.status:"");
    if(typeof autoMirrorIfFollower==="function"&&!opts.write) autoMirrorIfFollower("after-pull");
    if(!opts.silent) toast(opts.write?t("webdavUploadOk",{n:(outcome.candidate&&outcome.candidate.bookmarks||[]).length}):t("syncOk",{n:(outcome.candidate&&outcome.candidate.bookmarks||[]).length}),warning?"":"ok");
    return Promise.resolve(true);
  }
  if(outcome.status==="compatibility"){
    setSyncStatus("cache",_syncStatus.at,t("syncConflictNoStrongEtag"));
    if(opts.silent){ toast(t("syncConflictAuto"),"err"); return Promise.resolve(false); }
    openConfirm(t("syncCompatibilityTitle"),t("syncCompatibilityMsg"),t("webdavUploadNow"),function(){
      reconcileWebdavProfile(id,{write:true,compatibilityConfirmed:true}).then(function(next){ return presentSyncOutcome(id,next,{write:true}); });
    });
    return Promise.resolve(false);
  }
  if(outcome.status==="bootstrap"||outcome.status==="conflict"||outcome.status==="invalid"||outcome.status==="downgrade"||outcome.status==="race-conflict"){
    return openSyncConflict(id,outcome,opts);
  }
  setSyncStatus("failed",_syncStatus.at,outcome.status||"failed");
  if(!opts.silent) toast(opts.write?t("webdavUploadFailed"):t("syncFailed"),"err");
  return Promise.resolve(false);
}

function pushWithConflictCheck(id, opts){
  opts=opts||{};
  var p=getProfile(id);
  if(!p||p.type!=="webdav"||!p.url){ if(!opts.silent) toast(t("syncNoUrl"),"err"); return Promise.resolve(false); }
  setSyncStatus("syncing",_syncStatus.at);
  return reconcileWebdavProfile(id,{write:true,silent:!!opts.silent}).then(function(outcome){
    return presentSyncOutcome(id,outcome,Object.assign({},opts,{write:true}));
  }).catch(function(err){
    setSyncStatus("failed",_syncStatus.at,String(err&&err.message||err));
    explainSyncFailure(p.url, err);
    if(!opts.silent) toast(t("webdavUploadFailed"),"err");
    return false;
  });
}

var _conflictCtx=null;
function syncConflictKindLabel(kind){
  var keys={bookmark:"syncConflictKindBookmark",order:"syncConflictKindOrder",categories:"syncConflictKindCategories",calendarEvents:"syncConflictKindCalendar",settings:"syncConflictKindSettings",bootstrap:"syncConflictKindBootstrap"};
  return t(keys[kind]||"syncConflictKindBookmark");
}
function syncConflictOrderText(ids,snapshot){
  var names={},rows=snapshot&&snapshot.bookmarks||[];
  rows.forEach(function(bookmark){ names[bookmark.id]=bookmark.title||bookmark.id; });
  var labels=(ids||[]).slice(0,4).map(function(id){return names[id]||id;});
  return t("syncConflictItems",{n:(ids||[]).length})+(labels.length?" · "+labels.join(" → ")+((ids||[]).length>4?" …":""):"");
}
function syncConflictValueText(conflict,side,outcome){
  var value=conflict&&conflict[side];
  if(value==null) return {text:t("syncConflictDeleted"),deleted:true};
  if(conflict.kind==="bookmark"){
    var title=value.title||value.url||conflict.label||"";
    return {text:title+(value.url?" · "+prettyUrl(value.url):"")};
  }
  if(conflict.kind==="order") return {text:syncConflictOrderText(value,outcome&&outcome[side])};
  if(conflict.kind==="categories") return {text:(value||[]).join(" · ")||t("syncConflictEmpty")};
  if(conflict.kind==="calendarEvents") return {text:t("syncConflictItems",{n:(value||[]).length})};
  if(conflict.kind==="settings") return {text:(value.theme||"")+" · "+(value.view||"")};
  return {text:t("syncConflictEmpty")};
}
function syncConflictChoiceHtml(key,name,value,label,summary,deleted){
  return '<label class="sync-conflict-choice"><input type="radio" name="'+escapeHtml(name)+'" value="'+escapeHtml(value)+'" data-sync-choice-key="'+escapeHtml(key)+'">'+
    '<span class="sync-conflict-side">'+escapeHtml(label)+'</span><span class="sync-conflict-value'+(deleted?' deleted':'')+'">'+escapeHtml(summary)+'</span></label>';
}
function syncConflictRowHtml(conflict,index,outcome){
  var key=String(conflict.key),name="sync-conflict-"+index;
  var local=syncConflictValueText(conflict,"local",outcome),remote=syncConflictValueText(conflict,"remote",outcome);
  var kindLabel=syncConflictKindLabel(conflict.kind);
  var visibleLabel=conflict.kind==="bookmark"?(conflict.label||key):kindLabel;
  var kindHtml=conflict.kind==="bookmark"?'<span class="sync-conflict-kind">'+escapeHtml(kindLabel)+'</span>':"";
  return '<fieldset class="sync-conflict-row" data-sync-conflict-key="'+escapeHtml(key)+'"><legend>'+escapeHtml(visibleLabel)+kindHtml+'</legend><div class="sync-conflict-choices">'+
    syncConflictChoiceHtml(key,name,"local",t("syncConflictLocal"),local.text,local.deleted)+
    syncConflictChoiceHtml(key,name,"remote",t("syncConflictRemote"),remote.text,remote.deleted)+'</div></fieldset>';
}
function syncBootstrapRowHtml(outcome){
  var localCount=outcome.local&&outcome.local.bookmarks&&outcome.local.bookmarks.length||0;
  var remoteSnapshot=outcome.remote&&outcome.remote.data&&SyncMerge.canonicalize(outcome.remote.data);
  var remoteCount=remoteSnapshot&&remoteSnapshot.bookmarks.length||0;
  var mergedCount=outcome.mergeResult&&outcome.mergeResult.candidate&&outcome.mergeResult.candidate.bookmarks.length||0;
  return '<fieldset class="sync-conflict-row" data-sync-conflict-key="__bootstrap__"><legend>'+escapeHtml(t("syncBootstrapChoice"))+
    '<span class="sync-conflict-kind">'+escapeHtml(syncConflictKindLabel("bootstrap"))+'</span></legend><div class="sync-conflict-choices three">'+
    syncConflictChoiceHtml("__bootstrap__","sync-conflict-bootstrap","local",t("syncBootstrapLocal"),t("syncConflictItems",{n:localCount}),false)+
    syncConflictChoiceHtml("__bootstrap__","sync-conflict-bootstrap","remote",t("syncBootstrapRemote"),t("syncConflictItems",{n:remoteCount}),false)+
    syncConflictChoiceHtml("__bootstrap__","sync-conflict-bootstrap","merge",t("syncBootstrapMerge"),t("syncConflictItems",{n:mergedCount}),false)+'</div></fieldset>';
}
function syncConflictRequiredKeys(context){
  if(context&&context.outcome&&context.outcome.status==="bootstrap"){
    return context.choices.__bootstrap__==="merge"?["__bootstrap__"].concat(context.conflictKeys||[]):["__bootstrap__"];
  }
  return context&&context.keys||[];
}
function updateSyncConflictControls(){
  var context=_conflictCtx,apply=$("#conflictApply"),status=$("#conflictStatus"); if(!context||context.mode!=="choices") return;
  var required=syncConflictRequiredKeys(context);
  var remaining=required.filter(function(key){return !context.choices[key];}).length;
  if(apply) apply.disabled=remaining>0||context.applying;
  if(status) status.textContent=context.applying?t("syncConflictApplying"):(remaining?t("syncConflictRemaining",{n:remaining}):t("syncConflictReady"));
  var bulkVisible=context.outcome.status!=="bootstrap"||context.choices.__bootstrap__==="merge";
  var allLocal=$("#conflictAllLocal"),allRemote=$("#conflictAllRemote");
  if(allLocal) allLocal.hidden=!bulkVisible||!(context.conflictKeys||[]).length;
  if(allRemote) allRemote.hidden=!bulkVisible||!(context.conflictKeys||[]).length;
}
function renderSyncConflict(context){
  var outcome=context.outcome,mergeResult=outcome.mergeResult,conflicts=mergeResult&&mergeResult.conflicts||[];
  var body=$("#conflictBody"),summary=$("#conflictSummary"),list=$("#conflictList"),unreadable=$("#conflictUnreadable"),status=$("#conflictStatus");
  var allLocal=$("#conflictAllLocal"),allRemote=$("#conflictAllRemote"),apply=$("#conflictApply"),download=$("#conflictDownloadRemote"),useLocal=$("#conflictUseLocalRaw");
  context.choices={}; context.applying=false;
  var choiceMode=!!mergeResult&&!!mergeResult.candidate;
  if(choiceMode){
    context.mode="choices";
    var bootstrap=outcome.status==="bootstrap";
    context.conflictKeys=conflicts.map(function(conflict){return String(conflict.key);});
    context.keys=(bootstrap?["__bootstrap__"]:[]).concat(context.conflictKeys);
    if(body){
      var remoteData=outcome.remote&&outcome.remote.data,rn=remoteData&&remoteData.bookmarks?remoteData.bookmarks.length:0;
      body.textContent=t("syncConflictMsg",{local:outcome.local&&outcome.local.bookmarks?outcome.local.bookmarks.length:state.bookmarks.length,remote:rn});
    }
    var stats=mergeResult.stats||{added:0,updated:0,deleted:0};
    if(summary) summary.textContent=t("syncConflictSummary",{n:conflicts.length,added:stats.added||0,updated:stats.updated||0,deleted:stats.deleted||0});
    if(list) list.innerHTML=(bootstrap?syncBootstrapRowHtml(outcome):"")+conflicts.map(function(conflict,index){return syncConflictRowHtml(conflict,index,outcome);}).join("");
    if(unreadable){ unreadable.hidden=true; unreadable.textContent=""; }
    if(allLocal) allLocal.hidden=bootstrap;
    if(allRemote) allRemote.hidden=bootstrap;
    if(apply){ apply.hidden=false; apply.disabled=true; }
    if(download) download.hidden=true;
    if(useLocal) useLocal.hidden=true;
    updateSyncConflictControls();
    return;
  }
  context.mode="unreadable"; context.keys=[];
  if(body) body.textContent=t("syncConflictUnreadable");
  if(summary) summary.textContent="";
  if(list) list.innerHTML="";
  if(unreadable){ unreadable.hidden=false; unreadable.textContent=t("syncConflictUnreadableHelp"); }
  if(allLocal) allLocal.hidden=true;
  if(allRemote) allRemote.hidden=true;
  if(apply) apply.hidden=true;
  var raw=outcome.remote&&typeof outcome.remote.raw==="string"?outcome.remote.raw:"";
  if(download) download.hidden=!raw;
  if(useLocal){ useLocal.hidden=false; useLocal.disabled=!(outcome.remote&&outcome.remote.strongEtag)||outcome.status==="race-conflict"; }
  if(status) status.textContent=useLocal&&useLocal.disabled?t("syncConflictNoStrongEtag"):"";
}
function openSyncConflict(id, outcomeOrRemote, opts){
  opts=opts||{};
  var outcome=outcomeOrRemote&&outcomeOrRemote.status?outcomeOrRemote:null;
  if(!outcome){
    var local=syncSnapshotForProfile(id),remoteSnapshot=outcomeOrRemote?SyncMerge.canonicalize(outcomeOrRemote):null;
    var mergeResult=local&&remoteSnapshot?SyncMerge.bootstrap(local,remoteSnapshot):null;
    outcome=syncOutcome(remoteSnapshot?"bootstrap":"invalid",{local:local,remote:{data:outcomeOrRemote,unreadable:!remoteSnapshot},mergeResult:mergeResult,candidate:mergeResult&&mergeResult.candidate});
  }
  _conflictCtx={id:id,outcome:outcome,opts:opts,choices:{},keys:[],mode:""};
  if(opts.silent){
    setSyncStatus("cache",_syncStatus.at,t("syncConflictShort"));
    toast(t("syncConflictAuto"),"err");
    return Promise.resolve(false);
  }
  renderSyncConflict(_conflictCtx);
  openOverlay("conflictOverlay");
  return Promise.resolve(false);
}
function cancelSyncConflict(){ _conflictCtx=null; closeOverlay("conflictOverlay"); }
function syncConflictCandidate(context){
  var outcome=context.outcome;
  if(outcome.status==="bootstrap"){
    var choice=context.choices.__bootstrap__;
    if(choice==="local") return SyncMerge.canonicalize(outcome.local);
    if(choice==="remote") return outcome.remote&&outcome.remote.data&&SyncMerge.canonicalize(outcome.remote.data);
    if(choice==="merge") return (context.conflictKeys||[]).length
      ?SyncMerge.resolve(outcome.mergeResult,context.choices)
      :outcome.mergeResult&&SyncMerge.canonicalize(outcome.mergeResult.candidate);
    return null;
  }
  return SyncMerge.resolve(outcome.mergeResult,context.choices);
}
function finishSyncConflict(context,promise){
  context.applying=true; updateSyncConflictControls();
  return promise.then(function(done){
    if(_conflictCtx===context) _conflictCtx=null;
    closeOverlay("conflictOverlay");
    return presentSyncOutcome(context.id,done,{write:true});
  }).catch(function(error){
    if(_conflictCtx===context){
      context.applying=false; updateSyncConflictControls();
      var status=$("#conflictStatus"); if(status) status.textContent=String(error&&error.message||error);
    }
    return false;
  });
}
function applySyncConflictChoices(){
  var context=_conflictCtx; if(!context||context.mode!=="choices"||context.applying) return;
  var candidate=syncConflictCandidate(context);
  if(!candidate){
    var status=$("#conflictStatus"); if(status) status.textContent=t("syncConflictIncomplete");
    var first=$("#conflictList .sync-conflict-row:not(:has(input:checked)) input"); if(first) first.focus();
    return;
  }
  var bootstrapRemote=context.outcome.status==="bootstrap"&&context.choices.__bootstrap__==="remote";
  if(bootstrapRemote){
    var profile=getProfile(context.id),remote=context.outcome.remote||{};
    if(!applySyncSnapshot(context.id,candidate)){
      var failed=$("#conflictStatus"); if(failed) failed.textContent="local-save-failed"; return;
    }
    var stored=profile&&profile.type==="webdav"?storeConfirmedSyncBase(profile,candidate,remote.strongEtag||"",{status:remote.strongEtag?"synced":"compatibility"}):Promise.resolve(syncOutcome("synced",{ok:true,candidate:candidate}));
    finishSyncConflict(context,stored); return;
  }
  if(context.outcome.remote&&!context.outcome.remote.missing&&!context.outcome.remote.strongEtag){
    openConfirm(t("syncCompatibilityTitle"),t("syncCompatibilityMsg"),t("webdavUploadNow"),function(){
      finishSyncConflict(context,compatibilityWriteSelectedCandidate(context.id,candidate,{remote:context.outcome.remote,base:context.outcome.base,attempts:context.outcome.attempts}));
    });
    return;
  }
  finishSyncConflict(context,continueSyncCandidate(context.id,candidate,{remote:context.outcome.remote,base:context.outcome.base,attempts:context.outcome.attempts,opts:{write:true}}));
}
function downloadSyncConflictRemote(){
  var context=_conflictCtx,raw=context&&context.outcome.remote&&context.outcome.remote.raw;
  if(typeof raw!=="string") return;
  var date=new Date().toISOString().slice(0,10);
  if(typeof downloadBlob==="function") downloadBlob(raw,"text/plain;charset=utf-8","navi-remote-unreadable-"+date+".txt");
}
function useLocalForUnreadableRemote(){
  var context=_conflictCtx; if(!context||context.mode!=="unreadable"||context.applying) return;
  var remote=context.outcome.remote||{};
  if(!remote.strongEtag){ var status=$("#conflictStatus"); if(status) status.textContent=t("syncConflictNoStrongEtag"); return; }
  finishSyncConflict(context,continueSyncCandidate(context.id,context.outcome.local||syncSnapshotForProfile(context.id),{remote:remote,base:context.outcome.base,attempts:context.outcome.attempts,opts:{write:true}}));
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
function updateActiveProfile(patch){
  var p=activeProfile(); if(!p) return;
  var previousUrl=p.url||"";
  Object.keys(patch).forEach(function(k){ p[k]=patch[k]; });
  if(Object.prototype.hasOwnProperty.call(patch,"url")&&(p.url||"")!==previousUrl&&NaviStorage&&typeof NaviStorage.clearSyncBase==="function"){
    NaviStorage.clearSyncBase(p.id);
  }
  save(); syncProfileEditor(); renderSyncChip();
}
function deleteActiveProfile(){
  var p=activeProfile(); if(!p||getProfiles().length<=1) return;
  var delId=p.id;
  state.settings.profiles=getProfiles().filter(function(x){ return x.id!==delId; });
  if(NaviStorage&&typeof NaviStorage.clearSyncBase==="function") NaviStorage.clearSyncBase(delId);
  dropProfileData(delId);
  var nextId=getProfiles()[0].id; state.settings.activeProfile=nextId;
  var cached=loadProfileData(nextId);
  if(cached) applyProfileData(cached);
  else { state.bookmarks=[]; state.categories=[]; state.trash=[]; state.syncMeta={tombstones:[]}; ui.activeCat="All"; ui.selected={}; rebuildCategories(); }
  saveSilently({tracking:"remote"}); render();
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
    if(e.target.id==="conflictCancel"){ cancelSyncConflict(); return; }
    if(e.target.id==="conflictApply"){ applySyncConflictChoices(); return; }
    if(e.target.id==="conflictDownloadRemote"){ downloadSyncConflictRemote(); return; }
    if(e.target.id==="conflictUseLocalRaw"){ useLocalForUnreadableRemote(); return; }
    if(e.target.id==="conflictAllLocal"||e.target.id==="conflictAllRemote"){
      var side=e.target.id==="conflictAllLocal"?"local":"remote",context=_conflictCtx;
      if(!context||context.mode!=="choices") return;
      $all('#conflictList [data-sync-conflict-key]:not([data-sync-conflict-key="__bootstrap__"]) input[value="'+side+'"]').forEach(function(input){ input.checked=true; context.choices[input.getAttribute("data-sync-choice-key")]=side; });
      updateSyncConflictControls(); return;
    }
    if(e.target===cf&&_pressEl===cf){ _conflictCtx=null; }
  });
  if(cf) cf.addEventListener("change",function(e){
    var input=e.target.closest("[data-sync-choice-key]"); if(!input||!_conflictCtx) return;
    _conflictCtx.choices[input.getAttribute("data-sync-choice-key")]=input.value;
    updateSyncConflictControls();
  });
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&cf&&cf.classList.contains("open")) _conflictCtx=null; },true);
})();
