# Navi WebDAV Sync Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WebDAV/NAS synchronization preserve concurrent edits and deletions by combining server-enforced conditional writes, three-way merging, and durable tombstones.

**Architecture:** Add a pure `SyncMerge` module for canonical snapshots and deterministic three-way decisions, store one accepted base snapshot per Profile in the existing IndexedDB database, and let `js/sync.js` orchestrate GET → merge → conditional PUT without embedding merge rules. Keep v3 readable, write v4 only through safe or explicitly confirmed paths, and stop automatic upload when a server cannot provide a strong ETag.

**Tech Stack:** Plain browser JavaScript, localStorage, IndexedDB, Fetch/WebDAV, HTTP ETag / `If-Match` / `If-None-Match`, Python `ThreadingHTTPServer`, Node VM logic tests, dependency-free Chrome DevTools Protocol E2E tests.

**Spec:** `docs/superpowers/specs/2026-09-01-webdav-sync-safety-design.md`

## Global Constraints

- Different bookmark IDs may merge automatically; different edits to the same ID and delete-versus-edit must never be guessed.
- First-version record-level auto-merge covers bookmarks, categories, order, and durable deletion tombstones. Calendar and interface settings remain whole-field decisions when both sides change.
- A normal PUT to an existing remote file must carry the strong ETag from the exact representation that was merged.
- Creating a missing remote file must use `If-None-Match: *`.
- A 409 or 412 must refetch and re-merge; it must never fall through to an unconditional PUT.
- Missing or weak ETag disables effective background auto-upload. Manual compatibility upload requires an explicit warning.
- `remoteFp` is not a substitute for an accepted base snapshot or a server precondition.
- Durable tombstones are Profile-specific, independent from the 0–14 day UI trash, and are not automatically purged in this phase.
- Existing v3 files remain readable. A remote downgrade from a known v4 base to v3 is a conflict.
- AI Key, WebDAV passwords, and Profile configuration retain the existing private/redacted merge behavior.
- Do not add a content hash, frozen contract, release gate, CRDT, device registry, or main-storage migration.
- Use RED → GREEN for every behavioral task. Do not weaken assertions to pass.
- Execute in an isolated `.worktrees/` checkout created through `superpowers:using-git-worktrees`.

---

### Task 1: Canonical v3/v4 snapshots and local tombstone tracking

**Files:**

- Create: `js/sync-merge.js`
- Modify: `index.html`
- Modify: `tools/test.js`

**Interfaces:**

- Produces: `SyncMerge.canonicalize(value) -> CanonicalSnapshot | null`
- Produces: `SyncMerge.fromState(state) -> CanonicalSnapshot | null`
- Produces: `SyncMerge.trackLocal(previousState, nextState, now) -> DashboardState`
- Produces: `SyncMerge.same(a, b) -> boolean`
- `CanonicalSnapshot` contains `version`, `bookmarks`, `order`, `categories`, `tombstones`, `calendarEvents`, `theme`, `view`, and `settings`.

- [ ] **Step 1: Add failing canonicalization and tracking tests**

Load `js/sync-merge.js` directly after `js/state.js` in `tools/test.js`, then add:

```js
G("sync v4 canonicalization");
ok("SyncMerge module is loaded", typeof ctx.SyncMerge === "object");
if(ctx.SyncMerge){
  const legacy={schema:"navi-bookmarks",version:3,bookmarks:[
    {id:"a",title:"A",url:"https://a.example",category:"Work",clicks:1,lastOpened:10}
  ],categories:["Work"],trash:[],calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"}};
  const canonical=ctx.SyncMerge.canonicalize(legacy);
  eq("v3 becomes canonical v4", canonical.version, 4);
  eq("canonical order follows bookmark array", canonical.order.join(","), "a");
  eq("missing updatedAt migrates to zero", canonical.bookmarks[0].updatedAt, 0);
  eq("v3 starts without tombstones", canonical.tombstones.length, 0);
  ok("invalid bookmark collection is rejected", ctx.SyncMerge.canonicalize({bookmarks:{}})===null);

  const previous=ctx.defaults();
  previous.bookmarks=[{id:"a",title:"A",url:"https://a.example",category:"Work",description:"",tags:[],updatedAt:10}];
  previous.syncMeta={tombstones:[]};
  const changed=JSON.parse(JSON.stringify(previous)); changed.bookmarks[0].title="A2";
  const tracked=ctx.SyncMerge.trackLocal(previous,changed,100);
  eq("content edit receives updatedAt", tracked.bookmarks[0].updatedAt, 100);
  const statsOnly=JSON.parse(JSON.stringify(tracked)); statsOnly.bookmarks[0].clicks=20;
  eq("activity stats do not touch updatedAt", ctx.SyncMerge.trackLocal(tracked,statsOnly,200).bookmarks[0].updatedAt,100);
  const deleted=JSON.parse(JSON.stringify(tracked)); deleted.bookmarks=[];
  eq("missing id creates durable tombstone", ctx.SyncMerge.trackLocal(tracked,deleted,300).syncMeta.tombstones[0].id,"a");
  const restored=JSON.parse(JSON.stringify(deleted)); restored.bookmarks=[tracked.bookmarks[0]]; restored.syncMeta={tombstones:[{id:"a",deletedAt:300}]};
  const retracked=ctx.SyncMerge.trackLocal(deleted,restored,400);
  eq("restoring id removes tombstone", retracked.syncMeta.tombstones.length,0);
  eq("restoring id touches bookmark", retracked.bookmarks[0].updatedAt,400);
}
```

- [ ] **Step 2: Verify RED**

Run: `node tools/test.js`

Expected: FAIL because `js/sync-merge.js` or `SyncMerge` does not exist.

- [ ] **Step 3: Implement canonical data helpers**

Create `js/sync-merge.js` with these helpers:

