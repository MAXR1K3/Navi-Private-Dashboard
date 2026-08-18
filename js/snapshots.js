/* snapshots.js — 页面存档（离线正文快照）。
   存 IndexedDB 而不是 localStorage：单篇正文可达数十 KB，几百篇就会撑爆
   localStorage 的 ~5MB 预算，把书签数据本身挤掉。
   正文由扩展在「渲染后的页面」上就地抽取（见 background.js），质量远好于抓原始 HTML。 */
"use strict";

var SNAP_DB="navi-snapshots", SNAP_STORE="snaps", SNAP_TERMS="terms", _snapDb=null;

function snapOpen(){
  if(_snapDb) return Promise.resolve(_snapDb);
  return new Promise(function(res,rej){
    if(typeof indexedDB==="undefined"){ rej(new Error("no-idb")); return; }
    var req=indexedDB.open(SNAP_DB,2);
    req.onupgradeneeded=function(e){
      var db=e.target.result;
      if(!db.objectStoreNames.contains(SNAP_STORE)){
        var st=db.createObjectStore(SNAP_STORE,{keyPath:"key"});
        st.createIndex("at","at");
      }
      // 词向量单独存一个库：算相关页面要把所有条目读一遍，
      // 如果和正文放在一起，每次都得把几 MB 的文章正文一起拖出来。
      if(!db.objectStoreNames.contains(SNAP_TERMS)) db.createObjectStore(SNAP_TERMS,{keyPath:"key"});
    };
    req.onsuccess=function(){ _snapDb=req.result; res(_snapDb); };
    req.onerror=function(){ rej(req.error||new Error("idb-open")); };
  });
}
function snapTx(mode){
  return snapOpen().then(function(db){ return db.transaction(SNAP_STORE,mode).objectStore(SNAP_STORE); });
}
function termTx(mode){
  return snapOpen().then(function(db){ return db.transaction(SNAP_TERMS,mode).objectStore(SNAP_TERMS); });
}
/* 以规范化 URL 为键，这样同一页面换个书签 id 也能命中已有存档 */
function snapKey(url){ return (typeof normForDup==="function")?normForDup(url):String(url||"").toLowerCase(); }

function snapPut(url, snap){
  var key=snapKey(url); if(!key||!snap||!snap.text) return Promise.resolve(false);
  return snapTx("readwrite").then(function(st){
    return new Promise(function(res){
      var rec={ key:key, url:url, title:snap.title||"", text:snap.text, excerpt:snap.excerpt||"",
                byline:snap.byline||"", chars:snap.chars||snap.text.length, truncated:!!snap.truncated,
                at:snap.at||Date.now() };
      var r=st.put(rec); r.onsuccess=function(){ res(true); }; r.onerror=function(){ res(false); };
    });
  }).then(function(okv){ return snapPutTerms(key, rec0(url,snap)).then(function(){ return okv; }); })
    .catch(function(){ return false; });
}
function rec0(url,snap){ return { url:url, title:snap.title||"", text:snap.text||"" }; }
function snapPutTerms(key, r){
  if(typeof keywordVector!=="function") return Promise.resolve(false);
  var terms=keywordVector((r.title||"")+" "+(r.text||""), 30);
  return termTx("readwrite").then(function(st){
    return new Promise(function(res){
      var q=st.put({ key:key, url:r.url, title:r.title, terms:terms });
      q.onsuccess=function(){ res(true); }; q.onerror=function(){ res(false); };
    });
  }).catch(function(){ return false; });
}
function snapTermsAll(){
  return termTx("readonly").then(function(st){
    return new Promise(function(res){
      var out=[], c=st.openCursor();
      c.onsuccess=function(e){ var cur=e.target.result; if(!cur){ res(out); return; } out.push(cur.value); cur.continue(); };
      c.onerror=function(){ res(out); };
    });
  }).catch(function(){ return []; });
}
/* 老存档（v1 时期存的）没有词向量，补算一次 */
function snapEnsureTerms(){
  return Promise.all([snapAll(), snapTermsAll()]).then(function(r){
    var have={}; r[1].forEach(function(x){ have[x.key]=1; });
    var missing=r[0].filter(function(x){ return !have[x.key]; });
    if(!missing.length) return 0;
    return missing.reduce(function(p, m){
      return p.then(function(){
        return snapGet(m.url).then(function(rec){ return rec?snapPutTerms(m.key, rec):null; });
      });
    }, Promise.resolve()).then(function(){ return missing.length; });
  }).catch(function(){ return 0; });
}

/* ----- 相关页面 -----
   用 TF-IDF 余弦相似度。IDF 只依赖词向量库，不用碰正文，所以整个过程是轻的。 */
