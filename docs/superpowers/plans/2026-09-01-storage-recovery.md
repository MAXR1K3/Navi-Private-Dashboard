# Navi Storage Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single storage boundary that preserves corrupt primary data, keeps three valid recovery revisions, and gives the user explicit restore, raw-download, or confirmed-reset paths.

**Architecture:** Keep `localStorage` as the synchronous primary store for compatibility, move all primary-key inspection and writes behind global `NaviStorage`, and store prior valid raw versions in an IndexedDB recovery store. Make startup an explicit `ok | first-run | recovery` state machine so write-capable initialization never runs against corrupt input.

**Tech Stack:** Plain browser JavaScript, `localStorage`, IndexedDB, existing HTML/CSS modal infrastructure, Node VM logic tests, dependency-free Chrome DevTools Protocol E2E tests, existing Service Worker bump script.

**Spec:** `docs/superpowers/specs/2026-08-31-storage-recovery-design.md`

## Global Constraints

- Preserve the existing `navi.dashboard.v3` primary key and `navi.dashboard.v2` legacy fallback.
- Never call `localStorage.clear()` in production recovery code.
- Never seed, purge, sync, render the normal dashboard, or save while startup status is `recovery`.
- Preserve invalid raw text byte-for-byte until the user explicitly restores or resets.
- Keep IndexedDB revision failures non-blocking for successful primary saves, but announce one warning per page load.
- Keep WebDAV conflict handling, credential separation, and IndexedDB-as-primary out of this implementation.
- Use RED → GREEN for each behavioral unit; do not weaken an assertion to make a test pass.
- Do not add a hash, frozen contract, baseline, or new release gate. Structure validation, revision history, and ordinary tests cover the named overwrite failure.
- Run all commands from `/Users/maxs/Documents/Codex/2026-06-09/private-bookmark-navigation-page-sync-order` or the isolated worktree created for execution.

---

## Task 1: Add the storage inspection and validation boundary

**Files:**

- Create: `js/storage.js`
- Modify: `tools/test.js`
- Modify: `index.html`

**Interfaces introduced:**

```js
NaviStorage.validateDashboardState(value) // boolean
NaviStorage.inspectPrimary()              // ok | first-run | recovery
```

- [ ] **Step 1: Write failing inspection tests**

Add `js/storage.js` to the VM load list immediately after `js/state.js`, then add this group near the top of `tools/test.js`:

```js
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
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node tools/test.js
```

Expected: module loading or `storage boundary is loaded` fails because `js/storage.js` and `NaviStorage` do not exist.

- [ ] **Step 3: Implement validation and inspection**

Create `js/storage.js` with this synchronous boundary:

```js
/* storage.js — primary data boundary and recovery revisions */
"use strict";

var NAVI_SCHEMA_VERSION=4;
var NAVI_LEGACY_KEY="navi.dashboard.v2";

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
  var primary=null, legacy=null;
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

var NaviStorage={
  validateDashboardState:validateDashboardState,
  inspectPrimary:inspectPrimary
};
```

Load it in `index.html` directly after `js/state.js`:

```html
<script src="js/state.js"></script>
<script src="js/storage.js"></script>
<script src="js/icons.js"></script>
```

- [ ] **Step 4: Verify GREEN**

```bash
node tools/test.js
node --check js/storage.js
```

Expected: all logic tests pass and syntax checking exits 0.

- [ ] **Step 5: Commit Task 1**

```bash
git add js/storage.js tools/test.js index.html
git commit -m "添加统一存储检查边界"
```

---

## Task 2: Persist through the boundary and retain three valid revisions

**Files:**

- Modify: `js/storage.js`
- Modify: `js/utils.js`
- Modify: `tools/test.js`

**Interfaces introduced:**

```js
NaviStorage.persist(state)     // boolean
NaviStorage.getLastGood()      // Promise<revision|null>
NaviStorage.restore(raw)       // Promise<boolean>
NaviStorage.clearAll()         // Promise<void>
```

- [ ] **Step 1: Write failing persistence and retention tests**

Add this group to `tools/test.js`:

```js
G("storage persistence planning");
if (ctx.NaviStorage) {
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
```

- [ ] **Step 2: Verify RED**

```bash
node tools/test.js
```

Expected: `NaviStorage.persist` or `selectRecoveryRevisions` is missing.

- [ ] **Step 3: Add deterministic serialization and retention helpers**

Add these functions above `NaviStorage` in `js/storage.js`:

```js
function buildPersistPlan(value,previousRaw){
  var raw;
  try{
    raw=JSON.stringify(Object.assign({},value,{schemaVersion:NAVI_SCHEMA_VERSION}));
  }catch(e){ return {ok:false}; }
  var candidate=parseDashboardRaw(raw);
  if(!candidate.ok) return {ok:false};
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
```

Expose `selectRecoveryRevisions` on `NaviStorage` so the pure test covers the exact retention rule used by IndexedDB.

- [ ] **Step 4: Add the IndexedDB revision queue**

Use these constants and helpers in `js/storage.js`:

```js
var NAVI_RECOVERY_DB="navi-storage";
var NAVI_RECOVERY_STORE="revisions";
var NAVI_REVISION_LIMIT=3;
var _naviRevisionQueue=Promise.resolve();
var _naviRevisionWarned=false;

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
  });
}
function withRevisionStore(mode,run){
  return openRecoveryDb().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(NAVI_RECOVERY_STORE,mode);
      tx.oncomplete=function(){ db.close(); resolve(); };
      tx.onabort=tx.onerror=function(){
        var error=tx.error||new Error("indexeddb-transaction-failed");
        db.close(); reject(error);
      };
      run(tx.objectStore(NAVI_RECOVERY_STORE),tx);
    });
  });
}
function pruneRecoveryStore(store){
  var request=store.getAll();
  request.onsuccess=function(){
    var keep=selectRecoveryRevisions(request.result,NAVI_REVISION_LIMIT);
    var ids={}; keep.forEach(function(row){ ids[row.id]=true; });
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
```

The `add.onsuccess` ordering is required so the new row participates in pruning. Close the database on transaction completion or failure.

- [ ] **Step 5: Implement the public persistence methods**

Add these methods and expose them on `NaviStorage`:

```js
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
      var tx=db.transaction(NAVI_RECOVERY_STORE,"readonly");
      var request=tx.objectStore(NAVI_RECOVERY_STORE).getAll();
      request.onsuccess=function(){ resolve(request.result||[]); };
      request.onerror=function(){ reject(request.error||new Error("revision-read-failed")); };
      tx.oncomplete=function(){ db.close(); };
      tx.onabort=tx.onerror=function(){ db.close(); reject(tx.error||new Error("revision-read-failed")); };
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
  return withRevisionStore("readwrite",function(store){ store.clear(); }).catch(function(){});
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
```

The final `NaviStorage` object must expose `persist`, `getLastGood`, `restore`, `clearAll`, and `selectRecoveryRevisions` with the names listed above.

- [ ] **Step 6: Route existing saves through `NaviStorage`**

Replace the direct main-key writes in `js/utils.js`:

```js
function save(){
  if(typeof oplogCapture==="function") oplogCapture();
  if(NaviStorage.persist(state)) return true;
  if(typeof oplogDropSnaps==="function") oplogDropSnaps();
  if(NaviStorage.persist(state)) return true;
  warnStorageFull(); return false;
}
```

This preserves the existing quota retry while making `NaviStorage` the only ordinary writer for the primary key.

- [ ] **Step 7: Verify GREEN**

```bash
node tools/test.js
node --check js/storage.js
node --check js/utils.js
rg -n 'localStorage\.setItem\(KEY' js
```

Expected: tests pass; syntax checks exit 0; the search returns only the intentional primary writes inside `js/storage.js`.

- [ ] **Step 8: Commit Task 2**

```bash
git add js/storage.js js/utils.js tools/test.js
git commit -m "保存有效数据恢复版本"
```


---

## Task 3: Make startup recovery-safe

**Files:**

- Modify: `js/utils.js`
- Modify: `js/app.js`
- Modify: `tools/test.js`