```js
/* sync-merge.js — canonical sync snapshots and pure three-way decisions */
"use strict";

function syncClone(value){ return JSON.parse(JSON.stringify(value)); }
function syncObject(value){ return !!value&&Object.prototype.toString.call(value)==="[object Object]"; }
function syncStable(value){
  if(Array.isArray(value)) return value.map(syncStable);
  if(syncObject(value)){
    var out={}; Object.keys(value).sort().forEach(function(key){ out[key]=syncStable(value[key]); }); return out;
  }
  return value;
}
function syncSame(a,b){ return JSON.stringify(syncStable(a))===JSON.stringify(syncStable(b)); }
function syncBookmarkContent(bookmark){
  return {
    id:String(bookmark.id||""), url:String(bookmark.url||""), title:String(bookmark.title||""),
    category:String(bookmark.category||"Uncategorized"), description:String(bookmark.description||""),
    tags:Array.isArray(bookmark.tags)?bookmark.tags.slice():[], favorite:!!bookmark.favorite,
    pinned:!!bookmark.pinned
  };
}
function syncCanonicalize(value){
  if(!syncObject(value)||!Array.isArray(value.bookmarks)) return null;
  var seen={},bookmarks=[];
  for(var i=0;i<value.bookmarks.length;i++){
    var source=value.bookmarks[i]||{}, id=String(source.id||"");
    if(!id||seen[id]||!source.url) return null;
    seen[id]=true;
    var bookmark=Object.assign({},source,syncBookmarkContent(source));
    bookmark.updatedAt=Number(source.updatedAt)||0;
    bookmark.clicks=Number(source.clicks)||0; bookmark.lastOpened=Number(source.lastOpened)||0;
    bookmarks.push(bookmark);
  }
  var sync=value.sync||{}, localMeta=value.syncMeta||{};
  var tombstones=Array.isArray(value.tombstones)?value.tombstones:
    (Array.isArray(sync.tombstones)?sync.tombstones:(Array.isArray(localMeta.tombstones)?localMeta.tombstones:[]));
  tombstones=tombstones.filter(function(row){ return row&&row.id&&!seen[String(row.id)]; })
    .map(function(row){ return {id:String(row.id),deletedAt:Number(row.deletedAt)||0}; });
  return {
    version:4, bookmarks:bookmarks, order:bookmarks.map(function(b){return b.id;}),
    categories:Array.isArray(value.categories)?value.categories.slice():[], tombstones:tombstones,
    calendarEvents:Array.isArray(value.calendarEvents)?syncClone(value.calendarEvents):[],
    theme:value.theme||"light", view:value.view==="list2"?"list":value.view||"grid",
    settings:syncObject(value.settings)?syncClone(value.settings):null
  };
}
function syncFromState(value){ return syncCanonicalize(value); }
```

Implement local tracking with one tombstone per ID:

```js
function syncTrackLocal(previousState,nextState,now){
  var previous=syncCanonicalize(previousState||{bookmarks:[]})||{bookmarks:[],tombstones:[]};
  var next=syncClone(nextState),oldById={},live={},tombstones={};
  previous.bookmarks.forEach(function(bookmark){ oldById[bookmark.id]=bookmark; });
  previous.tombstones.forEach(function(row){ tombstones[row.id]=row; });
  (next.bookmarks||[]).forEach(function(bookmark){
    var id=String(bookmark.id||""); if(!id) return;
    live[id]=true;
    var old=oldById[id];
    if(!old||!syncSame(syncBookmarkContent(old),syncBookmarkContent(bookmark))) bookmark.updatedAt=now;
    else bookmark.updatedAt=Number(old.updatedAt)||0;
    delete tombstones[id];
  });
  previous.bookmarks.forEach(function(bookmark){
    if(!live[bookmark.id]&&!tombstones[bookmark.id]) tombstones[bookmark.id]={id:bookmark.id,deletedAt:now};
  });
  next.syncMeta={tombstones:Object.keys(tombstones).sort().map(function(id){return tombstones[id];})};
  return next;
}
var SyncMerge={
  canonicalize:syncCanonicalize,
  fromState:syncFromState,
  trackLocal:syncTrackLocal,
  same:syncSame
};
```

- [ ] **Step 4: Load the module in the page**

Place it before `js/storage.js` so persistence can call it at runtime:

```html
<script src="js/state.js"></script>
<script src="js/sync-merge.js"></script>
<script src="js/storage.js"></script>
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node tools/test.js
node --check js/sync-merge.js
```

Expected: all logic tests pass and syntax checking exits 0.

- [ ] **Step 6: Commit Task 1**

```bash
git add js/sync-merge.js index.html tools/test.js
git commit -m "添加同步快照与墓碑跟踪"
```

---

### Task 2: Deterministic three-way merge and conflict resolution

**Files:**

- Modify: `js/sync-merge.js`
- Modify: `tools/test.js`

**Interfaces:**

- Consumes: `SyncMerge.canonicalize`, `SyncMerge.same`
- Produces: `SyncMerge.merge(base, local, remote) -> MergeResult`
- Produces: `SyncMerge.bootstrap(local, remote) -> MergeResult`
- Produces: `SyncMerge.resolve(result, choices) -> CanonicalSnapshot | null`
- `MergeResult` contains `{candidate, conflicts, stats, remoteChanged, localChanged}`.
- Each conflict contains `{key, kind, label, base, local, remote}`; `choices[key]` is `"local"` or `"remote"`.

- [ ] **Step 1: Add the failing bookmark merge matrix**

Add table-driven tests that construct canonical snapshots and assert:

```js
G("three-way bookmark merge");
function snap(bookmarks, tombstones){ return ctx.SyncMerge.canonicalize({
  version:4,bookmarks:bookmarks,categories:["Work"],calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"},
  sync:{protocol:1,tombstones:tombstones||[]}
}); }
const base=snap([mk("a","https://a.example","A"),mk("b","https://b.example","B")]);
const localEdit=snap([mk("a","https://a.example","A local"),mk("b","https://b.example","B")]);
const remoteOther=snap([mk("a","https://a.example","A"),mk("b","https://b.example","B remote")]);
const independent=ctx.SyncMerge.merge(base,localEdit,remoteOther);
eq("independent edits have no conflicts",independent.conflicts.length,0);
eq("local edit is retained",independent.candidate.bookmarks.find(b=>b.id==="a").title,"A local");
eq("remote edit is retained",independent.candidate.bookmarks.find(b=>b.id==="b").title,"B remote");

const remoteSame=snap([mk("a","https://a.example","A remote"),mk("b","https://b.example","B")]);
const sameId=ctx.SyncMerge.merge(base,localEdit,remoteSame);
eq("different edits to same id conflict",sameId.conflicts[0].key,"bookmark:a");
ok("unresolved result cannot be applied",ctx.SyncMerge.resolve(sameId,{})===null);
eq("local choice resolves only that id",ctx.SyncMerge.resolve(sameId,{"bookmark:a":"local"}).bookmarks.find(b=>b.id==="a").title,"A local");

const localDelete=snap([mk("b","https://b.example","B")],[{id:"a",deletedAt:100}]);
eq("delete against unchanged auto-deletes",ctx.SyncMerge.merge(base,localDelete,base).candidate.bookmarks.some(b=>b.id==="a"),false);
eq("delete against edit conflicts",ctx.SyncMerge.merge(base,localDelete,remoteSame).conflicts[0].key,"bookmark:a");
```

