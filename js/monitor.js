/* monitor.js — 内网设施监控小组件：NAS 指标(CPU/内存/温度/上下行/硬盘/Docker/SMART/UPS/备份)
   + 服务在线/离线 + 内网延迟 + 外网访问。
   指标来源走「提供者适配器」：glances(推荐) / generic(反代 JSON) / synology(原生 DSM)。
   在线/离线 与 延迟 用浏览器 no-cors 探测实现，无需任何后端。 */
"use strict";

/* ===== runtime state ===== */
var monTimer=null;
var monState={ metrics:null, metricsErr:null, metricsTs:0, services:{}, loading:false };
var _monServiceSeq=0;

/* ===== settings helpers ===== */
function monCfg(){
  var m=state.settings.monitor;
  if(!m){ m=state.settings.monitor=defaultMonitor(); }
  if(!Array.isArray(m.services)) m.services=defaultMonitor().services;
  return m;
}
function defaultMonitor(){
  function svc(name,url){ return { id:"s"+(Date.now().toString(36))+(_monServiceSeq++).toString(36), name:name, url:url||"" }; }
  return {
    provider:"glances",
    host:"",
    synoUser:"", synoPass:"",
    refresh:30,
    metricsOn:true,
    services:[
      svc("NAS",""), svc("Jellyfin",""), svc("Plex",""), svc("qBittorrent",""),
      svc("Home Assistant",""), svc("OpenWrt",""), svc("Router",""),
      svc("Internet","https://1.1.1.1")
    ]
  };
}
function monNewService(name,url){ var m=monCfg(); m.services.push({ id:"s"+Date.now().toString(36)+(_monServiceSeq++).toString(36), name:name||"", url:url||"" }); }

/* ===== formatting ===== */
function monBytes(n){
  n=Number(n)||0; var u=["B","KB","MB","GB","TB","PB"], i=0;
  while(n>=1024&&i<u.length-1){ n/=1024; i++; }
  return (n>=100||i===0?Math.round(n):n.toFixed(1))+" "+u[i];
}
function monRate(bytesPerSec){ return monBytes(bytesPerSec)+"/s"; }
function monPct(n){ return (n==null||!isFinite(n))?"—":Math.round(n)+"%"; }
function monGaugeClass(p){ p=Number(p)||0; return p>=90?"crit":p>=75?"warn":"ok"; }

/* ===== reachability ping (online/offline + latency) ===== */
function monPing(url, timeoutMs){
  return new Promise(function(resolve){
    var u=normalizeUrl(url); if(!u){ resolve({ok:false,rtt:null}); return; }
    var started=(window.performance&&performance.now)?performance.now():Date.now();
    var done=false, ctrl=("AbortController" in window)?new AbortController():null;
    var to=setTimeout(function(){ if(done)return; done=true; if(ctrl){ try{ctrl.abort();}catch(e){}} resolve({ok:false,rtt:null}); }, timeoutMs||6000);
    var opts={ mode:"no-cors", cache:"no-store", redirect:"follow" };
    if(ctrl) opts.signal=ctrl.signal;
    fetch(u, opts).then(function(){
      if(done)return; done=true; clearTimeout(to);
      var now=(window.performance&&performance.now)?performance.now():Date.now();
      resolve({ ok:true, rtt:Math.max(0,Math.round(now-started)) });
    }).catch(function(){
      if(done)return; done=true; clearTimeout(to); resolve({ ok:false, rtt:null });
    });
  });
}