function snapRelated(url, limit){
  var key=snapKey(url);
  return snapTermsAll().then(function(all){
    var me=null, N=all.length;
    if(N<2) return [];
    var df={};
    all.forEach(function(v){
      if(v.key===key) me=v;
      var seen={};
      (v.terms||[]).forEach(function(t){ if(!seen[t.w]){ seen[t.w]=1; df[t.w]=(df[t.w]||0)+1; } });
    });
    if(!me||!me.terms||!me.terms.length) return [];
    function vec(v){
      var o={}, norm=0;
      (v.terms||[]).forEach(function(t){
        var w=(1+Math.log(t.n))*Math.log((N+1)/((df[t.w]||0)+1));
        if(w>0){ o[t.w]=w; norm+=w*w; }
      });
      return { o:o, norm:Math.sqrt(norm)||1 };
    }
    var mv=vec(me), out=[];
    all.forEach(function(v){
      if(v.key===key) return;
      var ov=vec(v), dot=0;
      for(var w in mv.o) if(ov.o[w]) dot+=mv.o[w]*ov.o[w];
      var sim=dot/(mv.norm*ov.norm);
      if(sim>0.06){
        var shared=Object.keys(mv.o).filter(function(w){ return ov.o[w]; })
          .sort(function(a,b){ return (mv.o[b]*ov.o[b])-(mv.o[a]*ov.o[a]); }).slice(0,3);
        out.push({ url:v.url, title:v.title, sim:sim, shared:shared });
      }
    });
    out.sort(function(a,b){ return b.sim-a.sim; });
    return out.slice(0, limit||5);
  }).catch(function(){ return []; });
}
function snapGet(url){
  var key=snapKey(url); if(!key) return Promise.resolve(null);
  return snapTx("readonly").then(function(st){
    return new Promise(function(res){
      var r=st.get(key); r.onsuccess=function(){ res(r.result||null); }; r.onerror=function(){ res(null); };
    });
  }).catch(function(){ return null; });
}
function snapDelete(url){
  var key=snapKey(url); if(!key) return Promise.resolve(false);
  return snapTx("readwrite").then(function(st){
    return new Promise(function(res){ var r=st.delete(key); r.onsuccess=function(){ res(true); }; r.onerror=function(){ res(false); }; });
  }).then(function(ok){
    return termTx("readwrite").then(function(st){
      return new Promise(function(res){ var r=st.delete(key); r.onsuccess=function(){ res(ok); }; r.onerror=function(){ res(ok); }; });
    });
  }).catch(function(){ return false; });
}
function snapAll(){
  return snapTx("readonly").then(function(st){
    return new Promise(function(res){
      var out=[], c=st.openCursor();
      c.onsuccess=function(e){ var cur=e.target.result; if(!cur){ res(out); return; }
        var v=cur.value; out.push({key:v.key,url:v.url,title:v.title,chars:v.chars,at:v.at}); cur.continue(); };
      c.onerror=function(){ res(out); };
    });
  }).catch(function(){ return []; });
}
function snapStats(){
  return snapAll().then(function(list){
    var bytes=list.reduce(function(a,b){ return a+(b.chars||0)*2; },0);   // UTF-16 粗估
    return { count:list.length, kb:Math.round(bytes/1024) };
  });
}
function snapClearAll(){
  return snapTx("readwrite").then(function(st){
    return new Promise(function(res){ var r=st.clear(); r.onsuccess=function(){ res(true); }; r.onerror=function(){ res(false); }; });
  }).then(function(ok){
    return termTx("readwrite").then(function(st){
      return new Promise(function(res){ var r=st.clear(); r.onsuccess=function(){ res(ok); }; r.onerror=function(){ res(ok); }; });
    });
  }).catch(function(){ return false; });
}

/* 已有存档的 URL 集合 —— 渲染卡片角标时同步查询代价太高，启动时缓存一份 */
var _snapKeys={};
function refreshSnapKeys(){
  return snapAll().then(function(list){
    _snapKeys={}; list.forEach(function(s){ _snapKeys[s.key]=s.at; });
    return _snapKeys;
  });
}
function hasSnapshot(url){ return !!_snapKeys[snapKey(url)]; }

