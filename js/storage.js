/* storage.js — 主数据边界与恢复版本 */
"use strict";

var NAVI_SCHEMA_VERSION=4;
var NAVI_LEGACY_KEY="navi.dashboard.v2";

function naviPlainObject(value){
  return !!value && Object.prototype.toString.call(value)==="[object Object]";
}
function validateDashboardState(value){
  if(!naviPlainObject(value)||!Array.isArray(value.bookmarks)||!naviPlainObject(value.settings)) return false;
  var arrays=["categories","trash","calendarEvents","opLog"];
  for(var i=0;i<arrays.length;i++){
    var field=arrays[i];
    if(value[field]!=null&&!Array.isArray(value[field])) return false;
  }
  if(value.theme!=null&&value.theme!=="light"&&value.theme!=="dark") return false;
  var view=value.view==="list2"?"list":value.view;
  if(view!=null&&view!=="grid"&&view!=="list"&&view!=="compact") return false;
  return true;
}
function parseDashboardRaw(raw){
  try{
    var value=JSON.parse(raw);
    return validateDashboardState(value)
      ?{ok:true,state:value}
      :{ok:false,reason:"invalid-structure"};
  }catch(e){
    return {ok:false,reason:"invalid-json"};
  }
}
function inspectPrimary(){
  var primary=null,legacy=null;
  try{
    primary=localStorage.getItem(KEY);
    legacy=localStorage.getItem(NAVI_LEGACY_KEY);
  }catch(e){
    return {status:"recovery",reason:"read-failed",raw:"",key:KEY};
  }
  if(primary==null&&legacy==null) return {status:"first-run"};
  var key=primary!=null?KEY:NAVI_LEGACY_KEY;
  var raw=primary!=null?primary:legacy;
  var parsed=parseDashboardRaw(raw);
  return parsed.ok
    ?{status:"ok",state:parsed.state,raw:raw,key:key}
    :{status:"recovery",reason:parsed.reason,raw:raw,key:key};
}

var NaviStorage={
  validateDashboardState:validateDashboardState,
  inspectPrimary:inspectPrimary
};