/* ===== metrics: provider adapters ===== */
function monFetchJson(url, opts){
  var ctrl=("AbortController" in window)?new AbortController():null;
  opts=opts||{}; opts.cache="no-store"; if(ctrl) opts.signal=ctrl.signal;
  var to=setTimeout(function(){ if(ctrl){ try{ctrl.abort();}catch(e){} } }, 9000);
  return fetch(url, opts).then(function(r){
    clearTimeout(to);
    if(!r.ok) throw new Error("HTTP "+r.status);
    return r.json();
  });
}
function monBase(host){
  var h=(host||"").trim().replace(/\/+$/,"");
  if(!h) return "";
  if(!/^https?:\/\//i.test(h)) h="http://"+h;
  return h;
}

/* Glances REST API (v4，回退 v3)。一次 /all 取全部指标。 */
function monFetchGlances(host){
  var base=monBase(host); if(!base) return Promise.reject(new Error("no-host"));
  return monFetchJson(base+"/api/4/all").catch(function(){ return monFetchJson(base+"/api/3/all"); }).then(parseGlances);
}
function glTemp(sensors){
  if(!Array.isArray(sensors)) return null;
  var best=null;
  sensors.forEach(function(s){
    var unit=String(s.unit||"").toUpperCase(), type=String(s.type||""), label=String(s.label||"").toLowerCase();
    var isTemp=(type==="temperature_core")||unit==="C"||/temp/.test(label);
    if(!isTemp) return;
    var v=Number(s.value); if(!isFinite(v)||v<=0||v>140) return;
    var pri=/package|composite|cpu|tctl|tdie|core 0|core0/.test(label)?2:1;
    if(!best||pri>best.pri||(pri===best.pri&&v>best.v)) best={v:v,pri:pri};
  });
  return best?Math.round(best.v):null;
}
function glNet(net){
  if(!Array.isArray(net)) return {up:0,down:0};
  var up=0,down=0;
  net.forEach(function(n){
    var name=String(n.interface_name||n.interface||"").toLowerCase();
    if(!name||name==="lo"||name.indexOf("docker")===0||name.indexOf("veth")===0||name.indexOf("br-")===0) return;
    var tsu=Number(n.time_since_update)||0;
    var r=(n.bytes_recv_rate_per_sec!=null)?Number(n.bytes_recv_rate_per_sec):(tsu?(Number(n.bytes_recv)||0)/tsu:0);
    var s=(n.bytes_sent_rate_per_sec!=null)?Number(n.bytes_sent_rate_per_sec):(tsu?(Number(n.bytes_sent)||0)/tsu:0);
    if(isFinite(r)) down+=r; if(isFinite(s)) up+=s;
  });
  return {up:up,down:down};
}
function glContainers(all){
  var list=all.containers||(all.docker&&(all.docker.containers||all.docker))||[];
  if(!Array.isArray(list)) return [];
  return list.map(function(c){
    var st=String(c.status||c.Status||c.state||"").toLowerCase();
    return { name:String(c.name||c.Names||c.id||"?"), running:/run|up/.test(st) };
  });
}
function parseGlances(all){
  all=all||{};
  var cpu=(all.cpu&&all.cpu.total!=null)?Number(all.cpu.total):(all.quicklook&&all.quicklook.cpu!=null?Number(all.quicklook.cpu):null);
  var mem=all.mem||{};
  var fsArr=Array.isArray(all.fs)?all.fs.map(function(f){
    return { mnt:String(f.mnt_point||f.device_name||"/"), percent:Number(f.percent), used:Number(f.used), size:Number(f.size) };
  }).filter(function(f){ return isFinite(f.percent); }).sort(function(a,b){ return b.percent-a.percent; }):[];
  var load=(all.load&&all.load.min1!=null)?Number(all.load.min1):null;
  var smart=Array.isArray(all.smart)?all.smart.map(function(d){ return { name:String(d.DeviceName||d.name||d.device||"disk"), health:null }; }):null;
  return {
    cpu: isFinite(cpu)?cpu:null,
    mem: (mem.percent!=null&&isFinite(mem.percent))?Number(mem.percent):null,
    memUsed: Number(mem.used)||null, memTotal: Number(mem.total)||null,
    temp: glTemp(all.sensors),
    net: glNet(all.network),
    load: isFinite(load)?load:null,
    uptime: all.uptime?String(all.uptime):null,
    fs: fsArr,
    containers: glContainers(all),
    smart: smart,
    ups: null, backup: null
  };
}

/* Generic：用户反代出的 JSON，直接返回归一化结构（字段缺失自动忽略）。 */
function monFetchGeneric(url){
  var u=monBase(url); if(!u) return Promise.reject(new Error("no-host"));
  return monFetchJson(u).then(function(j){
    j=j||{};
    var net=j.net||{};
    return {
      cpu:(j.cpu!=null?Number(j.cpu):null),
      mem:(j.mem!=null?Number(j.mem):(j.memory!=null?Number(j.memory):null)),
      memUsed:Number(j.memUsed)||null, memTotal:Number(j.memTotal)||null,
      temp:(j.temp!=null?Number(j.temp):null),
      net:{ up:Number(net.up||j.up||0)||0, down:Number(net.down||j.down||0)||0 },
      load:(j.load!=null?Number(j.load):null),
      uptime:j.uptime?String(j.uptime):null,
      fs:Array.isArray(j.fs)?j.fs.map(function(f){ return {mnt:String(f.mnt||f.name||"/"),percent:Number(f.percent),used:Number(f.used),size:Number(f.size)}; }):[],
      containers:Array.isArray(j.containers)?j.containers.map(function(c){ return {name:String(c.name||"?"),running:c.running!==false}; }):[],
      smart:Array.isArray(j.smart)?j.smart.map(function(d){ return {name:String(d.name||"disk"),health:(d.health||null)}; }):null,
      ups:(j.ups&&typeof j.ups==="object")?{percent:Number(j.ups.percent),status:String(j.ups.status||"")}:null,
      backup:(j.backup&&typeof j.backup==="object")?{status:String(j.backup.status||""),when:(j.backup.when||null)}:null
    };
  });
}

/* Synology DSM：login 取 SID → System.Utilization。需反代加 CORS 或扩展环境才能跨域。 */
function monFetchSynology(host, user, pass){
  var base=monBase(host); if(!base) return Promise.reject(new Error("no-host"));
  var loginUrl=base+"/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&format=sid"+
    "&account="+encodeURIComponent(user||"")+"&passwd="+encodeURIComponent(pass||"")+"&session=NaviMonitor";
  return monFetchJson(loginUrl).then(function(j){
    if(!j||!j.success||!j.data||!j.data.sid) throw new Error("auth");
    var sid=j.data.sid;
    var u=base+"/webapi/entry.cgi?api=SYNO.Core.System.Utilization&version=1&method=get&_sid="+encodeURIComponent(sid);
    return monFetchJson(u).then(function(r){ return parseSynology(r); });
  });
}
function parseSynology(r){
  var d=(r&&r.data)||{};
  var cpu=null;
  if(d.cpu){ cpu=(Number(d.cpu.user_load)||0)+(Number(d.cpu.system_load)||0); }
  var mem=null, memUsed=null, memTotal=null;
  if(d.memory){
    var total=Number(d.memory.total_real||d.memory.memory_size||0)*1024; // DSM 用 KB
    var avail=Number(d.memory.avail_real||0)*1024, real=Number(d.memory.real_usage);
    if(isFinite(real)) mem=real;
    if(total){ memTotal=total; if(avail) memUsed=total-avail; if(mem==null&&memUsed!=null) mem=memUsed/total*100; }
  }
  var up=0,down=0;
  if(Array.isArray(d.network)){ d.network.forEach(function(n){ if(String(n.device)==="total"){ down=Number(n.rx)||0; up=Number(n.tx)||0; } }); if(!down&&!up&&d.network[0]){ down=Number(d.network[0].rx)||0; up=Number(d.network[0].tx)||0; } }
  return { cpu:(cpu!=null&&isFinite(cpu))?cpu:null, mem:(mem!=null&&isFinite(mem))?mem:null,
    memUsed:memUsed, memTotal:memTotal, temp:null, net:{up:up,down:down},
    load:null, uptime:null, fs:[], containers:[], smart:null, ups:null, backup:null };
}

function monFetchMetrics(){
  var m=monCfg();
  if(m.provider==="synology") return monFetchSynology(m.host, m.synoUser, m.synoPass);
  if(m.provider==="generic") return monFetchGeneric(m.host);
  return monFetchGlances(m.host);
}

/* ===== refresh loop ===== */
function refreshMonitorData(){
  if(monState.loading) return Promise.resolve();
  var m=monCfg();
  monState.loading=true;
  var jobs=[];
  // metrics
  if(m.metricsOn!==false && (m.host||"").trim()){
    jobs.push(monFetchMetrics().then(function(mx){ monState.metrics=mx; monState.metricsErr=null; monState.metricsTs=Date.now(); })
      .catch(function(e){ monState.metrics=null; monState.metricsErr=(e&&e.message)||"error"; }));
  } else { monState.metrics=null; monState.metricsErr=null; }
  // services
  m.services.forEach(function(s){
    if(!s.url){ monState.services[s.id]={ status:"none", rtt:null }; return; }
    jobs.push(monPing(s.url).then(function(r){ monState.services[s.id]={ status:r.ok?"up":"down", rtt:r.rtt }; }));
  });
  return Promise.all(jobs).then(function(){ monState.loading=false; refreshMonitorDom(); })
    .catch(function(){ monState.loading=false; refreshMonitorDom(); });
}
function stopMonTimer(){ if(monTimer){ clearTimeout(monTimer); monTimer=null; } }
function scheduleMonTick(){
  var sec=Math.max(10, Number(monCfg().refresh)||30);
  monTimer=setTimeout(monTick, sec*1000);
}
function monTick(){ if(document.hidden||!$("#monBody")) return; refreshMonitorData(); scheduleMonTick(); }
function startMonTimer(){ stopMonTimer(); if(document.hidden||!$("#monBody")) return; monTick(); }
function ensureMonitor(){ startMonTimer(); }
document.addEventListener("visibilitychange", function(){
  if(document.hidden) stopMonTimer();
  else if($("#monBody")) startMonTimer();
});

/* ===== widget body render ===== */
function monitorBody(){ return '<div id="monBody">'+monitorInner()+'</div>'; }
function monStat(label, value, sub, gaugePct, icon){
  var g="";
  if(gaugePct!=null && isFinite(gaugePct)){
    var p=Math.max(0,Math.min(100,gaugePct));
    g='<div class="mon-bar"><span class="mon-bar-fill '+monGaugeClass(p)+'" style="width:'+p+'%"></span></div>';
  }
  return '<div class="mon-stat">'+
    '<div class="mon-stat-h">'+(icon||"")+'<span class="mon-stat-l">'+escapeHtml(label)+'</span></div>'+
    '<div class="mon-stat-v">'+value+'</div>'+(sub?'<div class="mon-stat-s">'+sub+'</div>':"")+g+
  '</div>';
}
function monitorMetricsHtml(){
  var m=monCfg();
  if(m.metricsOn===false) return "";
  if(!(m.host||"").trim()){
    return monitorDemoHtml();
  }
  if(monState.metricsErr){
    return '<div class="mon-hint mon-err">'+escapeHtml(t("monMetricsErr"))+' <button class="link-btn" data-monact="retry">'+escapeHtml(t("retry"))+'</button>'+
      '<div class="mon-err-d">'+escapeHtml(t("monCorsHint"))+'</div></div>';
  }
  var x=monState.metrics;
  if(!x){ return '<div class="mon-skel"></div>'; }
  var html='<div class="mon-grid">';
  html+=monStat(t("monCpu"), monPct(x.cpu), x.load!=null?(t("monLoad")+" "+x.load.toFixed(2)):"", x.cpu, ICONS.cpu);
  html+=monStat(t("monMem"), monPct(x.mem), (x.memUsed&&x.memTotal)?(monBytes(x.memUsed)+" / "+monBytes(x.memTotal)):"", x.mem, ICONS.chip);
  html+=monStat(t("monTemp"), x.temp!=null?(x.temp+"°C"):"—", "", x.temp!=null?Math.min(100,x.temp):null, ICONS.thermo);
  var net='<span class="mon-net"><span class="dn">↓ '+monRate(x.net.down)+'</span><span class="up">↑ '+monRate(x.net.up)+'</span></span>';
  html+=monStat(t("monNet"), net, "", null, ICONS.netio);
  html+='</div>';
  // disks
  if(x.fs&&x.fs.length){
    html+='<div class="mon-disks">';
    x.fs.slice(0,3).forEach(function(f){
      html+='<div class="mon-disk"><div class="mon-disk-h"><span class="mnt">'+escapeHtml(f.mnt)+'</span><span class="pc">'+monPct(f.percent)+'</span></div>'+
        '<div class="mon-bar"><span class="mon-bar-fill '+monGaugeClass(f.percent)+'" style="width:'+Math.max(0,Math.min(100,f.percent))+'%"></span></div></div>';
    });
    html+='</div>';
  }
  // extra rows: docker / smart / ups / backup / uptime
  var extras=[];
  if(x.containers&&x.containers.length){ var run=x.containers.filter(function(c){return c.running;}).length; extras.push({i:ICONS.dockerBox, l:t("monDocker"), v:run+"/"+x.containers.length+" "+t("monRunning")}); }
  if(x.smart&&x.smart.length){ extras.push({i:ICONS.shield, l:t("monSmart"), v:x.smart.length+" "+t("monDisks")}); }
  if(x.ups){ extras.push({i:ICONS.battery, l:t("monUps"), v:(isFinite(x.ups.percent)?x.ups.percent+"% ":"")+escapeHtml(x.ups.status||"")}); }
  if(x.backup){ extras.push({i:ICONS.archive, l:t("monBackup"), v:escapeHtml(x.backup.status||"")+(x.backup.when?(" · "+escapeHtml(String(x.backup.when))):"")}); }
  if(x.uptime){ extras.push({i:ICONS.clock, l:t("monUptime"), v:escapeHtml(x.uptime)}); }
  if(extras.length){
    html+='<div class="mon-extras">';
    extras.forEach(function(e){ html+='<div class="mon-x"><span class="mon-x-l">'+e.i+escapeHtml(e.l)+'</span><span class="mon-x-v">'+e.v+'</span></div>'; });
    html+='</div>';
  }
  return html;
}
function monitorDemoHtml(){
  var html='<div class="mon-demo-note">'+escapeHtml(t("monDemoMode"))+' <button class="link-btn" data-monact="settings">'+escapeHtml(t("monConfigure"))+'</button></div>';
  html+='<div class="mon-grid">';
  html+=monStat(t("monCpu"), "0%", t("monLoad")+" 0.00", 0, ICONS.cpu);
  html+=monStat(t("monMem"), "0%", "— / —", 0, ICONS.chip);
  html+=monStat(t("monTemp"), "—", "", null, ICONS.thermo);
  html+=monStat(t("monNet"), '<span class="mon-net"><span class="dn">↓ 0 B/s</span><span class="up">↑ 0 B/s</span></span>', "", null, ICONS.netio);
  html+='</div>';
  html+='<div class="mon-disks">'+
    '<div class="mon-disk"><div class="mon-disk-h"><span class="mnt">/volume1</span><span class="pc">0%</span></div><div class="mon-bar"><span class="mon-bar-fill" style="width:0%"></span></div></div>'+
    '<div class="mon-disk"><div class="mon-disk-h"><span class="mnt">/backup</span><span class="pc">—</span></div><div class="mon-bar"><span class="mon-bar-fill pending" style="width:0%"></span></div></div>'+
  '</div>';
  html+='<div class="mon-extras">'+
    '<div class="mon-x"><span class="mon-x-l">'+ICONS.dockerBox+escapeHtml(t("monDocker"))+'</span><span class="mon-x-v">0 '+escapeHtml(t("monRunning"))+'</span></div>'+
    '<div class="mon-x"><span class="mon-x-l">'+ICONS.shield+escapeHtml(t("monSmart"))+'</span><span class="mon-x-v">—</span></div>'+
    '<div class="mon-x"><span class="mon-x-l">'+ICONS.battery+escapeHtml(t("monUps"))+'</span><span class="mon-x-v">—</span></div>'+
    '<div class="mon-x"><span class="mon-x-l">'+ICONS.archive+escapeHtml(t("monBackup"))+'</span><span class="mon-x-v">—</span></div>'+
    '<div class="mon-x"><span class="mon-x-l">'+ICONS.clock+escapeHtml(t("monUptime"))+'</span><span class="mon-x-v">—</span></div>'+
  '</div>';
  return html;
}
function monitorServicesHtml(){
  var m=monCfg();
  if(!m.services.length) return "";
  var html='<div class="mon-svcs">';
  m.services.forEach(function(s){
    var st=(monState.services[s.id]||{}).status||(s.url?"pending":"none");
    var rtt=(monState.services[s.id]||{}).rtt;
    var demo=!(m.host||"").trim()&&!s.url;
    var sub = demo?t("monPending") : st==="up"?(rtt!=null?(rtt+" ms"):t("monOnline")) : st==="down"?t("monOffline") : st==="none"?t("monUnset") : "…";
    if(demo) st="demo";
    html+='<div class="mon-svc '+st+'" title="'+escapeHtml(s.url||"")+'"><span class="mon-dot"></span>'+
      '<span class="mon-svc-n">'+escapeHtml(s.name||"—")+'</span>'+
      '<span class="mon-svc-s">'+escapeHtml(sub)+'</span></div>';
  });
  html+='</div>';
  return html;
}
function monitorInner(){
  return monitorMetricsHtml()+monitorServicesHtml();
}
function refreshMonitorDom(){ var b=$("#monBody"); if(b) b.innerHTML=monitorInner(); }

/* ===== widget interactions ===== */
widgetsEl.addEventListener("click", function(e){
  var act=e.target.closest("[data-monact]"); if(!act) return;
  var a=act.getAttribute("data-monact");
  if(a==="settings"){
    if(typeof openSettings==="function") openSettings();
    if(typeof setActiveSetTab==="function") setActiveSetTab("services");
  }
  else if(a==="retry"){ monState.metricsErr=null; refreshMonitorData(); }
});

/* ===== settings panel wiring ===== */
function syncMonitorUI(){
  var m=monCfg();
  var prov=$("#monProvSeg"); if(prov) $all("#monProvSeg [data-monprov]").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-monprov")===m.provider); });
  var host=$("#monHost"); if(host) host.value=m.host||"";
  var rf=$("#monRefresh"); if(rf) rf.value=String(m.refresh||30);
  var su=$("#monSynoUser"); if(su) su.value=m.synoUser||"";
  var sp=$("#monSynoPass"); if(sp) sp.value=m.synoPass||"";
  monSyncProviderFields();
  renderMonServicesEditor();
  monSyncHostHint();
}
function monSyncProviderFields(){
  var m=monCfg(), syno=$("#monSynoFields");
  if(syno) syno.style.display=(m.provider==="synology")?"":"none";
}
function monSyncHostHint(){
  var el=$("#monHostHint"); if(!el) return;
  var m=monCfg();
  el.textContent = m.provider==="glances"?t("monHostHintGlances") : m.provider==="synology"?t("monHostHintSyno") : t("monHostHintGeneric");
  var inp=$("#monHost");
  if(inp) inp.setAttribute("placeholder", m.provider==="glances"?"http://192.168.1.10:61208" : m.provider==="synology"?"http://192.168.1.10:5000" : "https://nas.example.com/api/status.json");
}
function renderMonServicesEditor(){
  var box=$("#monServices"); if(!box) return;
  var m=monCfg(), html="";
  m.services.forEach(function(s){
    html+='<div class="mon-svc-row" data-sid="'+escapeHtml(s.id)+'">'+
      '<input class="mon-svc-name" type="text" value="'+escapeHtml(s.name||"")+'" placeholder="'+escapeHtml(t("monSvcName"))+'" />'+
      '<input class="mon-svc-url" type="text" value="'+escapeHtml(s.url||"")+'" placeholder="'+escapeHtml(t("monSvcUrl"))+'" autocomplete="off" />'+
      '<button class="btn icon mon-svc-del" data-mondel="'+escapeHtml(s.id)+'" title="'+escapeHtml(t("delete"))+'">'+ICONS.x+'</button>'+
    '</div>';
  });
  box.innerHTML=html;
}

function monRefreshWidget(){ var b=$("#monBody"); if(b){ refreshMonitorDom(); startMonTimer(); } }

(function monWireSettings(){
  var seg=$("#monProvSeg");
  if(seg) seg.addEventListener("click", function(e){
    var b=e.target.closest("[data-monprov]"); if(!b) return;
    monCfg().provider=b.getAttribute("data-monprov"); save();
    $all("#monProvSeg [data-monprov]").forEach(function(x){ x.classList.toggle("on", x===b); });
    monSyncProviderFields(); monSyncHostHint(); monRefreshWidget();
  });
  var host=$("#monHost"); if(host) host.addEventListener("input", function(e){ monCfg().host=e.target.value.trim(); save(); monState.metricsErr=null; });
  var rf=$("#monRefresh"); if(rf) rf.addEventListener("change", function(e){ monCfg().refresh=Math.max(10,Number(e.target.value)||30); save(); startMonTimer(); });
  var su=$("#monSynoUser"); if(su) su.addEventListener("input", function(e){ monCfg().synoUser=e.target.value; save(); });
  var sp=$("#monSynoPass"); if(sp) sp.addEventListener("input", function(e){ monCfg().synoPass=e.target.value; save(); });
  var add=$("#monAddSvc"); if(add) add.addEventListener("click", function(){ monNewService("",""); save(); renderMonServicesEditor(); });
  var test=$("#monTest"); if(test) test.addEventListener("click", function(){ monState.metricsErr=null; monState.metrics=null; refreshMonitorDom(); refreshMonitorData(); toast(t("monTesting"),"ok"); });
  var box=$("#monServices");
  if(box){
    box.addEventListener("input", function(e){
      var row=e.target.closest(".mon-svc-row"); if(!row) return;
      var id=row.getAttribute("data-sid"), m=monCfg();
      var s=null; m.services.forEach(function(x){ if(x.id===id) s=x; }); if(!s) return;
      if(e.target.classList.contains("mon-svc-name")) s.name=e.target.value;
      else if(e.target.classList.contains("mon-svc-url")){ s.url=e.target.value.trim(); monState.services[id]=null; }
      save();
    });
    box.addEventListener("click", function(e){
      var del=e.target.closest("[data-mondel]"); if(!del) return;
      var id=del.getAttribute("data-mondel"), m=monCfg();
      m.services=m.services.filter(function(x){ return x.id!==id; }); save(); renderMonServicesEditor();
    });
  }
})();
