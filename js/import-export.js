/* import-export.js — 书签 HTML 导入/导出 */
"use strict";

/* ===== import ===== */
function openImport(source){ ui.importData=null; ui.importSource=source||"file"; ui.importMode=(source==="safari"?(state.settings.browserSyncMode||"merge"):"merge"); $("#importSub").textContent=source==="safari"?t("syncSafariImportDesc"):t("importSub");
  $("#importBody").innerHTML='<div class="dropzone" id="dropzone"><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M20 21H4a2 2 0 0 1-2-2v-3"/></svg></div><div><b>'+escapeHtml(t("dzClick"))+'</b> '+escapeHtml(t("dzDrop"))+'</div></div>';
  $("#importFoot").innerHTML='<button class="btn" data-close>'+escapeHtml(t("cancel"))+'</button>'; wireDropzone(); openOverlay("importOverlay"); }
function wireDropzone(){ var dz=$("#dropzone"); if(!dz) return; dz.addEventListener("click", function(){ $("#fileInput").click(); }); dz.addEventListener("dragover", function(e){ e.preventDefault(); dz.classList.add("over"); }); dz.addEventListener("dragleave", function(){ dz.classList.remove("over"); }); dz.addEventListener("drop", function(e){ e.preventDefault(); dz.classList.remove("over"); var f=e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) readFile(f); }); }
$("#fileInput").addEventListener("change", function(e){ var f=e.target.files&&e.target.files[0]; if(f) readFile(f); e.target.value=""; });
function readFile(file){ var r=new FileReader(); r.onload=function(){ try{ parseBookmarksHtml(String(r.result||"")); }catch(err){ toast(t("couldntRead"),"err"); } }; r.onerror=function(){ toast(t("couldntRead"),"err"); }; r.readAsText(file); }
var ROOT_FOLDERS=["bookmarks bar","bookmarks toolbar","other bookmarks","bookmarks menu","favorites bar","favorites","mobile bookmarks","bookmarks"];
function importRootCategory(cat){
  var c=String(cat||"").trim().toLowerCase();
  if(!c||c==="bookmarks bar"||c==="bookmarks toolbar"||c==="favorites bar"||c==="favorites"||c==="bookmarks") return t("catBookmarksBar");
  if(c==="other bookmarks"||c==="bookmarks menu") return t("catOtherBookmarks");
  if(c==="mobile bookmarks") return t("catMobileBookmarks");
  return "";
}
function smartCategory(url){ var d=getDomain(url).toLowerCase(); function any(a){ for(var i=0;i<a.length;i++){ if(d.indexOf(a[i])>-1) return true; } return false; }
  if(any(["github.","gitlab.","stackoverflow","npmjs","developer.mozilla","dev.to","codepen","jsfiddle","bitbucket","vercel","netlify"])) return "Development";
  if(any(["youtube.","netflix","spotify","twitch","vimeo","soundcloud","hulu","disney"])) return "Media";
  if(any(["twitter.","x.com","facebook","instagram","reddit","linkedin","tiktok","threads","mastodon","bsky","pinterest"])) return "Social";
  if(any(["nytimes","bbc.","cnn.","theverge","techcrunch","theguardian","reuters","bloomberg","arstechnica","wired","medium"])) return "News";
  if(any(["amazon.","ebay.","etsy.","aliexpress","walmart","bestbuy","shop","store"])) return "Shopping";
  if(any(["docs.google","drive.google","notion","trello","asana","figma","slack","calendar.google","mail.google","dropbox","atlassian","linear.app"])) return "Productivity";
  if(any(["wikipedia","arxiv","scholar.google","coursera","udemy","khanacademy","stackexchange"])) return "Reference";
  if(any(["paypal","chase.","wellsfargo","bankofamerica","coinbase","fidelity","robinhood","mint."])) return "Finance";
  return "Other"; }
