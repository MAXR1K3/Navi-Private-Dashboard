/* state.js — 应用状态、localStorage 持久化（load/save/defaults） */
"use strict";

/* ===== state ===== */
var KEY = "navi.dashboard.v3";
var POWER_PROFILE_VERSION = 2;
var WKEYS = ["clock","search","overview","weather","netinfo","calendar","frequent","recent","notes","monitor"];
function defaultBrowserSyncSource(){
  if(typeof navigator!=="undefined" && /Edg\//.test(navigator.userAgent||"")) return "edge";
  return "chrome";
}
function defaults(){
  return {
    bookmarks:[], categories:[], trash:[], calendarEvents:[], opLog:[], theme:"light", view:"grid",
    settings:{
      appName:"Navi", tagline:"", logo:null, lang:"en", motionMode:"low", lowPower:true, animations:false,
      widgetsCollapsed:false, widgetsHidden:false, clockSeconds:false, clock24h:false, worldClockMode:"stack", worldClocks:[], showHolidays:true, calendarShowDoneBadges:false, categoryLayout:"tabs", hideHeaderOnScroll:false, hideHeaderOnScrollUserSet:false,
      widgets:{ clock:true, search:true, overview:true, weather:true, netinfo:true, calendar:true, frequent:true, recent:true, notes:true, monitor:false },
      widgetOrder:["clock","search","overview","weather","netinfo","calendar","frequent","recent","notes","monitor"],
      widgetSize:{ clock:1, search:2, overview:1, weather:1, netinfo:1, calendar:1, frequent:1, recent:1, notes:2, monitor:2 },
      notes:"",
      weather:null, weatherUnit:"c", searchEngine:"google", engineUsage:{},
      chromeSync:false, chromeSyncReplace:false, chromeSyncLastSync:0, chromeSyncCount:0,
      browserSyncSource:defaultBrowserSyncSource(), browserSyncMode:"merge", browserSyncLastSync:{}, browserSyncCounts:{}, pinnedCategories:{}, categoryColors:{},
      trashRetention:7, logRetention:2, aiProvider:"local", aiKey:"", privacy:false,
      glass:false, glassOpacity:45, refraction:false, background:{ type:"gradient", live:"aurora", image:null, wallpaperCat:"nature", wallpaperSource:"unsplash", wallpaperRotate:30 },
      autoThemeCoords:null,
      profiles:[{ id:"local", name:"Local", type:"local" }], activeProfile:"local",
      powerProfileVersion:POWER_PROFILE_VERSION
    }
  };
}
var state = defaults();
var ui = { activeCat:"All", query:"", tagFilter:"", selectMode:false, selected:{}, editingId:null, importData:null, importMode:"merge", calMonth:new Date().getMonth(), calYear:new Date().getFullYear(), calSelected:null, geoTried:false, ddOpen:false };
var clockTimer=null, weatherCache=null, netInfoCache=null;