- [ ] **Step 1: Write failing startup-state tests**

Add to `tools/test.js`:

```js
G("recovery-safe load");
ctx.localStorage.clear();
ctx.state = ctx.defaults();
const corruptStartup = '{"bookmarks":[';
ctx.localStorage.setItem(ctx.KEY, corruptStartup);
const recoveryLoad = ctx.load();
eq("load reports recovery", recoveryLoad.status, "recovery");
eq("load preserves corrupt primary", ctx.localStorage.getItem(ctx.KEY), corruptStartup);
eq("load does not seed demo bookmarks", ctx.state.bookmarks.length, 0);

ctx.localStorage.clear();
ctx.state = ctx.defaults();
const firstRunLoad = ctx.load();
eq("true first run becomes usable", firstRunLoad.status, "ok");
eq("true first run is identified", firstRunLoad.firstRun, true);
ok("true first run seeds demo bookmarks", ctx.state.bookmarks.length>0);
ok("true first run persists a valid primary", !!ctx.localStorage.getItem(ctx.KEY));

const migrationRaw = JSON.stringify(ctx.defaults());
ctx.localStorage.setItem(ctx.KEY, migrationRaw);
const rebuildCategories = ctx.rebuildCategories;
ctx.rebuildCategories = function(){ throw new Error("migration failed"); };
const migrationLoad = ctx.load();
ctx.rebuildCategories = rebuildCategories;
eq("migration exception enters recovery", migrationLoad.reason, "migration-failed");
eq("migration exception preserves original raw", ctx.localStorage.getItem(ctx.KEY), migrationRaw);
```

- [ ] **Step 2: Verify RED**

```bash
node tools/test.js
```

Expected: `load()` returns `undefined` or seeds against corrupt input.

- [ ] **Step 3: Extract hydration and return an explicit load result**

In `js/utils.js`, move the complete parsed-state assignment and migration body into `hydrateDashboardState(s)`. Its opening must be:

```js
function hydrateDashboardState(s){
  var d=defaults();
  state.bookmarks=s.bookmarks;
  state.categories=Array.isArray(s.categories)?s.categories:[];
  state.trash=Array.isArray(s.trash)?s.trash:[];
  state.calendarEvents=Array.isArray(s.calendarEvents)?s.calendarEvents:[];
  state.opLog=Array.isArray(s.opLog)?s.opLog:[];
  state.theme=s.theme||"light";
  state.view=(s.view==="list2"?"list":s.view)||"grid";
  state.settings=Object.assign({},d.settings,s.settings||{});
```

Keep every existing nested-settings merge and migration in this function. Finish with:

```js
  var migrated=migratePowerProfile();
  var bookmarksFirstMigrated=migrateBookmarksFirst(s.settings||{});
  normalizeWidgetOrder(); rebuildCategories();
  if(migrated||bookmarksFirstMigrated) save();
}
```

Replace `load()` with:

```js
function load(){
  var result=NaviStorage.inspectPrimary();
  if(result.status==="recovery") return result;
  if(result.status==="first-run"){
    seed(); save();
    return {status:"ok",firstRun:true};
  }
  try{
    hydrateDashboardState(result.state);
    return {status:"ok",firstRun:false,key:result.key};
  }catch(e){
    return {status:"recovery",reason:"migration-failed",raw:result.raw,key:result.key};
  }
}
```

`seed()` only creates demo state, so the true first-run branch must call `save()` exactly once.

- [ ] **Step 4: Gate all write-capable startup work in `js/app.js`**

Refactor the existing startup body into:

```js
function startNaviRuntime(){
  purgeTrash();
  if(typeof purgeOpLog==="function"){
    var before=Array.isArray(state.opLog)?state.opLog.length:0;
    purgeOpLog();
    if(before!==(Array.isArray(state.opLog)?state.opLog.length:0)) save();
  }
  oplogInit(); applyI18n(); initPerformanceGuards(); render(); initAutoTheme(); initChromeSync();
  if(typeof initSync==="function") initSync();
  if(typeof initCapture==="function") initCapture();
  if(typeof initContextual==="function") initContextual();
  if(typeof initMirror==="function") initMirror();
}
function showRecovery(result){
  document.documentElement.dataset.recovery="true";
  document.documentElement.dataset.recoveryReason=result.reason||"unknown";
}
function bootNavi(){
  var result=load();
  if(result.status==="recovery"){
    showRecovery(result);
    return;
  }
  startNaviRuntime();
}
bootNavi();
```