/* ----- 阅读器 ----- */
function openSnapshot(id, q){
  var b=byId(id); if(!b) return;
  openSnapshotUrl(b.url, q, b.title);
}
function openSnapshotUrl(url, q, fallbackTitle){
  snapGet(url).then(function(rec){
    if(!rec){ toast(t("snapNone"),""); return; }
    $("#snapTitle").textContent=rec.title||fallbackTitle||getDomain(url);
    var meta=[];
    if(rec.byline) meta.push(rec.byline);
    meta.push(prettyUrl(rec.url||url));
    if(rec.at) meta.push(t("snapSavedAt",{when:timeAgo(rec.at)}));
    meta.push(Math.round((rec.chars||0)/1000)+"k "+t("snapChars"));
    $("#snapMeta").textContent=meta.join(" · ");
    var body=$("#snapBody"); body.textContent="";
    var firstHit=null;
    String(rec.text||"").split(/\n{2,}/).forEach(function(p){
      var el=document.createElement("p");
      var m=snapMarkInto(el,p,q);
      if(m&&!firstHit) firstHit=m;
      body.appendChild(el);
    });
    if(rec.truncated){
      var tr=document.createElement("p"); tr.className="snap-trunc"; tr.textContent=t("snapTruncated"); body.appendChild(tr);
    }
    $("#snapOpenBtn").setAttribute("data-open-url", url);
    $("#snapDeleteBtn").setAttribute("data-snap-del", url);
    renderSnapRelated(url);
    openOverlay("snapOverlay");
    // 从搜索结果进来时直接跳到第一处命中，不用自己在长文里找。
    // 用 rect 相对量算，不用 offsetTop：offsetTop 是相对 offsetParent 的，
    // 而 #snapBody 没有定位上下文，量出来的根本不是滚动容器内的位置；
    // 而且要等弹层真的可见后再量，否则读到的全是 0。
    body.scrollTop=0;
    if(firstHit) setTimeout(function(){
      if(!document.getElementById("snapOverlay").classList.contains("open")) return;
      var br=body.getBoundingClientRect(), hr=firstHit.getBoundingClientRect();
      body.scrollTop+=(hr.top-br.top)-body.clientHeight/3;
    }, 40);
  });
}

function scheduleSnapSearch(q, visibleList){
  if(_snapSearchTimer) clearTimeout(_snapSearchTimer);
  var token=++_snapSearchToken;
  // 已经作为卡片命中的就别再列一遍，这块只呈现"仅正文里有"的补充结果
  var seen={}; (visibleList||[]).forEach(function(b){ seen[snapKey(b.url)]=1; });
  _snapSearchTimer=setTimeout(function(){
    snapSearch(q,seen).then(function(hits){
      if(token!==_snapSearchToken) return;          // 用户又敲了新词，这次结果作废
      renderSnapResults(hits,q);
    });
  }, 220);
}
function renderSnapResults(hits, q){
  var box=$("#snapResults"); if(!box) return;
  if(!hits.length){ box.innerHTML=""; return; }
  var h='<div class="sr-head">'+ICONS.archive+"<span>"+escapeHtml(t("snapFoundIn",{n:hits.length}))+"</span></div>";
  h+=hits.map(function(s){
    return '<button class="sr-item" data-snap-hit="'+escapeHtml(s.url)+'">'+
      '<div class="sr-t">'+escapeHtml(s.title||getDomain(s.url))+'</div>'+
      '<div class="sr-u">'+escapeHtml(prettyUrl(s.url))+'</div>'+
      '<div class="sr-s"></div></button>';
  }).join("");
  box.innerHTML=h;
  // 片段里可能有 < 之类的字符，交给文本节点处理，顺手把关键词标出来
  var els=box.querySelectorAll(".sr-s");
  hits.forEach(function(s,i){ if(els[i]) snapMarkInto(els[i], s.snippet||"", q); });
  box.setAttribute("data-q", q);
}
(function wireSnapResults(){
  contentEl.addEventListener("click", function(e){
    var it=e.target.closest("[data-snap-hit]"); if(!it) return;
    e.stopPropagation();
    var box=$("#snapResults");
    openSnapshotUrl(it.getAttribute("data-snap-hit"), box?box.getAttribute("data-q"):"");
  });
})();

function renderSnapRelated(url){
  var box=$("#snapRelated"); if(!box) return;
  box.innerHTML="";
  snapRelated(url,4).then(function(list){
    if(!list.length) return;
    box.innerHTML='<div class="rel-head">'+escapeHtml(t("snapRelated"))+"</div>"+
      list.map(function(r){
        return '<button class="rel-item" data-snap-hit="'+escapeHtml(r.url)+'">'+
          '<span class="rel-t">'+escapeHtml(r.title||getDomain(r.url))+'</span>'+
          (r.shared.length?'<span class="rel-k">'+r.shared.map(function(w){ return escapeHtml(w); }).join(" · ")+'</span>':'')+
          '</button>';
      }).join("");
  });
}

(function wireSnapshots(){
  var o=$("#snapOverlay"); if(!o) return;
  o.addEventListener("click", function(e){
    var rel=e.target.closest("[data-snap-hit]");
    if(rel){ e.stopPropagation(); openSnapshotUrl(rel.getAttribute("data-snap-hit"),""); return; }
    var op=e.target.closest("[data-open-url]");
    if(op){ var u=op.getAttribute("data-open-url"); if(u) window.open(normalizeUrl(u),"_blank","noopener"); return; }
    var del=e.target.closest("[data-snap-del]");
    if(del){
      var url=del.getAttribute("data-snap-del");
      openConfirm(t("snapDelete"), t("snapDeleteMsg"), t("delete"), function(){
        snapDelete(url).then(function(){ refreshSnapKeys().then(function(){ renderContent(); }); closeOverlay("snapOverlay"); toast(t("snapDeleted"),"ok"); });
      });
    }
  });
})();

