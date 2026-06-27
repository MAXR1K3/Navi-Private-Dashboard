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

function addChromeCat(out, seen, cat){
  cat=cleanCatName(cat)||"Uncategorized";
  if(isReservedCat(cat)) cat="Uncategorized";
  var key=cat.toLowerCase();
  if(!seen[key]){ seen[key]=true; out.push(cat); }
}
function chromeBookmarkFromItem(item){
  var cat=cleanCatName(item.cat)||"Uncategorized";
  if(isReservedCat(cat)) cat="Uncategorized";
  return { id:uid(), chromeSyncId:item.cid, title:item.title, url:normalizeUrl(item.url), category:cat, description:smartSummary(item.url,item.title,cat,""), clicks:0, lastOpened:0 };
}
function applyChromeReplace(items){
  var seenUrls={}, seenCats={}, cats=[], bookmarks=[];
  items.forEach(function(item){
    var key=normForDup(item.url);
    if(seenUrls[key]) return;
    seenUrls[key]=true;
    var bm=chromeBookmarkFromItem(item);
    addChromeCat(cats,seenCats,bm.category);
    bookmarks.push(bm);
  });
  state.bookmarks=bookmarks;
  state.categories=cats;
  return bookmarks.length;
}
function applyChromeMerge(items){
  var byUrl={}, byCid={}, ordered=[], used={}, seenUrls={}, chromeCats=[], chromeCatSeen={}, added=0;
  var oldCats=state.categories.slice();
  state.bookmarks.forEach(function(b){
    var key=normForDup(b.url);
    if(!byUrl[key]) byUrl[key]=b;
    if(b.chromeSyncId&&!byCid[b.chromeSyncId]) byCid[b.chromeSyncId]=b;
  });
  items.forEach(function(item){
    var key=normForDup(item.url);
    if(seenUrls[key]) return;
    seenUrls[key]=true;
    var cat=cleanCatName(item.cat)||"Uncategorized";
    if(isReservedCat(cat)) cat="Uncategorized";
    addChromeCat(chromeCats,chromeCatSeen,cat);
    var ex=byCid[item.cid]||byUrl[key];
    if(ex){
      ex.chromeSyncId=item.cid;
      delete ex._seed;
      if(item.title&&ex.title!==item.title) ex.title=item.title;
      if(ex.url!==normalizeUrl(item.url)) ex.url=normalizeUrl(item.url);
      if(ex.category!==cat) ex.category=cat;
      ordered.push(ex);
      used[ex.id]=true;
    } else {
      var bm=chromeBookmarkFromItem(item);
      ordered.push(bm);
      used[bm.id]=true;
      added++;
    }
  });
  var rest=[];
  state.bookmarks.forEach(function(b){
    if(used[b.id]||b._seed) return;
    if(b.chromeSyncId) return;
    rest.push(b);
  });
  var seenCats={};
  state.categories=chromeCats.slice();
  state.categories.forEach(function(c){ seenCats[String(c).toLowerCase()]=true; });
  state.bookmarks=ordered.concat(rest);
  oldCats.forEach(function(c){ addChromeCat(state.categories,seenCats,c); });
  state.bookmarks.forEach(function(b){ addChromeCat(state.categories,seenCats,b.category); });
  return added;
}

function runChromeSync(onDone){
  if(!hasChromeAPI()){ if(onDone) onDone("noext"); return; }
  _csSyncing=true; updateSyncUI();
  chrome.bookmarks.getTree(function(tree){
    var items=[]; walkChromeTree(tree, null, items);
    var added=state.settings.chromeSyncReplace?applyChromeReplace(items):applyChromeMerge(items);
    state.settings.chromeSyncLastSync=Date.now();
    state.settings.chromeSyncCount=state.bookmarks.filter(function(b){ return !!b.chromeSyncId; }).length;
    _csSyncing=false;
    rebuildCategories(); save(); render(); updateSyncUI();
    if(onDone) onDone(null, added);
  });
}

function applyPendingChrome(){
  if(!hasChromeAPI()||!chrome.storage||!chrome.storage.local) return;
  chrome.storage.local.get(["naviPending"], function(data){
    var q=(data&&data.naviPending)||[]; if(!q.length) return;
    chrome.storage.local.remove("naviPending");
    runChromeSync(null);
  });
}

var _csLive=false, _csSyncing=false, _csSyncTimer=null, _csSyncDebounce=null;
function queueChromeSync(delay){
  if(!state.settings.chromeSync||!hasChromeAPI()) return;
  if(_csSyncDebounce) clearTimeout(_csSyncDebounce);
  _csSyncDebounce=setTimeout(function(){
    _csSyncDebounce=null;
    if(state.settings.chromeSync&&hasChromeAPI()&&!_csSyncing) runChromeSync(null);
  }, delay||180);
}
function attachChromeLive(){
  if(!hasChromeAPI()||_csLive) return; _csLive=true;
  chrome.bookmarks.onCreated.addListener(function(id, node){
    if(!state.settings.chromeSync||!node.url||!isWebUrl(node.url)) return;
    queueChromeSync(180);
  });
  chrome.bookmarks.onRemoved.addListener(function(id){
    if(!state.settings.chromeSync) return;
    queueChromeSync(180);
  });
  chrome.bookmarks.onChanged.addListener(function(id, changes){
    if(!state.settings.chromeSync) return;
    queueChromeSync(180);
  });
  chrome.bookmarks.onMoved.addListener(function(id, info){
    if(!state.settings.chromeSync) return;
    queueChromeSync(180);
  });
}