Task 4 replaces the temporary `showRecovery` body. It must not call `save()`, `seed()`, or any runtime initializer.

- [ ] **Step 5: Verify GREEN**

```bash
node tools/test.js
node --check js/utils.js
node --check js/app.js
```

Expected: all tests pass and corrupt raw remains unchanged.

- [ ] **Step 6: Commit Task 3**

```bash
git add js/utils.js js/app.js tools/test.js
git commit -m "阻止损坏数据触发自动初始化"
```

---

## Task 4: Add the non-dismissible recovery experience

**Files:**

- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `js/ui-core.js`
- Modify: `js/i18n.js`
- Modify: `css/app.css`
- Modify: `js/storage.js`
- Modify: `tools/e2e.js`

- [ ] **Step 1: Add a failing real-browser recovery flow**

In `tools/e2e.js`, insert this group after `dev-check` and before normal fixture setup:

```js
await group("corrupt primary is preserved behind recovery UI", async()=>{
  await cdp.navigate(base+"?recovery-setup="+Date.now());
  await cdp.wait(`typeof NaviStorage==="object"`);
  const prepared=await cdp.evaluate(`(async()=>{
    await NaviStorage.clearAll();
    const good=defaults();
    good.settings.lang="en";
    good.bookmarks=[{id:"recover-me",title:"Recover me",url:"https://example.com/recovered",category:"Work",description:"",tags:[]}];
    NaviStorage.persist(good);
    const newer=defaults();
    newer.settings.lang="en";
    newer.bookmarks=[{id:"newer",title:"Newer",url:"https://example.com/newer",category:"Work",description:"",tags:[]}];
    NaviStorage.persist(newer);
    const archived=await NaviStorage.getLastGood();
    if(!archived||archived.state.bookmarks[0]?.id!=="recover-me") throw new Error("last-good revision was not committed");
    localStorage.setItem("navi.dashboard.v3",'{"bookmarks":[');
    return localStorage.getItem("navi.dashboard.v3");
  })()`);
  assert("corrupt fixture was not written",prepared==='{"bookmarks":[');

  await cdp.navigate(base+"?recovery="+Date.now());
  const recovery=await cdp.wait(`(()=>{const o=document.querySelector("#recoveryOverlay");return o&&o.classList.contains("open")?{raw:localStorage.getItem("navi.dashboard.v3"),name:o.querySelector(".modal").getAttribute("aria-labelledby"),restore:!document.querySelector("#recoveryRestore").disabled,download:!document.querySelector("#recoveryDownload").disabled,focus:o.contains(document.activeElement),blocked:document.querySelector("header").inert&&document.querySelector(".layout").inert}:null})()`);
  assert("corrupt raw changed during startup",recovery.raw==='{"bookmarks":[',JSON.stringify(recovery));
  assert("recovery dialog is not named",recovery.name==="recoveryTitle",JSON.stringify(recovery));
  assert("recovery actions, background blocking, or initial focus are wrong",recovery.restore&&recovery.download&&recovery.focus&&recovery.blocked,JSON.stringify(recovery));

  const escape=await cdp.evaluate(`(()=>{document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));return document.querySelector("#recoveryOverlay").classList.contains("open")})()`);
  assert("Escape dismissed the recovery decision",escape);

  await cdp.evaluate(`document.querySelector("#recoveryRestore").click()`);
  await cdp.wait(`state.bookmarks.some(b=>b.id==="recover-me")`);
  const restored=await cdp.evaluate(`({id:state.bookmarks[0]?.id,status:document.documentElement.dataset.recovery||""})`);
  assert("last valid revision was not restored",restored.id==="recover-me",JSON.stringify(restored));
  assert("app stayed in recovery after restore",restored.status!=="true",JSON.stringify(restored));
});

await group("recovery without a revision still offers download and confirmed reset", async()=>{
  await cdp.evaluate(`NaviStorage.clearAll()`);
  await cdp.evaluate(`localStorage.setItem("unrelated.same-origin","keep");localStorage.setItem("navi.pdata.remote","remove");localStorage.setItem("navi.dashboard.v2","remove");localStorage.setItem("navi.dashboard.prev","remove");localStorage.setItem("navi.dashboard.v3",'{"bookmarks":[');location.reload()`);
  await cdp.wait(`document.querySelector("#recoveryOverlay")?.classList.contains("open")`);
  const actions=await cdp.wait(`(()=>{const r=document.querySelector("#recoveryRestore");const d=document.querySelector("#recoveryDownload");return r&&!document.querySelector("#recoveryStatus").textContent.includes("Checking")?{restore:r.disabled,download:!d.disabled}:null})()`);
  assert("restore should be disabled without a revision",actions.restore);
  assert("download should remain available",actions.download);
  const downloaded=await cdp.evaluate(`new Promise(resolve=>{downloadBlob=(text,mime,name)=>resolve({text,mime,name});document.querySelector("#recoveryDownload").click()})`);
  assert("download did not preserve corrupt raw",downloaded.text==='{\"bookmarks\":[',JSON.stringify(downloaded));
  assert("download filename is not a dated text file",/^navi-corrupt-data-.+\.txt$/.test(downloaded.name),JSON.stringify(downloaded));
  await cdp.evaluate(`document.querySelector("#recoveryReset").click()`);
  await cdp.wait(`document.querySelector("#confirmOverlay").classList.contains("open")`);
  assert("reset confirmation did not open",await cdp.evaluate(`document.querySelector("#recoveryOverlay").classList.contains("open")`));
  await cdp.evaluate(`document.querySelector("#confirmOk").click()`);
  await cdp.wait(`state.bookmarks.length>0 && localStorage.getItem("navi.dashboard.v3")`);
  const reset=await cdp.evaluate(`({profile:localStorage.getItem("navi.pdata.remote"),legacy:localStorage.getItem("navi.dashboard.v2"),previous:localStorage.getItem("navi.dashboard.prev"),unrelated:localStorage.getItem("unrelated.same-origin")})`);
  assert("Navi-owned fallback data survived confirmed reset",reset.profile===null&&reset.legacy===null&&reset.previous===null,JSON.stringify(reset));
  assert("reset deleted unrelated same-origin data",reset.unrelated==="keep",JSON.stringify(reset));
});
```

