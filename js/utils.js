/* utils.js — 通用工具函数 + i18n 应用 + 品牌/动画 */
"use strict";

/* ===== utils ===== */
function $(s,r){ return (r||document).querySelector(s); }
function $all(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function uid(){ return "b"+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function escapeHtml(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
function normalizeUrl(u){ u=(u||"").trim(); if(!u) return ""; if(!/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(u) && !/^[a-zA-Z]+:/.test(u)){ u="https://"+u; } return u; }
function isWebUrl(u){ try{ var p=new URL(normalizeUrl(u)).protocol.toLowerCase(); return p==="http:"||p==="https:"; }catch(e){ return false; } }
function cleanCatName(v){ return String(v||"").replace(/\s+/g," ").trim(); }
function chromeSafeCatName(s){ return cleanCatName(String(s||"").replace(/[<>:"/\\|?*]/g," ").substring(0,60)); }
function isReservedCat(v){ var c=cleanCatName(v).toLowerCase(); return c==="all"||c==="全部"||c==="todos"; }
function uniqueCatName(v, oldName){ var c=cleanCatName(v); if(!c||isReservedCat(c)) return ""; for(var i=0;i<state.categories.length;i++){ if(state.categories[i]!==oldName && state.categories[i].toLowerCase()===c.toLowerCase()) return ""; } return c; }
function cssEscape(s){ if(window.CSS&&CSS.escape) return CSS.escape(String(s)); return String(s).replace(/[^a-zA-Z0-9_-]/g,function(ch){ return "\\"+ch; }); }
function getDomain(u){ try{ return new URL(normalizeUrl(u)).hostname.replace(/^www\./,""); }catch(e){ return (u||"").replace(/^https?:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0]; } }
function prettyUrl(u){ try{ var o=new URL(normalizeUrl(u)); var p=(o.pathname+o.search).replace(/\/$/,""); return o.hostname.replace(/^www\./,"")+(p&&p!=="/"?p:""); }catch(e){ return u; } }
function faviconUrl(u){ var d=getDomain(u); if(!d) return ""; return "https://www.google.com/s2/favicons?sz=64&domain="+encodeURIComponent(d); }
function hashHue(s){ var h=0; s=s||""; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))%360; } return h; }
function byId(id){ for(var i=0;i<state.bookmarks.length;i++){ if(state.bookmarks[i].id===id) return state.bookmarks[i]; } return null; }

function save(){
  if(typeof oplogCapture==="function") oplogCapture();
  try{ localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch(e){
    // Likely quota — drop undo snapshots (largest payload) and retry once so data still persists.
    if(typeof oplogDropSnaps==="function") oplogDropSnaps();
    try{ localStorage.setItem(KEY, JSON.stringify(state)); return true; }catch(e2){ return false; }
  }
}
function load(){
  var raw=null; try{ raw=localStorage.getItem(KEY)||localStorage.getItem("navi.dashboard.v2"); }catch(e){}
  if(raw){ try{ var s=JSON.parse(raw); if(s&&Array.isArray(s.bookmarks)){
    var d=defaults();
    state.bookmarks=s.bookmarks; state.categories=Array.isArray(s.categories)?s.categories:[];
    state.trash=Array.isArray(s.trash)?s.trash:[];
    state.opLog=Array.isArray(s.opLog)?s.opLog:[];
    state.theme=s.theme||"light"; state.view=s.view||"grid";
    state.settings=Object.assign({}, d.settings, s.settings||{});
    state.settings.widgets=Object.assign({}, d.settings.widgets, (s.settings&&s.settings.widgets)||{});
    state.settings.widgetSize=Object.assign({}, d.settings.widgetSize, (s.settings&&s.settings.widgetSize)||{});
    state.settings.background=Object.assign({}, d.settings.background, (s.settings&&s.settings.background)||{});
    if(!(s.settings&&s.settings.motionMode)) state.settings.motionMode=(state.settings.lowPower===false&&state.settings.animations)?"smooth":"low";
    if(!Array.isArray(state.settings.widgetOrder)) state.settings.widgetOrder=d.settings.widgetOrder.slice();
    var migrated=migratePowerProfile();
    normalizeWidgetOrder();
    rebuildCategories(); if(migrated) save(); return;
  } }catch(e){} }
  seed();
}
function migratePowerProfile(){
  var s=state.settings, changed=false;
  if(s.motionMode!=="low" && s.motionMode!=="smooth"){
    s.motionMode=(s.lowPower===false && s.animations)?"smooth":"low";
    changed=true;
  }
  if(s.powerProfileVersion!==POWER_PROFILE_VERSION){
    if(s.powerProfileVersion==null){
      s.motionMode="low";
      s.glass=false;
      s.refraction=false;
      if(s.background&&s.background.type==="live") s.background.type="gradient";
    }
    syncMotionSettings();
    s.powerProfileVersion=POWER_PROFILE_VERSION;
    changed=true;
  }
  return changed;
}
function normalizeWidgetOrder(){
  var seen={}, o=[];
  state.settings.widgetOrder.forEach(function(k){ if(WKEYS.indexOf(k)>-1 && !seen[k]){ seen[k]=1; o.push(k); } });
  WKEYS.forEach(function(k){ if(!seen[k]){ seen[k]=1; o.push(k); } });
  state.settings.widgetOrder=o;
}
function seed(){
  var demo=[
    ["GitHub","https://github.com","Development","Code hosting and collaboration for developers."],
    ["Stack Overflow","https://stackoverflow.com","Development","Q&A community for programming questions."],
    ["MDN Web Docs","https://developer.mozilla.org","Development","Reference docs for web standards and APIs."],
    ["Gmail","https://mail.google.com","Productivity",""],["Google Calendar","https://calendar.google.com","Productivity",""],
    ["Notion","https://notion.so","Productivity","All-in-one notes, docs and project workspace."],
    ["YouTube","https://youtube.com","Media",""],["Spotify","https://open.spotify.com","Media",""],
    ["Reddit","https://reddit.com","Social",""],["Hacker News","https://news.ycombinator.com","Reading",""],
    ["Wikipedia","https://wikipedia.org","Reading",""],["The Verge","https://theverge.com","Reading","Tech news, reviews and culture."]
  ];
  state.categories=["Development","Productivity","Media","Social","Reading"];
  state.bookmarks=demo.map(function(d){ return { id:uid(), title:d[0], url:d[1], category:d[2], description:d[3]||smartSummary(d[1],d[0],d[2],""), clicks:0, lastOpened:0, _seed:true }; });
}
function rebuildCategories(){
  var seen={}, cats=[];
  state.categories.forEach(function(c){ c=cleanCatName(c); if(c&&!isReservedCat(c)&&!seen[c.toLowerCase()]){ seen[c.toLowerCase()]=true; cats.push(c); } });
  state.categories=cats;
  var have={}; state.categories.forEach(function(c){ have[c]=true; });
  state.bookmarks.forEach(function(b){
    if(!b.id) b.id=uid();
    b.title=String(b.title||getDomain(b.url)||b.url||"");
    b.url=normalizeUrl(b.url||"");
    b.category=cleanCatName(b.category)||"Uncategorized";
    if(isReservedCat(b.category)) b.category="Uncategorized";
    if(typeof b.clicks!=="number") b.clicks=0; if(typeof b.lastOpened!=="number") b.lastOpened=0;
    if(typeof b.description!=="string"||!b.description.trim()) b.description=smartSummary(b.url,b.title,b.category,"");
    if(!have[b.category]){ have[b.category]=true; state.categories.push(b.category); }
  });
  state.categories=state.categories.filter(function(c){ return !!c&&!isReservedCat(c); });
}

/* ===== i18n apply ===== */
function applyI18n(){
  document.documentElement.lang = state.settings.lang;
  $all("[data-i18n]").forEach(function(el){ el.textContent = t(el.getAttribute("data-i18n")); });
  $all("[data-i18n-ph]").forEach(function(el){ el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
  $all("[data-i18n-title]").forEach(function(el){ el.setAttribute("title", t(el.getAttribute("data-i18n-title"))); });
  $("#langCode").textContent = LANGCODE[state.settings.lang];
}

/* ===== performance / brand / anim ===== */
var _scrollPowerTimer=0, _powerGuardsReady=false;
function currentMotionMode(){ return state.settings.motionMode==="smooth"?"smooth":"low"; }
function syncMotionSettings(){
  var smooth=currentMotionMode()==="smooth";
  state.settings.lowPower=!smooth;
  state.settings.animations=smooth;
}
function setMotionMode(mode){
  state.settings.motionMode=mode==="smooth"?"smooth":"low";
  syncMotionSettings();
  applyPerformanceMode();
  applyAnim();
  save();
  syncMotionUI();
}
function syncMotionUI(){
  var mode=currentMotionMode();
  $all('#motionSeg [data-motion]').forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-motion")===mode); });
}
function applyPerformanceMode(){
  var mode=currentMotionMode();
  document.body.classList.toggle("low-power", mode==="low");
  document.body.classList.toggle("smooth-motion", mode==="smooth");
}
function markPowerBusy(){
  document.body.classList.add("is-scrolling");
  if(_scrollPowerTimer) clearTimeout(_scrollPowerTimer);
  _scrollPowerTimer=setTimeout(function(){ document.body.classList.remove("is-scrolling"); _scrollPowerTimer=0; },180);
}
function initPerformanceGuards(){
  if(_powerGuardsReady) return; _powerGuardsReady=true;
  window.addEventListener("scroll", markPowerBusy, {passive:true,capture:true});
  window.addEventListener("wheel", markPowerBusy, {passive:true});
  window.addEventListener("touchmove", markPowerBusy, {passive:true});
  document.addEventListener("visibilitychange", function(){
    document.body.classList.toggle("tab-hidden", document.hidden);
  });
}
function applyAnim(){ document.body.classList.toggle("no-anim", currentMotionMode()==="low" || !state.settings.animations); }
function renderBrand(){
  var s=state.settings;
  $("#brandName").textContent=s.appName||"Navi";
  $("#brandTag").textContent=s.tagline||t("tagline");
  document.title=(s.appName||"Navi")+" — "+t("dashboard");
  $("#brandLogo").innerHTML = s.logo? '<img src="'+escapeHtml(s.logo)+'" alt="logo"/>' : ICONS.bookmark;
}
