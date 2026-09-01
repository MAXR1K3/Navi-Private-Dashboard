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

var SyncMerge={
  canonicalize:syncCanonicalize,
  fromState:syncFromState,
  trackLocal:syncTrackLocal,
  same:syncSame
};
