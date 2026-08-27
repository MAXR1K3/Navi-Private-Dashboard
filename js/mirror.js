/* mirror.js — 把「主浏览器（锚点）」的书签镜像进其它浏览器的原生书签树。
   浏览器扩展之间没有任何直接通道，Edge 里的扩展读不到 Chrome 的书签，
   所以中转站是已有的那份 bookmarks.json（NAS / 导出文件）：

       Chrome（主）→ Navi → bookmarks.json → Navi（从）→ 从浏览器的书签树

   安全边界：从浏览器只写进一个我们自己的文件夹，文件夹外的东西一律不碰。
   这样你在 Edge 里自己存的书签永远安全，想停止同步删掉那个文件夹即可。 */
"use strict";

var MIRROR_FOLDER="Navi";

/* ---- 角色：主 / 从 / 关闭 ----
   必须存在这台浏览器本地，绝不能进 state.settings —— settings 是要同步的，
   一旦写进去，其它浏览器拉下来后会以为自己也是主，几台机器互相打架。 */
function browserRole(){ var r=deviceGet("browserRole"); return r==="anchor"||r==="follower"?r:"off"; }
function setBrowserRole(role){ deviceSet("browserRole", role==="anchor"||role==="follower"?role:"off"); }
function isFollower(){ return browserRole()==="follower"; }
function isAnchor(){ return browserRole()==="anchor"; }

function mirrorNormUrl(u){
  return (typeof normForDup==="function")?normForDup(u):String(u||"").trim().toLowerCase();
}
function mirrorCatName(c){ return String(c||"Uncategorized").trim()||"Uncategorized"; }

/* ---- 规划：对比"应该有什么"和"现在有什么"，算出要做的操作 ----
   纯函数，不碰任何浏览器 API，这样最危险的一步可以在 tools/test.js 里穷举验证。
   canonical: [{title,url,category}]
   existing:  [{id,title,items:[{id,title,url}]}]   —— 镜像文件夹下的现状
   返回的操作是有顺序的：先建文件夹 → 再动条目 → 最后清理空文件夹。 */
function planMirror(canonical, existing){
  var plan={ addFolders:[], addItems:[], updateItems:[], moveItems:[], removeItems:[], removeFolders:[] };
  canonical=Array.isArray(canonical)?canonical:[];
  existing=Array.isArray(existing)?existing:[];

  var haveFolder={}, itemsByUrl={};
  existing.forEach(function(f){
    haveFolder[f.title]=f;
    (f.items||[]).forEach(function(it){
      var k=mirrorNormUrl(it.url);
      if(!k) return;
      // 同一个网址在镜像里重复出现时，留第一个，其余在下面会被当成多余项删掉
      if(!itemsByUrl[k]) itemsByUrl[k]={ item:it, folder:f.title, keep:false };
    });
  });

  var wantFolders={};
  canonical.forEach(function(b){
    var url=String(b.url||"").trim(); if(!url) return;
    var cat=mirrorCatName(b.category), title=String(b.title||url);
    wantFolders[cat]=true;
    var k=mirrorNormUrl(url), cur=itemsByUrl[k];
    if(!cur){
      plan.addItems.push({ folder:cat, title:title, url:url });
      return;
    }
    cur.keep=true;
    if(cur.folder!==cat) plan.moveItems.push({ id:cur.item.id, folder:cat, from:cur.folder });
    if(String(cur.item.title||"")!==title) plan.updateItems.push({ id:cur.item.id, title:title });
  });

  Object.keys(wantFolders).forEach(function(cat){ if(!haveFolder[cat]) plan.addFolders.push(cat); });

  // 镜像里有、但主浏览器已经没有的 → 删掉（只删我们自己文件夹里的）
  existing.forEach(function(f){
    (f.items||[]).forEach(function(it){
      var k=mirrorNormUrl(it.url), rec=itemsByUrl[k];
      if(!k){ plan.removeItems.push(it.id); return; }          // 没有网址的杂项
      if(!rec||!rec.keep||rec.item.id!==it.id) plan.removeItems.push(it.id);
    });
    if(!wantFolders[f.title]) plan.removeFolders.push(f.id);
  });
  return plan;
}
function mirrorPlanCount(plan){
  if(!plan) return 0;
  return plan.addFolders.length+plan.addItems.length+plan.updateItems.length+
         plan.moveItems.length+plan.removeItems.length+plan.removeFolders.length;
}
function mirrorPlanIsNoop(plan){ return mirrorPlanCount(plan)===0; }

