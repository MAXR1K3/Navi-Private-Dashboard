/* chrome-sync.js — Chrome 书签只读同步（仅扩展环境生效） */
"use strict";

/* ===== Chrome Sync ===== */
var CHROME_ROOTS=["Bookmarks bar","Bookmarks Bar","Other bookmarks","Other Bookmarks","Mobile bookmarks","Mobile Bookmarks","书签栏","其他书签","移动设备书签"];

function hasChromeAPI(){
  return typeof chrome!=="undefined"&&chrome&&chrome.bookmarks&&typeof chrome.bookmarks.getTree==="function";
}

function walkChromeTree(nodes, parentCat, out){
  (nodes||[]).forEach(function(n){
    if(n.url){
      if(isWebUrl(n.url)) out.push({ cid:n.id, title:(n.title||"").trim()||getDomain(n.url), url:n.url, cat:parentCat||"Uncategorized" });
    } else if(n.children){
      var isRoot=(!n.parentId||n.parentId==="0"||CHROME_ROOTS.indexOf(n.title)>-1);
      walkChromeTree(n.children, isRoot?null:(chromeSafeCatName(n.title)||null)||parentCat, out);
    }
  });
}

function runChromeSync(onDone){
  if(!hasChromeAPI()){ if(onDone) onDone("noext"); return; }
  _csSyncing=true; updateSyncUI();
  chrome.bookmarks.getTree(function(tree){
    var items=[]; walkChromeTree(tree, null, items);
    // Remove bookmarks deleted from Chrome (only sync'd ones)
    var cids={}; items.forEach(function(i){ cids[i.cid]=true; });
    state.bookmarks=state.bookmarks.filter(function(b){ return !b.chromeSyncId||cids[b.chromeSyncId]; });
    // Index existing by normalised URL
    var byUrl={}; state.bookmarks.forEach(function(b){ byUrl[normForDup(b.url)]=b; });
    var added=0;
    items.forEach(function(item){
      var key=normForDup(item.url);
      if(byUrl[key]){
        var ex=byUrl[key];
        ex.chromeSyncId=item.cid;
        if(item.title&&ex.title!==item.title) ex.title=item.title; // reflect title renames
      } else {
        var cat=item.cat||"Uncategorized";
        if(state.categories.indexOf(cat)===-1) state.categories.push(cat);
        state.bookmarks.push({ id:uid(), chromeSyncId:item.cid, title:item.title, url:normalizeUrl(item.url), category:cat, description:smartSummary(item.url,item.title,cat,""), clicks:0, lastOpened:0 });
        added++;
      }
    });
    state.settings.chromeSyncLastSync=Date.now();
    state.settings.chromeSyncCount=items.length;
    _csSyncing=false;
    rebuildCategories(); save(); render(); updateSyncUI();
    if(onDone) onDone(null, added);
  });
}

function applyPendingChrome(){
  if(!hasChromeAPI()||!chrome.storage||!chrome.storage.local) return;
  chrome.storage.local.get(["naviPending"], function(data){
    var q=(data&&data.naviPending)||[]; if(!q.length) return;
    var changed=false;
    q.forEach(function(ev){
      if(ev.type==="created"&&ev.node&&isWebUrl(ev.node.url)){
        if(state.bookmarks.some(function(b){ return normForDup(b.url)===normForDup(ev.node.url); })) return;
        var cat=(ev.parentTitle&&CHROME_ROOTS.indexOf(ev.parentTitle)===-1)?chromeSafeCatName(ev.parentTitle)||"Uncategorized":"Uncategorized";
        if(state.categories.indexOf(cat)===-1) state.categories.push(cat);
        state.bookmarks.push({ id:uid(), chromeSyncId:ev.node.id, title:(ev.node.title||"").trim()||getDomain(ev.node.url), url:normalizeUrl(ev.node.url), category:cat, description:smartSummary(ev.node.url,ev.node.title,cat,""), clicks:0, lastOpened:0 });
        changed=true;
      } else if(ev.type==="removed"){
        var prev=state.bookmarks.length;
        state.bookmarks=state.bookmarks.filter(function(b){ return b.chromeSyncId!==ev.id; });
        if(state.bookmarks.length!==prev) changed=true;
      } else if(ev.type==="changed"){
        state.bookmarks.forEach(function(b){
          if(b.chromeSyncId===ev.id){
            if(ev.changes&&ev.changes.title) b.title=ev.changes.title;
            if(ev.changes&&ev.changes.url&&isWebUrl(ev.changes.url)) b.url=normalizeUrl(ev.changes.url);
            changed=true;
          }
        });
      } else if(ev.type==="moved"){
        var isCatRoot=!ev.parentTitle||CHROME_ROOTS.indexOf(ev.parentTitle)>-1;
        var newCat=isCatRoot?"Uncategorized":(chromeSafeCatName(ev.parentTitle)||"Uncategorized");
        if(!isCatRoot&&state.categories.indexOf(newCat)===-1) state.categories.push(newCat);
        state.bookmarks.forEach(function(b){
          if(b.chromeSyncId===ev.id){ b.category=newCat; changed=true; }
        });
      }
    });
    chrome.storage.local.remove("naviPending");
    if(changed){ state.settings.chromeSyncLastSync=Date.now(); rebuildCategories(); save(); render(); updateSyncUI(); }
  });
}