Also cover both-side additions, same-ID additions, same-content edits, remote deletion, tombstone retention, and max merge for `clicks` / `lastOpened`.

Add a no-base bootstrap fixture where different IDs and normalized URLs are kept, while the same ID or normalized URL with different content becomes a conflict:

```js
const bootstrap=ctx.SyncMerge.bootstrap(
  snap([mk("local","https://local.example","Local"),mk("x","https://same.example/","Local same")]),
  snap([mk("remote","https://remote.example","Remote"),mk("y","https://same.example","Remote same")])
);
eq("bootstrap keeps independent records",bootstrap.candidate.bookmarks.filter(b=>/local|remote/.test(b.id)).length,2);
ok("bootstrap requires a choice for same normalized URL",bootstrap.conflicts.some(c=>c.kind==="bookmark"));
```

- [ ] **Step 2: Add failing order, category, calendar, and settings tests**

```js
G("three-way collection merge");
const oneSideOrder=ctx.SyncMerge.merge(base,
  snap([mk("b","https://b.example","B"),mk("a","https://a.example","A")]),base);
eq("one-sided reorder wins",oneSideOrder.candidate.order.join(","),"b,a");

const remoteReverse=snap([mk("b","https://b.example","B"),mk("a","https://a.example","A")]);
const localDifferent=snap([mk("a","https://a.example","A"),mk("b","https://b.example","B"),mk("c","https://c.example","C")]);
const orderConflict=ctx.SyncMerge.merge(base,localDifferent,remoteReverse);
ok("different two-sided ordering is explicit",orderConflict.conflicts.some(c=>c.key==="order"));
```

Use fixtures where only one side changes categories/calendar/settings and where both sides change them differently. Assert the former auto-merges and the latter produces `categories`, `calendarEvents`, or `settings` conflict keys.

- [ ] **Step 3: Verify RED**

Run: `node tools/test.js`

Expected: FAIL because `SyncMerge.merge` and `SyncMerge.resolve` are missing.

- [ ] **Step 4: Implement record decisions and conflict objects**

Use a pure three-way chooser:

```js
function syncChoose(key,kind,label,base,local,remote,conflicts){
  if(syncSame(local,remote)) return {value:syncClone(local)};
  if(syncSame(local,base)) return {value:syncClone(remote)};
  if(syncSame(remote,base)) return {value:syncClone(local)};
  conflicts.push({key:key,kind:kind,label:label,base:syncClone(base),local:syncClone(local),remote:syncClone(remote)});
  return {conflict:true};
}
```

Represent deletion as `null` in the chooser. Before returning the candidate, remove bookmarks whose selected value is `null`, keep one tombstone per deleted ID, remove tombstones for selected live records, merge stats with `Math.max`, then rebuild the bookmark array from the chosen order.

`SyncMerge.bootstrap` uses the same `MergeResult` shape without inventing a base. Index both sides by ID and by normalized URL (lowercase scheme/host and no trailing slash). Independent keys enter the candidate; same key with equal content enters once; same key with different content becomes a bookmark conflict. Any incoming tombstone that targets a live record is also a conflict because no common ancestor exists to prove which action came later.

- [ ] **Step 5: Implement deterministic collection and order rules**

Compare filtered ordered ID arrays against base. Use the selected side when only one changed; when neither changed, start with base and append local-new then remote-new IDs; when both changed identically, use that sequence; otherwise emit the `order` conflict. Apply the same chooser to normalized categories, calendar, and redacted settings groups.

- [ ] **Step 6: Implement complete resolution**

