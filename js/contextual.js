/* contextual.js — 时段感知：按当前是「工作时段」还是「休闲时段」，
   把对应分类的书签在「全部」视图里前置。
   刻意保守：默认关闭；只改排序不改筛选（不会藏起任何东西）；
   始终显示一个可点掉的提示条，避免"面板莫名其妙变了"的困惑。 */
"use strict";

var SCENES=["work","leisure"];
var _sceneMuted=false;   // 本次会话内临时关掉（不写盘）

function ctxCfg(){
  var s=state.settings;
  if(!s.contextual) s.contextual={ on:false, workStart:9, workEnd:18, eveStart:18, eveEnd:23 };
  return s.contextual;
}
function categoryScenes(){
  if(!state.settings.categoryScenes) state.settings.categoryScenes={};
  return state.settings.categoryScenes;
}
function categoryScene(cat){ return categoryScenes()[cat]||""; }
function setCategoryScene(cat, scene){
  var m=categoryScenes();
  if(scene) m[cat]=scene; else delete m[cat];
  save(); render();
}

/* 当前时段：工作日的工作时间 → work；每天的晚间与周末白天 → leisure；其余为空 */
function currentScene(now){
  var c=ctxCfg(); if(!c.on) return "";
  var d=now||new Date(), h=d.getHours()+d.getMinutes()/60, day=d.getDay();
  var weekend=(day===0||day===6);
  if(!weekend && h>=c.workStart && h<c.workEnd) return "work";
  if(h>=c.eveStart && h<c.eveEnd) return "leisure";
  if(weekend && h>=c.workStart && h<c.eveStart) return "leisure";
  return "";
}
function activeScene(){ return _sceneMuted?"":currentScene(); }
function sceneCategories(scene){
  if(!scene) return [];
  var m=categoryScenes();
  return Object.keys(m).filter(function(cat){ return m[cat]===scene && state.categories.indexOf(cat)>-1; });
}
function sceneLabel(scene){ return scene==="work"?t("sceneWork"):scene==="leisure"?t("sceneLeisure"):""; }
/* 该书签是否属于当前时段 */
function inActiveScene(b){
  var s=activeScene(); if(!s) return false;
  return categoryScene(b.category)===s;
}
/* 当前时段是否真的会影响排序（有分类被指派才算数） */
function sceneActiveEffective(){
  var s=activeScene();
  return (s && sceneCategories(s).length) ? s : "";
}

/* ----- 顶部提示条：让"前置"这件事是可见、可关闭的 ----- */
function renderSceneChip(){
  var host=$("#sceneChip"); if(!host) return;
  var s=sceneActiveEffective();
  if(!s || ui.activeCat!=="All" || ui.query.trim()){ host.hidden=true; host.innerHTML=""; return; }
  var cats=sceneCategories(s), n=state.bookmarks.filter(function(b){ return cats.indexOf(b.category)>-1; }).length;
  host.hidden=false;
  host.className="scene-chip "+s;
  host.innerHTML=ICONS.clock+'<span>'+escapeHtml(t("sceneBoosting",{scene:sceneLabel(s),n:n}))+'</span>'+
    '<button type="button" class="scene-off" data-scene-off aria-label="'+escapeHtml(t("sceneTurnOff"))+'" title="'+escapeHtml(t("sceneTurnOff"))+'">&#x2715;</button>';
}
if($("#sceneChip")) $("#sceneChip").addEventListener("click", function(e){
  if(e.target.closest("[data-scene-off]")){ _sceneMuted=true; renderContent(); toast(t("sceneMuted"),""); }
});

/* 时段边界到点时自动重排一次（不轮询，按剩余分钟数定时） */
var _sceneTimer=null;
function scheduleSceneCheck(){
  if(_sceneTimer) clearTimeout(_sceneTimer);
  if(!ctxCfg().on || document.hidden) return;
  var now=new Date(), mins=60-now.getMinutes();
  _sceneTimer=setTimeout(function(){
    var before=sceneActiveEffective();
    _sceneMuted=false;
    if(sceneActiveEffective()!==before) renderContent();
    scheduleSceneCheck();
  }, Math.max(1,mins)*60000);
}
document.addEventListener("visibilitychange", function(){ if(!document.hidden) scheduleSceneCheck(); });
function initContextual(){ scheduleSceneCheck(); }
