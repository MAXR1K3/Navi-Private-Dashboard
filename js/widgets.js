/* widgets.js — 顶部小组件：时钟/搜索/天气/日历/常用/最近 + 组件拖拽 */
"use strict";

/* ===== widgets ===== */
function anyWidgetOn(){ for(var i=0;i<WKEYS.length;i++){ if(state.settings.widgets[WKEYS[i]]) return true; } return false; }
function renderWidgets(){
  stopClockTimer();
  if(typeof stopMonTimer==="function") stopMonTimer();
  var head=$("#widgetsHead"), wrap=$("#widgetsWrap"), s=state.settings;
  if(s.widgetsHidden || !anyWidgetOn()){ wrap.style.display="none"; return; }
  wrap.style.display=""; head.classList.toggle("collapsed", !!s.widgetsCollapsed);
  if(s.widgetsCollapsed){ widgetsEl.classList.add("hidden"); widgetsEl.innerHTML=""; return; }
  widgetsEl.classList.remove("hidden");
  normalizeWidgetOrder();
  var html="", idx=0;
  s.widgetOrder.forEach(function(key){
    if(!s.widgets[key]) return;
    var body, icon, title;
    if(key==="clock"){ icon=ICONS.clock; title=t("clock"); body=clockBody(); }
    else if(key==="search"){ icon=ICONS.gsearch; title=t("webSearch"); body=searchBody(); }
    else if(key==="weather"){ icon=ICONS.cloud; title=t("weather"); body='<div id="wxBody">'+weatherBody()+'</div>'; }
    else if(key==="netinfo"){ icon=ICONS.globe; title=t("ipLocation"); body='<div id="netinfoBody">'+netinfoBody()+'</div>'; }
    else if(key==="calendar"){ icon=ICONS.cal; title=t("calendar"); body='<div id="calBody">'+calendarBody()+'</div>'; }
    else if(key==="frequent"){ icon=ICONS.star; title=t("frequentlyUsed"); body=listBody("frequent"); }
    else if(key==="overview"){ icon=ICONS.gauge; title=t("overviewTitle"); body=overviewBody(); }
    else if(key==="notes"){ icon=ICONS.note; title=t("notesTitle"); body=notesBody(); }
    else if(key==="monitor"){ icon=ICONS.server; title=t("monitorTitle"); body=monitorBody(); }
    else { icon=ICONS.history; title=t("recentlyOpened"); body=listBody("recent"); }
    var anim=s.animations?(' style="animation-delay:'+(idx*0.06).toFixed(2)+'s"'):'';
    html+='<div class="widget" data-w="'+key+'"'+anim+'>'+
      '<div class="w-head" draggable="true" title="'+escapeHtml(t("dragReorderW"))+'"><h3>'+icon+escapeHtml(title)+'</h3><span class="w-grip" aria-hidden="true">'+ICONS.grip+'</span></div>'+body+'</div>';
    idx++;
  });
  widgetsEl.innerHTML=html;
  if(s.widgets.clock){ startClockTimer(); }
  if(s.widgets.weather){ ensureWeather(); }
  if(s.widgets.netinfo){ ensureNetInfo(); }
  if(s.widgets.monitor && typeof ensureMonitor==="function"){ ensureMonitor(); }
  layoutWidgets(false);      // 初次渲染先稳定落位，避免从空布局飞入
  scheduleWidgetLayout(false); // 再排一帧，补上同步测量后可能发生的内容变化
}

/* ===== Masonry 布局：按内容高度给每个组件分配 grid-row span，消除拉伸留白、保持源顺序 ===== */
var _wLayoutRAF=0, _wMoveTimer=0;
function scheduleWidgetLayout(animate){ if(_wLayoutRAF) return; _wLayoutRAF=requestAnimationFrame(function(){ _wLayoutRAF=0; layoutWidgets(animate!==false); }); }
function widgetRectMap(){
  var m={};
  $all(".widget", widgetsEl).forEach(function(w){
    if(w.classList.contains("draggingw")) return;
    var k=w.getAttribute("data-w"), r=w.getBoundingClientRect();
    if(k&&r.width&&r.height) m[k]={left:r.left,top:r.top};
  });
  return m;
}
function animateWidgetMoves(before){
  if(!before||dragW||document.hidden) return;
  var changed=false, movers=[];
  $all(".widget", widgetsEl).forEach(function(w){
    if(w.classList.contains("draggingw")) return;
    var k=w.getAttribute("data-w"), b=before[k]; if(!b) return;
    var r=w.getBoundingClientRect(), dx=b.left-r.left, dy=b.top-r.top;
    if(Math.abs(dx)<1&&Math.abs(dy)<1) return;
    changed=true; movers.push(w);
    w.classList.add("movingw");
    w.style.transition="none";
    w.style.transform="translate3d("+dx+"px,"+dy+"px,0)";
  });
  if(!changed) return;
  if(_wMoveTimer){ clearTimeout(_wMoveTimer); _wMoveTimer=0; }
  widgetsEl.classList.add("layout-moving");
  // Force style commit before animating back to the natural grid position.
  void widgetsEl.offsetHeight;
  movers.forEach(function(w){
    w.style.transition="transform .32s cubic-bezier(.2,.8,.2,1), box-shadow .24s var(--ease), border-color .2s, background .2s";
    w.style.transform="";
  });
  _wMoveTimer=setTimeout(function(){
    _wMoveTimer=0;
    widgetsEl.classList.remove("layout-moving");
    $all(".widget.movingw", widgetsEl).forEach(function(w){ w.classList.remove("movingw"); w.style.transition=""; w.style.transform=""; });
  }, 380);
}
function layoutWidgets(animate){
  if(!widgetsEl) return;
  if(dragW) return;          // 拖拽进行中不重排，避免把被拖组件的占位高度算回去引起抖动
  var cs=getComputedStyle(widgetsEl);
  if(cs.display!=="grid") return;
  var before=animate===false?null:widgetRectMap();
  var rowH=parseFloat(cs.gridAutoRows)||6, gap=14;
  var ws=$all(".widget", widgetsEl);
  for(var i=0;i<ws.length;i++){
    var w=ws[i]; if(w.classList.contains("draggingw")) continue;
    var h=w.getBoundingClientRect().height; if(!h) continue;
    w.style.gridRowEnd="span "+Math.max(1, Math.ceil((h+gap)/rowH));
  }
  if(animate!==false) animateWidgetMoves(before);
}
window.addEventListener("resize", scheduleWidgetLayout, {passive:true});