The `cdp.evaluate` and `cdp.wait` expressions above use JavaScript template literals exactly as shown. Adapt normal fixture setup to replace its existing `localStorage.clear()` with `await NaviStorage.clearAll()` so the unrelated-key assertion remains meaningful.

- [ ] **Step 2: Verify RED**

```bash
node tools/e2e.js
```

Expected: the first recovery group fails because the recovery overlay and handlers do not exist.

- [ ] **Step 3: Add accessible recovery markup**

Insert before the hidden file inputs in `index.html`:

```html
<div class="overlay recovery-overlay" id="recoveryOverlay" data-static-overlay="true">
  <section class="modal recovery-modal" role="dialog" aria-modal="true" aria-labelledby="recoveryTitle" aria-describedby="recoveryDesc">
    <div class="recovery-mark" aria-hidden="true">!</div>
    <h2 id="recoveryTitle" data-i18n="recoveryTitle">Navi needs your decision</h2>
    <p id="recoveryDesc" data-i18n="recoveryDesc">Your original data is still stored, but Navi cannot safely open it.</p>
    <p class="recovery-status" id="recoveryStatus" role="status" aria-live="polite" data-i18n="recoveryChecking">Checking for a valid previous version…</p>
    <div class="recovery-actions">
      <button class="btn primary" id="recoveryRestore" type="button" disabled data-i18n="recoveryRestore">Restore previous version</button>
      <button class="btn" id="recoveryDownload" type="button" data-i18n="recoveryDownload">Download original data</button>
      <button class="btn danger" id="recoveryReset" type="button" data-i18n="recoveryReset">Reset Navi</button>
    </div>
  </section>
</div>
```