`SyncMerge.resolve` must return `null` until every conflict key has a valid choice. For bookmark conflicts, choosing a live record removes its tombstone and choosing `null` preserves a tombstone. For collection conflicts, replace only the named candidate group. Re-run canonicalization before returning.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
node tools/test.js
node --check js/sync-merge.js
```

Expected: all merge matrix tests pass.

- [ ] **Step 8: Commit Task 2**

```bash
git add js/sync-merge.js tools/test.js
git commit -m "实现确定性的三方同步合并"
```

---

### Task 3: IndexedDB base snapshots per WebDAV Profile

**Files:**

- Modify: `js/storage.js`
- Modify: `tools/test.js`
- Modify: `tools/e2e.js`

**Interfaces:**

- Produces: `NaviStorage.getSyncBase(profileId, url) -> Promise<BaseRecord | null>`
- Produces: `NaviStorage.putSyncBase(profileId, url, etag, snapshot) -> Promise<boolean>`
- Produces: `NaviStorage.clearSyncBase(profileId) -> Promise<void>`
- `BaseRecord` contains `{profileId,url,etag,snapshot,savedAt}`.

- [ ] **Step 1: Add failing API and URL-isolation tests**

In `tools/test.js`, assert the three APIs exist. Keep pure validation in Node and put real IndexedDB behavior in browser E2E:

```js
ok("storage exposes sync base lookup",typeof ctx.NaviStorage.getSyncBase==="function");
ok("storage exposes sync base save",typeof ctx.NaviStorage.putSyncBase==="function");
ok("storage exposes sync base clear",typeof ctx.NaviStorage.clearSyncBase==="function");
```

In `tools/e2e.js`, add an isolated group:

```js
await NaviStorage.clearAll();
const sample=SyncMerge.fromState(state);
const saved=await NaviStorage.putSyncBase("dav-a","https://nas.example/a.json",'"one"',sample);
const same=await NaviStorage.getSyncBase("dav-a","https://nas.example/a.json");
const changedUrl=await NaviStorage.getSyncBase("dav-a","https://nas.example/b.json");
await NaviStorage.clearSyncBase("dav-a");
const cleared=await NaviStorage.getSyncBase("dav-a","https://nas.example/a.json");
return {saved,etag:same&&same.etag,changedUrl,cleared};
```

Assert `saved === true`, ETag is preserved, and changed URL / cleared lookup return null.

- [ ] **Step 2: Verify RED**

Run:

```bash
node tools/test.js
node tools/e2e.js
```

Expected: API assertions fail.

- [ ] **Step 3: Upgrade the existing database schema**

Change the open version from 1 to 2 and create both stores idempotently:

```js
var NAVI_SYNC_BASE_STORE="syncBases";
var request=indexedDB.open(NAVI_RECOVERY_DB,2);
request.onupgradeneeded=function(){
  var db=request.result;
  if(!db.objectStoreNames.contains(NAVI_RECOVERY_STORE)) db.createObjectStore(NAVI_RECOVERY_STORE,{keyPath:"id",autoIncrement:true});
  if(!db.objectStoreNames.contains(NAVI_SYNC_BASE_STORE)) db.createObjectStore(NAVI_SYNC_BASE_STORE,{keyPath:"profileId"});
};
```

Generalize the transaction helper to accept a store name without changing revision behavior.

- [ ] **Step 4: Implement base APIs with validation**

Implement the public wrappers so `putSyncBase` requires nonempty Profile ID, exact URL, a canonicalizable snapshot, and string ETag (empty allowed only for a compatibility snapshot):

```js
function putSyncBase(profileId,url,etag,snapshot){
  var canonical=typeof SyncMerge==="object"?SyncMerge.canonicalize(snapshot):null;
  if(!profileId||!url||!canonical||typeof etag!=="string") return Promise.resolve(false);
  return withNamedStore(NAVI_SYNC_BASE_STORE,"readwrite",function(store){
    store.put({profileId:String(profileId),url:String(url),etag:etag,snapshot:canonical,savedAt:Date.now()});
  }).then(function(){return true;}).catch(function(){return false;});
}
function getSyncBase(profileId,url){
  return readNamedRow(NAVI_SYNC_BASE_STORE,String(profileId)).then(function(row){
    if(!row||row.url!==String(url)||!SyncMerge.canonicalize(row.snapshot)) return null;
    return row;
  }).catch(function(){return null;});
}
function clearSyncBase(profileId){
  return withNamedStore(NAVI_SYNC_BASE_STORE,"readwrite",function(store){store.delete(String(profileId));}).catch(function(){});
}
```

`readNamedRow` must resolve after the readonly transaction completes, using the same close-once pattern as `readRecoveryRows`. Extend `clearAll()` to clear both stores. Do not delete the entire IndexedDB database because page snapshots are a separate database and future stores must not be removed accidentally.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node tools/test.js
node tools/e2e.js
node --check js/storage.js
```

Expected: unit API and real IndexedDB lifecycle pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add js/storage.js tools/test.js tools/e2e.js
git commit -m "保存每个同步配置的共同基准"
```

---

### Task 4: v4 payloads and unified local change tracking

**Files:**

- Modify: `js/state.js`
- Modify: `js/storage.js`
- Modify: `js/utils.js`
- Modify: `js/oplog.js`
- Modify: `js/import-export.js`
- Modify: `js/sync.js`
- Modify: `js/trash.js`
- Modify: `tools/test.js`

**Interfaces:**

- Consumes: `SyncMerge.trackLocal`, `SyncMerge.fromState`, `SyncMerge.canonicalize`
- Changes: `NaviStorage.persist(value, opts?)`, where `opts.tracking === "remote"` preserves already-merged metadata.
- Changes: `save(opts?)` and `saveSilently(opts?)` forward persistence options.
- Produces: `buildWebdavPayload(snapshot?) -> v4 payload`.

- [ ] **Step 1: Add failing persistence and payload tests**

```js
G("sync metadata persistence");
ctx.localStorage.clear();
ctx.state=ctx.defaults();
ctx.state.bookmarks=[mk("a","https://a.example","A")];
ctx.save();
const firstSaved=JSON.parse(ctx.localStorage.getItem(ctx.KEY));
ok("local save creates syncMeta",Array.isArray(firstSaved.syncMeta.tombstones));
const firstUpdated=firstSaved.bookmarks[0].updatedAt;
ctx.state.bookmarks[0].title="A2"; ctx.save();
ok("content edit advances updatedAt",JSON.parse(ctx.localStorage.getItem(ctx.KEY)).bookmarks[0].updatedAt>=firstUpdated);
ctx.state.bookmarks=[]; ctx.save();
eq("delete survives immediate trash policy",JSON.parse(ctx.localStorage.getItem(ctx.KEY)).syncMeta.tombstones[0].id,"a");

ctx.state=ctx.defaults(); ctx.state.bookmarks=[mk("a","https://a.example","A")]; ctx.state.syncMeta={tombstones:[{id:"gone",deletedAt:10}]};
const payload=ctx.buildWebdavPayload();
eq("WebDAV payload writes v4",payload.version,4);
eq("WebDAV payload carries tombstone",payload.sync.tombstones[0].id,"gone");
ok("payload still redacts profile passwords",!(payload.settings.profiles||[]).some(p=>p.pass));
```

Add a remote-tracking test that passes a prepared state with fixed `updatedAt` and tombstones to `save({tracking:"remote"})`, then asserts the values remain unchanged.

- [ ] **Step 2: Verify RED**

Run: `node tools/test.js`

Expected: missing `syncMeta`, v3 payload, or lost remote metadata assertions fail.

- [ ] **Step 3: Add local sync metadata defaults and hydration**

Add `syncMeta:{tombstones:[]}` beside root state arrays in `defaults()`. Hydration, Profile snapshots/caches, JSON normalization, backup application, and snapshots must preserve a normalized `syncMeta`. Keep remote transport as `sync.tombstones`; do not place passwords or Profiles inside it.

When `updateActiveProfile` changes `url`, capture the old URL and call `NaviStorage.clearSyncBase(p.id)` before the next sync. When a Profile is deleted, clear its base in the same confirmed delete callback. These asynchronous cleanup calls are best-effort and must not make the local Profile edit fail.

- [ ] **Step 4: Track edits at the persistence boundary**

Change persistence to:

```js
function persistDashboard(value,opts){
  opts=opts||{};
  var previousRaw=null,previousState=null;
  try{ previousRaw=localStorage.getItem(KEY); }catch(e){}
  var previous=typeof previousRaw==="string"?parseDashboardRaw(previousRaw):{ok:false};
  if(opts.tracking!=="remote"&&typeof SyncMerge==="object"){
    var tracked=SyncMerge.trackLocal(previous.ok?previous.state:null,value,Date.now());
    value.bookmarks=tracked.bookmarks; value.syncMeta=tracked.syncMeta;
  }
  // continue through the existing validated single-write plan
}
```

Make `save(opts)` pass the same options on both quota attempts. Make `saveSilently(opts)` pass options through while keeping operation-log suspension.

- [ ] **Step 5: Build and parse v4 WebDAV payloads**

`buildWebdavPayload` must serialize the canonical snapshot, set `version:4`, and place tombstones under `sync:{protocol:1,tombstones:[...]}`. `normalizeDashboardPayload` must accept v3/v4, return root `syncMeta` plus `sourceVersion:Number(obj.version)||3`, preserve existing privacy/Profile behavior, and reject duplicate or empty bookmark IDs in v4.

- [ ] **Step 6: Preserve remote metadata without false local edits**

When sync applies a remote or merged snapshot, call `saveSilently({tracking:"remote"})`. `cacheProfileData`, `profileDataSnapshot`, and `applyProfileData` must include `syncMeta`. Restoring a trash item naturally removes its tombstone on the next ordinary save; permanent deletion leaves the tombstone intact.

Profile switching is also an explicit whole-state replacement: after `applyProfileData(cached)` or constructing an empty target Profile, call `saveSilently({tracking:"remote"})` so IDs from the previous Profile do not become tombstones in the new Profile. Ordinary user edits, imports, browser replacement sync, category changes, and trash operations continue using normal tracking.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
node tools/test.js
node tools/e2e.js
for f in js/*.js; do node --check "$f" || exit 1; done
```

