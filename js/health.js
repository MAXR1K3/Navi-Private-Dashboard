/* health.js — 链接健康检查：每个书签维护 health:{status,ts}，批量检测带并发限制。
   扩展环境（有 host_permissions）直接 fetch 看状态码；PWA/网页环境用 no-cors 探测可达性。 */
"use strict";

var _healthRun=null;

function healthTip(b){
  if(!b.health||!b.health.status||b.health.status==="unknown") return t("hUnknown");
  var ago=(typeof timeAgo==="function"&&b.health.ts)?timeAgo(b.health.ts):"";
  var key=b.health.status==="ok"?"hOk":(b.health.status==="bad"?"hBad":"hWarn");
  return t(key,{ago:ago});
}

function checkLink(url, cb){
  var direct=(typeof hasChromeAPI==="function")&&hasChromeAPI();
  var ctrl=window.AbortController?new AbortController():null;
  var to=setTimeout(function(){ if(ctrl){ try{ ctrl.abort(); }catch(e){} } },12000);
  var opts={redirect:"follow",cache:"no-store"};
  if(ctrl) opts.signal=ctrl.signal;
  if(!direct) opts.mode="no-cors"; // 网页环境跨域读不到状态码，能连通即视为正常
  fetch(url,opts).then(function(r){
    clearTimeout(to);
    if(r.type==="opaque"){ cb("ok"); return; }
    if(r.ok||(r.status>=300&&r.status<400)) cb("ok");
    else if(r.status===404||r.status===410||r.status===451) cb("bad");
    else cb("warn"); // 403/429/5xx 等：站点活着但当前请求被拒
  }).catch(function(){
    clearTimeout(to);
    cb(direct?"bad":"warn"); // 网页环境的网络错误可能是站点策略所致，标记“存疑”避免误杀
  });
}

function updateHealthDot(b){
  if(typeof gridEl==="undefined"||!gridEl) return;
  var nameEl=gridEl.querySelector('.card[data-id="'+cssEscape(b.id)+'"] .name');
  if(!nameEl) return;
  var dot=nameEl.querySelector(".hdot");
  if(!dot){ dot=document.createElement("span"); nameEl.insertBefore(dot,nameEl.firstChild); }
  dot.className="hdot "+b.health.status; dot.title=healthTip(b);
}

function healthCheckAll(){
  if(_healthRun){ toast(t("healthBusy"),""); return; }
  var list=state.bookmarks.slice();
  if(!list.length) return;
  _healthRun=true;
  toast(t("healthRunning"),"");
  var total=list.length, done=0, counts={ok:0,bad:0,warn:0}, qi=0;
  function finishOne(b,st){
    b.health={status:st,ts:Date.now()};
    counts[st]=(counts[st]||0)+1; done++;
    updateHealthDot(b);
    if(done>=total){
      _healthRun=null; save(); renderContent();
      toast(t("healthDone",{ok:counts.ok,warn:counts.warn,bad:counts.bad}), counts.bad?"":"ok");
      return;
    }
    next();
  }
  function next(){
    if(qi>=list.length) return;
    var b=list[qi++], url=normalizeUrl(b.url);
    if(!isWebUrl(url)){ finishOne(b,"bad"); return; }
    checkLink(url, function(st){ finishOne(b,st); });
  }
  for(var i=0;i<Math.min(6,total);i++) next();
}