- [ ] **Step 4: Make static overlays impossible to dismiss accidentally**

In `js/ui-core.js` add:

```js
function overlayIsStatic(el){ return !!(el&&el.hasAttribute("data-static-overlay")); }
function closeAll(){
  var ids=overlayIds().filter(function(id){ return !overlayIsStatic($("#"+id)); });
  if(typeof summaryUi!=="undefined"&&summaryUi.running) ids=ids.filter(function(id){ return id!=="summaryOverlay"; });
  ids.forEach(closeOverlay); confirmCb=null; promptCb=null;
}
```

In the delegated click handler, ignore `data-close` and backdrop clicks when the target overlay is static. Replace the Escape handler with the following so a secondary confirmation can still be cancelled without dismissing recovery:

```js
document.addEventListener("keydown",function(e){
  if(e.key!=="Escape") return;
  var active=document.activeElement&&document.activeElement.closest
    ?document.activeElement.closest(".overlay.open"):null;
  if(active&&!overlayIsStatic(active)){
    closeOverlay(active.id); confirmCb=null; promptCb=null; closeMenu(); return;
  }
  if(document.querySelector(".overlay.open[data-static-overlay]")) return;
  closeAll(); closeMenu();
});
```

Keep the existing Tab focus trap unchanged.

- [ ] **Step 5: Add all three-language recovery strings**

Add this key set to English in `js/i18n.js`:

```js
recoveryTitle:"Navi needs your decision",
recoveryDesc:"Your original data is still stored, but Navi cannot safely open it.",
recoveryChecking:"Checking for a valid previous version…",
recoveryReady:"A valid previous version from {date} is available.",
recoveryUnavailable:"No valid previous version was found. You can still download the original data or reset Navi.",
recoveryRestore:"Restore previous version",
recoveryDownload:"Download original data",
recoveryReset:"Reset Navi",
recoveryResetTitle:"Reset Navi?",
recoveryResetMsg:"This removes Navi data and profile caches from this browser. Download the original data first if you may need it.",
recoveryResetOk:"Reset Navi",
recoveryRestoreFailed:"The previous version could not be restored."
```

Add the matching Chinese values:

```js
recoveryTitle:"Navi 需要你做出选择",
recoveryDesc:"原始数据仍保存在浏览器中，但 Navi 无法安全打开它。",
recoveryChecking:"正在检查可用的有效版本…",
recoveryReady:"找到 {date} 保存的有效版本。",
recoveryUnavailable:"未找到有效的上一版本。你仍可下载原始数据或重置 Navi。",
recoveryRestore:"恢复上一版本",
recoveryDownload:"下载原始数据",
recoveryReset:"重置 Navi",
recoveryResetTitle:"要重置 Navi 吗？",
recoveryResetMsg:"这会删除此浏览器中的 Navi 数据和 Profile 缓存。如有可能需要，请先下载原始数据。",
recoveryResetOk:"重置 Navi",
recoveryRestoreFailed:"无法恢复上一版本。"
```

Add the matching Spanish values:

```js
recoveryTitle:"Navi necesita tu decisión",
recoveryDesc:"Tus datos originales siguen guardados, pero Navi no puede abrirlos de forma segura.",
recoveryChecking:"Buscando una versión anterior válida…",
recoveryReady:"Hay una versión válida guardada el {date}.",
recoveryUnavailable:"No se encontró una versión anterior válida. Aún puedes descargar los datos originales o restablecer Navi.",
recoveryRestore:"Restaurar versión anterior",
recoveryDownload:"Descargar datos originales",
recoveryReset:"Restablecer Navi",
recoveryResetTitle:"¿Restablecer Navi?",
recoveryResetMsg:"Se eliminarán los datos de Navi y las cachés de perfiles de este navegador. Descarga primero los datos originales si puedes necesitarlos.",
recoveryResetOk:"Restablecer Navi",
recoveryRestoreFailed:"No se pudo restaurar la versión anterior."
```

- [ ] **Step 6: Implement recovery actions in `js/app.js`**