Expected: metadata, payload, existing recovery, import, Profile, and browser flows pass.

- [ ] **Step 8: Commit Task 4**

```bash
git add js/state.js js/storage.js js/utils.js js/oplog.js js/import-export.js js/sync.js js/trash.js tools/test.js
git commit -m "写入兼容的 v4 同步元数据"
```

---

### Task 5: ETag-aware WebDAV transport and protocol stub

**Files:**

- Modify: `js/sync.js`
- Modify: `tools/dav-stub.py`
- Modify: `tools/test.js`

**Interfaces:**

- Produces: `strongSyncEtag(value) -> string`
- Changes: `fetchRemoteData(profile) -> Promise<{missing,unreadable,data,raw,etag,strongEtag,sourceVersion}>`
- Produces: `conditionalPut(profile, body, remote) -> Promise<Response>`
- `conditionalPut` uses `If-Match` for an existing resource and `If-None-Match: *` for a missing resource.

- [ ] **Step 1: Add failing transport decision tests**

```js
G("WebDAV conditional transport");
eq("strong ETag is accepted",ctx.strongSyncEtag('"abc"'),'"abc"');
eq("weak ETag is rejected",ctx.strongSyncEtag('W/"abc"'),"");
eq("empty ETag is rejected",ctx.strongSyncEtag(null),"");
eq("existing remote uses If-Match",ctx.syncConditionalHeaders({strongEtag:'"abc"'})["If-Match"],'"abc"');
eq("missing remote uses If-None-Match",ctx.syncConditionalHeaders({missing:true})["If-None-Match"],"*");
ok("existing remote without strong ETag has no safe headers",ctx.syncConditionalHeaders({etag:'W/"abc"'})===null);
```

- [ ] **Step 2: Verify RED**

Run: `node tools/test.js`

Expected: helper functions are missing.

- [ ] **Step 3: Implement response metadata and conditional headers**

Capture `r.headers.get("ETag")` before consuming the body. Add:

```js
function strongSyncEtag(value){
  value=String(value||"").trim();
  return value&&value.indexOf("W/")!==0?value:"";
}
function syncConditionalHeaders(remote){
  if(remote&&remote.missing) return {"If-None-Match":"*"};
  if(remote&&remote.strongEtag) return {"If-Match":remote.strongEtag};
  return null;
}
```

`conditionalPut` must reject with an `unsafe-precondition` error when headers are null. Do not put `force` back in as an unconditional bypass.

- [ ] **Step 4: Implement strong ETags in the stub**

Track a monotonically increasing integer per path and emit a quoted ETag on GET/PUT:

```python
REVS = {}
def etag_for(path):
    return '"navi-%d"' % REVS.get(path, 0)
```

Before reading a PUT body, enforce:

```python
path = self.path.split("?")[0]
exists = path in STORE
if self.headers.get("If-None-Match") == "*" and exists:
    return self._send(412, b"precondition failed")
match = self.headers.get("If-Match")
if match and (not exists or match != etag_for(path)):
    return self._send(412, b"precondition failed")
```

After a successful PUT increment `REVS[path]`, store the body, and return the new ETag. Add `If-Match,If-None-Match` to CORS allowed headers. Add `noetag`, `weaketag`, and `race` fault modes; `race` mutates the stored JSON and increments the revision immediately before evaluating the next PUT.

- [ ] **Step 5: Add a protocol self-test command**