/* ----- 孤儿清理 -----
   删书签的入口太多（回收站过期、保留期为「立即」、清空、导入替换、Profile 切换…），
   逐个去挂钩子迟早漏一个，漏了就是用户看不见的存储泄漏。改成统一扫一遍：
   只留下"还能对应上某条书签"的存档。
   ⚠️ 必须把其它 Profile 的缓存书签也算进来，否则一切换 Profile
   就会把另一边的存档全当孤儿删掉。 */
function snapLiveKeys(){
  var keys={};
  function add(list){ (list||[]).forEach(function(b){ var u=b&&(b.url||(b.bm&&b.bm.url)); if(u) keys[snapKey(u)]=1; }); }
  add(state.bookmarks); add(state.trash);
  try{
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(k&&k.indexOf("navi.pdata.")===0){
        var d=JSON.parse(localStorage.getItem(k)||"{}");
        add(d.bookmarks); add(d.trash);
      }
    }
  }catch(e){}
  return keys;
}
function snapPruneOrphans(){
  var live=snapLiveKeys();
  return snapAll().then(function(list){
    var dead=list.filter(function(s){ return !live[s.key]; });
    if(!dead.length) return 0;
    return snapTx("readwrite").then(function(st){
      dead.forEach(function(s){ try{ st.delete(s.key); }catch(e){} });
      return new Promise(function(res){
        st.transaction.oncomplete=function(){ res(dead.length); };
        st.transaction.onerror=function(){ res(0); };
      });
    });
  }).then(function(n){
    if(!n) return 0;
    // 词向量库也要跟着清，否则换成另一种看不见的泄漏
    return termTx("readwrite").then(function(st){
      return new Promise(function(res){
        var c=st.openCursor();
        c.onsuccess=function(e){ var cur=e.target.result; if(!cur){ res(n); return; }
          if(!live[cur.value.key]){ try{ cur.delete(); }catch(x){} }
          cur.continue(); };
        c.onerror=function(){ res(n); };
      });
    }).then(function(){ return refreshSnapKeys().then(function(){ return n; }); });
  }).catch(function(){ return 0; });
}

/* ----- 存档正文全文检索 -----
   不塞进 visibleBookmarks()：那是每次按键都跑的同步路径，而正文可能有好几 MB。
   这里单独异步跑一遍，结果作为"只在正文里命中"的补充区显示。 */
var _snapSearchToken=0, _snapSearchTimer=null;
function snapSnippet(text, q, span){
  var lo=text.toLowerCase(), i=lo.indexOf(q.toLowerCase());
  if(i<0) return "";
  span=span||70;
  var s=Math.max(0,i-span), e=Math.min(text.length,i+q.length+span);
  return (s>0?"…":"")+text.slice(s,e).replace(/\s+/g," ").trim()+(e<text.length?"…":"");
}
function snapSearch(q, excludeKeys, limit){
  q=String(q||"").trim();
  if(q.length<2) return Promise.resolve([]);
  var lo=q.toLowerCase(), max=limit||12;
  return snapTx("readonly").then(function(st){
    return new Promise(function(res){
      var out=[], c=st.openCursor();
      c.onsuccess=function(e){
        var cur=e.target.result;
        if(!cur||out.length>=max){ res(out); return; }
        var v=cur.value;
        if(!(excludeKeys&&excludeKeys[v.key]) && v.text && v.text.toLowerCase().indexOf(lo)>-1)
          out.push({ key:v.key, url:v.url, title:v.title, at:v.at, snippet:snapSnippet(v.text,q) });
        cur.continue();
      };
      c.onerror=function(){ res(out); };
    });
  }).catch(function(){ return []; });
}
/* 高亮时用文本节点切分，不做字符串拼 HTML —— 正文里带 < 的代码片段会被当标签吃掉 */
function snapMarkInto(el, text, q){
  el.textContent="";
  var lo=text.toLowerCase(), needle=String(q||"").toLowerCase(), i=0, first=null;
  if(!needle){ el.textContent=text; return null; }
  while(true){
    var hit=lo.indexOf(needle,i);
    if(hit<0){ el.appendChild(document.createTextNode(text.slice(i))); break; }
    if(hit>i) el.appendChild(document.createTextNode(text.slice(i,hit)));
    var m=document.createElement("mark");
    m.textContent=text.slice(hit,hit+needle.length);
    el.appendChild(m); if(!first) first=m;
    i=hit+needle.length;
  }
  return first;
}