function parseBookmarksHtml(html){ var doc=new DOMParser().parseFromString(html,"text/html"); var root=doc.querySelector("dl"); var items=[]; if(root){ walkDL(root,"",items); } if(!items.length){ doc.querySelectorAll("a[href]").forEach(function(a){ var href=a.getAttribute("href")||""; if(/^https?:/i.test(href)) items.push({title:(a.textContent||"").trim()||href,url:href,category:""}); }); } items=items.filter(function(it){ return isWebUrl(it.url); }); var folders={}; items.forEach(function(it){ var cat=it.category; if(!cat||ROOT_FOLDERS.indexOf(cat.toLowerCase())>-1){ cat=importRootCategory(cat)||smartCategory(it.url); } it.category=cat; folders[cat]=(folders[cat]||0)+1; }); if(!items.length){ toast(t("noBookmarksFile"),"err"); return; } ui.importData={items:items,folders:folders,source:ui.importSource||"file"}; showImportPreview(); }
function walkDL(dl,folder,out){ var dts=dl.querySelectorAll(":scope > dt"); dts.forEach(function(dt){ var h3=dt.querySelector(":scope > h3"), a=dt.querySelector(":scope > a"); if(h3){ var name=(h3.textContent||"").trim(); var sub=dt.querySelector(":scope > dl"); if(!sub){ var sib=dt.nextElementSibling; if(sib&&sib.tagName&&sib.tagName.toLowerCase()==="dl") sub=sib; } if(sub) walkDL(sub,name,out); } else if(a){ var href=a.getAttribute("href")||""; out.push({title:(a.textContent||"").trim()||href,url:href,category:folder}); } }); }
function showImportPreview(){ var d=ui.importData; var fnames=Object.keys(d.folders).sort(function(a,b){ return d.folders[b]-d.folders[a]; }); var dup=countDuplicates(d.items,d.source,ui.importMode), neu=d.items.length-dup;
  var html='<div class="seg imp-mode-seg" id="impSeg"><button data-mode="merge" class="'+(ui.importMode==="merge"?"on":"")+'">'+escapeHtml(t("syncModeMerge"))+'</button><button data-mode="separate" class="'+(ui.importMode==="separate"?"on":"")+'">'+escapeHtml(t("syncModeSeparate"))+'</button><button data-mode="replaceSource" class="'+(ui.importMode==="replaceSource"?"on":"")+'">'+escapeHtml(t("syncModeReplaceSource"))+'</button><button data-mode="replaceAll" class="'+(ui.importMode==="replaceAll"?"on":"")+'">'+escapeHtml(t("syncModeReplaceAll"))+'</button></div>';
  html+='<div class="imp-summary"><div class="stat"><div class="num">'+d.items.length+'</div><div class="lab">'+escapeHtml(t("bookmarksFound"))+'</div></div><div class="stat"><div class="num">'+fnames.length+'</div><div class="lab">'+escapeHtml(t("categoriesN"))+'</div></div><div class="stat"><div class="num">'+(ui.importMode==="merge"||ui.importMode==="separate"?neu:d.items.length)+'</div><div class="lab">'+escapeHtml((ui.importMode==="merge"||ui.importMode==="separate")?t("newToAdd"):t("total"))+'</div></div></div>';
  html+='<div class="folder-list">'; fnames.forEach(function(f){ html+='<div class="folder-row"><div class="fname"><span class="dot"></span>'+escapeHtml(f)+'</div><div class="fcount">'+d.folders[f]+'</div></div>'; }); html+='</div>';
  $("#importBody").innerHTML=html; $("#importSub").textContent=t("foldersBecome")+" "+(dup&&(ui.importMode==="merge"||ui.importMode==="separate")?t("dupSkipped",{n:dup}):t("reviewConfirm"));
  var nAdd=(ui.importMode==="merge"||ui.importMode==="separate"?neu:d.items.length);
  $("#importFoot").innerHTML='<button class="btn" data-close>'+escapeHtml(t("cancel"))+'</button><button class="btn primary" id="impConfirm">'+escapeHtml(t("importN",{n:nAdd}))+'</button>';
  $("#impSeg").addEventListener("click", function(e){ var b=e.target.closest("[data-mode]"); if(!b) return; ui.importMode=b.getAttribute("data-mode"); showImportPreview(); });
  var conf=$("#impConfirm"); if(conf) conf.addEventListener("click", doImport);
}
function normForDup(u){ return normalizeUrl(u).replace(/\/+$/,"").toLowerCase(); }
function countDuplicates(items,source,mode){ var existing={}; state.bookmarks.forEach(function(b){ var k=(mode==="separate"?(bookmarkSource(b)||"manual")+"|":"")+normForDup(b.url); existing[k]=true; }); var seen={},dup=0; items.forEach(function(it){ var k=(mode==="separate"?(source||"file")+"|":"")+normForDup(it.url); if(existing[k]||seen[k]){ dup++; } else { seen[k]=true; } }); return dup; }
function doImport(){
  var d=ui.importData; if(!d) return;
  var res;
  if(typeof applyBookmarkItems==="function") res=applyBookmarkItems(d.items,d.source||"file",ui.importMode);
  else res={added:0,skipped:0};
  ui.activeCat="All"; ui.importData=null; save(); closeOverlay("importOverlay"); render();
  toast(t("importedToast",{a:res.added})+(res.skipped?t("importedSkip",{s:res.skipped}):""),"ok");
}