Add a `run_self_test()` function in `tools/dav-stub.py` and invoke it only when the first argument is `--self-test`. It starts `ThreadingHTTPServer(("127.0.0.1",0),H)` on a background thread, uses `http.client.HTTPConnection`, and proves: missing-resource conditional create succeeds, stale `If-Match` returns 412, current `If-Match` succeeds, and stale PUT does not alter stored bytes. Always call `shutdown()`, `server_close()`, and join the thread in `finally`.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
node tools/test.js
python3 tools/dav-stub.py --self-test
node --check js/sync.js
python3 -m py_compile tools/dav-stub.py
```

Expected: helper and HTTP precondition tests pass.

- [ ] **Step 7: Commit Task 5**

```bash
git add js/sync.js tools/dav-stub.py tools/test.js
git commit -m "使用 ETag 保护 WebDAV 条件写入"
```

---

### Task 6: Safe pull, merge, retry, upload, and compatibility orchestration

**Files:**

- Modify: `js/sync.js`
- Modify: `tools/test.js`
- Modify: `tools/e2e.js`

**Interfaces:**

- Consumes: `SyncMerge.merge`, `SyncMerge.resolve`, all sync base APIs, `conditionalPut`.
- Produces: `reconcileWebdavProfile(id, opts) -> Promise<SyncOutcome>`
- `opts.write === true` permits conditional upload; ordinary pull uses `false`.
- `SyncOutcome` contains `{ok,status,candidate,conflicts,etag,attempts}`.

- [ ] **Step 1: Add failing pure orchestration decisions**

Extract and test a small decision helper:

```js
G("safe sync orchestration decisions");
eq("no base requires bootstrap",ctx.syncReconcileDecision({remote:{data:{}},base:null}),"bootstrap");
eq("known v4 base and remote v3 is downgrade",ctx.syncReconcileDecision({remote:{data:{},sourceVersion:3},base:{snapshot:{version:4}}}),"downgrade");
eq("write without strong ETag is compatibility",ctx.syncReconcileDecision({remote:{data:{},sourceVersion:4},base:{snapshot:{version:4}},write:true}),"compatibility");
eq("read with base may merge",ctx.syncReconcileDecision({remote:{data:{},sourceVersion:4,strongEtag:'"e"'},base:{snapshot:{version:4}},write:false}),"merge");
```

- [ ] **Step 2: Verify RED**

Run: `node tools/test.js`

Expected: `syncReconcileDecision` is missing.

- [ ] **Step 3: Implement bootstrap and conservative compatibility paths**

`syncReconcileDecision` must return `bootstrap`, `downgrade`, `invalid`, `compatibility`, or `merge`. Bootstrap must open the conflict UI with explicit remote/local/first-merge choices. Missing/weak ETag leaves pull available but prevents background write. Manual compatibility PUT must go through a separate confirmation callback and a fresh remote read; it must never be invoked by `maybeUploadBookmarksAfterBrowserSync`.

Keep the unsafe exception visibly isolated:

```js
function compatibilityPutConfirmed(profile,body,userConfirmed){
  if(userConfirmed!==true) return Promise.reject(new Error("compatibility-confirmation-required"));
  return syncFetch(profile.url,{
    method:"PUT",headers:webdavHeaders(profile,{"Content-Type":"application/json; charset=utf-8"}),
    body:body,cache:"no-store",credentials:"omit"
  },SYNC_UPLOAD_TIMEOUT);
}
```

Only the compatibility confirmation callback may call this function. Normal upload, automatic upload, bootstrap on an ETag-capable server, retries, and conflict resolution must call `conditionalPut`.

- [ ] **Step 4: Implement read-only reconciliation**

For `opts.write !== true`:

1. Merge base/local/remote.
2. If true conflicts exist, return them without changing either side.
3. Save the candidate locally with `{tracking:"remote"}`.
4. Update base only when the resulting local snapshot equals the fetched remote snapshot.
5. If local contains pending differences, keep the old base and show a local-pending status rather than claiming remote synchronization.

- [ ] **Step 5: Implement conditional write reconciliation**

For `opts.write === true`, merge first, save the validated candidate locally, and call conditional PUT only when there are no true conflicts. Serialize exactly that candidate rather than rereading a mutable global state between merge and PUT.

On a 409/412, refetch and repeat from the same accepted base, with an `attempts` counter capped at 3. A true conflict or the fourth race returns a conflict outcome. No branch calls an unconditional normal PUT.

After PUT success, use the response ETag; if missing, GET the resource and compare canonical content. Save a base only after local and confirmed remote snapshots match. If base storage fails, return status `base-warning` and keep future behavior conservative.

- [ ] **Step 6: Route existing entry points through the orchestrator**

- `syncProfile(id)` calls `reconcileWebdavProfile(id,{write:false})`.
- `pushWithConflictCheck(id,opts)` calls it with `{write:true,silent:opts.silent}`.
- `maybeUploadBookmarksAfterBrowserSync` treats `compatibility`, `bootstrap`, `conflict`, and `downgrade` as skipped auto-upload.
- Remove the `force:true` path from existing conflict resolution.
- Keep existing timeout, CORS, auth, read-only, and mixed-content diagnostics.

- [ ] **Step 7: Add browser assertions for no-write failure paths**

In isolated E2E state, stub `fetch` and `NaviStorage` to assert that invalid remote, missing base, weak ETag, IndexedDB base failure, and 412 exhaustion never call a naked PUT and never advance the base.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
node tools/test.js
node tools/e2e.js
node --check js/sync.js
rg -n 'method:"PUT"' js/sync.js
```

Expected: every normal PUT call is inside `conditionalPut`; logic and browser tests pass.

- [ ] **Step 9: Commit Task 6**

```bash
git add js/sync.js tools/test.js tools/e2e.js
git commit -m "编排安全的多设备同步流程"
```

---

### Task 7: Per-conflict accessible resolution UI

**Files:**

- Modify: `index.html`
- Modify: `css/app.css`
- Modify: `js/sync.js`
- Modify: `js/i18n.js`
- Modify: `tools/e2e.js`

**Interfaces:**

- Consumes: `MergeResult.conflicts`, `SyncMerge.resolve`.
- Produces: `openSyncConflict(id, mergeResult, opts) -> Promise<boolean>`.
- Produces: conflict selections keyed by `conflict.key` and submitted only when complete.

- [ ] **Step 1: Add failing conflict interaction E2E**

Replace the current count-only assertion with a result containing two bookmark conflicts and one order conflict. Assert:

```js
const overlay=document.querySelector("#conflictOverlay");
const rows=overlay.querySelectorAll("[data-sync-conflict-key]");
const apply=document.querySelector("#conflictApply");
return {
  open:overlay.classList.contains("open"), named:overlay.querySelector('[role="dialog"]').getAttribute("aria-labelledby")==="conflictTitle",
  rows:rows.length, applyInitiallyDisabled:apply.disabled,
  summary:document.querySelector("#conflictSummary").textContent,
  live:document.querySelector("#conflictStatus").getAttribute("aria-live")
};
```

Choose one option per row, assert Apply becomes enabled, cancel once and prove neither local nor remote callback ran, reopen and submit all choices, then assert `SyncMerge.resolve` output is passed to safe reconciliation.

- [ ] **Step 2: Verify RED**

Run: `node tools/e2e.js`

Expected: new conflict list, summary, live status, or Apply control is missing.

- [ ] **Step 3: Replace the modal structure**

Keep the existing named dialog and add:

```html
<div class="sync-conflict-summary" id="conflictSummary"></div>
<div class="sync-conflict-list" id="conflictList"></div>
<p class="sync-conflict-status" id="conflictStatus" role="status" aria-live="polite"></p>
```

