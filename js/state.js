/* state.js — 应用状态、localStorage 持久化（load/save/defaults） */
"use strict";

/* ===== state ===== */
var KEY = "navi.dashboard.v3";
var POWER_PROFILE_VERSION = 2;
var WKEYS = ["clock","search","weather","calendar","frequent","recent","monitor"];
function defaults(){
  return {
    bookmarks:[], categories:[], trash:[], opLog:[], theme:"light", view:"grid",
    settings:{
      appName:"Navi", tagline:"", logo:null, lang:"en", motionMode:"low", lowPower:true, animations:false,
      widgetsCollapsed:false, widgetsHidden:false, clockSeconds:false, showHolidays:true, categoryLayout:"tabs",
      widgets:{ clock:true, search:true, weather:true, calendar:true, frequent:true, recent:true, monitor:false },
      widgetOrder:["clock","search","weather","calendar","frequent","recent","monitor"],
      widgetSize:{ clock:1, search:2, weather:1, calendar:1, frequent:1, recent:1, monitor:2 },
      weather:null, weatherUnit:"c", searchEngine:"google", engineUsage:{},
      chromeSync:false, chromeSyncReplace:false, chromeSyncLastSync:0, chromeSyncCount:0,
      trashRetention:7, aiProvider:"local", aiKey:"",
      glass:false, glassOpacity:45, refraction:false, background:{ type:"gradient", live:"aurora", image:null },
      autoThemeCoords:null,
      powerProfileVersion:POWER_PROFILE_VERSION
    }
  };
}
var state = defaults();
var ui = { activeCat:"All", query:"", selectMode:false, selected:{}, editingId:null, importData:null, importMode:"merge", calMonth:new Date().getMonth(), calYear:new Date().getFullYear(), geoTried:false, ddOpen:false };
var clockTimer=null, weatherCache=null;
