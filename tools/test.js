#!/usr/bin/env node
/* tools/test.js — 纯逻辑层的回归测试，不开浏览器，秒级跑完。
   只测"改错了会静默出问题"的那些函数：搜索打分、去重规范化、同步指纹与合并、
   代理返回的 markdown 解析、清理分类、存档片段。DOM / 视觉不在这层，那部分靠 dev-check.html。
   用法：node tools/test.js */
"use strict";
const fs = require("fs"), path = require("path");
const { createEnv, load, root } = require("./env.js");

const ctx = createEnv();
const moduleFiles = ["js/i18n.js","js/state.js","js/sync-merge.js","js/storage.js","js/icons.js","js/utils.js","js/oplog.js","js/render.js",
                          "js/suggest.js","js/sync.js","js/cleanup.js","js/snapshots.js",
                          "js/bookmarks.js","js/import-export.js","js/keywords.js","js/widgets.js","js/chrome-sync.js","js/mirror.js","js/menu.js","js/action-menus.js"];
const failed = load(ctx, moduleFiles);
if (failed.length) { console.error("× 模块加载失败：\n  " + failed.join("\n  ")); process.exit(1); }

let pass = 0, fail = 0, group = "";
const G = n => { group = n; };
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; console.log("  ✘ [" + group + "] " + name + (detail ? "\n      " + detail : ""));
}
const eq = (name, got, want) => ok(name, got === want, "期望 " + JSON.stringify(want) + "，实际 " + JSON.stringify(got));

