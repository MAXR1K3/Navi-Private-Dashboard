/* state.js — 应用状态、localStorage 持久化（load/save/defaults） */
"use strict";

/* ===== state ===== */
var KEY = "navi.dashboard.v3";
var WKEYS = ["clock","search","weather","calendar","frequent","recent"];
function defaults(){
  return {
    bookmarks:[], categories:[], trash:[], theme:"light", view:"grid",
    settings:{
      appName:"Navi", tagline:"", logo:null, lang:"en", animations:true,
      widgetsCollapsed:false, widgetsHidden:false, clockSeconds:false, showHolidays:true, categoryLayout:"tabs",
      widgets:{ clock:true, search:true, weather:true, calendar:true, frequent:true, recent:true },
      widgetOrder:["clock","search","weather","calendar","frequent","recent"],
      widgetSize:{ clock:1, search:2, weather:1, calendar:1, frequent:1, recent:1 },
      weather:null, weatherUnit:"c", searchEngine:"google", engineUsage:{},
      chromeSync:false, chromeSyncLastSync:0, chromeSyncCount:0,
      trashRetention:7, aiProvider:"local", aiKey:""
    }
  };
}
var state = defaults();
var ui = { activeCat:"All", query:"", selectMode:false, selected:{}, editingId:null, importData:null, importMode:"merge", calMonth:new Date().getMonth(), calYear:new Date().getFullYear(), geoTried:false, ddOpen:false };
var clockTimer=null, weatherCache=null;
