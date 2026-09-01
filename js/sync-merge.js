/* sync-merge.js — 同步快照规范化、墓碑跟踪与纯三方决策 */
"use strict";

function syncClone(value){
  if(value===undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
function syncObject(value){
  return !!value&&Object.prototype.toString.call(value)==="[object Object]";
}
function syncStable(value){
  if(Array.isArray(value)) return value.map(syncStable);
  if(syncObject(value)){
    var out={};
    Object.keys(value).sort().forEach(function(key){ out[key]=syncStable(value[key]); });
    return out;
  }
  return value;
}
function syncSame(a,b){
  return JSON.stringify(syncStable(a))===JSON.stringify(syncStable(b));
}
function syncBookmarkContent(bookmark){
  bookmark=bookmark||{};
  return {
    id:String(bookmark.id||""),
    url:String(bookmark.url||""),
    title:String(bookmark.title||""),
    category:String(bookmark.category||"Uncategorized"),
    description:String(bookmark.description||""),
    tags:Array.isArray(bookmark.tags)?bookmark.tags.map(String):[],
    favorite:!!bookmark.favorite,
    pinned:!!bookmark.pinned
  };
}
function syncCanonicalTombstones(value,liveIds){
  var transport=syncObject(value.sync)?value.sync:{}, local=syncObject(value.syncMeta)?value.syncMeta:{};
  var rows=Array.isArray(value.tombstones)?value.tombstones:
    (Array.isArray(transport.tombstones)?transport.tombstones:(Array.isArray(local.tombstones)?local.tombstones:[]));
  var byId={};
  rows.forEach(function(row){
    if(!row||row.id==null) return;
    var id=String(row.id),deletedAt=Number(row.deletedAt)||0;
    if(!id||liveIds[id]) return;
    if(!byId[id]||deletedAt>byId[id].deletedAt) byId[id]={id:id,deletedAt:deletedAt};
  });
  return Object.keys(byId).sort().map(function(id){ return byId[id]; });
}
function syncCanonicalize(value){
  if(!syncObject(value)||!Array.isArray(value.bookmarks)) return null;
  var seen={},bookmarks=[];
  for(var i=0;i<value.bookmarks.length;i++){
    var source=value.bookmarks[i];
    if(!syncObject(source)) return null;
    var id=String(source.id||""),url=String(source.url||"");
    if(!id||!url||seen[id]) return null;
    seen[id]=true;
    var bookmark=Object.assign({},syncClone(source),syncBookmarkContent(source));
    bookmark.updatedAt=Number(source.updatedAt)||0;
    bookmark.clicks=Number(source.clicks)||0;
    bookmark.lastOpened=Number(source.lastOpened)||0;
    bookmarks.push(bookmark);
  }
  var categories=Array.isArray(value.categories)?value.categories.map(String):[];
  if(!categories.length){
    var cats={};
    bookmarks.forEach(function(bookmark){
      if(!cats[bookmark.category]){ cats[bookmark.category]=true; categories.push(bookmark.category); }
    });
  }
  return {
    version:4,
    bookmarks:bookmarks,
    order:bookmarks.map(function(bookmark){ return bookmark.id; }),
    categories:categories,
    tombstones:syncCanonicalTombstones(value,seen),
    calendarEvents:Array.isArray(value.calendarEvents)?syncClone(value.calendarEvents):[],
    theme:value.theme||"light",
    view:(value.view==="list2"?"list":value.view)||"grid",
    settings:syncObject(value.settings)?syncClone(value.settings):null
  };
}
function syncFromState(value){ return syncCanonicalize(value); }
function syncTrackLocal(previousState,nextState,now){
  var previous=syncCanonicalize(previousState||{bookmarks:[]})||{bookmarks:[],tombstones:[]};
  var next=syncClone(nextState||{}),oldById={},live={},tombstones={};
  previous.bookmarks.forEach(function(bookmark){ oldById[bookmark.id]=bookmark; });
  previous.tombstones.forEach(function(row){ tombstones[row.id]=syncClone(row); });
  syncCanonicalTombstones(next,{}).forEach(function(row){
    if(!tombstones[row.id]||row.deletedAt>tombstones[row.id].deletedAt) tombstones[row.id]=row;
  });
  if(!Array.isArray(next.bookmarks)) next.bookmarks=[];
  next.bookmarks.forEach(function(bookmark){
    var id=String(bookmark&&bookmark.id||"");
    if(!id) return;
    live[id]=true;
    var old=oldById[id];
    if(!old||!syncSame(syncBookmarkContent(old),syncBookmarkContent(bookmark))) bookmark.updatedAt=now;
    else bookmark.updatedAt=Number(old.updatedAt)||0;
    delete tombstones[id];
  });
  previous.bookmarks.forEach(function(bookmark){
    if(!live[bookmark.id]&&!tombstones[bookmark.id]) tombstones[bookmark.id]={id:bookmark.id,deletedAt:now};
  });
  next.syncMeta=Object.assign({},syncObject(next.syncMeta)?next.syncMeta:{},{
    tombstones:Object.keys(tombstones).sort().map(function(id){ return tombstones[id]; })
  });
  return next;
}
function syncRecordSame(a,b){
  if(!a||!b) return a===b;
  return syncSame(syncBookmarkContent(a),syncBookmarkContent(b));
}
function syncMergeActivity(record,a,b){
  if(!record) return null;
  var out=syncClone(record),left=a||{},right=b||{};
  out.clicks=Math.max(Number(left.clicks)||0,Number(right.clicks)||0,Number(out.clicks)||0);
  out.lastOpened=Math.max(Number(left.lastOpened)||0,Number(right.lastOpened)||0,Number(out.lastOpened)||0);
  out.updatedAt=Math.max(Number(out.updatedAt)||0,
    syncRecordSame(a,b)?Math.max(Number(left.updatedAt)||0,Number(right.updatedAt)||0):Number(out.updatedAt)||0);
  return out;
}
function syncById(rows){
  var out={}; (rows||[]).forEach(function(row){ out[row.id]=row; }); return out;
}
function syncTombstoneMap(rows){
  var out={};
  (rows||[]).forEach(function(row){
    if(!row||!row.id) return;
    if(!out[row.id]||(Number(row.deletedAt)||0)>out[row.id].deletedAt) out[row.id]={id:row.id,deletedAt:Number(row.deletedAt)||0};
  });
  return out;
}
function syncChoice(key,kind,label,base,local,remote,conflicts,same){
  same=same||syncSame;
  if(same(local,remote)) return {value:syncClone(local)};
  if(same(local,base)) return {value:syncClone(remote)};
  if(same(remote,base)) return {value:syncClone(local)};
  conflicts.push({key:key,kind:kind,label:label,base:syncClone(base),local:syncClone(local),remote:syncClone(remote)});
  return {conflict:true};
}
function syncAppendUnique(target,source,allowed){
  var seen={}; target.forEach(function(id){ seen[id]=true; });
  (source||[]).forEach(function(id){ if((!allowed||allowed[id])&&!seen[id]){ seen[id]=true; target.push(id); } });
  return target;
}
function syncOrderDecision(base,local,remote,possible,conflicts){
  var baseMap=syncById(base.bookmarks),localMap=syncById(local.bookmarks),remoteMap=syncById(remote.bookmarks);
  var baseInLocal=base.order.filter(function(id){ return !!localMap[id]; });
  var localBaseOrder=local.order.filter(function(id){ return !!baseMap[id]; });
  var baseInRemote=base.order.filter(function(id){ return !!remoteMap[id]; });
  var remoteBaseOrder=remote.order.filter(function(id){ return !!baseMap[id]; });
  var localChanged=!syncSame(baseInLocal,localBaseOrder);
  var remoteChanged=!syncSame(baseInRemote,remoteBaseOrder);
  var chosen=[];
  if(localChanged&&remoteChanged&&!syncSame(localBaseOrder,remoteBaseOrder)){
    conflicts.push({key:"order",kind:"order",label:"Bookmark order",base:base.order.slice(),local:local.order.slice(),remote:remote.order.slice()});
    chosen=base.order.filter(function(id){ return !!possible[id]; });
    syncAppendUnique(chosen,local.order,possible); syncAppendUnique(chosen,remote.order,possible);
    return chosen;
  }
  if(localChanged) chosen=local.order.filter(function(id){ return !!possible[id]; });
  else if(remoteChanged) chosen=remote.order.filter(function(id){ return !!possible[id]; });
  else chosen=base.order.filter(function(id){ return !!possible[id]; });
  syncAppendUnique(chosen,local.order,possible); syncAppendUnique(chosen,remote.order,possible);
  return chosen;
}
function syncCandidateObject(bookmarks,order,categories,tombstones,calendarEvents,settingsGroup){
  var byId=syncById(bookmarks),ordered=[];
  order.forEach(function(id){ if(byId[id]){ ordered.push(byId[id]); delete byId[id]; } });
  Object.keys(byId).sort().forEach(function(id){ ordered.push(byId[id]); order.push(id); });
  return {
    version:4,bookmarks:ordered,order:order.slice(),categories:syncClone(categories||[]),
    tombstones:Object.keys(tombstones).sort().map(function(id){ return tombstones[id]; }),
    calendarEvents:syncClone(calendarEvents||[]),theme:settingsGroup.theme||"light",
    view:settingsGroup.view||"grid",settings:syncClone(settingsGroup.settings)
  };
}
function syncMerge(baseValue,localValue,remoteValue){
  var base=syncCanonicalize(baseValue),local=syncCanonicalize(localValue),remote=syncCanonicalize(remoteValue);
  if(!base||!local||!remote) return {candidate:null,conflicts:[{key:"invalid",kind:"invalid",label:"Invalid data"}],stats:{added:0,updated:0,deleted:0},remoteChanged:true,localChanged:true};
  var baseBy=syncById(base.bookmarks),localBy=syncById(local.bookmarks),remoteBy=syncById(remote.bookmarks);
  var localT=syncTombstoneMap(local.tombstones),remoteT=syncTombstoneMap(remote.tombstones),baseT=syncTombstoneMap(base.tombstones);
  var ids={},possible={},records={},tombstones={},conflicts=[];
  [base.bookmarks,local.bookmarks,remote.bookmarks,base.tombstones,local.tombstones,remote.tombstones].forEach(function(rows){
    (rows||[]).forEach(function(row){ ids[row.id]=true; });
  });
  Object.keys(ids).sort().forEach(function(id){
    var before=baseBy[id]||null,left=localBy[id]||null,right=remoteBy[id]||null;
    var decision=syncChoice("bookmark:"+id,"bookmark",(left||right||before||{}).title||id,before,left,right,conflicts,syncRecordSame);
    if(decision.conflict){
      var conflict=conflicts[conflicts.length-1];
      conflict.recordIds=[id];
      conflict.localDeletedAt=localT[id]&&localT[id].deletedAt||0;
      conflict.remoteDeletedAt=remoteT[id]&&remoteT[id].deletedAt||0;
      if(left||right) possible[id]=true;
      return;
    }
    if(decision.value){ records[id]=syncMergeActivity(decision.value,left,right); possible[id]=true; }
    else {
      var deletedAt=Math.max(localT[id]&&localT[id].deletedAt||0,remoteT[id]&&remoteT[id].deletedAt||0,baseT[id]&&baseT[id].deletedAt||0);
      if(before||deletedAt) tombstones[id]={id:id,deletedAt:deletedAt};
    }
  });
  var order=syncOrderDecision(base,local,remote,possible,conflicts);
  var categoriesChoice=syncChoice("categories","categories","Categories",base.categories,local.categories,remote.categories,conflicts);
  var calendarChoice=syncChoice("calendarEvents","calendarEvents","Calendar",base.calendarEvents,local.calendarEvents,remote.calendarEvents,conflicts);
  var baseSettings={theme:base.theme,view:base.view,settings:base.settings};
  var localSettings={theme:local.theme,view:local.view,settings:local.settings};
  var remoteSettings={theme:remote.theme,view:remote.view,settings:remote.settings};
  var settingsChoice=syncChoice("settings","settings","Interface settings",baseSettings,localSettings,remoteSettings,conflicts);
  var candidate=syncCandidateObject(Object.keys(records).map(function(id){return records[id];}),order,
    categoriesChoice.conflict?base.categories:categoriesChoice.value,tombstones,
    calendarChoice.conflict?base.calendarEvents:calendarChoice.value,
    settingsChoice.conflict?baseSettings:settingsChoice.value);
  var stats={added:0,updated:0,deleted:0},candidateBy=syncById(candidate.bookmarks);
  Object.keys(candidateBy).forEach(function(id){
    if(!baseBy[id]) stats.added++;
    else if(!syncRecordSame(baseBy[id],candidateBy[id])) stats.updated++;
  });
  Object.keys(baseBy).forEach(function(id){ if(!candidateBy[id]&&!possible[id]) stats.deleted++; });
  return {candidate:candidate,conflicts:conflicts,stats:stats,
    remoteChanged:!syncSame(base,remote),localChanged:!syncSame(base,local)};
}
function syncNormUrl(value){
  try{
    var parsed=new URL(String(value||""));
    parsed.protocol=parsed.protocol.toLowerCase(); parsed.hostname=parsed.hostname.toLowerCase();
    parsed.pathname=parsed.pathname.replace(/\/+$/g,"")||"/";
    var out=parsed.toString(); return out.replace(/\/$/,"");
  }catch(e){ return String(value||"").trim().toLowerCase().replace(/\/+$/g,""); }
}
function syncBootstrap(localValue,remoteValue){
  var local=syncCanonicalize(localValue),remote=syncCanonicalize(remoteValue);
  if(!local||!remote) return {candidate:null,conflicts:[{key:"invalid",kind:"invalid",label:"Invalid data"}],stats:{added:0,updated:0,deleted:0}};
  var remoteUsed={},remoteById=syncById(remote.bookmarks),remoteByUrl={};
  remote.bookmarks.forEach(function(bookmark){ remoteByUrl[syncNormUrl(bookmark.url)]=bookmark; });
  var records=[],conflicts=[],possible={},tombstones=syncTombstoneMap(local.tombstones.concat(remote.tombstones));
  local.bookmarks.forEach(function(left){
    var right=remoteById[left.id]||remoteByUrl[syncNormUrl(left.url)]||null;
    if(!right){ records.push(syncClone(left)); possible[left.id]=true; return; }
    remoteUsed[right.id]=true;
    if(syncRecordSame(left,right)){
      var merged=syncMergeActivity(left,left,right); records.push(merged); possible[merged.id]=true; return;
    }
    var key=left.id===right.id?"bookmark:"+left.id:"bookmark-url:"+syncNormUrl(left.url);
    conflicts.push({key:key,kind:"bookmark",label:left.title||right.title||left.url,base:null,local:syncClone(left),remote:syncClone(right),recordIds:[left.id,right.id],localDeletedAt:0,remoteDeletedAt:0});
    possible[left.id]=true; possible[right.id]=true;
  });
  remote.bookmarks.forEach(function(right){ if(!remoteUsed[right.id]){ records.push(syncClone(right)); possible[right.id]=true; } });
  Object.keys(tombstones).forEach(function(id){
    var live=records.find(function(bookmark){return bookmark.id===id;})||local.bookmarks.find(function(bookmark){return bookmark.id===id;})||remote.bookmarks.find(function(bookmark){return bookmark.id===id;});
    if(live){
      conflicts.push({key:"bookmark:"+id,kind:"bookmark",label:live.title||id,base:null,
        local:local.bookmarks.find(function(bookmark){return bookmark.id===id;})||null,
        remote:remote.bookmarks.find(function(bookmark){return bookmark.id===id;})||null,recordIds:[id],
        localDeletedAt:(syncTombstoneMap(local.tombstones)[id]||{}).deletedAt||0,
        remoteDeletedAt:(syncTombstoneMap(remote.tombstones)[id]||{}).deletedAt||0});
      records=records.filter(function(bookmark){return bookmark.id!==id;});
    }
  });
  var order=[]; syncAppendUnique(order,local.order,possible); syncAppendUnique(order,remote.order,possible);
  var categories=[]; syncAppendUnique(categories,local.categories); syncAppendUnique(categories,remote.categories);
  var calendarChoice=syncSame(local.calendarEvents,remote.calendarEvents)?{value:local.calendarEvents}:{conflict:true};
  if(calendarChoice.conflict) conflicts.push({key:"calendarEvents",kind:"calendarEvents",label:"Calendar",base:null,local:local.calendarEvents,remote:remote.calendarEvents});
  var localSettings={theme:local.theme,view:local.view,settings:local.settings},remoteSettings={theme:remote.theme,view:remote.view,settings:remote.settings};
  var settingsChoice=syncSame(localSettings,remoteSettings)?{value:localSettings}:{conflict:true};
  if(settingsChoice.conflict) conflicts.push({key:"settings",kind:"settings",label:"Interface settings",base:null,local:localSettings,remote:remoteSettings});
  var candidate=syncCandidateObject(records,order,categories,tombstones,
    calendarChoice.conflict?[]:calendarChoice.value,settingsChoice.conflict?localSettings:settingsChoice.value);
  return {candidate:candidate,conflicts:conflicts,stats:{added:records.length,updated:0,deleted:0},remoteChanged:true,localChanged:true};
}
function syncResolve(result,choices){
  if(!result||!result.candidate||!Array.isArray(result.conflicts)) return null;
  choices=choices||{};
  for(var i=0;i<result.conflicts.length;i++){
    if(choices[result.conflicts[i].key]!=="local"&&choices[result.conflicts[i].key]!=="remote") return null;
  }
  var candidate=syncClone(result.candidate),records=syncById(candidate.bookmarks),tombstones=syncTombstoneMap(candidate.tombstones);
  result.conflicts.forEach(function(conflict){
    var side=choices[conflict.key],value=syncClone(conflict[side]);
    if(conflict.kind==="bookmark"){
      (conflict.recordIds||[]).forEach(function(id){ delete records[id]; delete tombstones[id]; });
      if(value){ records[value.id]=syncMergeActivity(value,conflict.local,conflict.remote); delete tombstones[value.id]; }
      else {
        var id=(conflict.recordIds||[])[0],deletedAt=side==="local"?conflict.localDeletedAt:conflict.remoteDeletedAt;
        if(id) tombstones[id]={id:id,deletedAt:Number(deletedAt)||0};
      }
    }else if(conflict.kind==="order") candidate.order=Array.isArray(value)?value.slice():candidate.order;
    else if(conflict.kind==="categories") candidate.categories=syncClone(value||[]);
    else if(conflict.kind==="calendarEvents") candidate.calendarEvents=syncClone(value||[]);
    else if(conflict.kind==="settings"){
      candidate.theme=value.theme; candidate.view=value.view; candidate.settings=syncClone(value.settings);
    }
  });
  var allowed={}; Object.keys(records).forEach(function(id){allowed[id]=true;});
  var order=(candidate.order||[]).filter(function(id){return !!allowed[id];});
  syncAppendUnique(order,Object.keys(records).sort(),allowed);
  candidate.bookmarks=order.map(function(id){return records[id];}); candidate.order=order;
  candidate.tombstones=Object.keys(tombstones).sort().filter(function(id){return !records[id];}).map(function(id){return tombstones[id];});
  return syncCanonicalize(candidate);
}

var SyncMerge={
  canonicalize:syncCanonicalize,
  fromState:syncFromState,
  trackLocal:syncTrackLocal,
  same:syncSame,
  merge:syncMerge,
  bootstrap:syncBootstrap,
  resolve:syncResolve
};