/* ---- 执行 ----
   防回环靠的不是打补丁，而是角色本身：
   主浏览器只做「浏览器 -> Navi -> 上传」，从浏览器只做「下载 -> Navi -> 写进浏览器」。
   从浏览器永远不读自己的书签树，我们写进去的东西也就不可能再流回去。 */
var _mirrorBusy=false;
var MIRROR_LOOSE=" loose";

function bmCall(method, a, b){
  var api=getExtApi();
  return new Promise(function(res, rej){
    if(!api||!api.bookmarks||typeof api.bookmarks[method]!=="function"){ rej(new Error("noext")); return; }
    try{
      // 按实际传了几个参数来拼调用：getTree 只收一个回调，
      // 写成 getTree(undefined, cb) 在真实 Chrome 上会直接抛参数错误
      var args=[];
      if(a!==undefined) args.push(a);
      if(b!==undefined) args.push(b);
      if(isPromiseExtApi(api)){ api.bookmarks[method].apply(api.bookmarks,args).then(res,rej); return; }
      args.push(function(r){
        var err=(typeof chrome!=="undefined"&&chrome.runtime&&chrome.runtime.lastError)||null;
        if(err){ rej(new Error(err.message||"bookmarks")); return; }
        res(r);
      });
      var ret=api.bookmarks[method].apply(api.bookmarks,args);
      if(ret&&typeof ret.then==="function") ret.then(res,rej);
    }catch(e){ rej(e); }
  });
}

/* 找到书签栏，再在它下面找/建我们自己的文件夹 */
function ensureMirrorRoot(){
  return bmCall("getTree").then(function(tree){
    var bar=null;
    (function walk(nodes){
      (nodes||[]).forEach(function(n){
        if(!bar&&!n.url&&BROWSER_BAR_ROOTS.indexOf(n.title)>-1) bar=n;
        if(n.children) walk(n.children);
      });
    })(tree);
    if(!bar){ // 有些浏览器书签栏标题对不上，退回第一个根节点下的第一个文件夹
      var root=(tree&&tree[0]&&tree[0].children)||[];
      bar=root.filter(function(n){ return !n.url; })[0]||null;
    }
    if(!bar) throw new Error("nobar");
    var mine=(bar.children||[]).filter(function(n){ return !n.url&&n.title===MIRROR_FOLDER; })[0];
    if(mine) return mine;
    return bmCall("create", { parentId:bar.id, title:MIRROR_FOLDER });
  });
}

/* 读出镜像文件夹现在的样子（只读我们自己的地盘） */
function readMirrorState(){
  return ensureMirrorRoot().then(function(root){
    return bmCall("getSubTree", root.id).then(function(sub){
      var node=(sub&&sub[0])||root;
      var kids=node.children||[];
      var folders=kids.filter(function(n){ return !n.url; }).map(function(f){
        return { id:f.id, title:f.title,
                 items:(f.children||[]).map(function(c){ return { id:c.id, title:c.title, url:c.url||"" }; }) };
      });
      // 直接躺在根下面的条目（正常不该有）也纳入清理范围
      var loose=kids.filter(function(n){ return n.url; });
      if(loose.length) folders.push({ id:null, title:MIRROR_LOOSE,
        items:loose.map(function(c){ return { id:c.id, title:c.title, url:c.url||"" }; }) });
      return { rootId:node.id, folders:folders };
    });
  });
}