var _csLive=false, _csSyncing=false, _csSyncTimer=null;
function attachChromeLive(){
  if(!hasChromeAPI()||_csLive) return; _csLive=true;
  chrome.bookmarks.onCreated.addListener(function(id, node){
    if(!state.settings.chromeSync||!node.url||!isWebUrl(node.url)) return;
    if(state.bookmarks.some(function(b){ return normForDup(b.url)===normForDup(node.url); })) return;
    chrome.bookmarks.get(node.parentId||id, function(parents){
      var pt=(parents&&parents[0]&&parents[0].title)||"";
      var cat=(CHROME_ROOTS.indexOf(pt)===-1&&pt)?chromeSafeCatName(pt)||"Uncategorized":"Uncategorized";
      if(state.categories.indexOf(cat)===-1) state.categories.push(cat);
      state.bookmarks.push({ id:uid(), chromeSyncId:id, title:(node.title||"").trim()||getDomain(node.url), url:normalizeUrl(node.url), category:cat, description:smartSummary(node.url,node.title,cat,""), clicks:0, lastOpened:0 });
      state.settings.chromeSyncLastSync=Date.now();
      rebuildCategories(); save(); render(); updateSyncUI();
      toast(t("bookmarkAdded"),"ok");
    });
  });
  chrome.bookmarks.onRemoved.addListener(function(id){
    if(!state.settings.chromeSync) return;
    var prev=state.bookmarks.length;
    state.bookmarks=state.bookmarks.filter(function(b){ return b.chromeSyncId!==id; });
    if(state.bookmarks.length!==prev){ state.settings.chromeSyncLastSync=Date.now(); save(); render(); updateSyncUI(); }
  });
  chrome.bookmarks.onChanged.addListener(function(id, changes){
    if(!state.settings.chromeSync) return;
    state.bookmarks.forEach(function(b){
      if(b.chromeSyncId===id){
        if(changes.title) b.title=changes.title;
        if(changes.url&&isWebUrl(changes.url)) b.url=normalizeUrl(changes.url);
      }
    });
    state.settings.chromeSyncLastSync=Date.now(); save(); renderContent(); updateSyncUI();
  });
  chrome.bookmarks.onMoved.addListener(function(id, info){
    if(!state.settings.chromeSync) return;
    chrome.bookmarks.get(info.parentId, function(parents){
      var pt=(parents&&parents[0]&&parents[0].title)||"";
      var isRoot=!pt||CHROME_ROOTS.indexOf(pt)>-1;
      var cat=isRoot?"Uncategorized":(chromeSafeCatName(pt)||"Uncategorized");
      var found=false;
      state.bookmarks.forEach(function(b){ if(b.chromeSyncId===id){ b.category=cat; found=true; } });
      if(found){ state.settings.chromeSyncLastSync=Date.now(); rebuildCategories(); save(); render(); updateSyncUI(); }
    });
  });
}