Replace the temporary `showRecovery` with:

```js
var _recoveryResult=null;
var _recoveryLastGood=null;

function showRecovery(result){
  _recoveryResult=result;
  document.documentElement.dataset.recovery="true";
  ["#bgLayer","header","#widgetsWrap",".layout","#selbar","#quickUndoBar"].forEach(function(selector){
    var element=$(selector);
    if(element){ element.inert=true; element.setAttribute("aria-hidden","true"); }
  });
  applyI18n(); openOverlay("recoveryOverlay");
  var restore=$("#recoveryRestore"),status=$("#recoveryStatus");
  restore.disabled=true;
  NaviStorage.getLastGood().then(function(revision){
    _recoveryLastGood=revision;
    restore.disabled=!revision;
    status.textContent=revision
      ?t("recoveryReady",{date:new Date(revision.savedAt).toLocaleString()})
      :t("recoveryUnavailable");
    (revision?restore:$("#recoveryDownload")).focus();
  });
}
function downloadRecoveryRaw(){
  var stamp=new Date().toISOString().replace(/[:.]/g,"-");
  downloadBlob(_recoveryResult.raw||"","text/plain;charset=utf-8","navi-corrupt-data-"+stamp+".txt");
}
$("#recoveryRestore").addEventListener("click",function(){
  if(!_recoveryLastGood) return;
  NaviStorage.restore(_recoveryLastGood.raw).then(function(ok){
    if(ok) location.reload(); else toast(t("recoveryRestoreFailed"),"err");
  });
});
$("#recoveryDownload").addEventListener("click",downloadRecoveryRaw);
$("#recoveryReset").addEventListener("click",function(){
  openConfirm(t("recoveryResetTitle"),t("recoveryResetMsg"),t("recoveryResetOk"),function(){
    NaviStorage.clearAll().then(function(){ location.reload(); });
  });
});
```

Use `getLastGood()` as the deterministic E2E queue boundary; do not add a test-only flush method or expose IndexedDB stores and revision IDs to UI code.

- [ ] **Step 7: Style a calm, high-salience recovery dialog**

Add to the modal section of `css/app.css`:

```css
.recovery-overlay{z-index:94;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(18px)}
.recovery-modal{width:min(560px,calc(100vw - 32px));text-align:center;padding:32px}
.recovery-mark{display:grid;place-items:center;width:48px;height:48px;margin:0 auto 18px;border-radius:16px;background:color-mix(in srgb,var(--danger) 14%,transparent);color:var(--danger);font-size:26px;font-weight:800}
.recovery-modal h2{margin:0 0 10px;font-size:clamp(24px,4vw,32px);letter-spacing:-.025em}
.recovery-modal>p{max-width:46ch;margin:0 auto;color:var(--text-soft);line-height:1.6}
.recovery-status{min-height:48px;padding-top:14px}
.recovery-actions{display:grid;gap:10px;margin-top:24px}
.recovery-actions .btn{justify-content:center;min-height:44px}
@media (min-width:560px){.recovery-actions{grid-template-columns:1fr 1fr}.recovery-actions .danger{grid-column:1/-1}}
```

Use the repository’s existing danger-color variable if its name differs from `--danger`; do not introduce a duplicate color token.

- [ ] **Step 8: Verify GREEN**

```bash
node tools/test.js
node tools/e2e.js
node --check js/app.js
node --check js/ui-core.js
node --check js/i18n.js
```

Expected: both suites pass, recovery remains open under Escape, restore returns to the dashboard, reset preserves the unrelated key, and syntax checks exit 0.

- [ ] **Step 9: Commit Task 4**

```bash
git add index.html js/app.js js/ui-core.js js/i18n.js css/app.css tools/e2e.js js/storage.js
git commit -m "添加可恢复的数据损坏界面"
```


---

## Task 5: Document, cache, and fully verify the release

**Files:**

- Modify: `README.md`
- Modify: `index.html`
- Modify: `sw.js`

- [ ] **Step 1: Add bilingual recovery documentation**

In the Chinese data/backup section of `README.md`, add:

```md
### 数据损坏恢复

Navi 会区分首次启动与无法解析的数据。检测到损坏或不兼容的主数据时，应用不会载入演示数据，也不会覆盖原始内容。恢复界面可以恢复最近一个有效版本、下载原始文本，或在二次确认后只重置 Navi 自己的数据。

恢复版本保存在浏览器的 IndexedDB 中，最多保留 3 个不同的有效版本。重置不会删除页面存档数据库，也不会清除同源下不属于 Navi 的数据。
```

In the English data/backup section, add:

```md
### Corrupt-data recovery

Navi distinguishes a true first run from data it cannot safely parse. When primary data is corrupt or incompatible, the app does not load demo content and does not overwrite the original text. The recovery screen can restore the latest valid revision, download the original text, or reset only Navi-owned data after confirmation.

Recovery revisions are stored in browser IndexedDB, with at most 3 distinct valid versions retained. Reset does not delete the page-snapshot database or unrelated same-origin data.
```

- [ ] **Step 2: Refresh the offline shell and cache version**

```bash
node tools/bump.js 73
```

Expected: `index.html` stylesheet query versions and `sw.js` cache become `73`, and `sw.js` includes `./js/storage.js` in page order.

- [ ] **Step 3: Run focused and full verification**

```bash
node tools/test.js
node tools/e2e.js
for file in js/*.js tools/*.js sw.js; do node --check "$file" || exit 1; done
node tools/bump.js 73
git diff --check
git status --short
git diff --stat
git diff -- index.html sw.js js/storage.js js/utils.js js/app.js js/ui-core.js js/i18n.js css/app.css tools/test.js tools/e2e.js README.md
```

Expected:

- logic suite reports zero failures;
- real Chrome E2E reports every group passed;
- every JavaScript syntax check exits 0;
- the second bump remains at `navi-v73` and introduces no new diff;
- `git diff --check` has no output;
- only the planned files are modified.

- [ ] **Step 4: Confirm the exact storage safety boundaries**

```bash
rg -n 'localStorage\.clear\(' js
rg -n 'localStorage\.setItem\(KEY' js
rg -n 'navi-storage|navi\.dashboard\.prev|navi\.pdata\.' js/storage.js
rg -n 'js/storage\.js' index.html sw.js tools/test.js
```

Expected:

- no production module calls `localStorage.clear()`;
- only `js/storage.js` writes the main key;
- reset targets exactly the approved Navi keys and Profile prefix;
- the storage module is loaded by the page, offline shell, and Node tests.

- [ ] **Step 5: Commit Task 5**

```bash
git add README.md index.html sw.js
git commit -m "记录数据恢复与离线缓存更新"
```

- [ ] **Step 6: Perform final branch review**

```bash
git status --short --branch
git log --oneline --decorate -8
git diff origin/main...HEAD --stat
```

Expected: clean worktree, the design/plan and implementation commits are visible, and only the approved storage-recovery scope appears in the branch diff.

---

## Plan Self-Review Checklist

Before execution starts:

- [x] Every behavior in the approved specification maps to a task and test above.
- [x] Every named public storage interface has an implementation step and at least one verification path.
- [x] No step deletes `navi.dashboard.v2` during normal migration.
- [x] Reset never deletes `navi-snapshots` or unrelated same-origin data.
- [x] Recovery startup cannot call write-capable initializers.
- [x] Code samples use the current global-script style and ES syntax already accepted by the project.
- [x] Search this plan for unresolved markers:

```bash
rg -n 'TO''DO|TB''D|FIX''ME|implement la''ter|fill i''n' docs/superpowers/plans/2026-09-01-storage-recovery.md
```

Expected: no output.

---

## Deferred Follow-up Sequence

After this plan ships and is live-validated:

1. Design WebDAV conditional writes with ETag, three-way merge, and deletion tombstones.
2. Implement and live-test concurrent-device conflict handling.
3. Design credentials separation with provider-specific secret storage and redacted exports.
4. Migrate the primary store to IndexedDB behind the stable `NaviStorage` interface, retaining the current `localStorage` payload as a read-only rollback source during migration.