var _syncUiTimer=null;
function updateSyncUI(){
  var tog=document.getElementById("setChromeSync");
  var replaceTog=document.getElementById("setChromeSyncReplace");
  var statusEl=document.getElementById("csSyncStatus");
  var syncBtn=document.getElementById("csSyncNow");
  var noteEl=document.getElementById("csNote");
  var ext=hasChromeAPI();
  if(tog){ tog.checked=!!state.settings.chromeSync; tog.disabled=!ext; }
  if(replaceTog){ replaceTog.checked=!!state.settings.chromeSyncReplace; replaceTog.disabled=!ext; }
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
  var mf=JSON.stringify({ manifest_version:3, name:"Navi — Private Bookmark Dashboard", version:"1.4", description:"Private bookmark dashboard with read-only Chrome sync. Open from the toolbar icon.", permissions:["bookmarks","storage","tabs"], host_permissions:["http://*/*","https://*/*"], action:{ default_title:"Navi", default_icon:{ "16":"icons/icon-192.png","32":"icons/icon-192.png","48":"icons/icon-192.png","128":"icons/icon-512.png" } }, icons:{ "192":"icons/icon-192.png","512":"icons/icon-512.png" }, background:{service_worker:"background.js"} }, null, 2);
  var bg=[
    "// Navi background.js v1.4 — queues Chrome bookmark events while the dashboard is closed,",
    "// and opens/focuses the dashboard from the toolbar icon (no new-tab override).",
    "const ROOTS=['Bookmarks bar','Bookmarks Bar','Other bookmarks','Other Bookmarks',",
    "  'Mobile bookmarks','Mobile Bookmarks','书签栏','其他书签','移动设备书签'];",
    "const MAX_QUEUE=500; // prevent unbounded growth",
    "",
    "chrome.action.onClicked.addListener(async()=>{",
    "  const dashUrl=chrome.runtime.getURL('index.html');",
    "  try{",
    "    const tabs=await chrome.tabs.query({});",
    "    const existing=tabs.find(t=>t.url&&t.url.indexOf(dashUrl)===0);",
    "    if(existing){",
    "      await chrome.tabs.update(existing.id,{active:true});",
    "      if(existing.windowId!=null) await chrome.windows.update(existing.windowId,{focused:true});",
    "    }else{ await chrome.tabs.create({url:dashUrl}); }",
    "  }catch(_){ chrome.tabs.create({url:dashUrl}); }",
    "});",
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
    "1. 把下载的 manifest.json 和 background.js 覆盖到本项目根目录（与 index.html 同一文件夹）",
    "2. 打开 chrome://extensions，右上角开启【开发者模式】",
    "3. 点击【加载已解压的扩展程序】，选择该文件夹（已装过则点扩展卡片上的刷新图标重新加载）",
    "4. 点地址栏右侧的【拼图图标🧩】→ 找到本扩展 → 点【图钉】把图标固定到工具栏",
    "5. 点击固定后的扩展图标即可打开导航页（在独立标签中，地址栏显示 chrome-extension://…）",
    "6. 此时进入【设置 → 同步】开启 Chrome 同步即可；只有从这个图标打开才能同步",
    "注：固定的是扩展图标（图片），鼠标悬停提示为 Navi —— 这是扩展名，与你在设置里自定义的页面标题无关。"
  ]:lang==="es"?[
    "1. Copia manifest.json y background.js en la raíz del proyecto (misma carpeta que index.html)",
    "2. Abre chrome://extensions y activa el 'Modo desarrollador' (arriba a la derecha)",
    "3. Haz clic en 'Cargar sin empaquetar' y elige la carpeta (si ya está, pulsa el icono de recarga en su tarjeta)",
    "4. Abre el menú de extensiones (icono de puzle 🧩, junto a la barra de direcciones) → busca esta extensión → fíjala con el alfiler",
    "5. Haz clic en el icono fijado para abrir el panel (en su pestaña; la URL será chrome-extension://…)",
    "6. Entra en 'Ajustes → Sincronización' y activa la Sincronización Chrome; solo sincroniza si lo abres desde ese icono",
    "Nota: es el icono de la extensión (imagen); su tooltip 'Navi' es el nombre de la extensión, no el título personalizable de la página."
  ]:[
    "1. Copy manifest.json and background.js into the project root (same folder as index.html)",
    "2. Open chrome://extensions and enable Developer mode (top-right)",
    "3. Click 'Load unpacked' and pick the folder (if already added, click the reload icon on its card)",
    "4. Open the extensions menu (puzzle icon 🧩 next to the address bar) → find this extension → click the pin to keep it on the toolbar",
    "5. Click the pinned icon to open the dashboard (in its own tab; the URL will be chrome-extension://…)",
    "6. Go to Settings → Sync and turn on Chrome Sync; it only syncs when opened from that icon",
    "Note: it's the extension icon (an image); its 'Navi' tooltip is the extension name, not the customizable page title."
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

document.getElementById("setChromeSyncReplace").addEventListener("change", function(e){
  state.settings.chromeSyncReplace=e.target.checked;
  save(); updateSyncUI();
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
