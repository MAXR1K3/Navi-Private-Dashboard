/* storage.js — 主数据边界与恢复版本 */
"use strict";

var NAVI_SCHEMA_VERSION=4;
var NAVI_LEGACY_KEY="navi.dashboard.v2";
var NAVI_RECOVERY_DB="navi-storage";
var NAVI_RECOVERY_STORE="revisions";
var NAVI_REVISION_LIMIT=3;
var _naviRevisionQueue=Promise.resolve();
var _naviRevisionWarned=false;

function naviPlainObject(value){
  return !!value && Object.prototype.toString.call(value)==="[object Object]";
}
function validateDashboardState(value){
  if(!naviPlainObject(value)||!Array.isArray(value.bookmarks)||!naviPlainObject(value.settings)) return false;
  var arrays=["categories","trash","calendarEvents","opLog"];
  for(var i=0;i<arrays.length;i++){
    var field=arrays[i];
    if(value[field]!=null&&!Array.isArray(value[field])) return false;
  }
  if(value.theme!=null&&value.theme!=="light"&&value.theme!=="dark") return false;
  var view=value.view==="list2"?"list":value.view;
  if(view!=null&&view!=="grid"&&view!=="list"&&view!=="compact") return false;
  return true;
}
function parseDashboardRaw(raw){
  try{
    var value=JSON.parse(raw);
    return validateDashboardState(value)
      ?{ok:true,state:value}
      :{ok:false,reason:"invalid-structure"};
  }catch(e){
    return {ok:false,reason:"invalid-json"};
  }
}
function inspectPrimary(){
  var primary=null,legacy=null;
  try{
    primary=localStorage.getItem(KEY);
    legacy=localStorage.getItem(NAVI_LEGACY_KEY);
  }catch(e){
    return {status:"recovery",reason:"read-failed",raw:"",key:KEY};
  }
  if(primary==null&&legacy==null) return {status:"first-run"};
  var key=primary!=null?KEY:NAVI_LEGACY_KEY;
  var raw=primary!=null?primary:legacy;
  var parsed=parseDashboardRaw(raw);
  return parsed.ok
    ?{status:"ok",state:parsed.state,raw:raw,key:key}
    :{status:"recovery",reason:parsed.reason,raw:raw,key:key};
}
function buildPersistPlan(value,previousRaw){
  var raw;
  try{
    raw=JSON.stringify(Object.assign({},value,{schemaVersion:NAVI_SCHEMA_VERSION}));
  }catch(e){ return {ok:false}; }
  if(!parseDashboardRaw(raw).ok) return {ok:false};
  var previous=typeof previousRaw==="string"?parseDashboardRaw(previousRaw):{ok:false};
  return {ok:true,raw:raw,previousRaw:previous.ok?previousRaw:null};
}
function selectRecoveryRevisions(rows,limit){
  var seen={},kept=[];
  (rows||[]).slice().sort(function(a,b){ return b.savedAt-a.savedAt||b.id-a.id; }).forEach(function(row){
    if(kept.length>=limit||!row||typeof row.raw!=="string"||seen[row.raw]) return;
    if(!parseDashboardRaw(row.raw).ok) return;
    seen[row.raw]=true; kept.push(row);
  });
  return kept;
}
function openRecoveryDb(){
  return new Promise(function(resolve,reject){
    if(typeof indexedDB==="undefined"){ reject(new Error("indexeddb-unavailable")); return; }
    var request=indexedDB.open(NAVI_RECOVERY_DB,1);
    request.onupgradeneeded=function(){
      if(!request.result.objectStoreNames.contains(NAVI_RECOVERY_STORE)){
        request.result.createObjectStore(NAVI_RECOVERY_STORE,{keyPath:"id",autoIncrement:true});
      }
    };
    request.onsuccess=function(){ resolve(request.result); };
    request.onerror=function(){ reject(request.error||new Error("indexeddb-open-failed")); };
    request.onblocked=function(){ reject(new Error("indexeddb-open-blocked")); };
  });
}
function withRevisionStore(mode,run){
  return openRecoveryDb().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(NAVI_RECOVERY_STORE,mode),settled=false;
      function finish(error){
        if(settled) return; settled=true; db.close();
        if(error) reject(error); else resolve();
      }
      tx.oncomplete=function(){ finish(); };
      tx.onabort=tx.onerror=function(){ finish(tx.error||new Error("indexeddb-transaction-failed")); };
      try{ run(tx.objectStore(NAVI_RECOVERY_STORE),tx); }
      catch(error){ try{ tx.abort(); }catch(e){} finish(error); }
    });
  });
}
function pruneRecoveryStore(store){
  var request=store.getAll();
  request.onsuccess=function(){
    var keep=selectRecoveryRevisions(request.result,NAVI_REVISION_LIMIT),ids={};
    keep.forEach(function(row){ ids[row.id]=true; });
    request.result.forEach(function(row){ if(!ids[row.id]) store.delete(row.id); });
  };
}
function archiveRevision(raw){
  if(!parseDashboardRaw(raw).ok) return Promise.resolve();
  return withRevisionStore("readwrite",function(store){
    var add=store.add({savedAt:Date.now(),schemaVersion:NAVI_SCHEMA_VERSION,raw:raw});
    add.onsuccess=function(){ pruneRecoveryStore(store); };
  });
}
function queueRevision(raw){
  _naviRevisionQueue=_naviRevisionQueue.then(function(){ return archiveRevision(raw); }).catch(function(){
    if(!_naviRevisionWarned&&typeof toast==="function"){
      _naviRevisionWarned=true; toast(t("recoveryRevisionFailed"),"err");
    }
  });
  return _naviRevisionQueue;
}
function persistDashboard(value){
  var previousRaw=null;
  try{ previousRaw=localStorage.getItem(KEY); }catch(e){}
  var plan=buildPersistPlan(value,previousRaw);
  if(!plan.ok) return false;
  try{ localStorage.setItem(KEY,plan.raw); }
  catch(e){ return false; }
  if(plan.previousRaw) queueRevision(plan.previousRaw);
  return true;
}
function readRecoveryRows(){
  return openRecoveryDb().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(NAVI_RECOVERY_STORE,"readonly"),rows=[],settled=false;
      var request=tx.objectStore(NAVI_RECOVERY_STORE).getAll();
      request.onsuccess=function(){ rows=request.result||[]; };
      function finish(error){
        if(settled) return; settled=true; db.close();
        if(error) reject(error); else resolve(rows);
      }
      tx.oncomplete=function(){ finish(); };
      tx.onabort=tx.onerror=function(){ finish(tx.error||new Error("revision-read-failed")); };
    });
  });
}
function getLastGood(){
  return _naviRevisionQueue.then(readRecoveryRows).then(function(rows){
    var revision=selectRecoveryRevisions(rows,NAVI_REVISION_LIMIT)[0];
    if(!revision) return null;
    return {state:parseDashboardRaw(revision.raw).state,raw:revision.raw,savedAt:revision.savedAt};
  }).catch(function(){ return null; });
}
function restoreDashboard(raw){
  if(typeof raw!=="string"||!parseDashboardRaw(raw).ok) return Promise.resolve(false);
  try{ localStorage.setItem(KEY,raw); return Promise.resolve(true); }
  catch(e){ return Promise.resolve(false); }
}
function clearRecoveryStore(){
  _naviRevisionQueue=_naviRevisionQueue.then(function(){
    return withRevisionStore("readwrite",function(store){ store.clear(); });
  }).catch(function(){});
  return _naviRevisionQueue;
}
function clearNaviData(){
  var exact={"navi.dashboard.v3":true,"navi.dashboard.v2":true,"navi.dashboard.prev":true};
  var remove=[];
  try{
    for(var i=0;i<localStorage.length;i++){
      var key=localStorage.key(i);
      if(exact[key]||String(key).indexOf("navi.pdata.")===0) remove.push(key);
    }
    remove.forEach(function(key){ localStorage.removeItem(key); });
  }catch(e){}
  return clearRecoveryStore();
}

var NaviStorage={
  validateDashboardState:validateDashboardState,
  inspectPrimary:inspectPrimary,
  persist:persistDashboard,
  selectRecoveryRevisions:selectRecoveryRevisions,
  getLastGood:getLastGood,
  restore:restoreDashboard,
  clearAll:clearNaviData
};