function clockBody(){
  return '<div class="clock-wrap">'+
    '<div class="clock-digits" id="wTime"></div>'+
    '<div class="clock-date" id="wDate"></div>'+
    '<div class="clock-greet" id="wGreet"></div>'+
  '</div>'+worldClockBody(new Date());
}
function worldClockZones(){
  var fallback=["UTC","America/New_York","America/Los_Angeles","America/Chicago","America/Denver","America/Toronto","America/Vancouver","Europe/London","Europe/Paris","Europe/Madrid","Europe/Berlin","Europe/Rome","Europe/Amsterdam","Europe/Zurich","Europe/Moscow","Europe/Istanbul","Asia/Shanghai","Asia/Hong_Kong","Asia/Taipei","Asia/Tokyo","Asia/Seoul","Asia/Singapore","Asia/Bangkok","Asia/Kuala_Lumpur","Asia/Jakarta","Asia/Manila","Asia/Dubai","Asia/Kolkata","Australia/Sydney","Australia/Melbourne","Pacific/Auckland"];
  var zones=[];
  try{ if(Intl.supportedValuesOf) zones=Intl.supportedValuesOf("timeZone")||[]; }catch(e){}
  if(!zones.length) zones=fallback.slice();
  var seen={}, out=[];
  zones.concat(fallback).forEach(function(z){ if(z&&!seen[z]){ seen[z]=1; out.push(z); } });
  return out;
}
function worldClockAliases(){
  return [
    ["Beijing","Asia/Shanghai","Beijing / 北京"],["北京","Asia/Shanghai","北京 / Beijing"],["Peking","Asia/Shanghai","Peking / Beijing"],
    ["Shanghai","Asia/Shanghai","Shanghai / 上海"],["上海","Asia/Shanghai","上海 / Shanghai"],
    ["Hong Kong","Asia/Hong_Kong","Hong Kong / 香港"],["香港","Asia/Hong_Kong","香港 / Hong Kong"],
    ["Taipei","Asia/Taipei","Taipei / 台北"],["台北","Asia/Taipei","台北 / Taipei"],
    ["Tokyo","Asia/Tokyo","Tokyo / 东京"],["东京","Asia/Tokyo","东京 / Tokyo"],["Seoul","Asia/Seoul","Seoul / 首尔"],["首尔","Asia/Seoul","首尔 / Seoul"],
    ["Singapore","Asia/Singapore","Singapore / 新加坡"],["新加坡","Asia/Singapore","新加坡 / Singapore"],
    ["Bangkok","Asia/Bangkok","Bangkok / 曼谷"],["曼谷","Asia/Bangkok","曼谷 / Bangkok"],
    ["Kuala Lumpur","Asia/Kuala_Lumpur","Kuala Lumpur / 吉隆坡"],["Jakarta","Asia/Jakarta","Jakarta / 雅加达"],["Manila","Asia/Manila","Manila / 马尼拉"],
    ["Dubai","Asia/Dubai","Dubai / 迪拜"],["迪拜","Asia/Dubai","迪拜 / Dubai"],["Delhi","Asia/Kolkata","Delhi / New Delhi"],["New Delhi","Asia/Kolkata","New Delhi / 新德里"],["新德里","Asia/Kolkata","新德里 / New Delhi"],
    ["London","Europe/London","London / 伦敦"],["伦敦","Europe/London","伦敦 / London"],["Paris","Europe/Paris","Paris / 巴黎"],["巴黎","Europe/Paris","巴黎 / Paris"],
    ["Madrid","Europe/Madrid","Madrid / 马德里"],["马德里","Europe/Madrid","马德里 / Madrid"],["Berlin","Europe/Berlin","Berlin / 柏林"],["柏林","Europe/Berlin","柏林 / Berlin"],
    ["Rome","Europe/Rome","Rome / 罗马"],["Amsterdam","Europe/Amsterdam","Amsterdam / 阿姆斯特丹"],["Zurich","Europe/Zurich","Zurich / 苏黎世"],["Moscow","Europe/Moscow","Moscow / 莫斯科"],["Istanbul","Europe/Istanbul","Istanbul / 伊斯坦布尔"],
    ["New York","America/New_York","New York / 纽约"],["纽约","America/New_York","纽约 / New York"],
    ["Los Angeles","America/Los_Angeles","Los Angeles / 洛杉矶"],["LA","America/Los_Angeles","LA / Los Angeles"],["洛杉矶","America/Los_Angeles","洛杉矶 / Los Angeles"],
    ["San Francisco","America/Los_Angeles","San Francisco / 旧金山"],["旧金山","America/Los_Angeles","旧金山 / San Francisco"],["Seattle","America/Los_Angeles","Seattle / 西雅图"],["西雅图","America/Los_Angeles","西雅图 / Seattle"],
    ["Chicago","America/Chicago","Chicago / 芝加哥"],["Denver","America/Denver","Denver / 丹佛"],["Toronto","America/Toronto","Toronto / 多伦多"],["Vancouver","America/Vancouver","Vancouver / 温哥华"],
    ["Sydney","Australia/Sydney","Sydney / 悉尼"],["悉尼","Australia/Sydney","悉尼 / Sydney"],["Melbourne","Australia/Melbourne","Melbourne / 墨尔本"],["Auckland","Pacific/Auckland","Auckland / 奥克兰"],
    ["UTC","UTC","UTC"],["GMT","UTC","GMT / UTC"]
  ].map(function(a){ return {value:a[0], tz:a[1], label:a[2]}; });
}
function worldClockOptions(){
  var opts=worldClockAliases().map(function(a){ return {value:a.value, label:a.label}; });
  worldClockZones().forEach(function(z){ opts.push({value:z,label:tzLabel(z)}); });
  return opts;
}
function tzLabel(tz){ return String(tz||"").replace(/_/g," ").replace(/\//g," / "); }
function tzCity(tz){ var p=String(tz||"").split("/"); return (p[p.length-1]||tz).replace(/_/g," "); }
function tzTime(tz, date){
  try{
    return new Intl.DateTimeFormat(LOCALE[state.settings.lang],{hour:"2-digit",minute:"2-digit",hour12:!state.settings.clock24h,timeZone:tz}).format(date||new Date());
  }catch(e){ return "—"; }
}
function tzOffsetLabel(tz, date){
  try{
    var s=new Intl.DateTimeFormat("en-US",{timeZone:tz,timeZoneName:"shortOffset",hour:"2-digit",minute:"2-digit"}).format(date||new Date());
    var m=s.match(/GMT[+-]\d{1,2}(?::\d{2})?|GMT/);
    return m?m[0]:"";
  }catch(e){ return ""; }
}
function worldClockList(){
  if(!Array.isArray(state.settings.worldClocks)) state.settings.worldClocks=[];
  return state.settings.worldClocks;
}
function findTimeZone(q){
  q=String(q||"").trim().toLowerCase(); if(!q) return "";
  if(q==="utc"||q==="gmt") return "UTC";
  var alias=worldClockAliases(), compact=q.replace(/[\s_-]+/g,"");
  for(var a=0;a<alias.length;a++){
    var av=alias[a].value.toLowerCase(), al=alias[a].label.toLowerCase(), ac=av.replace(/[\s_/-]+/g,"");
    if(av===q || ac===compact || al.indexOf(q)>-1) return alias[a].tz;
  }
  var zones=worldClockZones(), compact=q.replace(/[\s_-]+/g,"");
  for(var i=0;i<zones.length;i++){ if(zones[i].toLowerCase()===q) return zones[i]; }
  for(var j=0;j<zones.length;j++){
    var z=zones[j].toLowerCase(), c=z.replace(/[\s_/-]+/g,"");
    if(z.indexOf(q)>-1||c.indexOf(compact)>-1) return zones[j];
  }
  return "";
}
function worldClockBody(now){
  var clocks=worldClockList(), mode=state.settings.worldClockMode==="compact"?"compact":"stack";
  var rows=clocks.length?clocks.map(function(c){
    var tz=typeof c==="string"?c:c.tz, id=escapeHtml(tz), label=escapeHtml(tzCity(tz));
    if(mode==="compact") return '<div class="wc-chip" data-tz="'+id+'"><b>'+escapeHtml(tzTime(tz,now))+'</b><span>'+label+'</span><button type="button" data-clock-remove="'+id+'" title="'+escapeHtml(t("removeClock"))+'">×</button></div>';
    return '<div class="wc-row" data-tz="'+id+'"><div><b>'+label+'</b><small>'+escapeHtml(tzLabel(tz))+'</small></div><span>'+escapeHtml(tzTime(tz,now))+'</span><em>'+escapeHtml(tzOffsetLabel(tz,now))+'</em><button type="button" data-clock-remove="'+id+'" title="'+escapeHtml(t("removeClock"))+'">×</button></div>';
  }).join(""):'<div class="wc-empty">'+escapeHtml(t("worldClockEmpty"))+'</div>';
  return '<div class="world-clock">'+
    '<div class="wc-head"><b>'+escapeHtml(t("worldClock"))+'</b><div class="wc-mode"><button type="button" data-clock-mode="stack" class="'+(mode==="stack"?"on":"")+'">'+escapeHtml(t("clockStack"))+'</button><button type="button" data-clock-mode="compact" class="'+(mode==="compact"?"on":"")+'">'+escapeHtml(t("clockCompact"))+'</button></div></div>'+
    '<div class="wc-list '+mode+'" id="worldClockList">'+rows+'</div>'+
    '<form class="wc-add" id="worldClockForm"><input name="tz" type="text" list="tzOptions" placeholder="'+escapeHtml(t("worldClockPh"))+'" autocomplete="off" /><datalist id="tzOptions">'+worldClockOptions().map(function(o){ return '<option value="'+escapeHtml(o.value)+'">'+escapeHtml(o.label)+'</option>'; }).join("")+'</datalist><button type="submit">'+escapeHtml(t("addClock"))+'</button></form>'+
  '</div>';
}
function refreshWorldClockDom(){
  var w=$(".world-clock"); if(w){ w.outerHTML=worldClockBody(new Date()); layoutWidgets(); }
}
function tickClock(){
  var el=$("#wTime"); if(!el) return;
  var d=new Date(), h=d.getHours(), m=d.getMinutes(), sec=d.getSeconds();
  var is24=!!state.settings.clock24h, ampm=h>=12?"PM":"AM", mm=m<10?("0"+m):m;
  var hh=is24?(h<10?("0"+h):h):(h%12||12);
  var html='<span class="ch">'+hh+'</span><span class="csep">:</span><span class="ch">'+mm+'</span>';
  if(!is24) html+='<span class="campm">'+ampm+'</span>';
  if(state.settings.clockSeconds){
    var ss=sec<10?("0"+sec):sec;
    html+='<span class="csec">:'+ss+'</span>';
  }
  el.innerHTML=html;
  var de=$("#wDate");
  if(de) de.textContent=d.toLocaleDateString(LOCALE[state.settings.lang],{weekday:"long",month:"long",day:"numeric"});
  var g=$("#wGreet");
  if(g) g.textContent=h<5?t("goodNight"):h<12?t("goodMorning"):h<18?t("goodAfternoon"):t("goodEvening");
  var wc=$("#worldClockList");
  if(wc){
    $all("[data-tz]", wc).forEach(function(row){
      var tz=row.getAttribute("data-tz");
      if(row.classList.contains("wc-chip")){ var b=row.querySelector("b"); if(b) b.textContent=tzTime(tz,d); }
      else { var sp=row.querySelector("span"); if(sp) sp.textContent=tzTime(tz,d); var em=row.querySelector("em"); if(em) em.textContent=tzOffsetLabel(tz,d); }
    });
  }
}
function stopClockTimer(){
  if(clockTimer){ clearTimeout(clockTimer); clearInterval(clockTimer); clockTimer=null; }
}
function startClockTimer(){
  stopClockTimer();
  if(document.hidden || !$("#wTime")) return;
  tickClock();
  layoutWidgets();
  scheduleClockTick();
}
function scheduleClockTick(){
  var cadence=state.settings.clockSeconds?1000:60000;
  var delay=cadence-(Date.now()%cadence)+25;
  clockTimer=setTimeout(function(){ tickClock(); scheduleClockTick(); }, delay);
}
document.addEventListener("visibilitychange", function(){
  if(document.hidden) stopClockTimer();
  else if($("#wTime")) startClockTimer();
});
function currentEngine(){ var k=state.settings.searchEngine||"google"; return ENGINES[k]?k:"google"; }
function searchBody(){
  var cur=currentEngine(), chips="";
  engineDisplayOrder().forEach(function(k){ var e=ENGINES[k]; chips+='<button type="button" class="engine-pill'+(k===cur?" on":"")+'" data-engine="'+k+'"><span class="ed" style="background:'+e.c+'"></span>'+escapeHtml(e.label)+'</button>'; });
  return '<div class="engine-strip">'+chips+'</div><form class="gform" id="gForm"><input name="q" type="text" placeholder="'+escapeHtml(t("searchWebPh"))+'" autocomplete="off" /><button type="submit" title="'+escapeHtml(ENGINES[cur].label)+'">'+ICONS.gsearch+'</button></form><div class="g-hint">'+escapeHtml(t("searchHint",{engine:ENGINES[cur].label}))+'</div>';
}
function runWebSearch(q){ q=String(q||"").trim(); if(!q) return; var k=currentEngine(), e=ENGINES[k]||ENGINES.google; bumpEngineUsage(k); save(); window.open(e.url+encodeURIComponent(q),"_blank","noopener"); }

var WMO={0:["Clear","☀️"],1:["Mainly clear","🌤️"],2:["Partly cloudy","⛅"],3:["Overcast","☁️"],45:["Fog","🌫️"],48:["Rime fog","🌫️"],51:["Light drizzle","🌦️"],53:["Drizzle","🌦️"],55:["Heavy drizzle","🌦️"],56:["Freezing drizzle","🌧️"],57:["Freezing drizzle","🌧️"],61:["Light rain","🌦️"],63:["Rain","🌧️"],65:["Heavy rain","🌧️"],66:["Freezing rain","🌧️"],67:["Freezing rain","🌧️"],71:["Light snow","🌨️"],73:["Snow","🌨️"],75:["Heavy snow","❄️"],77:["Snow grains","❄️"],80:["Showers","🌦️"],81:["Showers","🌦️"],82:["Heavy showers","⛈️"],85:["Snow showers","🌨️"],86:["Snow showers","🌨️"],95:["Thunderstorm","⛈️"],96:["Thunderstorm","⛈️"],99:["Thunderstorm","⛈️"]};
var weatherSearchResults=[], weatherSearching=false, weatherSearchQuery="";
function weatherLabel(g){
  return [g.name, g.admin2, g.admin1, g.country_code||g.country].filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(", ");
}
function weatherPanel(){
  if(ui.weatherPanel==="forecast") return weatherForecastPanel();
  if(ui.weatherPanel==="search") return weatherSearchPanel();
  return "";
}
function weatherForecastPanel(){
  var d=weatherCache&&weatherCache.data, daily=d&&d.daily;
  if(!daily||!daily.length) return "";
  var unit=state.settings.weatherUnit==="f"?"°F":"°C";
  var rows=daily.slice(0,7).map(function(day,i){
    var info=WMO[day.code]||["",""];
    var dt=new Date(day.date+"T12:00:00");
    var name=i===0?t("today"):dt.toLocaleDateString(LOCALE[state.settings.lang],{weekday:"short"});
    var pop=day.pop!=null?('<span class="wx-pop">'+Math.round(day.pop)+'%</span>'):"";
    return '<div class="wx-day"><span class="wx-day-name">'+escapeHtml(name)+'</span><span class="wx-day-ico">'+info[1]+'</span><span class="wx-day-temp">'+Math.round(day.max)+unit+' / '+Math.round(day.min)+unit+'</span>'+pop+'</div>';
  }).join("");
  return '<div class="wx-panel"><div class="wx-panel-head"><b>'+escapeHtml(t("forecast7"))+'</b><button class="link-btn" data-wact="closePanel">'+escapeHtml(t("close"))+'</button></div>'+rows+'</div>';
}
function weatherSearchPanel(){
  var results="";
  if(weatherSearching) results='<div class="wx-msg">'+escapeHtml(t("searchingArea"))+'</div>';
  else if(weatherSearchResults.length){
    results='<div class="wx-results">'+weatherSearchResults.map(function(g,i){
      return '<button type="button" data-wloc="'+i+'"><span>'+escapeHtml(weatherLabel(g))+'</span><small>'+escapeHtml([g.latitude&&Number(g.latitude).toFixed(2),g.longitude&&Number(g.longitude).toFixed(2)].filter(Boolean).join(", "))+'</small></button>';
    }).join("")+'</div>';
  } else if(weatherSearchQuery){
    results='<div class="wx-msg">'+escapeHtml(t("cityNotFound"))+'</div>';
  }
  return '<div class="wx-panel"><div class="wx-panel-head"><b>'+escapeHtml(t("areaSearch"))+'</b><button class="link-btn" data-wact="closePanel">'+escapeHtml(t("close"))+'</button></div><form class="wx-set" id="wxSearchForm"><input type="text" id="wxSearchCity" value="'+escapeHtml(weatherSearchQuery)+'" placeholder="'+escapeHtml(t("enterCity"))+'" /><button class="btn primary" type="submit" style="height:36px;padding:0 12px;">'+escapeHtml(t("searchArea"))+'</button></form>'+results+'<button class="link-btn" data-wact="geo" style="margin-top:8px;">'+escapeHtml(t("useMyLocation"))+'</button></div>';
}
function weatherBody(){
  var s=state.settings;
  if(weatherCache&&weatherCache.data){
    var d=weatherCache.data, info=WMO[d.code]||["",""], unit=s.weatherUnit==="f"?"°F":"°C";
    return '<div class="wx"><div class="emoji">'+info[1]+'</div><div><div class="temp">'+Math.round(d.temp)+unit+'</div><div class="desc">'+escapeHtml(info[0])+'</div><div class="loc">'+escapeHtml(s.weather?s.weather.label:"")+'</div></div></div>'+
      '<div class="wx-extra"><div>'+escapeHtml(t("wind"))+' <b>'+Math.round(d.wind)+(s.weatherUnit==="f"?" mph":" km/h")+'</b></div><div>'+escapeHtml(t("humidity"))+' <b>'+(d.hum!=null?d.hum+"%":"—")+'</b></div><div class="spacer"></div><button class="link-btn" data-wact="forecast">'+escapeHtml(t("forecast7"))+'</button><button class="link-btn" data-wact="changeWeather">'+escapeHtml(t("changeArea"))+'</button><div class="wx-unit"><button data-unit="c" class="'+(s.weatherUnit==="c"?"on":"")+'">°C</button><button data-unit="f" class="'+(s.weatherUnit==="f"?"on":"")+'">°F</button></div></div>'+weatherPanel();
  }
  if(weatherCache&&weatherCache.error==="locate"){
    ui.weatherPanel="search";
    return '<div class="wx-msg">'+escapeHtml(t("setLocation"))+'</div>'+weatherSearchPanel();
  }
  if(weatherCache&&weatherCache.error){
    return '<div class="wx-msg">'+escapeHtml(t("couldntLoad"))+' <button class="link-btn" data-wact="retry">'+escapeHtml(t("retry"))+'</button></div>'+weatherSearchPanel();
  }
  return '<div class="wx-skel"></div>';
}
function ensureWeather(){
  var s=state.settings;
  if(weatherCache&&weatherCache.data){ var key=s.weather?(s.weather.lat+","+s.weather.lon+","+s.weatherUnit):""; if(weatherCache.key===key&&(Date.now()-weatherCache.ts)<15*60*1000) return; }
  if(s.weather){ fetchWeather(s.weather.lat, s.weather.lon); return; }
  if(!ui.geoTried){
    ui.geoTried=true;
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(function(pos){ state.settings.weather={lat:pos.coords.latitude,lon:pos.coords.longitude,label:t("useMyLocation")}; save(); fetchWeather(state.settings.weather.lat,state.settings.weather.lon); },
        function(){ weatherCache={error:"locate"}; refreshWeatherDom(); }, {timeout:8000,maximumAge:600000});
    } else { weatherCache={error:"locate"}; refreshWeatherDom(); }
  } else if(!weatherCache){ weatherCache={error:"locate"}; refreshWeatherDom(); }
}
function fetchWeather(lat,lon){
  var s=state.settings, key=lat+","+lon+","+s.weatherUnit;
  var tu=s.weatherUnit==="f"?"fahrenheit":"celsius", wu=s.weatherUnit==="f"?"mph":"kmh";
  var url="https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+"&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=auto&temperature_unit="+tu+"&wind_speed_unit="+wu;
  fetch(url).then(function(r){ return r.json(); }).then(function(j){
    var c=j.current||{}, dy=j.daily||{}, days=[];
    (dy.time||[]).forEach(function(day,i){ days.push({date:day, code:(dy.weather_code||[])[i], max:(dy.temperature_2m_max||[])[i], min:(dy.temperature_2m_min||[])[i], pop:(dy.precipitation_probability_max||[])[i]}); });
    weatherCache={key:key,ts:Date.now(),data:{temp:c.temperature_2m,code:c.weather_code,wind:c.wind_speed_10m,hum:c.relative_humidity_2m,daily:days}};
    refreshWeatherDom();
  }).catch(function(){ weatherCache={error:"net",ts:Date.now()}; refreshWeatherDom(); });
}
function refreshWeatherDom(){ var b=$("#wxBody"); if(b){ b.innerHTML=weatherBody(); layoutWidgets(); } }
function refreshCalDom(){ var b=$("#calBody"); if(b){ b.innerHTML=calendarBody(); layoutWidgets(); } }

/* ===== IP & location widget ===== */
function niRow(k,v){ return '<div class="ni-row"><span class="ni-k">'+escapeHtml(k)+'</span><span class="ni-v" title="'+escapeHtml(v)+'">'+escapeHtml(v)+'</span></div>'; }
function netinfoBody(){
  if(netInfoCache&&netInfoCache.data){
    var d=netInfoCache.data, loc=[d.city,d.region].filter(Boolean).join(", ");
    var rows=niRow("IP", d.ip||"—");
    if(d.isp) rows+=niRow(t("ipISP"), d.isp);
    return '<div class="netinfo">'+
      '<div class="ni-top">'+(d.flag?'<span class="ni-flag">'+escapeHtml(d.flag)+'</span>':ICONS.globe)+
        '<div class="ni-loc"><div class="ni-city">'+escapeHtml(loc||d.country||t("ipUnknown"))+'</div>'+
        '<div class="ni-country">'+escapeHtml(loc?d.country:"")+'</div></div></div>'+
      '<div class="ni-rows">'+rows+'</div></div>';
  }
  if(netInfoCache&&netInfoCache.error){
    return '<div class="wx-msg">'+escapeHtml(t("ipError"))+' <button class="link-btn" data-wact="ipretry">'+escapeHtml(t("retry"))+'</button></div>';
  }
  return '<div class="wx-skel"></div>';
}
function refreshNetInfoDom(){ var b=$("#netinfoBody"); if(b){ b.innerHTML=netinfoBody(); layoutWidgets(); } }
function ensureNetInfo(){
  if(netInfoCache&&netInfoCache.loading) return;
  if(netInfoCache&&netInfoCache.data&&(Date.now()-netInfoCache.ts)<30*60*1000) return;
  fetchNetInfo();
}
function fetchNetInfo(){
  netInfoCache={loading:true};
  fetch("https://ipwho.is/").then(function(r){ return r.json(); }).then(function(j){
    if(j&&j.success!==false&&j.ip) return { ip:j.ip, city:j.city, region:j.region, country:j.country, flag:(j.flag&&j.flag.emoji)||"", isp:(j.connection&&(j.connection.isp||j.connection.org))||"" };
    throw new Error("bad");
  }).catch(function(){
    return fetch("https://ipapi.co/json/").then(function(r){ return r.json(); }).then(function(j){
      if(j&&j.ip) return { ip:j.ip, city:j.city, region:j.region, country:j.country_name||j.country, flag:"", isp:j.org||"" };
      throw new Error("bad");
    });
  }).then(function(d){
    netInfoCache={ts:Date.now(),data:d}; refreshNetInfoDom();
  }).catch(function(){
    netInfoCache={error:1,ts:Date.now()}; refreshNetInfoDom();
  });
}

function easterDate(y){ var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1; return new Date(y,mo-1,da); }
function addDays(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
function md(d){ return (d.getMonth()+1)+"-"+d.getDate(); }
// day-of-month for the nth given weekday of a month (dow: 0=Sun..6=Sat), and for the last such weekday
function nthDow(y,month0,dow,n){ var first=new Date(y,month0,1).getDay(); return 1+((dow-first+7)%7)+(n-1)*7; }
function lastDow(y,month0,dow){ var last=new Date(y,month0+1,0), ld=last.getDate(); return ld-((last.getDay()-dow+7)%7); }
function holidayMap(y){
  var l=state.settings.lang, m={};
  function add(month,day,en,zh,es){ if(day>=1) m[month+"-"+day]=l==="zh"?zh:(l==="es"?es:en); }
  add(1,1,"New Year’s Day","元旦","Año Nuevo");
  if(l==="zh"){
    add(2,14,"Valentine’s Day","情人节","San Valentín");
    add(3,8,"Women’s Day","妇女节","Día de la Mujer");
    add(5,1,"Labour Day","劳动节","Día del Trabajo");
    add(5,4,"Youth Day","青年节","Día de la Juventud");
    add(6,1,"Children’s Day","儿童节","Día del Niño");
    add(9,10,"Teachers’ Day","教师节","Día del Maestro");
    add(10,1,"National Day","国庆节","Día Nacional");
    add(12,24,"Christmas Eve","平安夜","Nochebuena");
    add(12,25,"Christmas","圣诞节","Navidad");
  } else if(l==="es"){
    add(1,6,"Epiphany","主显节","Reyes Magos");
    var e1=easterDate(y); m[md(addDays(e1,-2))]="Viernes Santo"; m[md(addDays(e1,1))]="Lunes de Pascua";
    add(5,1,"Labour Day","劳动节","Día del Trabajo");
    add(8,15,"Assumption Day","圣母升天节","Asunción");
    add(10,12,"National Day of Spain","西班牙国庆日","Día de la Hispanidad");
    add(11,1,"All Saints’ Day","诸圣节","Todos los Santos");
    add(12,6,"Constitution Day","宪法日","Día de la Constitución");
    add(12,8,"Immaculate Conception","圣母无染原罪节","Inmaculada Concepción");
    add(12,25,"Christmas","圣诞节","Navidad");
  } else {
    add(1,nthDow(y,0,1,3),"MLK Jr. Day","马丁·路德·金纪念日","Día de MLK");
    add(2,14,"Valentine’s Day","情人节","San Valentín");
    add(2,nthDow(y,1,1,3),"Presidents’ Day","总统日","Día de los Presidentes");
    add(5,lastDow(y,4,1),"Memorial Day","阵亡将士纪念日","Día de los Caídos");
    add(6,19,"Juneteenth","六月节","Juneteenth");
    add(7,4,"Independence Day","独立日","Día de la Independencia");
    add(9,nthDow(y,8,1,1),"Labor Day","劳动节","Día del Trabajo");
    add(10,31,"Halloween","万圣节前夜","Halloween");
    add(11,11,"Veterans Day","退伍军人节","Día de los Veteranos");
    add(11,nthDow(y,10,4,4),"Thanksgiving","感恩节","Acción de Gracias");
    add(12,25,"Christmas","圣诞节","Navidad");
    add(12,31,"New Year’s Eve","跨年夜","Nochevieja");
  }
  return m;
}

function calDateKey(d){
  var y=d.getFullYear(), m=d.getMonth()+1, day=d.getDate();
  return y+"-"+(m<10?"0"+m:m)+"-"+(day<10?"0"+day:day);
}
function calDateFromKey(k){
  var p=String(k||"").split("-").map(function(v){ return parseInt(v,10); });
  if(p.length!==3||!p[0]||!p[1]||!p[2]) return new Date();
  return new Date(p[0],p[1]-1,p[2]);
}
function calStart(d){ return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(); }
function calEvents(){
  if(!Array.isArray(state.calendarEvents)) state.calendarEvents=[];
  return state.calendarEvents;
}
function calEventsFor(key){
  return calEvents().filter(function(e){ return e&&e.date===key; }).sort(function(a,b){ return (a.done===b.done?0:(a.done?1:-1)) || ((a.createdAt||0)-(b.createdAt||0)); });
}
function calMonthEventCounts(y,m){
  var out={};
  calEvents().forEach(function(e){
    if(!e||!e.date) return;
    if(e.done && !state.settings.calendarShowDoneBadges) return;
    var d=calDateFromKey(e.date);
    if(d.getFullYear()===y&&d.getMonth()===m) out[e.date]=(out[e.date]||0)+1;
  });
  return out;
}
function calSelectedDate(y,m){
  var today=new Date(), chosen=ui.calSelected?calDateFromKey(ui.calSelected):null;
  if(chosen&&chosen.getFullYear()===y&&chosen.getMonth()===m) return chosen;
  if(today.getFullYear()===y&&today.getMonth()===m) return today;
  return new Date(y,m,1);
}
function calRelativeText(d){
  var diff=Math.round((calStart(d)-calStart(new Date()))/86400000);
  if(diff===0) return t("calToday");
  if(diff===-1) return t("calYesterday");
  if(diff===1) return t("calTomorrow");
  return diff<0?t("calDaysAgo",{n:Math.abs(diff)}):t("calDaysLater",{n:diff});
}
function calWeekNumber(d){
  var x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  x.setHours(0,0,0,0);
  x.setDate(x.getDate()+3-((x.getDay()+6)%7));
  var w1=new Date(x.getFullYear(),0,4);
  return 1+Math.round(((x-w1)/86400000-3+((w1.getDay()+6)%7))/7);
}
function calUpcomingEvents(limit){
  var now=calStart(new Date());
  return calEvents().filter(function(e){ return e&&!e.done&&e.date&&calStart(calDateFromKey(e.date))>=now; })
    .sort(function(a,b){ return a.date===b.date?((a.createdAt||0)-(b.createdAt||0)):a.date.localeCompare(b.date); })
    .slice(0,limit||3);
}
function calendarDetail(date, holidayName){
  var key=calDateKey(date), events=calEventsFor(key), dow=date.getDay(), isWeekend=(dow===0||dow===6);
  var dateLabel=date.toLocaleDateString(LOCALE[state.settings.lang],{weekday:"long",month:"long",day:"numeric"});
  var chips='<span>'+escapeHtml(calRelativeText(date))+'</span><span>'+escapeHtml(isWeekend?t("calWeekend"):t("calWeekday"))+'</span><span>'+escapeHtml(t("calWeekNo",{n:calWeekNumber(date)}))+'</span>';
  if(holidayName) chips+='<span class="holiday-chip">'+escapeHtml(holidayName)+'</span>';
  var rows="";
  if(events.length){
    rows=events.map(function(ev){
      return '<div class="cal-event'+(ev.done?" done":"")+'" data-event-id="'+escapeHtml(ev.id)+'">'+
        '<button type="button" class="cal-check" data-cal-done="'+escapeHtml(ev.id)+'" title="'+escapeHtml(t("calToggleDone"))+'">'+(ev.done?"✓":"")+'</button>'+
        '<span>'+escapeHtml(ev.text)+'</span>'+
        '<button type="button" class="cal-x" data-cal-del="'+escapeHtml(ev.id)+'" title="'+escapeHtml(t("delete"))+'">×</button>'+
      '</div>';
    }).join("");
  } else {
    rows='<div class="cal-empty">'+escapeHtml(t("calNoReminder"))+'</div>';
  }
  var upcoming=calUpcomingEvents(3).filter(function(ev){ return ev.date!==key; });
  var up="";
  if(upcoming.length){
    up='<div class="cal-upcoming"><div class="cal-subtitle">'+escapeHtml(t("calUpcoming"))+'</div>'+
      upcoming.map(function(ev){
        var d=calDateFromKey(ev.date);
        return '<button type="button" data-cal-open="'+escapeHtml(ev.date)+'"><b>'+escapeHtml(d.toLocaleDateString(LOCALE[state.settings.lang],{month:"short",day:"numeric"}))+'</b><span>'+escapeHtml(ev.text)+'</span></button>';
      }).join("")+'</div>';
  }
  return '<div class="cal-detail" data-cal-selected="'+escapeHtml(key)+'">'+
    '<div class="cal-picked"><div><b>'+escapeHtml(dateLabel)+'</b><small>'+escapeHtml(key)+'</small></div></div>'+
    '<div class="cal-chips">'+chips+'</div>'+
    '<form class="cal-add" id="calEventForm"><input name="event" type="text" maxlength="80" placeholder="'+escapeHtml(t("calReminderPh"))+'" autocomplete="off" /><button type="submit">'+escapeHtml(t("calAddReminder"))+'</button></form>'+
    '<label class="cal-done-badges"><input type="checkbox" id="calShowDoneBadges"'+(state.settings.calendarShowDoneBadges?" checked":"")+'><span>'+escapeHtml(t("calShowDoneBadges"))+'</span></label>'+
    '<div class="cal-events">'+rows+'</div>'+up+
  '</div>';
}
function calendarBody(){
  var y=ui.calYear, m=ui.calMonth, first=new Date(y,m,1), startDow=first.getDay(), days=new Date(y,m+1,0).getDate();
  var today=new Date(), isThis=(today.getFullYear()===y&&today.getMonth()===m);
  var monthName=first.toLocaleDateString(LOCALE[state.settings.lang],{month:"long",year:"numeric"});
  var dows=DOWS[state.settings.lang]||DOWS.en;
  var atToday=isThis;
  var selected=calSelectedDate(y,m), selectedKey=calDateKey(selected);
  var yearOpts="", monthOpts="";
  for(var yy=today.getFullYear()-80; yy<=today.getFullYear()+80; yy++){ yearOpts+='<option value="'+yy+'"'+(yy===y?" selected":"")+'>'+yy+'</option>'; }
  for(var mm=0; mm<12; mm++){ var md=new Date(y,mm,1); monthOpts+='<option value="'+mm+'"'+(mm===m?" selected":"")+'>'+escapeHtml(md.toLocaleDateString(LOCALE[state.settings.lang],{month:"short"}))+'</option>'; }
  var h='<div class="cal-head"><button class="cal-title" data-cal="today" title="'+escapeHtml(t("today"))+'"><span class="m">'+escapeHtml(monthName)+'</span></button><div class="cal-nav"><button data-cal="prev" title="‹">'+ICONS.chevL+'</button><button data-cal="today" class="cal-now'+(atToday?" cur":"")+'" title="'+escapeHtml(t("today"))+'"><span class="dot"></span></button><button data-cal="next" title="›">'+ICONS.chevR+'</button></div></div><div class="cal-jump"><select id="calJumpMonth" title="'+escapeHtml(t("calJumpMonth"))+'">'+monthOpts+'</select><select id="calJumpYear" title="'+escapeHtml(t("calJumpYear"))+'">'+yearOpts+'</select></div><div class="cal-grid">';
  dows.forEach(function(d,i){ h+='<div class="dow'+(i===0||i===6?" we":"")+'">'+escapeHtml(d)+'</div>'; });
  for(var i=0;i<startDow;i++){ h+='<div class="day blank"></div>'; }
  var holidays=state.settings.showHolidays===false?{}:holidayMap(y);
  var monthHols=[], eventCounts=calMonthEventCounts(y,m), selectedHoliday=holidays[(selected.getMonth()+1)+"-"+selected.getDate()];
  for(var dd=1;dd<=days;dd++){
    var dow=new Date(y,m,dd).getDay(), we=(dow===0||dow===6);
    var key=calDateKey(new Date(y,m,dd)), tdy=isThis&&dd===today.getDate(), hn=holidays[(m+1)+"-"+dd], evn=eventCounts[key]||0;
    if(hn) monthHols.push({d:dd,name:hn});
    h+='<button type="button" class="day'+(tdy?" today":"")+(we?" we":"")+(hn?" holiday":"")+(key===selectedKey?" selected":"")+(evn?" has-event":"")+'" data-cal-day="'+escapeHtml(key)+'"'+(hn?' title="'+escapeHtml(hn)+'"':'')+'><span>'+dd+'</span>'+(evn?'<i>'+evn+'</i>':"")+'</button>';
  }
  for(var tail=startDow+days; tail<42; tail++){ h+='<div class="day blank"></div>'; }
  h+='</div>';
  if(monthHols.length){
    h+='<div class="cal-hols">';
    monthHols.forEach(function(o){ h+='<div class="cal-hol"'+( (isThis&&o.d===today.getDate())?' data-tdy="1"':'')+'><span class="hd">'+o.d+'</span><span class="hn">'+escapeHtml(o.name)+'</span></div>'; });
    h+='</div>';
  }
  h+=calendarDetail(selected, selectedHoliday);
  return h;
}
function listBody(kind){
  var items,empty;
  if(kind==="frequent"){
    var favs=state.bookmarks.filter(function(b){return !!b.favorite;}).sort(function(a,b){return (b.lastOpened||0)-(a.lastOpened||0);}).slice(0,4);
    var favIds={}; favs.forEach(function(b){ favIds[b.id]=1; });
    var auto=state.bookmarks.filter(function(b){return !favIds[b.id]&&(b.clicks||0)>0;}).sort(function(a,b){return (b.clicks||0)-(a.clicks||0);}).slice(0,Math.max(0,5-favs.length));
    items=favs.concat(auto); empty=t("frequentEmpty");
  }
  else { items=state.bookmarks.filter(function(b){return (b.lastOpened||0)>0;}).sort(function(a,b){return (b.lastOpened||0)-(a.lastOpened||0);}).slice(0,5); empty=t("recentEmpty"); }
  var hasStats=kind==="frequent"?state.bookmarks.some(function(b){ return (b.clicks||0)>0; }):state.bookmarks.some(function(b){ return (b.lastOpened||0)>0; });
  var h='<div class="mini-tools">'+(kind==="frequent"?'<button type="button" data-fav-add="1">'+escapeHtml(t("addFavoritePage"))+'</button>':"")+'<button type="button" data-list-clear="'+kind+'"'+(hasStats?"":" disabled")+'>'+escapeHtml(kind==="frequent"?t("clearFrequent"):t("clearRecent"))+'</button></div>';
  if(!items.length){ return h+'<div class="w-empty">'+escapeHtml(empty)+'</div>'; }
  h+='<div class="mini-list">';
  items.forEach(function(b,i){
    var dom=getDomain(b.url), hue=hashHue(dom||b.title), letter=(b.title||dom||"?").trim().charAt(0)||"?", fav=faviconUrl(b.url);
    var badge = kind==="frequent"?'<button type="button" class="fav-toggle'+(b.favorite?" on":"")+'" data-fav-toggle="'+escapeHtml(b.id)+'" title="'+escapeHtml(b.favorite?t("removeFavorite"):t("addFavorite"))+'">★</button>':'<span class="msub mini-time">'+escapeHtml(timeAgo(b.lastOpened))+'</span>';
    var sub = prettyUrl(b.url);
    h+='<div class="mini" style="--i:'+i+'" data-open="'+escapeHtml(b.id)+'" title="'+escapeHtml(b.url)+'"><div class="fav" style="--c:'+hue+'"><span class="letter">'+escapeHtml(letter)+'</span>'+(fav?'<img class="fav-img" loading="lazy" alt="" src="'+escapeHtml(fav)+'"/>':'')+'</div><div class="mtext"><div class="mname">'+escapeHtml(b.title||dom)+'</div><div class="msub">'+escapeHtml(sub)+'</div></div>'+badge+'</div>';
  });
  return h+'</div>';
}

/* ===== Notes（便签）：本地速记，纯 localStorage，隐私模式下照常工作 ===== */
function notesBody(){
  var v=state.settings.notes||"";
  return '<div class="notes-wrap">'+
    '<textarea id="notesArea" class="notes-area" spellcheck="false" placeholder="'+escapeHtml(t("notesPh"))+'">'+escapeHtml(v)+'</textarea>'+
    '<div class="notes-foot"><span id="notesCount">'+(v?String(v.length):"")+'</span></div>'+
  '</div>';
}
var _notesSaveTimer=0;
function onNotesInput(ta){
  state.settings.notes=ta.value;
  var c=$("#notesCount"); if(c) c.textContent=ta.value?String(ta.value.length):"";
  if(_notesSaveTimer) clearTimeout(_notesSaveTimer);
  _notesSaveTimer=setTimeout(function(){ _notesSaveTimer=0; save(); }, 500);
}
function flushNotes(ta){ if(_notesSaveTimer){ clearTimeout(_notesSaveTimer); _notesSaveTimer=0; } state.settings.notes=ta.value; save(); }

/* ===== Overview（概览）：把已有数据聚成一屏，纯自有数据、零外部请求 ===== */
function overviewStats(){
  var dead=0, warn=0, lastCheck=0;
  state.bookmarks.forEach(function(b){
    if(b.health){
      if(b.health.status==="bad") dead++; else if(b.health.status==="warn") warn++;
      if((b.health.ts||0)>lastCheck) lastCheck=b.health.ts;
    }
  });
  var si=(typeof storageInfo==="function")?storageInfo():{pct:0,kb:0};
  return {
    bm:state.bookmarks.length, cats:state.categories.length,
    dead:dead, warn:warn, issues:dead+warn, lastCheck:lastCheck,
    storagePct:si.pct, storageKb:si.kb,
    trash:Array.isArray(state.trash)?state.trash.length:0,
    lastSync:state.settings.chromeSyncLastSync||0
  };
}
function overviewBody(){
  var s=overviewStats();
  function tile(val,label,ov,cls){
    var tag=ov?"button":"div", attr=ov?' type="button" data-ov="'+ov+'"':'';
    return '<'+tag+' class="ov-tile'+(ov?" act":"")+(cls?" "+cls:"")+'"'+attr+'>'+
      '<span class="ov-val">'+escapeHtml(String(val))+'</span><span class="ov-label">'+escapeHtml(label)+'</span></'+tag+'>';
  }
  var h='<div class="ov-grid">';
  h+=tile(s.bm, t("ovBookmarks"), "all", "");
  h+=tile(s.cats, t("ovCategories"), "", "");
  h+=tile(s.issues, t("ovDeadLinks"), "health", s.issues>0?"warn":"ok");
  h+=tile(s.storagePct+"%", t("ovStorage"), "storage", s.storagePct>=80?"warn":"");
  h+='</div>';
  h+='<div class="ov-bar" title="'+escapeHtml(t("ovStorage"))+'"><i class="'+(s.storagePct>=90?"full":(s.storagePct>=80?"warn":""))+'" style="width:'+Math.max(2,Math.min(100,s.storagePct))+'%"></i></div>';
  var meta=[];
  if(s.trash>0) meta.push('<button type="button" class="ov-link" data-ov="trash">'+escapeHtml(t("ovTrash",{n:s.trash}))+'</button>');
  if(s.lastSync) meta.push('<span>'+escapeHtml(t("ovLastSync",{t:timeAgo(s.lastSync)}))+'</span>');
  else if(s.lastCheck) meta.push('<span>'+escapeHtml(t("ovLastCheck",{t:timeAgo(s.lastCheck)}))+'</span>');
  if(meta.length) h+='<div class="ov-foot">'+meta.join('<span class="ov-sep">·</span>')+'</div>';
  return h;
}

// widget interactions
widgetsEl.addEventListener("click", function(e){
  var ov=e.target.closest("[data-ov]"); if(ov){ var oa=ov.getAttribute("data-ov");
    if(oa==="health"){ if(typeof openHealthIssues==="function") openHealthIssues(); }
    else if(oa==="storage"){ if(typeof openSettings==="function") openSettings("general"); }
    else if(oa==="trash"){ if(typeof openTrash==="function") openTrash(); }
    else if(oa==="all"){ setActiveCat("All"); }
    return;
  }
  var eng=e.target.closest("[data-engine]"); if(eng){ state.settings.searchEngine=eng.getAttribute("data-engine"); save(); refreshSearchWidget(); return; }
  var favAdd=e.target.closest("[data-fav-add]"); if(favAdd){ openAdd({favorite:true}); return; }
  var favToggle=e.target.closest("[data-fav-toggle]"); if(favToggle){ e.stopPropagation(); toggleFavoriteBookmark(favToggle.getAttribute("data-fav-toggle")); return; }
  var listClear=e.target.closest("[data-list-clear]"); if(listClear&&!listClear.disabled){ clearWidgetList(listClear.getAttribute("data-list-clear")); return; }
  var clockMode=e.target.closest("[data-clock-mode]"); if(clockMode){ state.settings.worldClockMode=clockMode.getAttribute("data-clock-mode")==="compact"?"compact":"stack"; save(); refreshWorldClockDom(); return; }
  var clockRemove=e.target.closest("[data-clock-remove]"); if(clockRemove){ removeWorldClock(clockRemove.getAttribute("data-clock-remove")); return; }
  var open=e.target.closest("[data-open]"); if(open){ openBookmark(open.getAttribute("data-open")); return; }
  var calDay=e.target.closest("[data-cal-day]"); if(calDay){ ui.calSelected=calDay.getAttribute("data-cal-day"); refreshCalDom(); return; }
  var calOpen=e.target.closest("[data-cal-open]"); if(calOpen){ var od=calDateFromKey(calOpen.getAttribute("data-cal-open")); ui.calYear=od.getFullYear(); ui.calMonth=od.getMonth(); ui.calSelected=calDateKey(od); refreshCalDom(); return; }
  var calDone=e.target.closest("[data-cal-done]"); if(calDone){ toggleCalendarEvent(calDone.getAttribute("data-cal-done")); return; }
  var calDel=e.target.closest("[data-cal-del]"); if(calDel){ deleteCalendarEvent(calDel.getAttribute("data-cal-del")); return; }
  var cal=e.target.closest("[data-cal]"); if(cal){ var a=cal.getAttribute("data-cal"); if(a==="prev"){ ui.calMonth--; if(ui.calMonth<0){ui.calMonth=11;ui.calYear--;} } else if(a==="next"){ ui.calMonth++; if(ui.calMonth>11){ui.calMonth=0;ui.calYear++;} } else { var td=new Date(); ui.calMonth=td.getMonth(); ui.calYear=td.getFullYear(); ui.calSelected=calDateKey(td); } refreshCalDom(); return; }
  var unit=e.target.closest("[data-unit]"); if(unit){ state.settings.weatherUnit=unit.getAttribute("data-unit"); save(); if(state.settings.weather) fetchWeather(state.settings.weather.lat,state.settings.weather.lon); return; }
  var wloc=e.target.closest("[data-wloc]"); if(wloc){ selectWeatherResult(+wloc.getAttribute("data-wloc")); return; }
  var wact=e.target.closest("[data-wact]"); if(wact){ var act=wact.getAttribute("data-wact"); if(act==="geo"){ ui.geoTried=false; ui.weatherPanel=""; weatherSearchResults=[]; weatherSearchQuery=""; weatherCache=null; state.settings.weather=null; save(); refreshWeatherDom(); ensureWeather(); } else if(act==="retry"){ weatherCache=null; ui.geoTried=false; refreshWeatherDom(); ensureWeather(); } else if(act==="forecast"){ ui.weatherPanel=ui.weatherPanel==="forecast"?"":"forecast"; refreshWeatherDom(); } else if(act==="changeWeather"){ ui.weatherPanel=ui.weatherPanel==="search"?"":"search"; refreshWeatherDom(); } else if(act==="closePanel"){ ui.weatherPanel=""; refreshWeatherDom(); } else if(act==="ipretry"){ netInfoCache=null; refreshNetInfoDom(); ensureNetInfo(); } return; }
});
widgetsEl.addEventListener("submit", function(e){
  if(e.target.id==="wxForm"||e.target.id==="wxSearchForm"){ e.preventDefault(); var inp=e.target.querySelector("input"); var city=inp&&inp.value.trim(); if(city) geocodeCity(city); }
  if(e.target.id==="gForm"){ e.preventDefault(); runWebSearch(e.target.elements.q&&e.target.elements.q.value); }
  if(e.target.id==="calEventForm"){
    e.preventDefault();
    var text=e.target.elements.event&&e.target.elements.event.value.trim();
    var box=e.target.closest("[data-cal-selected]");
    if(text&&box) addCalendarEvent(box.getAttribute("data-cal-selected"), text);
  }
  if(e.target.id==="worldClockForm"){
    e.preventDefault();
    var tz=e.target.elements.tz&&e.target.elements.tz.value.trim();
    addWorldClock(tz);
  }
});
widgetsEl.addEventListener("change", function(e){
  if(e.target.id==="calJumpMonth"||e.target.id==="calJumpYear"){
    var jm=$("#calJumpMonth"), jy=$("#calJumpYear");
    ui.calMonth=jm?Number(jm.value):ui.calMonth;
    ui.calYear=jy?Number(jy.value):ui.calYear;
    var d=calSelectedDate(ui.calYear,ui.calMonth);
    if(d.getFullYear()!==ui.calYear||d.getMonth()!==ui.calMonth) d=new Date(ui.calYear,ui.calMonth,1);
    ui.calSelected=calDateKey(d);
    refreshCalDom();
    return;
  }
  if(e.target.id==="calShowDoneBadges"){
    state.settings.calendarShowDoneBadges=e.target.checked;
    save(); refreshCalDom();
  }
});
widgetsEl.addEventListener("input", function(e){ if(e.target&&e.target.id==="notesArea") onNotesInput(e.target); });
widgetsEl.addEventListener("focusout", function(e){ if(e.target&&e.target.id==="notesArea") flushNotes(e.target); }, true);
function refreshSearchWidget(){ var w=widgetsEl.querySelector('.widget[data-w="search"]'); if(w){ var head=w.querySelector('.w-head'); w.innerHTML=(head?head.outerHTML:"")+searchBody(); } }
function refreshListWidget(kind){ var w=widgetsEl.querySelector('.widget[data-w="'+kind+'"]'); if(w){ var head=w.querySelector('.w-head'); w.innerHTML=(head?head.outerHTML:"")+listBody(kind); layoutWidgets(); } }
widgetsEl.addEventListener("error", function(e){ var tg=e.target; if(tg&&tg.classList&&tg.classList.contains("fav-img")) tg.classList.add("hide"); }, true);

function addWorldClock(q){
  var tz=findTimeZone(q);
  if(!tz){ toast(t("worldClockNotFound"),"err"); return; }
  var list=worldClockList();
  if(list.some(function(c){ return (typeof c==="string"?c:c.tz)===tz; })){ toast(t("worldClockExists"),"err"); return; }
  list.push({tz:tz});
  save(); refreshWorldClockDom(); toast(t("worldClockAdded"),"ok");
}
function removeWorldClock(tz){
  var before=worldClockList().length;
  state.settings.worldClocks=worldClockList().filter(function(c){ return (typeof c==="string"?c:c.tz)!==tz; });
  if(state.settings.worldClocks.length!==before){ save(); refreshWorldClockDom(); }
}
function toggleFavoriteBookmark(id){
  var b=byId(id); if(!b) return;
  b.favorite=!b.favorite; save(); refreshListWidget("frequent"); toast(b.favorite?t("favoriteAdded"):t("favoriteRemoved"),"ok");
}
function clearWidgetList(kind){
  if(kind==="recent"){
    state.bookmarks.forEach(function(b){ b.lastOpened=0; });
    save(); refreshListWidget("recent"); toast(t("recentCleared"),"ok"); return;
  }
  state.bookmarks.forEach(function(b){ b.clicks=0; });
  save(); refreshListWidget("frequent"); toast(t("frequentCleared"),"ok");
}

function addCalendarEvent(date,text){
  calEvents().push({id:uid(), date:date, text:text, done:false, createdAt:Date.now()});
  save(); refreshCalDom(); toast(t("calReminderAdded"),"ok");
}
function toggleCalendarEvent(id){
  var ev=calEvents().find(function(e){ return e&&e.id===id; });
  if(!ev) return;
  ev.done=!ev.done; save(); refreshCalDom(); toast(ev.done?t("calReminderDone"):t("calReminderRestored"),"ok");
}
function deleteCalendarEvent(id){
  var before=calEvents().length;
  state.calendarEvents=calEvents().filter(function(e){ return !e||e.id!==id; });
  if(state.calendarEvents.length!==before){ save(); refreshCalDom(); toast(t("calReminderDeleted"),"ok"); }
}

function geocodeCity(city){
  weatherSearching=true; weatherSearchQuery=city; weatherSearchResults=[]; ui.weatherPanel="search"; refreshWeatherDom();
  fetch("https://geocoding-api.open-meteo.com/v1/search?count=8&language="+encodeURIComponent(state.settings.lang==="zh"?"zh":state.settings.lang)+"&name="+encodeURIComponent(city)).then(function(r){return r.json();}).then(function(j){
    weatherSearching=false;
    weatherSearchResults=(j&&j.results)||[];
    if(weatherSearchResults.length===1){ selectWeatherResult(0); return; }
    if(!weatherSearchResults.length) toast(t("cityNotFound"),"err");
    refreshWeatherDom();
  }).catch(function(){ weatherSearching=false; refreshWeatherDom(); toast(t("couldntLookup"),"err"); });
}
function selectWeatherResult(idx){
  var g=weatherSearchResults[idx]; if(!g) return;
  var label=weatherLabel(g);
  state.settings.weather={lat:g.latitude,lon:g.longitude,label:label};
  save(); weatherCache=null; weatherSearchResults=[]; weatherSearchQuery=""; ui.weatherPanel="";
  refreshWeatherDom(); fetchWeather(g.latitude,g.longitude); toast(t("weatherSetTo",{city:g.name}),"ok");
}

// widget reorder — drag the header area (entire .w-head, excluding buttons)
var dragW=null;
widgetsEl.addEventListener("dragstart", function(e){
  // Buttons have draggable="false" but prevent from them anyway
  if(e.target.closest("button")){ e.preventDefault(); return; }
  var head=e.target.closest(".w-head"); if(!head){ e.preventDefault(); return; }
  dragW=head.closest(".widget"); if(!dragW) return;
  e.dataTransfer.effectAllowed="move";
  try{ e.dataTransfer.setData("text/plain", dragW.getAttribute("data-w")); }catch(_){}
  try{ e.dataTransfer.setDragImage(dragW, 28, 16); }catch(_){}
  widgetsEl.classList.add("dragging-active");
  document.body.classList.add("no-select");
  wLastMove=null;
  // 拖拽时把被拖组件压成细条占位：移动它几乎不改变其它组件的瀑布流高度，避免重排抖动
  setTimeout(function(){ if(dragW){ dragW.classList.add("draggingw"); dragW.style.gridRowEnd="span 9"; } },0);
});
var wLastMove=null;
widgetsEl.addEventListener("dragover", function(e){
  if(!dragW) return; e.preventDefault(); e.dataTransfer.dropEffect="move";
  // 抖动抑制（迟滞）：上次成功重排后，指针需再移动一段距离才重新判定，避免重排反馈循环
  if(wLastMove&&Math.hypot(e.clientX-wLastMove.x,e.clientY-wLastMove.y)<16) return;
  var pos=widgetAfter(e.clientX,e.clientY), moved=false;
  if(!pos.el){ if(widgetsEl.lastElementChild!==dragW){ widgetsEl.appendChild(dragW); moved=true; } }
  else if(pos.before){ if(pos.el!==dragW&&dragW.nextElementSibling!==pos.el){ widgetsEl.insertBefore(dragW,pos.el); moved=true; } }
  else { if(pos.el!==dragW&&pos.el.nextElementSibling!==dragW){ widgetsEl.insertBefore(dragW,pos.el.nextSibling); moved=true; } }
  if(moved) wLastMove={x:e.clientX,y:e.clientY};
});
widgetsEl.addEventListener("drop", function(e){ if(dragW) e.preventDefault(); });
widgetsEl.addEventListener("dragend", function(){ if(dragW){ dragW.classList.remove("draggingw"); dragW.style.gridRowEnd=""; } widgetsEl.classList.remove("dragging-active"); document.body.classList.remove("no-select"); commitWidgetOrder(); dragW=null; wLastMove=null; layoutWidgets(); });
// 最近中心点判定：取指针到各组件中心距离最近者，再按指针处于其左/右半侧决定前/后插入。
// 整块组件区域都参与命中（判定范围更大、更跟手），并适配瀑布流的错位高度。
function widgetAfter(x,y){
  var els=$all(".widget:not(.draggingw)",widgetsEl);
  if(!els.length) return {el:null,before:true};
  var best=null, bestD=Infinity, before=true;
  for(var i=0;i<els.length;i++){
    var b=els[i].getBoundingClientRect(), cx=b.left+b.width/2, cy=b.top+b.height/2;
    var dx=x-cx, dy=y-cy, d=dx*dx+dy*dy;
    if(d<bestD){ bestD=d; best=els[i]; before=(x<cx); }
  }
  return {el:best,before:before};
}
function commitWidgetOrder(){
  var order=$all(".widget",widgetsEl).map(function(el){ return el.getAttribute("data-w"); });
  WKEYS.forEach(function(k){ if(order.indexOf(k)===-1) order.push(k); });
  state.settings.widgetOrder=order; save();
}

function openBookmark(id){ var b=byId(id); if(!b) return; var url=normalizeUrl(b.url); if(!isWebUrl(url)){ toast(t("invalidUrl"),"err"); return; } b.clicks=(b.clicks||0)+1; b.lastOpened=Date.now(); save(); window.open(url,"_blank","noopener"); }