var _syncUiTimer=null;
function updateSyncUI(){
  var tog=document.getElementById("setChromeSync");
  var statusEl=document.getElementById("csSyncStatus");
  var syncBtn=document.getElementById("csSyncNow");
  var noteEl=document.getElementById("csNote");
  var ext=hasChromeAPI();
  if(tog){ tog.checked=!!state.settings.chromeSync; tog.disabled=!ext; }
  if(statusEl){
    if(_csSyncing){
      statusEl.innerHTML='<span style="display:inline-flex;align-items:center;gap:5px"><svg class="spin" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5"/></svg>'+escapeHtml(t("syncing"))+'</span>';
    } else if(!ext){
      statusEl.textContent=t("notExtension");
    } else if(!state.settings.chromeSync){
      statusEl.textContent=t("chromeSyncSec");
    } else if(!state.settings.chromeSyncLastSync){
      statusEl.textContent=t("neverSynced")+" · "+t("autoSyncDesc");
    } else {
      statusEl.textContent=t("lastSynced",{t:timeAgo(state.settings.chromeSyncLastSync)})+
        (state.settings.chromeSyncCount?" · "+t("syncedCount",{n:state.settings.chromeSyncCount}):"")+
        " · "+t("autoSyncDesc");
    }
  }
  if(syncBtn){
    syncBtn.style.display=(ext&&state.settings.chromeSync&&!_csSyncing)?"inline-flex":"none";
  }
  if(noteEl) noteEl.style.display=(!ext)?"":"none";
  var lk=document.getElementById("csSetupLink"); if(lk) lk.textContent=t("extensionSetup");
  // keep "X ago" text fresh while settings panel is open
  if(!_syncUiTimer&&state.settings.chromeSync&&state.settings.chromeSyncLastSync){
    _syncUiTimer=setInterval(function(){
      if(document.getElementById("csSyncStatus")) updateSyncUI();
      else{ clearInterval(_syncUiTimer); _syncUiTimer=null; }
    }, 60*1000);
  }
}

function downloadText(fn, txt){ var a=document.createElement("a"); a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(txt); a.download=fn; document.body.appendChild(a); a.click(); setTimeout(function(){ a.remove(); }, 100); }

function downloadExtFiles(){
  var mf=JSON.stringify({ manifest_version:3, name:"Navi — Private Bookmark Dashboard", version:"1.1", description:"Private bookmark dashboard with read-only Chrome sync.", permissions:["bookmarks","storage"], chrome_url_overrides:{newtab:"bookmark-dashboard.html"}, background:{service_worker:"background.js"} }, null, 2);
  var bg=[
    "// Navi background.js v1.1 — queues Chrome bookmark events while the dashboard is closed",
    "const ROOTS=['Bookmarks bar','Bookmarks Bar','Other bookmarks','Other Bookmarks',",
    "  'Mobile bookmarks','Mobile Bookmarks','书签栏','其他书签','移动设备书签'];",
    "const MAX_QUEUE=500; // prevent unbounded growth",
    "",
    "async function enqueue(ev){",
    "  try{",
    "    const d=await chrome.storage.local.get('naviPending');",
    "    const q=d.naviPending||[];",
    "    q.push(ev);",
    "    // Trim oldest entries if queue exceeds cap",
    "    const trimmed=q.length>MAX_QUEUE?q.slice(q.length-MAX_QUEUE):q;",
    "    await chrome.storage.local.set({naviPending:trimmed});",
    "  }catch(_){}",
    "}",
    "",
    "chrome.bookmarks.onCreated.addListener(async(id,node)=>{",
    "  if(!node.url) return;",
    "  let parentTitle='';",
    "  try{ const [p]=await chrome.bookmarks.get(node.parentId); parentTitle=p?.title||''; }catch(_){}",
    "  await enqueue({type:'created',id,node,parentTitle});",
    "});",
    "",
    "chrome.bookmarks.onRemoved.addListener(async(id,removeInfo)=>{",
    "  // removeInfo.node.url is undefined for folders — skip folder-removal events",
    "  if(removeInfo?.node&&!removeInfo.node.url) return;",
    "  await enqueue({type:'removed',id});",
    "});",
    "",
    "chrome.bookmarks.onChanged.addListener(async(id,changes)=>{",
    "  await enqueue({type:'changed',id,changes});",
    "});",
    "",
    "chrome.bookmarks.onMoved.addListener(async(id,info)=>{",
    "  let parentTitle='';",
    "  try{ const [p]=await chrome.bookmarks.get(info.parentId); parentTitle=p?.title||''; }catch(_){}",
    "  await enqueue({type:'moved',id,parentId:info.parentId,parentTitle});",
    "});"
  ].join("\n");
  downloadText("manifest.json", mf);
  setTimeout(function(){ downloadText("background.js", bg); }, 250);
}