function applyMirrorPlan(rootId, plan, onProgress){
  var folderId={}, done=0, total=mirrorPlanCount(plan);
  function step(){ done++; if(onProgress) onProgress(done, total); }
  function folderIdFor(name){
    if(folderId[name]) return Promise.resolve(folderId[name]);
    return bmCall("getChildren", rootId).then(function(kids){
      var f=(kids||[]).filter(function(k){ return !k.url&&k.title===name; })[0];
      if(!f) throw new Error("nofolder");
      folderId[name]=f.id; return f.id;
    });
  }
  var chain=Promise.resolve();
  plan.addFolders.forEach(function(name){
    chain=chain.then(function(){
      return bmCall("create", { parentId:rootId, title:name }).then(function(f){ folderId[name]=f.id; step(); });
    });
  });
  plan.moveItems.forEach(function(m){
    chain=chain.then(function(){
      return folderIdFor(m.folder).then(function(pid){ return bmCall("move", m.id, { parentId:pid }).then(step); });
    });
  });
  plan.updateItems.forEach(function(u){
    chain=chain.then(function(){ return bmCall("update", u.id, { title:u.title }).then(step); });
  });
  plan.addItems.forEach(function(a){
    chain=chain.then(function(){
      return folderIdFor(a.folder).then(function(pid){
        return bmCall("create", { parentId:pid, title:a.title, url:a.url }).then(step);
      });
    });
  });
  plan.removeItems.forEach(function(id){
    chain=chain.then(function(){ return bmCall("remove", id).then(step).catch(step); });
  });
  plan.removeFolders.forEach(function(id){
    if(!id) return;
    chain=chain.then(function(){ return bmCall("removeTree", id).then(step).catch(step); });
  });
  return chain.then(function(){ return { applied:total }; });
}

/* 从浏览器的一次完整镜像 */
function runMirrorSync(opts){
  opts=opts||{};
  if(_mirrorBusy) return Promise.resolve({ skipped:"busy" });
  if(typeof hasChromeAPI!=="function"||!hasChromeAPI()) return Promise.resolve({ skipped:"noext" });
  if(!isFollower()&&!opts.force) return Promise.resolve({ skipped:"notfollower" });
  _mirrorBusy=true;
  return readMirrorState().then(function(st){
    var plan=planMirror(state.bookmarks, st.folders);
    if(opts.dryRun) return { plan:plan, count:mirrorPlanCount(plan), dryRun:true };
    if(mirrorPlanIsNoop(plan)) return { plan:plan, count:0 };
    return applyMirrorPlan(st.rootId, plan, opts.onProgress).then(function(r){
      deviceSet("mirrorLastRun", Date.now());
      return { plan:plan, count:r.applied };
    });
  }).then(function(r){ _mirrorBusy=false; return r; })
    .catch(function(e){ _mirrorBusy=false; return { error:String((e&&e.message)||e) }; });
}

/* 自动触发：从浏览器每次打开 Navi、以及每次从 NAS 拉到新数据之后，都自动镜像一次。
   静默执行，只在出错时提示——正常情况下这件事不该打扰人。 */
function autoMirrorIfFollower(reason){
  if(!isFollower()) return Promise.resolve({skipped:"notfollower"});
  if(typeof hasChromeAPI!=="function"||!hasChromeAPI()) return Promise.resolve({skipped:"noext"});
  return runMirrorSync({}).then(function(r){
    if(r&&r.error) console.warn("[navi] 镜像失败:", r.error, "(", reason, ")");
    else if(r&&r.count) toast(t("mirrorDone",{n:r.count,folder:MIRROR_FOLDER}),"ok");
    return r;
  });
}
function initMirror(){
  if(!isFollower()) return;
  // 稍等一下，让 WebDAV 那边先把最新数据拉下来
  setTimeout(function(){ autoMirrorIfFollower("startup"); }, 3000);
}