The footer contains Cancel, “All local”, “All remote”, and a disabled primary `#conflictApply` labelled “Apply choices and sync safely”. Remove the old whole-dataset Merge default.

- [ ] **Step 4: Render focused conflict rows**

Each row must have a visible title, kind label, concise local/remote summaries, and a two-option radio group sharing a unique name. A deletion is labelled explicitly instead of rendering an empty side. Store selections in `_conflictCtx.choices`; bulk buttons update every row and the Apply disabled state.

For an unreadable remote response, render no record choices. Show Cancel, `#conflictDownloadRemote`, and a secondary “Use local with current ETag” action. The download action saves the untouched `remote.raw` as `navi-remote-unreadable-<date>.txt`; the overwrite action is disabled when there is no strong ETag and routes to the compatibility confirmation when required.

- [ ] **Step 5: Submit through safe reconciliation**

On Apply, call `SyncMerge.resolve`; if null, announce the incomplete selection and keep the modal open. Otherwise call the conditional-write continuation with the latest remote ETag. Cancel clears context and restores focus without saving or fetching.

- [ ] **Step 6: Style for desktop and mobile**

Use existing tokens, at least 44px controls, visible focus, scrollable conflict list, and spatial separation for bulk actions. On narrow screens stack local/remote choices without horizontal overflow. Do not use color alone to distinguish deletion or side.

- [ ] **Step 7: Add English, Chinese, and Spanish strings**

Add the same keys to all three locales, using this exact English/Chinese copy and faithful Spanish translations:

```js
syncConflictSummary:"Automatically merged {added} added, {updated} updated, and {deleted} deleted. Review {conflicts} conflict(s).",
syncConflictSummary_zh:"已自动合并：新增 {added}、更新 {updated}、删除 {deleted}。请处理 {conflicts} 个冲突。",
syncConflictBookmark:"Bookmark", syncConflictOrder:"Bookmark order", syncConflictCategories:"Categories",
syncConflictCalendar:"Calendar", syncConflictSettings:"Interface settings",
syncConflictLocal:"Local", syncConflictRemote:"Remote", syncConflictDeleted:"Deleted",
syncConflictAllLocal:"All local", syncConflictAllRemote:"All remote",
syncConflictApply:"Apply choices and sync safely", syncConflictIncomplete:"Choose a result for every conflict.",
syncNoSafeEtag:"This server does not provide a strong ETag. Safe automatic upload is unavailable.",
syncProtocolDowngrade:"The remote file was written by an older client. Review it before continuing.",
syncBaseWarning:"Data synced, but the safety baseline could not be saved. The next write will require review.",
syncLocalPending:"Remote changes merged locally; local changes are still waiting to upload.",
syncDownloadRemote:"Download remote original"
```