function showExtSetupGuide(){
  var lang=state.settings.lang;
  var lines=lang==="zh"?[
    "1. 将 manifest.json 和 background.js 与 bookmark-dashboard.html 放在同一文件夹",
    "2. 打开 chrome://extensions",
    "3. 右上角开启【开发者模式】",
    "4. 点击【加载已解压的扩展程序】，选择该文件夹",
    "5. 打开新标签页，Navi 会以扩展方式运行",
    "6. 在设置中开启 Chrome 同步即可"
  ]:lang==="es"?[
    "1. Coloca manifest.json y background.js en la misma carpeta que bookmark-dashboard.html",
    "2. Ve a chrome://extensions",
    "3. Activa el 'Modo desarrollador' (esquina superior derecha)",
    "4. Haz clic en 'Cargar sin empaquetar' y selecciona la carpeta",
    "5. Abre una pestaña nueva — Navi se ejecutará como extensión",
    "6. Activa la Sincronización Chrome en Ajustes"
  ]:[
    "1. Place manifest.json and background.js in the same folder as bookmark-dashboard.html",
    "2. Open chrome://extensions",
    "3. Enable Developer mode (top-right toggle)",
    "4. Click 'Load unpacked' and select the folder",
    "5. Open a new tab — Navi will run as an extension",
    "6. Enable Chrome Sync in Settings"
  ];
  openConfirm(t("extensionSetup"), lines.join("\n"), lang==="zh"?"下载文件":lang==="es"?"Descargar archivos":"Download files", function(){
    downloadExtFiles();
  });
  // allow newlines in confirm message
  var msgEl=document.getElementById("confirmMsg");
  if(msgEl) msgEl.style.whiteSpace="pre-line";
}

function initChromeSync(){
  updateSyncUI();
  if(!hasChromeAPI()||!state.settings.chromeSync) return;
  applyPendingChrome();
  attachChromeLive();
  // Auto-sync on startup if stale (>30 min) or never synced
  var age=Date.now()-(state.settings.chromeSyncLastSync||0);
  if(age>30*60*1000){
    runChromeSync(function(err, added){
      if(!err&&added) toast(t("importedToast",{a:added}),"ok");
    });
  }
  // Periodic 30-min sync
  if(!_csSyncTimer){
    _csSyncTimer=setInterval(function(){
      if(state.settings.chromeSync&&hasChromeAPI()&&!_csSyncing) runChromeSync(null);
    }, 30*60*1000);
  }
}

document.getElementById("setChromeSync").addEventListener("change", function(e){
  state.settings.chromeSync=e.target.checked; save(); updateSyncUI();
  if(e.target.checked&&hasChromeAPI()){
    runChromeSync(function(err){
      if(err) toast(t("chromeSyncError"),"err");
      else{
        attachChromeLive();
        if(!_csSyncTimer){
          _csSyncTimer=setInterval(function(){
            if(state.settings.chromeSync&&hasChromeAPI()&&!_csSyncing) runChromeSync(null);
          }, 30*60*1000);
        }
        toast(t("chromeSyncEnabled"),"ok");
      }
    });
  } else {
    if(_csSyncTimer){ clearInterval(_csSyncTimer); _csSyncTimer=null; }
    toast(t("chromeSyncDisabled"),"ok");
  }
});

document.getElementById("csSyncNow").addEventListener("click", function(){
  var btn=this; btn.disabled=true; btn.textContent=t("syncing");
  runChromeSync(function(err){
    btn.disabled=false; btn.textContent=t("syncNow");
    if(err) toast(t("chromeSyncError"),"err");
    else toast(t("syncedCount",{n:state.settings.chromeSyncCount}),"ok");
  });
});

document.getElementById("csSetupLink").addEventListener("click", function(e){
  e.preventDefault(); showExtSetupGuide();
});