/* ---------- 同步 v4 规范化与本地墓碑 ---------- */
G("sync v4 canonicalization");
ok("SyncMerge module is loaded", typeof ctx.SyncMerge === "object");
if(ctx.SyncMerge){
  const legacy={schema:"navi-bookmarks",version:3,bookmarks:[
    {id:"a",title:"A",url:"https://a.example",category:"Work",description:"",tags:[],clicks:1,lastOpened:10}
  ],categories:["Work"],trash:[],calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"}};
  const canonical=ctx.SyncMerge.canonicalize(legacy);
  eq("v3 becomes canonical v4", canonical.version, 4);
  eq("canonical order follows bookmark array", canonical.order.join(","), "a");
  eq("missing updatedAt migrates to zero", canonical.bookmarks[0].updatedAt, 0);
  eq("v3 starts without tombstones", canonical.tombstones.length, 0);
  ok("invalid bookmark collection is rejected", ctx.SyncMerge.canonicalize({bookmarks:{}})===null);
  ok("duplicate stable IDs are rejected", ctx.SyncMerge.canonicalize({bookmarks:[legacy.bookmarks[0],legacy.bookmarks[0]]})===null);

  const previous=ctx.defaults();
  previous.bookmarks=[{id:"a",title:"A",url:"https://a.example",category:"Work",description:"",tags:[],updatedAt:10}];
  previous.syncMeta={tombstones:[]};
  const changed=JSON.parse(JSON.stringify(previous)); changed.bookmarks[0].title="A2";
  const tracked=ctx.SyncMerge.trackLocal(previous,changed,100);
  eq("content edit receives updatedAt", tracked.bookmarks[0].updatedAt, 100);
  const statsOnly=JSON.parse(JSON.stringify(tracked)); statsOnly.bookmarks[0].clicks=20;
  eq("activity stats do not touch updatedAt", ctx.SyncMerge.trackLocal(tracked,statsOnly,200).bookmarks[0].updatedAt,100);
  const deleted=JSON.parse(JSON.stringify(tracked)); deleted.bookmarks=[];
  const deletedTracked=ctx.SyncMerge.trackLocal(tracked,deleted,300);
  eq("missing id creates durable tombstone", deletedTracked.syncMeta.tombstones[0].id,"a");
  const restored=JSON.parse(JSON.stringify(deletedTracked)); restored.bookmarks=[tracked.bookmarks[0]];
  const retracked=ctx.SyncMerge.trackLocal(deletedTracked,restored,400);
  eq("restoring id removes tombstone", retracked.syncMeta.tombstones.length,0);
  eq("restoring id touches bookmark", retracked.bookmarks[0].updatedAt,400);
}

/* ---------- 确定性三方同步合并 ---------- */
G("three-way sync merge");
ok("SyncMerge exposes merge", !!ctx.SyncMerge&&typeof ctx.SyncMerge.merge==="function");
ok("SyncMerge exposes bootstrap", !!ctx.SyncMerge&&typeof ctx.SyncMerge.bootstrap==="function");
ok("SyncMerge exposes conflict resolution", !!ctx.SyncMerge&&typeof ctx.SyncMerge.resolve==="function");
if(ctx.SyncMerge&&typeof ctx.SyncMerge.merge==="function"){
  const syncBm=(id,url,title,extra)=>Object.assign({id,url,title,category:"Work",description:"",tags:[],favorite:false,updatedAt:10,clicks:0,lastOpened:0},extra||{});
  const syncSnap=(bookmarks,tombstones,extra)=>ctx.SyncMerge.canonicalize(Object.assign({
    version:4,bookmarks,categories:["Work"],calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"},
    sync:{protocol:1,tombstones:tombstones||[]}
  },extra||{}));
  const base=syncSnap([syncBm("a","https://a.example","A"),syncBm("b","https://b.example","B")]);
  const localEdit=syncSnap([syncBm("a","https://a.example","A local"),syncBm("b","https://b.example","B")]);
  const remoteOther=syncSnap([syncBm("a","https://a.example","A"),syncBm("b","https://b.example","B remote")]);
  const independent=ctx.SyncMerge.merge(base,localEdit,remoteOther);
  eq("independent edits have no conflicts",independent.conflicts.length,0);
  eq("local edit is retained",independent.candidate.bookmarks.find(b=>b.id==="a").title,"A local");
  eq("remote edit is retained",independent.candidate.bookmarks.find(b=>b.id==="b").title,"B remote");

  const remoteSame=syncSnap([syncBm("a","https://a.example","A remote"),syncBm("b","https://b.example","B")]);
  const sameId=ctx.SyncMerge.merge(base,localEdit,remoteSame);
  eq("different edits to same id conflict",sameId.conflicts[0].key,"bookmark:a");
  eq("unresolved conflict cannot be applied",ctx.SyncMerge.resolve(sameId,{}),null);
  eq("local choice resolves only that id",ctx.SyncMerge.resolve(sameId,{"bookmark:a":"local"}).bookmarks.find(b=>b.id==="a").title,"A local");

  const localDelete=syncSnap([syncBm("b","https://b.example","B")],[{id:"a",deletedAt:100}]);
  const deletedClean=ctx.SyncMerge.merge(base,localDelete,base);
  eq("delete against unchanged auto-deletes",deletedClean.candidate.bookmarks.some(b=>b.id==="a"),false);
  eq("delete retains a durable tombstone",deletedClean.candidate.tombstones.find(t=>t.id==="a").deletedAt,100);
  eq("delete against edit conflicts",ctx.SyncMerge.merge(base,localDelete,remoteSame).conflicts[0].key,"bookmark:a");
  eq("remote delete against unchanged auto-deletes",ctx.SyncMerge.merge(base,base,localDelete).candidate.bookmarks.some(b=>b.id==="a"),false);

  const localAdd=syncSnap(base.bookmarks.concat(syncBm("l","https://local.example","Local")));
  const remoteAdd=syncSnap(base.bookmarks.concat(syncBm("r","https://remote.example","Remote")));
  const addMerge=ctx.SyncMerge.merge(base,localAdd,remoteAdd);
  eq("different added ids both survive",addMerge.candidate.bookmarks.filter(b=>b.id==="l"||b.id==="r").length,2);
  const localSameAdd=syncSnap(base.bookmarks.concat(syncBm("x","https://x.example","Local X")));
  const remoteSameAdd=syncSnap(base.bookmarks.concat(syncBm("x","https://x.example","Remote X")));
  ok("different same-id additions conflict",ctx.SyncMerge.merge(base,localSameAdd,remoteSameAdd).conflicts.some(c=>c.key==="bookmark:x"));

  const localStats=syncSnap([syncBm("a","https://a.example","A",{clicks:5,lastOpened:20}),syncBm("b","https://b.example","B")]);
  const remoteStats=syncSnap([syncBm("a","https://a.example","A",{clicks:4,lastOpened:30}),syncBm("b","https://b.example","B")]);
  const statsMerge=ctx.SyncMerge.merge(base,localStats,remoteStats).candidate.bookmarks.find(b=>b.id==="a");
  eq("activity clicks merge by maximum",statsMerge.clicks,5);
  eq("last opened merges by maximum",statsMerge.lastOpened,30);

  const reordered=syncSnap([syncBm("b","https://b.example","B"),syncBm("a","https://a.example","A")]);
  eq("one-sided reorder wins",ctx.SyncMerge.merge(base,reordered,base).candidate.order.join(","),"b,a");
  const orderBase=syncSnap([syncBm("a","https://a.example","A"),syncBm("b","https://b.example","B"),syncBm("c","https://c.example","C")]);
  const orderLocal=syncSnap([syncBm("b","https://b.example","B"),syncBm("a","https://a.example","A"),syncBm("c","https://c.example","C")]);
  const orderRemote=syncSnap([syncBm("a","https://a.example","A"),syncBm("c","https://c.example","C"),syncBm("b","https://b.example","B")]);
  ok("different two-sided ordering is explicit",ctx.SyncMerge.merge(orderBase,orderLocal,orderRemote).conflicts.some(c=>c.key==="order"));

  const catsLocal=syncSnap(base.bookmarks,[],{categories:["Work","Personal"]});
  eq("one-sided categories change wins",ctx.SyncMerge.merge(base,catsLocal,base).candidate.categories.join(","),"Work,Personal");
  const catsRemote=syncSnap(base.bookmarks,[],{categories:["Work","Remote"]});
  ok("two-sided categories changes conflict",ctx.SyncMerge.merge(base,catsLocal,catsRemote).conflicts.some(c=>c.key==="categories"));
  const calLocal=syncSnap(base.bookmarks,[],{calendarEvents:[{id:"e1",date:"2026-09-01",text:"Local"}]});
  const calRemote=syncSnap(base.bookmarks,[],{calendarEvents:[{id:"e2",date:"2026-09-02",text:"Remote"}]});
  eq("one-sided calendar change wins",ctx.SyncMerge.merge(base,calLocal,base).candidate.calendarEvents[0].id,"e1");
  ok("two-sided calendar changes conflict",ctx.SyncMerge.merge(base,calLocal,calRemote).conflicts.some(c=>c.key==="calendarEvents"));
  const setLocal=syncSnap(base.bookmarks,[],{settings:{lang:"zh"}}),setRemote=syncSnap(base.bookmarks,[],{settings:{lang:"es"}});
  eq("one-sided settings change wins",ctx.SyncMerge.merge(base,setLocal,base).candidate.settings.lang,"zh");
  ok("two-sided settings changes conflict",ctx.SyncMerge.merge(base,setLocal,setRemote).conflicts.some(c=>c.key==="settings"));

  const bootstrap=ctx.SyncMerge.bootstrap(
    syncSnap([syncBm("local","https://local.example","Local"),syncBm("x","https://same.example/","Local same")]),
    syncSnap([syncBm("remote","https://remote.example","Remote"),syncBm("y","https://same.example","Remote same")])
  );
  eq("bootstrap keeps independent records",bootstrap.candidate.bookmarks.filter(b=>b.id==="local"||b.id==="remote").length,2);
  ok("bootstrap requires a choice for same normalized URL",bootstrap.conflicts.some(c=>c.kind==="bookmark"));
}

/* ---------- 存储检查 ---------- */
G("storage inspection");
ok("storage boundary is loaded", typeof ctx.NaviStorage === "object");
if (ctx.NaviStorage) {
  ctx.localStorage.clear();
  eq("missing current and legacy keys is first run",
    ctx.NaviStorage.inspectPrimary().status, "first-run");

  const valid = ctx.defaults();
  valid.bookmarks = [{id:"one", title:"One", url:"https://example.com", category:"Work", tags:[]}];
  const validRaw = JSON.stringify(valid);
  ctx.localStorage.setItem(ctx.KEY, validRaw);
  const inspected = ctx.NaviStorage.inspectPrimary();
  eq("valid primary is accepted", inspected.status, "ok");
  eq("valid primary raw is returned unchanged", inspected.raw, validRaw);

  const corruptRaw = '{"bookmarks":[';
  ctx.localStorage.setItem(ctx.KEY, corruptRaw);
  const corrupt = ctx.NaviStorage.inspectPrimary();
  eq("truncated JSON enters recovery", corrupt.status, "recovery");
  eq("truncated JSON is preserved", corrupt.raw, corruptRaw);
  eq("inspection never overwrites bad raw", ctx.localStorage.getItem(ctx.KEY), corruptRaw);

  ctx.localStorage.setItem(ctx.KEY, JSON.stringify({bookmarks:{}, settings:{}}));
  eq("wrong bookmarks shape enters recovery",
    ctx.NaviStorage.inspectPrimary().status, "recovery");

  ["categories","trash","calendarEvents","opLog"].forEach(function(field){
    const wrong = ctx.defaults(); wrong[field] = {};
    ctx.localStorage.setItem(ctx.KEY, JSON.stringify(wrong));
    eq("wrong "+field+" shape enters recovery",
      ctx.NaviStorage.inspectPrimary().status, "recovery");
  });

  ctx.localStorage.removeItem(ctx.KEY);
  ctx.localStorage.setItem("navi.dashboard.v2", validRaw);
  const legacy = ctx.NaviStorage.inspectPrimary();
  eq("valid v2 fallback is accepted", legacy.status, "ok");
  eq("v2 fallback records its source key", legacy.key, "navi.dashboard.v2");

  ctx.localStorage.setItem(ctx.KEY, corruptRaw);
  eq("corrupt current data is not hidden by valid v2 fallback",
    ctx.NaviStorage.inspectPrimary().status, "recovery");
}

/* ---------- 存储持久化与恢复版本 ---------- */
G("storage persistence planning");
const hasStoragePersistence = !!ctx.NaviStorage &&
  typeof ctx.NaviStorage.persist === "function" &&
  typeof ctx.NaviStorage.selectRecoveryRevisions === "function";
ok("storage boundary exposes persist", !!ctx.NaviStorage&&typeof ctx.NaviStorage.persist === "function");
ok("storage boundary exposes revision selection", !!ctx.NaviStorage&&typeof ctx.NaviStorage.selectRecoveryRevisions === "function");
ok("storage boundary exposes last-good lookup", !!ctx.NaviStorage&&typeof ctx.NaviStorage.getLastGood === "function");
ok("storage boundary exposes restore", !!ctx.NaviStorage&&typeof ctx.NaviStorage.restore === "function");
ok("storage boundary exposes scoped reset", !!ctx.NaviStorage&&typeof ctx.NaviStorage.clearAll === "function");
ok("storage exposes sync base lookup", !!ctx.NaviStorage&&typeof ctx.NaviStorage.getSyncBase === "function");
ok("storage exposes sync base save", !!ctx.NaviStorage&&typeof ctx.NaviStorage.putSyncBase === "function");
ok("storage exposes sync base clear", !!ctx.NaviStorage&&typeof ctx.NaviStorage.clearSyncBase === "function");
if (hasStoragePersistence) {
  ctx.localStorage.clear();
  const first = ctx.defaults();
  first.bookmarks = [{id:"old", title:"Old", url:"https://old.example", category:"Work", tags:[]}];
  eq("valid state persists", ctx.NaviStorage.persist(first), true);
  const written = JSON.parse(ctx.localStorage.getItem(ctx.KEY));
  eq("first save writes schema version", written.schemaVersion, 4);
  eq("first save preserves bookmark", written.bookmarks[0].id, "old");

  const before = ctx.localStorage.getItem(ctx.KEY);
  eq("invalid state is rejected", ctx.NaviStorage.persist({bookmarks:{},settings:{}}), false);
  eq("rejected state does not replace primary", ctx.localStorage.getItem(ctx.KEY), before);

  const setItem = ctx.localStorage.setItem;
  ctx.localStorage.setItem = function(){ throw new Error("quota"); };
  eq("failed primary write is reported", ctx.NaviStorage.persist(first), false);
  ctx.localStorage.setItem = setItem;
  eq("failed primary write preserves old raw", ctx.localStorage.getItem(ctx.KEY), before);

  const rows = [
    {id:1,savedAt:10,raw:before},
    {id:2,savedAt:20,raw:before},
    {id:3,savedAt:30,raw:JSON.stringify(Object.assign({},first,{theme:"dark"}))},
    {id:4,savedAt:40,raw:JSON.stringify(Object.assign({},first,{view:"compact"}))},
    {id:5,savedAt:50,raw:JSON.stringify(Object.assign({},first,{view:"list"}))},
    {id:6,savedAt:60,raw:'{"bookmarks":['}
  ];
  const kept = ctx.NaviStorage.selectRecoveryRevisions(rows,3);
  eq("retention keeps three valid distinct rows", kept.length, 3);
  eq("retention is newest first", kept.map(row=>row.id).join(","), "5,4,3");
}

/* ---------- 同步元数据持久化 ---------- */
G("sync metadata persistence");
const syncDefaults=ctx.defaults();
ok("default state owns tombstones",!!syncDefaults.syncMeta&&Array.isArray(syncDefaults.syncMeta.tombstones));
ctx.localStorage.clear();
const localTracked=ctx.defaults();
localTracked.bookmarks=[{id:"tracked",title:"Tracked",url:"https://tracked.example",category:"Work",description:"",tags:[]}];
eq("ordinary primary save succeeds",ctx.NaviStorage.persist(localTracked),true);
let syncWritten=JSON.parse(ctx.localStorage.getItem(ctx.KEY));
ok("ordinary save timestamps new bookmark",Number(syncWritten.bookmarks[0].updatedAt)>0,JSON.stringify(syncWritten.bookmarks[0]));
localTracked.bookmarks=[];
ctx.NaviStorage.persist(localTracked);
syncWritten=JSON.parse(ctx.localStorage.getItem(ctx.KEY));
eq("ordinary save creates a durable tombstone",syncWritten.syncMeta&&syncWritten.syncMeta.tombstones[0]&&syncWritten.syncMeta.tombstones[0].id,"tracked");

const remoteTracked=ctx.defaults();
remoteTracked.bookmarks=[{id:"remote-fixed",title:"Remote",url:"https://remote.example",category:"Work",description:"",tags:[],updatedAt:77}];
remoteTracked.syncMeta={tombstones:[{id:"remote-gone",deletedAt:66}]};
ctx.NaviStorage.persist(remoteTracked,{tracking:"remote"});
syncWritten=JSON.parse(ctx.localStorage.getItem(ctx.KEY));
eq("remote tracking preserves updatedAt",syncWritten.bookmarks[0].updatedAt,77);
eq("remote tracking preserves tombstone",syncWritten.syncMeta.tombstones[0].deletedAt,66);

ctx.localStorage.clear();
const priorProfile=ctx.defaults();
priorProfile.bookmarks=[{id:"prior",title:"Prior",url:"https://prior.example",category:"Work",description:"",tags:[],updatedAt:11}];
ctx.NaviStorage.persist(priorProfile,{tracking:"remote"});
ctx.state=ctx.defaults();
ctx.state.bookmarks=[{id:"incoming",title:"Incoming",url:"https://incoming.example",category:"Work",description:"",tags:[],updatedAt:77}];
ctx.state.syncMeta={tombstones:[{id:"remote-gone",deletedAt:66}]};
ctx.saveSilently({tracking:"remote"});
syncWritten=JSON.parse(ctx.localStorage.getItem(ctx.KEY));
eq("silent remote save forwards tracking mode",syncWritten.bookmarks[0].updatedAt,77);
eq("silent remote save does not invent cross-profile deletion",syncWritten.syncMeta.tombstones.some(t=>t.id==="prior"),false);

ctx.state=ctx.defaults();
ctx.state.bookmarks=[{id:"payload",title:"Payload",url:"https://payload.example",category:"Work",description:"",tags:[],updatedAt:55}];
ctx.state.categories=["Work"];
ctx.state.syncMeta={tombstones:[{id:"gone",deletedAt:44}]};
const syncPayload=ctx.buildWebdavPayload();
eq("WebDAV payload writes v4",syncPayload.version,4);
eq("WebDAV payload declares protocol",syncPayload.sync&&syncPayload.sync.protocol,1);
eq("WebDAV payload carries tombstone",syncPayload.sync&&syncPayload.sync.tombstones&&syncPayload.sync.tombstones[0]&&syncPayload.sync.tombstones[0].id,"gone");
const normalizedV4=ctx.normalizeDashboardPayload(syncPayload,{preserveProfiles:true,preservePrivate:true});
eq("v4 normalization reports source version",normalizedV4&&normalizedV4.sourceVersion,4);
eq("v4 normalization restores local tombstones",normalizedV4&&normalizedV4.syncMeta&&normalizedV4.syncMeta.tombstones&&normalizedV4.syncMeta.tombstones[0]&&normalizedV4.syncMeta.tombstones[0].id,"gone");

ctx.localStorage.clear();
ctx.state.syncMeta={tombstones:[{id:"profile-gone",deletedAt:33}]};
ctx.cacheProfileData("sync-profile",ctx.profileDataSnapshot());
const cachedSync=ctx.loadProfileData("sync-profile");
eq("Profile cache preserves tombstones",cachedSync&&cachedSync.syncMeta&&cachedSync.syncMeta.tombstones&&cachedSync.syncMeta.tombstones[0]&&cachedSync.syncMeta.tombstones[0].id,"profile-gone");
ctx.state.syncMeta={tombstones:[]};
ctx.applyProfileData(cachedSync);
eq("Profile apply restores tombstones",ctx.state.syncMeta&&ctx.state.syncMeta.tombstones&&ctx.state.syncMeta.tombstones[0]&&ctx.state.syncMeta.tombstones[0].deletedAt,33);

ctx.localStorage.clear();
ctx.state=ctx.defaults();
ctx.state.settings.profiles=[
  {id:"local",name:"Local",type:"local"},
  {id:"dav-life",name:"DAV",type:"webdav",url:"https://nas.example/old.json",autoSync:false}
];
ctx.state.settings.activeProfile="local";
ctx.state.bookmarks=[{id:"local-only",title:"Local",url:"https://local.example",category:"Local",description:"",tags:[],updatedAt:12}];
const incomingProfile={
  bookmarks:[{id:"remote-only",title:"Remote",url:"https://remote.example",category:"Remote",description:"",tags:[],updatedAt:77}],
  categories:["Remote"],trash:[],calendarEvents:[],syncMeta:{tombstones:[{id:"remote-gone",deletedAt:66}]},theme:"light",view:"grid"
};
ctx.cacheProfileData("dav-life",incomingProfile);
const renderProfile=ctx.render;
ctx.render=function(){};
ctx.switchProfile("dav-life");
syncWritten=JSON.parse(ctx.localStorage.getItem(ctx.KEY));
eq("Profile switch preserves incoming bookmark time",syncWritten.bookmarks[0].updatedAt,77);
eq("Profile switch does not create tombstone for prior Profile",syncWritten.syncMeta.tombstones.some(t=>t.id==="local-only"),false);

const clearedBases=[];
const clearSyncBase=ctx.NaviStorage.clearSyncBase;
ctx.NaviStorage.clearSyncBase=function(id){ clearedBases.push(id); return Promise.resolve(); };
ctx.updateActiveProfile({url:"https://nas.example/new.json"});
eq("changing Profile URL clears its prior sync base",clearedBases.join(","),"dav-life");
ctx.updateActiveProfile({name:"Renamed DAV"});
eq("unrelated Profile edits keep the sync base",clearedBases.join(","),"dav-life");
ctx.deleteActiveProfile();
eq("deleting Profile clears its sync base",clearedBases.join(","),"dav-life,dav-life");
ctx.NaviStorage.clearSyncBase=clearSyncBase;
ctx.render=renderProfile;

/* ---------- WebDAV 条件写入 ---------- */
G("WebDAV conditional transport");
ok("strong ETag helper is exposed",typeof ctx.strongSyncEtag==="function");
ok("conditional header helper is exposed",typeof ctx.syncConditionalHeaders==="function");
ok("conditional PUT helper is exposed",typeof ctx.conditionalPut==="function");
if(typeof ctx.strongSyncEtag==="function"&&typeof ctx.syncConditionalHeaders==="function"){
  eq("strong ETag is accepted",ctx.strongSyncEtag('"abc"'),'"abc"');
  eq("weak ETag is rejected",ctx.strongSyncEtag('W/"abc"'),"");
  eq("lowercase weak ETag is rejected",ctx.strongSyncEtag('w/"abc"'),"");
  eq("empty ETag is rejected",ctx.strongSyncEtag(null),"");
  eq("existing remote uses If-Match",ctx.syncConditionalHeaders({strongEtag:'"abc"'})["If-Match"],'"abc"');
  eq("missing remote uses If-None-Match",ctx.syncConditionalHeaders({missing:true})["If-None-Match"],"*");
  eq("existing remote without strong ETag has no safe headers",ctx.syncConditionalHeaders({etag:'W/"abc"'}),null);
}

/* ---------- 恢复安全启动 ---------- */
G("recovery-safe load");
ctx.localStorage.clear();
ctx.state = ctx.defaults();
const corruptStartup = '{"bookmarks":[';
ctx.localStorage.setItem(ctx.KEY, corruptStartup);
const recoveryLoad = ctx.load();
eq("load reports recovery", recoveryLoad&&recoveryLoad.status, "recovery");
eq("load preserves corrupt primary", ctx.localStorage.getItem(ctx.KEY), corruptStartup);
eq("load does not seed demo bookmarks", ctx.state.bookmarks.length, 0);

ctx.localStorage.clear();
ctx.state = ctx.defaults();
const firstRunLoad = ctx.load();
eq("true first run becomes usable", firstRunLoad&&firstRunLoad.status, "ok");
eq("true first run is identified", firstRunLoad&&firstRunLoad.firstRun, true);
ok("true first run seeds demo bookmarks", ctx.state.bookmarks.length>0);
ok("true first run persists a valid primary", !!ctx.localStorage.getItem(ctx.KEY));

const migrationRaw = JSON.stringify(ctx.defaults());
ctx.localStorage.setItem(ctx.KEY, migrationRaw);
const rebuildCategories = ctx.rebuildCategories;
ctx.rebuildCategories = function(){ throw new Error("migration failed"); };
const migrationLoad = ctx.load();
ctx.rebuildCategories = rebuildCategories;
eq("migration exception enters recovery", migrationLoad&&migrationLoad.reason, "migration-failed");
eq("migration exception preserves original raw", ctx.localStorage.getItem(ctx.KEY), migrationRaw);

/* ---------- PWA 横屏 ---------- */
G("PWA orientation");
const webManifest = JSON.parse(fs.readFileSync(path.join(root,"manifest.webmanifest"),"utf8"));
ok("PWA 不再强制竖屏", !webManifest.orientation || webManifest.orientation === "any" || webManifest.orientation === "natural",
   "当前 orientation=" + JSON.stringify(webManifest.orientation));

G("extension least privilege");
const extensionManifest = JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
const requiredExtensionPermissions = ["bookmarks","contextMenus","scripting","storage"];
eq("扩展只声明已审计的 API 权限",
   (extensionManifest.permissions||[]).slice().sort().join(","),
   requiredExtensionPermissions.slice().sort().join(","));
ok("扩展不再请求可读取全部标签信息的 tabs 权限", !(extensionManifest.permissions||[]).includes("tabs"));
eq("主机访问仅限普通 HTTP/HTTPS 网页",
   (extensionManifest.host_permissions||[]).slice().sort().join(","),
   ["http://*/*","https://*/*"].sort().join(","));
ok("扩展不请求 file 或笼统 all_urls 访问",
   !(extensionManifest.host_permissions||[]).some(function(origin){ return origin==="<all_urls>"||origin.indexOf("file:")===0; }));
const readmeText = fs.readFileSync(path.join(root,"README.md"),"utf8");
ok("README 中文说明扩展权限", readmeText.indexOf("### 扩展权限说明")>-1);
ok("README English explains extension permissions", readmeText.indexOf("### Extension Permissions")>-1);

G("browser E2E infrastructure");
ok("仓库包含真实浏览器 E2E 入口", fs.existsSync(path.join(root,"tools/e2e.js")));
ok("GitHub Actions 会运行验证", fs.existsSync(path.join(root,".github/workflows/verify.yml")));

G("progressive module boundaries");
const indexHtml = fs.readFileSync(path.join(root,"index.html"),"utf8");
const menuSource = fs.readFileSync(path.join(root,"js/menu.js"),"utf8");
const actionMenusPath = path.join(root,"js/action-menus.js");
const menuStylesPath = path.join(root,"css/menus.css");
ok("菜单交互拥有独立脚本", fs.existsSync(actionMenusPath));
ok("菜单样式拥有独立样式表", fs.existsSync(menuStylesPath));
ok("页面加载独立菜单脚本", /<script src="js\/action-menus\.js"><\/script>/.test(indexHtml));
ok("页面加载独立菜单样式", /<link rel="stylesheet" href="css\/menus\.css\?v=\d+" \/>/.test(indexHtml));
ok("通用头部脚本不再承担弹出菜单逻辑", !/function\s+(?:openViewMenu|openMenu|moreMenuGroup)\b/.test(menuSource));

/* ---------- 卡片展示模式 ---------- */
G("card view modes");
ok("提供视图值归一化函数", typeof ctx.normalizeCardView === "function");
ok("提供视图样式映射函数", typeof ctx.cardViewClass === "function");
ok("提供当前视图提示函数", typeof ctx.viewBtnLabel === "function");
if (typeof ctx.normalizeCardView === "function") {
  eq("网格模式保持不变", ctx.normalizeCardView("grid"), "grid");
  eq("双列模式保持不变", ctx.normalizeCardView("list"), "list");
  eq("紧凑模式保持不变", ctx.normalizeCardView("compact"), "compact");
  eq("未知模式安全回到网格", ctx.normalizeCardView("unknown"), "grid");
}
if (typeof ctx.cardViewClass === "function") {
  eq("网格不追加样式类", ctx.cardViewClass("grid"), "");
  eq("双列沿用现有 list2 样式类", ctx.cardViewClass("list"), " list2");
  eq("紧凑追加 compact 样式类", ctx.cardViewClass("compact"), " compact");
}
if (typeof ctx.viewBtnLabel === "function") {
  eq("双列模式明确读出当前选择", ctx.viewBtnLabel("list"), "Current view: List");
  eq("紧凑模式明确读出当前选择", ctx.viewBtnLabel("compact"), "Current view: Compact");
}

/* ---------- 手机更多菜单分组 ---------- */
G("mobile more menu groups");
ok("提供更多菜单动作分组函数", typeof ctx.moreMenuGroup === "function");
if (typeof ctx.moreMenuGroup === "function") {
  eq("导入属于导入导出组", ctx.moreMenuGroup("import"), "transfer");
  eq("导出属于导入导出组", ctx.moreMenuGroup("export"), "transfer");
  eq("摘要属于 AI 工具组", ctx.moreMenuGroup("summaries"), "ai");
  eq("分类建议属于 AI 工具组", ctx.moreMenuGroup("suggest"), "ai");
  ["widgets","addcat","health","healthIssues","cleanup","trash"].forEach(function(action){
    eq(action+" 属于维护组", ctx.moreMenuGroup(action), "maintenance");
  });
  eq("清空全部独占危险区", ctx.moreMenuGroup("clear"), "danger");
  eq("未知动作不会误入任何组", ctx.moreMenuGroup("unknown"), "");
}

/* ---------- 未配置小组件渐进披露 ---------- */
G("unconfigured widget disclosure");
ctx.state.settings.worldClocks = [];
ctx.ui.worldClockSetup = false;
let wcCollapsed = ctx.worldClockBody(new Date("2026-08-31T12:00:00Z"));
ok("未配置世界时钟只显示添加入口", wcCollapsed.indexOf('data-clock-setup') > -1);
ok("未点击时不渲染世界时钟表单", wcCollapsed.indexOf('id="worldClockForm"') < 0);
ok("未配置时不显示无意义的布局切换", wcCollapsed.indexOf('data-clock-mode') < 0);
ctx.ui.worldClockSetup = true;
let wcExpanded = ctx.worldClockBody(new Date("2026-08-31T12:00:00Z"));
ok("点击后才渲染世界时钟表单", wcExpanded.indexOf('id="worldClockForm"') > -1);

ctx.state.settings.weather = null;
ctx.weatherCache = null;
ctx.ui.weatherPanel = "";

/* ---------- 键盘重排 ---------- */
G("keyboard reorder");
ok("提供不依赖 DOM 的重排函数", typeof ctx.reorderListItem === "function");
if (typeof ctx.reorderListItem === "function") {
  eq("向前移动一位", ctx.reorderListItem(["a","b","c"],1,"earlier").join(""), "bac");
  eq("向后移动一位", ctx.reorderListItem(["a","b","c"],1,"later").join(""), "acb");
  eq("移到开头", ctx.reorderListItem(["a","b","c"],2,"start").join(""), "cab");
  eq("首项不能继续前移", ctx.reorderListItem(["a","b","c"],0,"earlier").join(""), "abc");
  eq("末项不能继续后移", ctx.reorderListItem(["a","b","c"],2,"later").join(""), "abc");
  eq("非法索引保持原顺序", ctx.reorderListItem(["a","b","c"],9,"start").join(""), "abc");
}
ctx.ui.geoTried = false;
let wxCollapsed = ctx.weatherBody();
ok("未配置天气只显示设置入口", wxCollapsed.indexOf('data-wact="openWeatherSetup"') > -1);
ok("未点击时不渲染天气搜索表单", wxCollapsed.indexOf('id="wxSearchForm"') < 0);
ok("未配置天气不显示假加载骨架", wxCollapsed.indexOf('wx-skel') < 0);
ctx.ensureWeather();
ok("未点击 CTA 前不会主动请求定位", ctx.ui.geoTried === false);
ctx.ui.weatherPanel = "search";
let wxExpanded = ctx.weatherBody();
ok("点击后才渲染天气搜索表单", wxExpanded.indexOf('id="wxSearchForm"') > -1);
ctx.ui.weatherPanel = "";

/* ---------- 搜索打分 ---------- */
G("fuzzyScore");
const { fuzzyScore } = ctx;
ok("完全匹配得分最高", fuzzyScore("github", "github.com dev") > fuzzyScore("github", "my git hub notes"));
ok("不相关的词不匹配", fuzzyScore("zzqqxx", "github.com developer tools") === 0);
ok("空查询视为全通过", fuzzyScore("", "anything") === 1);
// —— 以下是"常见字母组合把无关书签全捞出来"这一类回归 ——
// haystack 是标题+URL+分类+描述拼起来的长串，c/o/d/e 这种字母在里面几乎必然凑得齐，
// 松散的子序列和短词编辑距离都会让它命中一切。
ok("code 不匹配散布命中的无关网址", fuzzyScore("code", "example.com some random page") === 0,
   "实际得分 " + fuzzyScore("code", "example.com some random page"));
ok("cod 不匹配（URL 里遍地是 com，距离 1）", fuzzyScore("cod", "example.com some random page") === 0,
   "实际得分 " + fuzzyScore("cod", "example.com some random page"));
ok("code 仍能匹配真正相关的", fuzzyScore("code", "https://code.visualstudio.com VS Code") > 0);
// 收紧的同时这些必须活着：紧凑缩写、拼写容错
ok("gh 仍能匹配 github（紧凑缩写）", fuzzyScore("gh", "github.com https://github.com") > 0);
ok("dcs 仍能匹配 docs（紧凑缩写）", fuzzyScore("dcs", "https://docs.google.com") > 0);
ok("gthub 仍能匹配 github（拼写容错）", fuzzyScore("gthub", "github.com https://github.com") > 0);
ok("dribble 仍能匹配 dribbble", fuzzyScore("dribble", "dribbble.com 设计灵感") > 0);
ok("3 字查询仍走子串匹配", fuzzyScore("mdn", "MDN Web Docs https://developer.mozilla.org") > 0);

/* ---------- 检索缓存与掩码预筛（这次性能优化引入的新面） ---------- */
G("检索派生缓存");
const bm = { id:"x1", title:"React 官方文档", url:"https://react.dev/learn",
             category:"开发", description:"入门指南", tags:["前端"] };
const d1 = ctx.bookmarkSearchData(bm);
ok("内容没变时复用同一份缓存", ctx.bookmarkSearchData(bm) === d1);
bm.title = "Vue 官方文档";
const d2 = ctx.bookmarkSearchData(bm);
ok("改了标题就重算", d2 !== d1 && d2.ch.indexOf("vue") > -1, "ch=" + d2.ch.slice(0, 40));
ok("缓存不进 JSON（否则会写进 localStorage 和导出文件）",
   JSON.stringify(bm).indexOf("_sx") < 0);
ok("缓存不出现在 Object.keys 里", Object.keys(bm).indexOf("_sx") < 0);
// 改了内容后搜索结果要跟着变——缓存类改动最容易在这里翻车
ctx.state.bookmarks = [{ id:"c1", title:"独一无二的旧标题", url:"https://example.org/a",
                         category:"c", description:"", tags:[] }];
ctx.state.categories = ["c"]; ctx.ui.activeCat = "All"; ctx.ui.tagFilter = ""; ctx.ui.query = "旧标题";
eq("改名前能搜到", ctx.visibleBookmarks().length, 1);
ctx.state.bookmarks[0].title = "换成了别的名字";
eq("改名后旧词搜不到", ctx.visibleBookmarks().length, 0);
ctx.ui.query = "别的名字";
eq("改名后新词能搜到", ctx.visibleBookmarks().length, 1);
ctx.ui.query = "";

G("掩码预筛不会漏匹配");
// 先确认掩码本身有区分力——写坏成"全都一样"时预筛会静默失效（结果仍对，只是白算）
ok("不同字符集的掩码不同", ctx.charMask("abc") !== ctx.charMask("xyz"));
eq("缺失字符数计算正确", ctx.popcount(ctx.charMask("abcd") & ~ctx.charMask("abxy")), 2);
eq("完全包含时缺失为 0", ctx.popcount(ctx.charMask("abc") & ~ctx.charMask("xabcy")), 0);
// 预筛的前提：查询里有 k+1 个字符在目标里根本不存在时，编辑距离必然 > k。
// 这条不成立的话，预筛就会把真匹配挡掉——用随机串做属性测试来守住它。
let violations = 0, checked = 0;
const alpha = "abcdefghijklmnopqrstuvwxyz0123456789";
const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
for (let i = 0; i < 4000; i++) {
  const la = 3 + Math.floor(rnd() * 8), lb = 3 + Math.floor(rnd() * 8);
  let a = "", b = "";
  for (let j = 0; j < la; j++) a += alpha[Math.floor(rnd() * alpha.length)];
  for (let j = 0; j < lb; j++) b += alpha[Math.floor(rnd() * alpha.length)];
  if (rnd() < 0.5) { const cut = Math.floor(rnd() * a.length); b = a.slice(0, cut) + alpha[Math.floor(rnd()*alpha.length)] + a.slice(cut + 1); }
  for (const k of [0, 1, 2]) {
    const dist = ctx.editDistance(a, b, k);
    if (dist <= k) { checked++; if (ctx.popcount(ctx.charMask(a) & ~ctx.charMask(b)) > k) violations++; }
  }
}
ok("真匹配从不被预筛挡掉（" + checked + " 个样本）", violations === 0, violations + " 个反例");
ok("样本量足够", checked > 200, "只验证了 " + checked + " 个");
// 上面那条只验证了数学不等式本身，验证不到"代码有没有正确地用它"。
// 真正该守的是：加了预筛之后，打分结果必须和不加预筛完全一致。
let diff = 0, pairs = 0, sample = "";
const HAYS = ["React 官方文档 https://react.dev/learn 开发 前端",
              "MDN Web API https://developer.mozilla.org/en-US/docs/Web/API 学习",
              "Stack Overflow python tagged questions https://stackoverflow.com/questions",
              "知乎问题 如何入门机器学习 https://zhihu.com/question/123456 学习",
              "npm lodash package https://npmjs.com/package/lodash 工具",
              "Bookmark 42 https://example42.com/some/path Cat2 desc"];
const QS = ["react","documentation","python","机器学习","lodash","stackoverflow","exa","gi",
            "docs","mdn","reac","pyton","stackoverflw","zh","例子","example42","npm包"];
for (const h of HAYS) {
  const withMask = { ch: ctx.compactSearch(h), ht: ctx.looseText(h).split(/\s+/).filter(Boolean) };
  withMask.hm = withMask.ht.map(ctx.charMask);
  const noMask = { ch: withMask.ch, ht: withMask.ht, hm: null };
  for (const q of QS) {
    const qd = ctx.queryData(q); pairs++;
    const a = ctx.fuzzyScoreData(qd, withMask), b = ctx.fuzzyScoreData(qd, noMask);
    if (a !== b) { diff++; if (!sample) sample = '"' + q + '" → 有预筛 ' + a + "，无预筛 " + b; }
  }
}
ok("预筛不改变任何打分结果（" + pairs + " 组）", diff === 0, diff + " 组不一致，例如 " + sample);
// 手工用例的"缺失字符数"几乎都是 0，碰不到 popcount 恰好等于容错上限的边界，
// 而预筛写错（<= 写成 <）正是在这个边界上翻车。用随机串把边界扫出来。
let rdiff = 0, rpairs = 0, hitBoundary = 0, rsample = "";
for (let i = 0; i < 3000; i++) {
  const la = 4 + Math.floor(rnd() * 6);
  let base = "";
  for (let j = 0; j < la; j++) base += alpha[Math.floor(rnd() * alpha.length)];
  // 在 base 上做 1~2 处改动当查询，保证有相当比例落在编辑距离容错边界上
  let q = base;
  const edits = 1 + Math.floor(rnd() * 2);
  for (let e = 0; e < edits; e++) {
    const at = Math.floor(rnd() * q.length);
    q = q.slice(0, at) + alpha[Math.floor(rnd() * alpha.length)] + q.slice(at + 1);
  }
  const h = "title " + base + " https://" + base + ".com/x cat desc";
  const wm = { ch: ctx.compactSearch(h), ht: ctx.looseText(h).split(/\s+/).filter(Boolean) };
  wm.hm = wm.ht.map(ctx.charMask);
  const nm = { ch: wm.ch, ht: wm.ht, hm: null };
  const qd = ctx.queryData(q); rpairs++;
  const maxd = q.length <= 3 ? 0 : (q.length <= 6 ? 1 : 2);
  for (const tok of wm.ht) if (ctx.popcount(ctx.charMask(q) & ~ctx.charMask(tok)) === maxd) { hitBoundary++; break; }
  const a = ctx.fuzzyScoreData(qd, wm), b = ctx.fuzzyScoreData(qd, nm);
  if (a !== b) { rdiff++; if (!rsample) rsample = '"' + q + '" vs "' + base + '"：有预筛 ' + a + "，无预筛 " + b; }
}
ok("随机串上预筛同样不改变结果（" + rpairs + " 组）", rdiff === 0, rdiff + " 组不一致，例如 " + rsample);
ok("随机样本确实覆盖到了边界（popcount 恰等于容错上限）", hitBoundary > 50, "只覆盖到 " + hitBoundary + " 组");

G("fuzzyScore 字符串入口");
// palette.js 仍然用 fuzzyScore(q, 字符串)，两条入口的结果必须一致
const hay = "React 官方文档 https://react.dev/learn 开发 前端";
ok("字符串入口与数据入口结果相同",
   ctx.fuzzyScore("react", hay) ===
   ctx.fuzzyScoreData(ctx.queryData("react"), { ch: ctx.compactSearch(hay),
     ht: ctx.looseText(hay).split(/\s+/).filter(Boolean), hm: null }));
ok("字符串入口仍能正常匹配", ctx.fuzzyScore("react", hay) > 0);

/* ---------- URL 去重规范化 ---------- */
G("normForDup");
const { normForDup } = ctx;
eq("补协议", normForDup("example.com/a"), "https://example.com/a");
eq("去尾斜杠", normForDup("https://example.com/a/"), "https://example.com/a");
eq("大小写归一", normForDup("https://Example.COM/A"), "https://example.com/a");
ok("有无尾斜杠算同一条", normForDup("https://x.com/p/") === normForDup("https://x.com/p"));

/* ---------- 同步指纹 ---------- */
G("syncFingerprint");
const { syncFingerprint } = ctx;
const mk = (id, url, title) => ({ id, url, title, category: "c", description: "", tags: [] });
const A = [mk("1","https://a.com","A"), mk("2","https://b.com","B")];
const B = [mk("2","https://b.com","B"), mk("1","https://a.com","A")];   // 只是顺序不同
const C = [mk("1","https://a.com","A 改过了"), mk("2","https://b.com","B")];
eq("纯换顺序不算改动", syncFingerprint(A), syncFingerprint(B));
ok("改了标题就要变", syncFingerprint(A) !== syncFingerprint(C));

/* ---------- 书签镜像规划（写错就是删掉别人的书签） ---------- */
G("planMirror");
const canon = (list) => list.map(([title,url,category]) => ({title,url,category}));

// 空镜像 → 全部新建
let p = ctx.planMirror(canon([["A","https://a.com","开发"],["B","https://b.com","设计"]]), []);
eq("空镜像时新建两个文件夹", p.addFolders.sort().join(","), "672-开发,设计".slice(4));
eq("空镜像时新建两条", p.addItems.length, 2);
eq("空镜像时不删任何东西", p.removeItems.length + p.removeFolders.length, 0);

// 完全一致 → 什么都不做（最重要的一条：不能每次都重建一遍）
const existing = [{id:"f1",title:"开发",items:[{id:"i1",title:"A",url:"https://a.com"}]}];
p = ctx.planMirror(canon([["A","https://a.com","开发"]]), existing);
ok("完全一致时是空操作", ctx.mirrorPlanIsNoop(p), JSON.stringify(p));

// 标题改了 → 只更新，不重建
p = ctx.planMirror(canon([["A 改名了","https://a.com","开发"]]), existing);
eq("只产生一次更新", p.updateItems.length, 1);
eq("更新指向正确的节点", p.updateItems[0].id, "i1");
eq("不新建也不删除", p.addItems.length + p.removeItems.length, 0);

// 换了分类 → 移动而不是删了重建（保留节点，书签的添加日期等不丢）
p = ctx.planMirror(canon([["A","https://a.com","设计"]]), existing);
eq("产生一次移动", p.moveItems.length, 1);
eq("移动到新分类", p.moveItems[0].folder, "设计");
eq("移动时不删除节点", p.removeItems.length, 0);
ok("目标文件夹会被建出来", p.addFolders.indexOf("设计") > -1);

// 主浏览器删掉了 → 镜像里也要删
p = ctx.planMirror(canon([]), existing);
eq("多余的条目被删", p.removeItems.length, 1);
eq("空掉的文件夹被删", p.removeFolders.length, 1);

// 网址等价（尾斜杠/大小写）不该被当成两条
p = ctx.planMirror(canon([["A","https://A.com/","开发"]]), existing);
ok("尾斜杠与大小写视为同一条", p.addItems.length === 0 && p.removeItems.length === 0, JSON.stringify(p));

// 镜像里出现重复网址 → 留一条，其余清掉
p = ctx.planMirror(canon([["A","https://a.com","开发"]]),
  [{id:"f1",title:"开发",items:[{id:"i1",title:"A",url:"https://a.com"},{id:"i2",title:"A 副本",url:"https://a.com"}]}]);
eq("重复项被清掉一条", p.removeItems.length, 1);
eq("被清掉的是副本", p.removeItems[0], "i2");

// 没有网址的杂项（用户手动塞进镜像文件夹的子文件夹之类）也会被清走
p = ctx.planMirror(canon([]), [{id:"f1",title:"开发",items:[{id:"x1",title:"手动加的",url:""}]}]);
eq("无网址的条目被清掉", p.removeItems.length, 1);

// 边界
ok("传空不炸", ctx.mirrorPlanIsNoop(ctx.planMirror([], [])));
ok("传 null 不炸", ctx.mirrorPlanIsNoop(ctx.planMirror(null, null)));
p = ctx.planMirror(canon([["无分类","https://c.com",""]]), []);
eq("没有分类时归到 Uncategorized", p.addItems[0].folder, "Uncategorized");

G("browserRole");
ctx.localStorage.removeItem("navi.device");
eq("默认不参与镜像", ctx.browserRole(), "off");
ctx.setBrowserRole("follower");
ok("设成从浏览器", ctx.isFollower() === true && ctx.isAnchor() === false);
ctx.setBrowserRole("anchor");
ok("设成主浏览器", ctx.isAnchor() === true && ctx.isFollower() === false);
ctx.setBrowserRole("胡乱写的");
eq("非法值退回 off", ctx.browserRole(), "off");
// 角色是这台浏览器自己的事，绝不能同步出去
ok("角色不写进 settings", JSON.stringify(ctx.state.settings).indexOf("browserRole") < 0);

/* ---------- 书签优先：仪表盘默认折叠 + 一次性迁移 ---------- */
G("bookmarks-first dashboard");
const freshDashboard = ctx.defaults();
ok("新安装默认折叠仪表盘，让书签先进入首屏",
   freshDashboard.settings.widgetsCollapsed === true);
const previousDashboardSettings = ctx.state.settings;
ctx.state.settings = Object.assign({}, freshDashboard.settings, { widgetsCollapsed:false });
delete ctx.state.settings.bookmarksFirstVersion;
const canMigrateBookmarksFirst = typeof ctx.migrateBookmarksFirst === "function";
ok("提供旧配置的一次性书签优先迁移", canMigrateBookmarksFirst);
if (canMigrateBookmarksFirst) {
  ok("旧配置第一次迁移会折叠仪表盘",
     ctx.migrateBookmarksFirst({}) === true && ctx.state.settings.widgetsCollapsed === true);
  ctx.state.settings.widgetsCollapsed = false; // 模拟用户迁移后主动展开
  ok("迁移标记存在后不再覆盖用户选择",
     ctx.migrateBookmarksFirst(ctx.state.settings) === false && ctx.state.settings.widgetsCollapsed === false);
}
ctx.state.settings = previousDashboardSettings;

/* ---------- 完整 JSON 备份默认脱敏 ---------- */
G("backup credential redaction");
const previousBackupSettings = ctx.state.settings;
ctx.state.settings = Object.assign({}, previousBackupSettings, {
  appName:"Private Navi",
  aiKey:"sk-private-test",
  profiles:[
    {id:"local",name:"Local",type:"local"},
    {id:"nas",name:"NAS",type:"webdav",url:"https://nas.example/bookmarks.json",user:"max",pass:"dav-private-test"}
  ]
});
const safeBackup = ctx.buildBackup();
eq("JSON 备份不导出 AI Key", safeBackup.settings.aiKey, "");
ok("JSON 备份不导出任何 WebDAV 密码",
   safeBackup.settings.profiles.every(function(profile){ return !profile.pass; }),
   JSON.stringify(safeBackup.settings.profiles));
eq("脱敏后仍保留普通设置", safeBackup.settings.appName, "Private Navi");
eq("生成脱敏备份不会清空当前 AI Key", ctx.state.settings.aiKey, "sk-private-test");
eq("生成脱敏备份不会清空当前 WebDAV 密码", ctx.state.settings.profiles[1].pass, "dav-private-test");
ctx.state.settings = previousBackupSettings;

/* ---------- 窄屏组件可见性 ---------- */
G("widgetVisibleNow / widgetsCollapsedNow");
ctx.state.settings.widgets={clock:true, calendar:true, monitor:false};
ctx.state.settings.widgetsMobile={};
// 宽屏：只看总开关
ctx.window.matchMedia=function(){ return {matches:false, addEventListener(){}, addListener(){}}; };
ok("宽屏下开着的组件显示", ctx.widgetVisibleNow("clock") === true);
ok("宽屏下关掉的组件不显示", ctx.widgetVisibleNow("monitor") === false);
// 窄屏：额外看白名单，没设过 = 显示（不静默藏东西）
ctx.window.matchMedia=function(){ return {matches:true, addEventListener(){}, addListener(){}}; };
ok("窄屏未设置时仍显示", ctx.widgetVisibleNow("clock") === true);
ctx.state.settings.widgetsMobile={calendar:false};
ok("窄屏被排除的组件不显示", ctx.widgetVisibleNow("calendar") === false);
ok("窄屏排除不影响其它组件", ctx.widgetVisibleNow("clock") === true);
ctx.window.matchMedia=function(){ return {matches:false, addEventListener(){}, addListener(){}}; };
ok("同一个组件在宽屏照常显示", ctx.widgetVisibleNow("calendar") === true);

// 折叠：窄屏下这台设备的选择优先于同步过来的设置
ctx.localStorage.removeItem("navi.device");
ctx.state.settings.widgetsCollapsed=false;
ctx.state.settings.mobileCollapse=true;
ctx.window.matchMedia=function(){ return {matches:true, addEventListener(){}, addListener(){}}; };
ok("手机上首次打开默认折叠", ctx.widgetsCollapsedNow() === true);
ctx.deviceSet("mobileExpanded", true);
ok("用户在这台设备展开后就保持展开", ctx.widgetsCollapsedNow() === false);
ctx.window.matchMedia=function(){ return {matches:false, addEventListener(){}, addListener(){}}; };
ok("桌面端不受手机上的选择影响", ctx.widgetsCollapsedNow() === false);
ctx.state.settings.widgetsCollapsed=true;
ok("桌面端仍按自己的设置折叠", ctx.widgetsCollapsedNow() === true);
// 设备本地偏好绝不能进入会同步的 settings
ok("设备偏好不写进 settings", JSON.stringify(ctx.state.settings).indexOf("mobileExpanded") < 0);
ok("设备偏好存在独立的 localStorage 键", !!ctx.localStorage.getItem("navi.device"));

/* ---------- 存档导出包 ---------- */
G("snapParseBundle");
const goodBundle={schema:"navi-archives",version:1,count:2,archives:[
  {url:"https://a.example/1",title:"甲",text:"x".repeat(80),at:1000},
  {url:"https://b.example/2",title:"乙",text:"y".repeat(80),at:2000}]};
eq("正常包能解析", (ctx.snapParseBundle(goodBundle)||[]).length, 2);
ok("补齐缺省字段", (function(){ const r=ctx.snapParseBundle(goodBundle)[0];
  return typeof r.excerpt==="string" && typeof r.truncated==="boolean" && r.chars===80; })());
// 别把书签备份误当成存档包导进来
ok("书签备份不是存档包", ctx.snapParseBundle({schema:"navi-bookmarks",bookmarks:[{url:"https://x.com"}]}) === null);
ok("乱七八糟的对象返回 null", ctx.snapParseBundle({foo:1}) === null);
ok("null 返回 null", ctx.snapParseBundle(null) === null);
eq("裸数组也接受（手工拼的文件常这样）",
   (ctx.snapParseBundle([{url:"https://c.example/3",text:"z".repeat(80)}])||[]).length, 1);
eq("完全没正文的条目被丢掉",
   (ctx.snapParseBundle({schema:"navi-archives",archives:[{url:"https://d.example",text:"  "}]})||[]).length, 0);
// 回归：按字符数卡长度是拉丁中心的，四十来字的中文正文是完整文章
eq("短中文正文不该被当成垃圾丢掉",
   (ctx.snapParseBundle({schema:"navi-archives",archives:[
     {url:"https://d.example",text:"红烧肉的做法。五花肉切块焯水。冰糖炒糖色是关键。红烧肉要炖到软糯。"}]})||[]).length, 1);
eq("没有 url 的条目被丢掉",
   (ctx.snapParseBundle({schema:"navi-archives",archives:[{title:"没地址",text:"x".repeat(80)}]})||[]).length, 0);

G("snapImportDecision");
// 同一页面两边都有时，留更新的那份，避免导入旧备份把新存档盖掉
eq("本地没有 → 新增", ctx.snapImportDecision({at:100}, null), "add");
eq("导入的更新 → 替换", ctx.snapImportDecision({at:200}, {at:100}), "replace");
eq("导入的更旧 → 跳过", ctx.snapImportDecision({at:100}, {at:200}), "skip");
eq("时间相同 → 跳过（不做无谓写入）", ctx.snapImportDecision({at:100}, {at:100}), "skip");

/* ---------- 远端内容识别 ---------- */
G("looksLikeBookmarkExport");
// NAS 反代在会话过期时常对任何请求回一个 200 登录页；登录页里也有 <a href>，
// 以前会被当成书签文件整份采纳，把本地库替换成登录页上的几个链接。
const loginPage = '<!doctype html><html><head><title>DSM Login</title></head><body><h1>Sign in</h1>' +
  '<a href="https://www.synology.com/support">Support</a>' +
  '<a href="https://account.synology.com/reset">Forgot password</a></body></html>';
ok("登录页不算书签文件", ctx.looksLikeBookmarkExport(loginPage) === false);
ok("目录列表不算", ctx.looksLikeBookmarkExport('<html><body><ul><li><a href="https://x.com/a">a</a></li></ul></body></html>') === false);
ok("错误页不算", ctx.looksLikeBookmarkExport("<html><body>404 Not Found</body></html>") === false);
// 真正的浏览器导出文件必须继续认得
ok("带 NETSCAPE 声明的认得",
   ctx.looksLikeBookmarkExport('<!DOCTYPE NETSCAPE-Bookmark-file-1><HTML><BODY><DL><DT><A HREF="https://x.com">X</A></DL>') === true);
ok("只有 DT/A 结构也认得",
   ctx.looksLikeBookmarkExport('<DL><p><DT><A HREF="https://x.com" ADD_DATE="1">X</A></DL>') === true);
ok("空内容不算", ctx.looksLikeBookmarkExport("") === false);

/* ---------- 推送决策（这条错一次就是别人的数据被抹掉） ---------- */
G("syncPushDecision");
const bmk=[{id:"1",url:"https://a.com",title:"A",category:"c",description:"",tags:[]}];
const fpOf=ctx.syncFingerprint(bmk);
eq("远程不存在 → 直接写", ctx.syncPushDecision({missing:true}, undefined), "upload");
eq("远程不存在且有基准 → 直接写", ctx.syncPushDecision({missing:true}, fpOf), "upload");
eq("远程读不懂 → 交给用户", ctx.syncPushDecision({unreadable:true}, fpOf), "conflict");
// 这条是回归：以前没有基准指纹时直接上传，把另一台设备的数据整份覆盖掉还报成功
eq("没有基准指纹但远程有内容 → 交给用户", ctx.syncPushDecision({data:{bookmarks:bmk}}, undefined), "conflict");
eq("基准为空字符串同样不算基准", ctx.syncPushDecision({data:{bookmarks:bmk}}, ""), "conflict");
eq("指纹一致 → 直接写", ctx.syncPushDecision({data:{bookmarks:bmk}}, fpOf), "upload");
eq("指纹不一致 → 交给用户", ctx.syncPushDecision({data:{bookmarks:bmk}}, "别的指纹"), "conflict");
eq("拿不到远端信息 → 保守处理", ctx.syncPushDecision(null, fpOf), "conflict");

/* ---------- 远端合并 ---------- */
G("mergeRemoteIntoLocal");
ctx.state.bookmarks = [mk("L1","https://same.com","本地版本"), mk("L2","https://local-only.com","只在本地")];
ctx.state.categories = ["c"];
ctx.state.trash = [{ bm: mk("T1","https://deleted.com","本地删掉的"), deletedAt: Date.now() }];
const merged = ctx.mergeRemoteIntoLocal({
  bookmarks: [mk("R1","https://same.com","远端版本"), mk("R2","https://remote-only.com","只在远端"),
              mk("R3","https://deleted.com","本地删掉的")],
  categories: ["c","远端新分类"]
});
const urls = merged.bookmarks.map(b => b.url);
ok("远端独有的会并进来", urls.indexOf("https://remote-only.com") > -1);
ok("本地独有的不会丢", urls.indexOf("https://local-only.com") > -1);
eq("同一 URL 本地版本优先",
   (merged.bookmarks.find(b => b.url === "https://same.com") || {}).title, "本地版本");
ok("远端新分类会并进来", merged.categories.indexOf("远端新分类") > -1);
eq("新增计数正确", merged.added, 1);
ok("回收站作为墓碑，删掉的不会被远端复活",
   urls.indexOf("https://deleted.com") < 0, "实际: " + JSON.stringify(urls));

/* ---------- r.jina.ai 的 markdown 解析 ---------- */
G("parseJina");
const jina = [
  "Title: Service worker", "", "URL Source: https://en.wikipedia.org/wiki/Service_worker", "",
  "Markdown Content:",
  "[Jump to content](https://en.wikipedia.org/wiki/Service_worker#bodyContent)",
  "- [x] Main menu ", "move to sidebar hide",
  "*   [Main page](https://en.wikipedia.org/wiki/Main_Page \"Visit the main page\")",
  "*   [Contents](https://en.wikipedia.org/wiki/Wikipedia:Contents \"Guides\")",
  "这是真正的正文段落，长度足够超过阈值，里面没有密集的链接，应该被当作描述抽出来，用于验证按行筛选的规则确实有效。"
].join("\n");
const jr = ctx.parseJina(jina) || "";
ok("抽到了正文", jr.indexOf("这是真正的正文段落") > -1);
ok("导航块被丢掉", jr.indexOf("Main menu") < 0 && jr.indexOf("move to sidebar") < 0, jr.slice(0, 160));
ok("标题被识别", jr.indexOf("Service worker") > -1);
ok("正文太少时返回 null", ctx.parseJina("Title: x\n\nMarkdown Content:\n短") === null);
// 中文正文一段常常只有五六十字，按字符数卡 80 会整段丢掉
const zh = ["Title: 中文页面","","Markdown Content:","*   [导航](https://x.com \"导航\")","跳转到内容",
  "这是一段正常长度的中文正文，介绍了页面的主要内容，通常五六十个字就足以说明白一件事。"].join("\n");
const zr = ctx.parseJina(zh) || "";
ok("中文正文不会被长度阈值丢掉", zr.indexOf("这是一段正常长度的中文正文") > -1, zr.slice(0,120) || "(null)");
ok("中文导航短句仍被丢掉", zr.indexOf("跳转到内容") < 0 && zr.indexOf("导航") < 0);

/* ---------- 清理分类 ---------- */
G("cleanupScan");
const now = Date.now(), day = 86400000;
ctx.state.bookmarks = [
  { id:"a", url:"https://dup.com", title:"留下的", clicks:9, lastOpened:now-day, description:"x", category:"c" },
  { id:"b", url:"https://dup.com/", title:"重复的", clicks:0, lastOpened:0, description:"", category:"c" },
  { id:"c", url:"https://never.com", title:"从没打开", clicks:0, lastOpened:0, category:"c" },
  { id:"d", url:"https://stale.com", title:"很久没开", clicks:3, lastOpened:now-400*day, category:"c" },
  { id:"e", url:"https://dead.com", title:"失效", clicks:1, lastOpened:now-day, category:"c", health:{status:"bad"} }
];
const scan = ctx.cleanupScan();
eq("重复识别出 1 条", scan.dup.length, 1);
eq("重复项保留点击多的那条", scan.dup[0].keep.id, "a");
ok("被判重复的不再进其它分类",
   !scan.never.concat(scan.stale, scan.dead).some(x => x.b.id === "b"));
eq("从没打开", scan.never.length, 1);
eq("长期未用", scan.stale.length, 1);
eq("失效链接", scan.dead.length, 1);

/* ---------- 本地关键词提取 ---------- */
G("extractKeywords");
const zhText = "机器学习入门指南。本文介绍机器学习的基本概念，包括监督学习、无监督学习和强化学习。" +
               "机器学习模型的训练需要大量数据，深度学习是机器学习的一个分支，神经网络是深度学习的核心。" +
               "我们会用 Python 和 PyTorch 实现一个简单的神经网络。";
const zhKw = ctx.extractKeywords(zhText, 8);
ok("中文抽出真正的词", zhKw.indexOf("机器学习") > -1 && zhKw.indexOf("神经网络") > -1, zhKw.join("/"));
// 中文没有词边界，n-gram 会切出"器学习入"这种跨词碎片，必须被过滤掉
ok("不出现跨词碎片", !zhKw.some(w => ["器学习入","学习入门","习入门指","是机器学"].indexOf(w) > -1), zhKw.join("/"));
ok("被长词吸收的短词不重复出现", zhKw.indexOf("学习") < 0, zhKw.join("/"));
// 这是有意的取舍：中文片段只出现一次时无法与跨词碎片区分，宁可漏也不给噪声
ok("只出现一次的中文词不进候选", ctx.extractKeywords("量子计算很有趣。今天天气不错，我去买了一杯咖啡然后回家。", 8)
   .indexOf("量子计算") < 0);
ok("中英混排时英文词照常抽出", zhKw.indexOf("pytorch") > -1 || zhKw.indexOf("python") > -1, zhKw.join("/"));

const enText = "Using IndexedDB. This tutorial walks you through using the asynchronous API of IndexedDB. " +
               "IndexedDB is a transactional database system. Transactions in IndexedDB are scoped to object stores.";
const enKw = ctx.extractKeywords(enText, 8);
ok("英文抽到主题词", enKw.indexOf("indexeddb") > -1, enKw.join("/"));
ok("停用词被剔除", !enKw.some(w => ["the","this","through","using","are","you"].indexOf(w) > -1), enKw.join("/"));
ok("同词根只保留一个", enKw.filter(w => w.indexOf("transaction") === 0).length <= 1, enKw.join("/"));

// 每篇都出现的词没有区分度，应该被 IDF 压下去
const df = { 教程: 20, 神经网络: 1 };
const idfKw = ctx.extractKeywords("神经网络教程。神经网络教程讲解神经网络。教程教程教程教程。", 3, df, 20);
ok("语料里到处都有的词被压低", idfKw.indexOf("神经网络") > -1 && idfKw[0] !== "教程", idfKw.join("/"));

G("跨词碎片过滤（左右自由度）");
// n-gram 会切出"器学习入"这种跨词碎片。判据不是频次也不是凝固度，
// 而是左右自由度：真词出现在各种上下文里，碎片永远被夹在同一个短语中间。
const frag = "机器学习入门 机器学习入门指南。机器学习的基本概念包括监督学习和无监督学习。" +
             "机器学习模型需要大量训练数据。深度学习是机器学习的一个分支。神经网络是深度学习的核心。神经网络有很多层。";
const fk = ctx.extractKeywords(frag, 12);
ok("真词都在", ["机器学习","监督学习","深度学习","神经网络"].every(w => fk.indexOf(w) > -1), fk.join("/"));
ok("碎片一个不留", !["器学习入","学习入门","习入门指","是机器学","度学习是","经网络是"].some(w => fk.indexOf(w) > -1), fk.join("/"));
// 总在句首出现的词，左邻居永远是边界符——那是成词的证据，不能因此判成碎片
const head = "神经网络很重要。神经网络有很多层。神经网络需要训练。";
ok("总在句首的词不被误杀", ctx.extractKeywords(head, 5).indexOf("神经网络") > -1,
   ctx.extractKeywords(head, 5).join("/"));

G("summarizeText 抽取式摘要");
const artZh = "跳转到内容。主菜单。机器学习入门指南。本文介绍机器学习的基本概念。" +
  "机器学习是人工智能的一个分支，它让计算机从数据中学习规律，而不需要显式编程。" +
  "监督学习使用带标签的数据训练模型，无监督学习则从无标签数据中发现结构。" +
  "深度学习是机器学习的一个子领域，它使用多层神经网络。神经网络的训练依赖反向传播算法。版权所有。联系我们。";
const sZh = ctx.summarizeText(artZh, 120);
ok("摘出的是原文里的句子", artZh.indexOf(sZh.split("。")[0]) > -1, sZh);
ok("跳过导航与页脚残留", ["跳转到内容","主菜单","版权所有","联系我们"].every(j => sZh.indexOf(j) < 0), sZh);
ok("长度受控", ctx.kwTextWeight(sZh) < 120 * 1.4, "权重长度 " + Math.round(ctx.kwTextWeight(sZh)));
ok("中文句子之间不留多余空格", !/。\s/.test(sZh), sZh);

const artEn = "Skip to content. Menu. Using IndexedDB. IndexedDB is a low-level API for client-side storage " +
  "of significant amounts of structured data. This tutorial walks you through using the asynchronous API. " +
  "You create an object store and then add records to it. Last modified on Feb 8. View this page on GitHub.";
const sEn = ctx.summarizeText(artEn, 140);
ok("英文摘要抓住主题", sEn.toLowerCase().indexOf("indexeddb") > -1, sEn);
ok("英文跳过导航", sEn.indexOf("Skip to content") < 0 && sEn.indexOf("View this page") < 0, sEn);
ok("句子按原文顺序排列", (function(){
  const parts = sEn.split(/(?<=\.)\s+/).filter(Boolean);
  let last = -1;
  return parts.every(p => { const at = artEn.indexOf(p.trim()); const ok2 = at > last; last = at; return ok2; });
})(), sEn);
eq("空文本返回空", ctx.summarizeText("", 100), "");
ok("重复内容不会被选两遍", (function(){
  const dup = "神经网络很重要。神经网络很重要。神经网络确实很重要。这是另一件完全不同的事情，讲的是数据库事务。";
  const s = ctx.summarizeText(dup, 200);
  return (s.match(/神经网络很重要/g) || []).length <= 1;
})());

G("keywordVector");
const kv = ctx.keywordVector(frag, 10);
ok("返回带词频的结构", kv.length > 0 && typeof kv[0].w === "string" && typeof kv[0].n === "number");
ok("按权重排序，主题词在前", kv[0].w === "机器学习", JSON.stringify(kv.slice(0,3)));
ok("同样不含碎片", !kv.some(x => x.w === "器学习入"), kv.map(x=>x.w).join("/"));

G("bookmarkText");
const bt = ctx.bookmarkText({ title: "标题", description: "描述", url: "https://x.com/some-path/here" });
ok("含标题", bt.indexOf("标题") > -1);
ok("含描述", bt.indexOf("描述") > -1);
ok("含 URL 路径分词", bt.indexOf("some path here") > -1, bt);
ok("有存档时把正文接上", ctx.bookmarkText({ title:"t", url:"https://x.com" }, "正文内容").indexOf("正文内容") > -1);

/* ---------- 存档片段 ---------- */
G("snapshots");
const { snapSnippet, snapKey } = ctx;
const long = "前置内容".repeat(40) + "关键命中词" + "后置内容".repeat(40);
const sn = snapSnippet(long, "关键命中词");
ok("片段包含命中词", sn.indexOf("关键命中词") > -1);
ok("片段两端有省略号", sn.startsWith("…") && sn.endsWith("…"), sn.slice(0, 40));
ok("片段长度受控", sn.length < 200, "实际 " + sn.length);
eq("查不到时返回空", snapSnippet("毫不相干的正文", "找不到"), "");
ok("存档键与去重规范化一致", snapKey("https://X.com/p/") === snapKey("https://x.com/p"));

/* ---------- 概念搜索 ---------- */
G("conceptMatchGroups");
ok("已知概念词能命中分组", (ctx.conceptMatchGroups("视频") || []).length > 0);
ok("无意义词不命中", (ctx.conceptMatchGroups("qwzxjk") || []).length === 0);

console.log((fail ? "\n✘ " : "✔ ") + pass + " passed" + (fail ? ", " + fail + " failed" : ""));
process.exit(fail ? 1 : 0);