In the actual locale objects, use the existing unsuffixed key names; the `_zh` line above specifies the Chinese value for `syncConflictSummary`, not a fourth runtime key. Add native Spanish values rather than copying English. The existing locale-parity E2E must remain exact.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
node tools/test.js
node tools/e2e.js
node tools/dev-check.js 2>/dev/null || true
```

The authoritative visual-contract result remains the `dev-check.html` group inside `tools/e2e.js`; it must report no failures. All keyboard/focus/conflict assertions pass.

- [ ] **Step 9: Commit Task 7**

```bash
git add index.html css/app.css js/sync.js js/i18n.js tools/e2e.js
git commit -m "提供逐项同步冲突处理界面"
```

---

### Task 8: Two-client race E2E, documentation, cache, and release verification

**Files:**

- Modify: `.gitignore`
- Modify: `tools/e2e.js`
- Modify: `tools/dav-stub.py`
- Modify: `README.md`
- Modify: `sw.js`
- Modify: `docs/superpowers/plans/2026-09-01-webdav-sync-safety.md`

**Interfaces:**

- Verifies all prior task interfaces against two isolated browser profiles and one real local HTTP/WebDAV server.

- [x] **Step 1: Add the failing two-client browser scenario**

Within `tools/e2e.js`, start `tools/dav-stub.py` on a free port and a second Chrome process with a separate temporary `--user-data-dir`. Connect a second `Cdp` instance and configure both pages with the same WebDAV URL and credentials.

Exercise these exact cases:

1. Both clients pull the same v4 base and persist identical ETags.
2. A adds bookmark `a-new`; B adds `b-new`; A uploads, then B uploads and the remote contains both.
3. A deletes `shared`; B edits `other`; after both uploads `shared` is absent, its tombstone exists, and `other` has B's edit.
4. A and B edit `same` differently; B shows `bookmark:same`, makes no premature PUT, and cancellation preserves both sides.
5. Enable stub `race`; B's first PUT receives 412, its retry includes the injected `remote-x`, and request history proves both ETags differ.
6. Enable `noetag`; automatic upload makes no PUT and the status explains safe auto-upload is unavailable.

- [x] **Step 2: Verify RED**

Run: `node tools/e2e.js`

Expected: one or more two-client, tombstone, 412 retry, or no-ETag assertions fail before the complete integration is present.

- [x] **Step 3: Run the focused scenario until all six cases pass**

Add an environment filter in `tools/e2e.js`:

```js
const onlySync=process.env.NAVI_SYNC_E2E_ONLY==="1";
```

Wrap the pre-existing non-sync groups in `if(!onlySync)` and always run the two-client group. Run `NAVI_SYNC_E2E_ONLY=1 node tools/e2e.js`. If a case fails, apply `superpowers:systematic-debugging`, add a focused logic or protocol assertion that reproduces the exact cause, make the smallest correction in the owning module, and rerun this command. Task 8 is not complete until all six named cases produce passing output; an unexplained retry or skipped assertion is a failure.

- [x] **Step 4: Document safe and compatibility modes**

Update Chinese and English README sections to explain:

- WebDAV must expose a strong `ETag` and allow `If-Match` / `If-None-Match` through CORS for safe automatic writes.
- Different-bookmark edits merge automatically; same-bookmark edits and delete-versus-edit require a choice.
- Tombstones are distinct from the visible trash.
- Servers without strong ETag can still be read, but auto-upload is disabled and manual compatibility upload cannot guarantee race protection.
- Every writing device must run the upgraded Navi version before relying on v4 tombstones.

- [x] **Step 5: Regenerate the offline shell and bump cache version once**

Run `node tools/bump.js` without a numeric override so it increments the current version and adds `js/sync-merge.js` to the Service Worker shell. Inspect that `index.html`, `sw.js` CACHE, both stylesheets, and all script entries agree.

Add `__pycache__/` and `*.pyc` under the existing temporary-artifact section of `.gitignore` before Python verification, so syntax checks cannot contaminate the release diff.

- [x] **Step 6: Run the complete release verification**

```bash
node tools/test.js
node tools/e2e.js
python3 tools/dav-stub.py --self-test
for f in js/*.js tools/*.js sw.js; do node --check "$f" || exit 1; done
python3 -m py_compile tools/dav-stub.py
node tools/bump.js "$(sed -n 's/var CACHE = "navi-v\([0-9][0-9]*\)";/\1/p' sw.js)"
git diff --check
git status --short --branch
```

Expected:

- all logic tests pass;
- all existing and two-client Chrome E2E groups pass;
- protocol self-test passes;
- syntax and Python compilation exit 0;
- bump verification reports no version drift and creates no diff;
- only intended tracked changes are present before the final commit.

- [x] **Step 7: Audit spec completion explicitly**

For every item in spec sections 3, 5–14, and 17, record the proving test name, file location, or command output in the execution notes. Treat absent ETag handling, remote downgrade, base failure, delete-versus-edit, order conflict, and 412 retry as incomplete unless their dedicated assertions ran.

- [x] **Step 8: Commit Task 8**

```bash
git add README.md sw.js index.html js tools docs/superpowers/plans/2026-09-01-webdav-sync-safety.md
git commit -m "验证多设备同步安全流程"
```

- [x] **Step 9: Final branch review and integration**

Use `superpowers:verification-before-completion`, perform the requested code review without dispatching subagents unless the user explicitly authorizes them, then use `superpowers:finishing-a-development-branch`. Merge locally only after the feature branch is clean and every verification command has fresh passing output. Push to GitHub only if the user's current authorization includes remote publication; verify the remote SHA after pushing.

## 执行与规格审计（2026-09-01）

| 规格章节 | 完成证据 |
| --- | --- |
| 3 已批准的产品行为 | `tools/test.js` 的 `three-way sync merge` 覆盖独立修改、同记录冲突、删除对编辑、顺序/分类/日历/设置；`tools/e2e.js` 的双客户端组证明自动上传只走条件写入。 |
| 5 组件边界 | `js/sync-merge.js` 保持纯对象逻辑；`NaviStorage` 的 base 接口由 `sync bases are isolated by Profile and URL` 实测；网络/UI 编排留在 `js/sync.js`；`tools/dav-stub.py --self-test` 验证协议替身。 |
| 6 v4 数据格式 | `sync v4 canonicalization` 与 `sync metadata persistence` 验证 v3→canonical v4、远端 `sync.tombstones`、本地/Profile `syncMeta.tombstones`、恢复移除墓碑和活动统计不制造内容冲突。 |
| 7 兼容与迁移 | 逻辑测试验证 v3 可读、缺 ID/时间字段规范化；`unsafe reconciliation paths never write or advance the base` 覆盖无 base 首次建立关系、弱 ETag、v4 base 对 v3 downgrade 和 base 不可用。 |
| 8 本地变更跟踪 | `sync metadata persistence` 验证统一保存边界的 `updatedAt`、删除墓碑、恢复、remote tracking 与 Profile 隔离；双客户端删除场景证明墓碑跨端生效且不依赖 UI 回收站。 |
| 9 三方合并规则 | `three-way sync merge` 覆盖书签矩阵、同 ID 新增、delete-versus-edit、点击统计最大值、单/双边改序、分类集合、日历和设置；`per-conflict choices...` 验证 `SyncMerge.resolve` 输出。 |
| 10 安全写入流程 | `tools/dav-stub.py --self-test` 证明 `If-None-Match: *`、`If-Match`、旧 ETag 412 和 CORS 条件头；双客户端 412 场景证明重读、重新合并、两个不同 ETag；`failed base persistence...` 证明 base 保存失败显示 `base-warning`。 |
| 11 无 ETag 兼容模式 | `weak-ETag conflict choices require confirmation and a fresh read` 证明人工兼容写前确认与复读；双客户端 `no-ETag server blocked auto-upload...` 证明自动路径零 PUT 且状态解释强 ETag 限制。 |
| 12 冲突界面 | `per-conflict choices...`、`first sync always offers...`、`unreadable remote...`、`conflict choices fit a narrow mobile viewport` 覆盖具名 dialog、逐项/批量选择、完整选择门槛、取消、原文下载、强 ETag 覆盖限制、三语集合标题、焦点/underlay 与 375px 布局。 |
| 13 错误和恢复 | `unsafe reconciliation paths...` 覆盖 invalid、bootstrap、compatibility、base-unavailable、三次 412；`failed base persistence...` 覆盖 PUT 后 base 失败；既有 recovery 两组 E2E 证明原文保留、恢复版本、下载与确认重置。 |
| 14 测试策略 | RED 已分别观察到缺失逐项控件、首次三选缺失、隐藏按钮误显示、弹层 underlay 未隔离、412 最终状态不可审核、双客户端墓碑字段假设、race 注入 ID 与 no-ETag 状态提示失败；随后 focused 与 full suite 均 GREEN。 |
| 17 完成标准 | `node tools/test.js` 为 `333 passed`；`node tools/e2e.js` 的既有组及六个双客户端子场景全通过；协议、JS/Python 语法、cache drift 与 `git diff --check` 均通过。正常 PUT 调用仍仅存在于 `conditionalPut`，无条件 PUT 仅存在于显式确认的 `compatibilityPutConfirmed`。 |

发布验证记录：

- `NAVI_SYNC_E2E_ONLY=1 node tools/e2e.js`：六个双客户端子场景通过。
- `node tools/test.js`：`333 passed`。
- `node tools/e2e.js`：全部浏览器组与双客户端组通过。
- `python3 tools/dav-stub.py --self-test`：通过。
- `for f in js/*.js tools/*.js sw.js; do node --check "$f" || exit 1; done`：通过。
- `python3 -m py_compile tools/dav-stub.py`：通过，产物由 `.gitignore` 排除。
- `node tools/bump.js 75`：`navi-v75 → navi-v75`，2 个样式、35 个脚本，无版本漂移。
- `git diff --check`：通过。