/* ===== export ===== */
function exportBookmarks(){ if(!state.bookmarks.length){ toast(t("nothingToExport"),"err"); return; } var groups={}; state.categories.forEach(function(c){ groups[c]=[]; }); state.bookmarks.forEach(function(b){ (groups[b.category]=groups[b.category]||[]).push(b); }); var now=Math.floor(Date.now()/1000); var out='<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n'; Object.keys(groups).forEach(function(cat){ if(!groups[cat].length) return; out+='    <DT><H3 ADD_DATE="'+now+'">'+escapeHtml(cat)+'</H3>\n    <DL><p>\n'; groups[cat].forEach(function(b){ out+='        <DT><A HREF="'+escapeHtml(b.url)+'" ADD_DATE="'+now+'">'+escapeHtml(b.title)+'</A>\n'; }); out+='    </DL><p>\n'; }); out+='</DL><p>\n'; var blob=new Blob([out],{type:"text/html"}), a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=(state.settings.appName||"navi").toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-bookmarks.html"; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },100); toast(t("exportedToast",{n:state.bookmarks.length}),"ok"); }

/* ===== JSON 备份（canonical bookmarks.json：数据与界面分离后的统一数据载体） ===== */
var BACKUP_PREV_KEY="navi.dashboard.prev";
function clonePlain(obj){ return JSON.parse(JSON.stringify(obj)); }
function mergeDashboardSettings(baseSettings, incomingSettings, opts){
  opts=opts||{};
  var d=defaults(), base=baseSettings||d.settings, incoming=incomingSettings||{};
  var merged=Object.assign({}, d.settings, incoming);
  merged.widgets=Object.assign({}, d.settings.widgets, incoming.widgets||{});
  merged.widgetSize=Object.assign({}, d.settings.widgetSize, incoming.widgetSize||{});
  merged.background=Object.assign({}, d.settings.background, incoming.background||{});
  merged.engineUsage=Object.assign({}, d.settings.engineUsage, incoming.engineUsage||{});
  merged.worldClocks=Array.isArray(incoming.worldClocks)?clonePlain(incoming.worldClocks):[];
  merged.browserSyncLastSync=Object.assign({}, d.settings.browserSyncLastSync, incoming.browserSyncLastSync||{});
  merged.browserSyncCounts=Object.assign({}, d.settings.browserSyncCounts, incoming.browserSyncCounts||{});
  merged.pinnedCategories=Object.assign({}, d.settings.pinnedCategories, incoming.pinnedCategories||{});
  merged.categoryColors=Object.assign({}, d.settings.categoryColors, incoming.categoryColors||{});
  if(opts.preserveProfiles){
    merged.profiles=clonePlain(base.profiles||d.settings.profiles);
    merged.activeProfile=base.activeProfile||"local";
  } else if(Array.isArray(incoming.profiles)){
    merged.profiles=clonePlain(incoming.profiles);
  } else {
    merged.profiles=clonePlain(base.profiles||d.settings.profiles);
  }
  if(opts.preservePrivate){
    merged.aiKey=base.aiKey||"";
  }
  if(!Array.isArray(merged.widgetOrder)) merged.widgetOrder=d.settings.widgetOrder.slice();
  return merged;
}
function derivePayloadCats(items){
  var seen={}, out=[];
  (items||[]).forEach(function(b){ var c=cleanCatName(b.category)||"Uncategorized", k=c.toLowerCase(); if(!seen[k]){ seen[k]=1; out.push(c); } });
  return out;
}
function normalizeBookmarkPayload(b){
  var out=Object.assign({}, b||{});
  out.id=out.id||uid();
  out.title=String(out.title||out.name||getDomain(out.url||out.href||"")||"");
  out.url=normalizeUrl(out.url||out.href||"");
  out.category=cleanCatName(out.category||out.folder)||"Uncategorized";
  if(isReservedCat(out.category)) out.category="Uncategorized";
  out.description=typeof out.description==="string"?out.description:"";
  out.tags=Array.isArray(out.tags)?out.tags:[];
  out.favorite=!!out.favorite;
  if(typeof out.clicks!=="number") out.clicks=0;
  if(typeof out.lastOpened!=="number") out.lastOpened=0;
  return out;
}
function normalizeDashboardPayload(obj, opts){
  opts=opts||{};
  if(!obj||!Array.isArray(obj.bookmarks)) return null;
  var out={};
  out.bookmarks=obj.bookmarks.map(normalizeBookmarkPayload).filter(function(b){ return isWebUrl(b.url); });
  out.categories=Array.isArray(obj.categories)?obj.categories.map(cleanCatName).filter(Boolean):derivePayloadCats(out.bookmarks);
  out.trash=Array.isArray(obj.trash)?clonePlain(obj.trash):[];
  out.calendarEvents=Array.isArray(obj.calendarEvents)?clonePlain(obj.calendarEvents):null;
  out.theme=obj.theme||state.theme||"light";
  out.view=(obj.view==="list2"?"list":obj.view)||state.view||"grid";
  out.settings=obj.settings&&typeof obj.settings==="object" ? mergeDashboardSettings(state.settings, obj.settings, opts) : null;
  return out;
}
function buildBackup(){
  return { schema:"navi-bookmarks", version:3, app:state.settings.appName||"Navi", exportedAt:new Date().toISOString(),
    theme:state.theme, view:state.view, bookmarks:state.bookmarks, categories:state.categories, trash:state.trash, calendarEvents:state.calendarEvents, settings:state.settings };
}
function downloadBlob(text, mime, name){
  var blob=new Blob([text],{type:mime}), a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },100);
}
function exportJSON(){
  try{
    var stamp=new Date().toISOString().slice(0,10);
    downloadBlob(JSON.stringify(buildBackup(),null,2), "application/json",
      (state.settings.appName||"navi").toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+stamp+".json");
    toast(t("backupExported"),"ok");
  }catch(e){ toast(t("couldntRead"),"err"); }
}
function snapshotPrev(){ try{ localStorage.setItem(BACKUP_PREV_KEY, JSON.stringify({ bookmarks:state.bookmarks, categories:state.categories, trash:state.trash, calendarEvents:state.calendarEvents, theme:state.theme, view:state.view, settings:state.settings, savedAt:Date.now() })); }catch(e){} }
function applyBackupObj(obj){
  var data=normalizeDashboardPayload(obj,{});
  if(!data){ toast(t("backupInvalid"),"err"); return false; }
  snapshotPrev(); // 覆盖前先存一份，可“恢复上一个版本”
  state.bookmarks=data.bookmarks;
  state.categories=data.categories;
  state.trash=data.trash;
  if(Array.isArray(data.calendarEvents)) state.calendarEvents=data.calendarEvents;
  state.theme=data.theme;
  state.view=data.view;
  if(data.settings) state.settings=data.settings;
  ui.activeCat="All"; ui.selected={};
  rebuildCategories(); normalizeWidgetOrder();
  save(); applyI18n(); render();
  // 整份数据被换掉了，旧书签的存档就成了孤儿
  if(typeof snapPruneOrphans==="function") snapPruneOrphans();
  return true;
}
function importJSONFile(file){
  var r=new FileReader();
  r.onload=function(){ var obj; try{ obj=JSON.parse(String(r.result||"")); }catch(e){ toast(t("backupInvalid"),"err"); return; }
    if(!obj||!Array.isArray(obj.bookmarks)){ toast(t("backupInvalid"),"err"); return; }
    openConfirm(t("importJsonTitle"), t("importJsonMsg",{n:obj.bookmarks.length}), t("importJsonOk"), function(){ if(applyBackupObj(obj)) toast(t("backupImported",{n:state.bookmarks.length}),"ok"); });
  };
  r.onerror=function(){ toast(t("couldntRead"),"err"); };
  r.readAsText(file);
}
function restorePrev(){
  var raw=null; try{ raw=localStorage.getItem(BACKUP_PREV_KEY); }catch(e){}
  if(!raw){ toast(t("noPrevBackup"),""); return; }
  var obj; try{ obj=JSON.parse(raw); }catch(e){ toast(t("backupInvalid"),"err"); return; }
  openConfirm(t("restorePrevTitle"), t("restorePrevMsg"), t("restorePrevOk"), function(){ if(applyBackupObj(obj)) toast(t("prevRestored"),"ok"); });
}
if($("#exportJsonBtn")) $("#exportJsonBtn").addEventListener("click", exportJSON);
if($("#importJsonBtn")) $("#importJsonBtn").addEventListener("click", function(){ $("#jsonInput").click(); });
if($("#jsonInput")) $("#jsonInput").addEventListener("change", function(e){ var f=e.target.files&&e.target.files[0]; e.target.value=""; if(f) importJSONFile(f); });
if($("#restorePrevBtn")) $("#restorePrevBtn").addEventListener("click", restorePrev);
