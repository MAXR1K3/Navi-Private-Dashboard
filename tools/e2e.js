#!/usr/bin/env node
/* tools/e2e.js — dependency-free, real-Chrome regression suite.
   Starts an isolated static server and browser profile, drives the app through
   Chrome DevTools Protocol, and exits non-zero on the first failed flow. */
"use strict";

const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const mime = {
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8", ".png":"image/png",
  ".svg":"image/svg+xml", ".ico":"image/x-icon"
};

function assert(name, value, detail){
  if(!value) throw new Error(name + (detail ? "\n    " + detail : ""));
}
function delay(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
async function group(name, run){
  const started=Date.now(); await run();
  console.log("  ✔ " + name + " (" + (Date.now()-started) + "ms)");
}
function chromeExecutable(){
  const candidates=[process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
  for(const candidate of candidates){ if(fs.existsSync(candidate)) return candidate; }
  for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    try{ const found=execFileSync("which",[name],{encoding:"utf8"}).trim(); if(found) return found; }catch(_){ }
  }
  throw new Error("Chrome/Chromium not found. Set CHROME_BIN to the browser executable.");
}
function staticServer(){
  return http.createServer((req,res)=>{
    let pathname="/";
    try{ pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname); }catch(_){ }
    const rel=pathname.replace(/^\/+/,"")||"index.html";
    let file=path.resolve(root,rel);
    if(file!==root&&!file.startsWith(root+path.sep)){ res.writeHead(403); res.end("Forbidden"); return; }
    try{ if(fs.statSync(file).isDirectory()) file=path.join(file,"index.html"); }catch(_){ }
    fs.readFile(file,(err,data)=>{
      if(err){ res.writeHead(err.code==="ENOENT"?404:500); res.end(err.code||"Error"); return; }
      res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});
      res.end(req.method==="HEAD"?undefined:data);
    });
  });
}
async function listen(server){
  await new Promise((resolve,reject)=>{ server.once("error",reject); server.listen(0,"127.0.0.1",resolve); });
  return server.address().port;
}
async function freePort(){
  const server=net.createServer(); const port=await listen(server);
  await new Promise(resolve=>server.close(resolve)); return port;
}
async function waitForTargets(port, child, chromeLog){
  const end=Date.now()+15000;
  while(Date.now()<end){
    if(child.exitCode!==null) throw new Error("Chrome exited early ("+child.exitCode+")\n"+chromeLog());
    try{
      const response=await fetch("http://127.0.0.1:"+port+"/json/list");
      if(response.ok){ const targets=await response.json(); if(targets.some(t=>t.type==="page")) return targets; }
    }catch(_){ }
    await delay(100);
  }
  throw new Error("Timed out waiting for Chrome DevTools\n"+chromeLog());
}

class CDP {
  constructor(url){ this.url=url; this.seq=0; this.pending=new Map(); this.ws=null; }
  async connect(){
    if(typeof WebSocket==="undefined") throw new Error("Node 22+ is required (global WebSocket is unavailable).");
    this.ws=new WebSocket(this.url);
    this.ws.onmessage=event=>{
      const msg=JSON.parse(event.data); if(!msg.id||!this.pending.has(msg.id)) return;
      const job=this.pending.get(msg.id); this.pending.delete(msg.id);
      if(msg.error) job.reject(new Error(JSON.stringify(msg.error))); else job.resolve(msg.result);
    };
    this.ws.onclose=()=>{ for(const job of this.pending.values()) job.reject(new Error("CDP connection closed")); this.pending.clear(); };
    await new Promise((resolve,reject)=>{ this.ws.onopen=resolve; this.ws.onerror=reject; });
  }
  send(method,params={}){
    return new Promise((resolve,reject)=>{
      const id=++this.seq; this.pending.set(id,{resolve,reject});
      this.ws.send(JSON.stringify({id,method,params}));
    });
  }
  async evaluate(expression){
    const result=await this.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails){
      const ex=result.exceptionDetails.exception;
      throw new Error((ex&&ex.description)||result.exceptionDetails.text||"Browser evaluation failed");
    }
    return result.result.value;
  }
  async wait(expression,timeout=8000){
    const end=Date.now()+timeout; let last;
    while(Date.now()<end){
      try{ last=await this.evaluate(expression); if(last) return last; }catch(err){ last=err.message; }
      await delay(100);
    }
    throw new Error("Browser wait timed out: "+expression+"\nLast result: "+String(last));
  }
  async navigate(url){
    await this.send("Page.navigate",{url});
    await this.wait(`document.readyState==="complete" && location.href.startsWith(${JSON.stringify(url.split("?")[0])})`);
  }
  close(){ if(this.ws&&this.ws.readyState<2) this.ws.close(); }
}

async function main(){
  const server=staticServer(); const appPort=await listen(server); const debugPort=await freePort();
  const base="http://127.0.0.1:"+appPort+"/";
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),"navi-e2e-"));
  const browser=chromeExecutable(); let chromeText="";
  const child=spawn(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
    "--disable-extensions","--disable-background-networking","--no-first-run","--no-default-browser-check",
    "--remote-debugging-port="+debugPort,"--user-data-dir="+profile,"--window-size=1280,800",base],
    {stdio:["ignore","pipe","pipe"]});
  const collect=chunk=>{ chromeText=(chromeText+String(chunk)).slice(-12000); };
  child.stdout.on("data",collect); child.stderr.on("data",collect);
  let cdp;
  try{
    const targets=await waitForTargets(debugPort,child,()=>chromeText);
    const page=targets.find(t=>t.type==="page"&&t.url.startsWith(base))||targets.find(t=>t.type==="page");
    cdp=new CDP(page.webSocketDebuggerUrl); await cdp.connect();
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Network.enable");
    await cdp.send("Network.setBypassServiceWorker",{bypass:true});
    await cdp.send("Network.setCacheDisabled",{cacheDisabled:true});

    await group("dev-check reports no structural or visual-contract failures", async()=>{
      await cdp.navigate(base+"dev-check.html?e2e="+Date.now());
      const result=await cdp.wait(`(()=>{const s=document.querySelector("#sum");return s&&!s.textContent.includes("running")?{summary:s.textContent,failed:document.querySelectorAll(".chk.fail").length,details:[...document.querySelectorAll(".chk.fail")].map(x=>x.textContent.trim())}:null})()`,12000);
      assert("dev-check failures",result.failed===0,result.summary+"\n"+(result.details||[]).join("\n"));
    });

    await group("sync bases are isolated by Profile and URL", async()=>{
      await cdp.navigate(base+"?sync-base="+Date.now());
      await cdp.wait(`typeof NaviStorage==="object" && typeof SyncMerge==="object"`);
      const result=await cdp.evaluate(`(async()=>{
        await NaviStorage.clearAll();
        const sample=SyncMerge.fromState(state);
        const saved=await NaviStorage.putSyncBase("dav-a","https://nas.example/a.json",'"one"',sample);
        const same=await NaviStorage.getSyncBase("dav-a","https://nas.example/a.json");
        const changedUrl=await NaviStorage.getSyncBase("dav-a","https://nas.example/b.json");
        const overwritten=await NaviStorage.putSyncBase("dav-a","https://nas.example/a.json",'"two"',sample);
        const latest=await NaviStorage.getSyncBase("dav-a","https://nas.example/a.json");
        await NaviStorage.clearSyncBase("dav-a");
        const cleared=await NaviStorage.getSyncBase("dav-a","https://nas.example/a.json");
        await NaviStorage.putSyncBase("dav-a","https://nas.example/a.json",'"three"',sample);
        await NaviStorage.clearAll();
        const reset=await NaviStorage.getSyncBase("dav-a","https://nas.example/a.json");
        return {saved,etag:same&&same.etag,changedUrl,overwritten,latest:latest&&latest.etag,cleared,reset};
      })()`);
      assert("sync base was not saved",result.saved&&result.etag==='"one"',JSON.stringify(result));
      assert("sync base leaked across URL",result.changedUrl===null,JSON.stringify(result));
      assert("sync base was not replaced",result.overwritten&&result.latest==='"two"',JSON.stringify(result));
      assert("sync base clear was not scoped",result.cleared===null,JSON.stringify(result));
      assert("Navi reset left sync base behind",result.reset===null,JSON.stringify(result));
    });

    await group("unsafe reconciliation paths never write or advance the base", async()=>{
      await cdp.navigate(base+"?safe-reconcile="+Date.now());
      await cdp.wait(`typeof NaviStorage==="object" && typeof SyncMerge==="object"`);
      const result=await cdp.evaluate(`(async()=>{
        if(typeof reconcileWebdavProfile!=="function"||typeof compatibilityPutConfirmed!=="function") return {missing:true};
        const original={
          fetchRemoteData,conditionalPut,compatibilityPutConfirmed,
          getSyncBase:NaviStorage.getSyncBase,putSyncBase:NaviStorage.putSyncBase
        };
        let conditionalWrites=0,compatibilityWrites=0,baseWrites=0,etagSeq=0;
        const bm=(title)=>({id:"shared",title,url:"https://shared.example",category:"Work",description:"",tags:[],updatedAt:10});
        const snap=(title)=>SyncMerge.canonicalize({version:4,bookmarks:[bm(title)],categories:["Work"],calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"},sync:{protocol:1,tombstones:[]}});
        const baseSnap=snap("Base"),remoteData={bookmarks:baseSnap.bookmarks,categories:baseSnap.categories,calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"},syncMeta:{tombstones:[]},sourceVersion:4};
        try{
          state=defaults();
          state.settings.profiles=[{id:"local",name:"Local",type:"local"},{id:"dav-e2e",name:"DAV",type:"webdav",url:"https://nas.example/bookmarks.json",autoSync:false}];
          state.settings.activeProfile="dav-e2e";
          state.bookmarks=[bm("Local")]; state.categories=["Work"]; state.syncMeta={tombstones:[]};
          saveSilently({tracking:"remote"});
          conditionalPut=async()=>{ conditionalWrites++; return {ok:false,status:412,headers:{get(){return "";}}}; };
          compatibilityPutConfirmed=async()=>{ compatibilityWrites++; return {ok:true,status:200,headers:{get(){return "";}}}; };
          NaviStorage.putSyncBase=async()=>{ baseWrites++; return true; };

          NaviStorage.getSyncBase=async()=>({profileId:"dav-e2e",url:"https://nas.example/bookmarks.json",etag:'"base"',snapshot:baseSnap});
          fetchRemoteData=async()=>({unreadable:true,raw:"bad",missing:false,strongEtag:'"bad"'});
          const invalid=await reconcileWebdavProfile("dav-e2e",{write:true,silent:true});

          NaviStorage.getSyncBase=async()=>null;
          fetchRemoteData=async()=>({data:remoteData,sourceVersion:4,missing:false,strongEtag:'"remote"'});
          const bootstrap=await reconcileWebdavProfile("dav-e2e",{write:true,silent:true});

          NaviStorage.getSyncBase=async()=>({profileId:"dav-e2e",url:"https://nas.example/bookmarks.json",etag:'"base"',snapshot:baseSnap});
          fetchRemoteData=async()=>({data:remoteData,sourceVersion:4,missing:false,etag:'W/"weak"',strongEtag:""});
          const compatibility=await reconcileWebdavProfile("dav-e2e",{write:true,silent:true});

          NaviStorage.getSyncBase=async()=>{ throw new Error("idb-down"); };
          fetchRemoteData=async()=>({data:remoteData,sourceVersion:4,missing:false,strongEtag:'"remote"'});
          const unavailable=await reconcileWebdavProfile("dav-e2e",{write:true,silent:true});

          NaviStorage.getSyncBase=async()=>({profileId:"dav-e2e",url:"https://nas.example/bookmarks.json",etag:'"base"',snapshot:baseSnap});
          fetchRemoteData=async()=>({data:remoteData,sourceVersion:4,missing:false,strongEtag:'"race-'+(++etagSeq)+'"'});
          const raced=await reconcileWebdavProfile("dav-e2e",{write:true,silent:true});
          return {missing:false,statuses:[invalid.status,bootstrap.status,compatibility.status,unavailable.status,raced.status],
            conditionalWrites,compatibilityWrites,baseWrites,attempts:raced.attempts,
            raceReviewable:!!(raced.mergeResult&&raced.mergeResult.candidate&&raced.remote&&raced.remote.strongEtag)};
        } finally {
          fetchRemoteData=original.fetchRemoteData;
          conditionalPut=original.conditionalPut;
          compatibilityPutConfirmed=original.compatibilityPutConfirmed;
          NaviStorage.getSyncBase=original.getSyncBase;
          NaviStorage.putSyncBase=original.putSyncBase;
        }
      })()`);
      assert("safe reconciler is missing",result.missing!==true,JSON.stringify(result));
      if(!result.missing){
        assert("unsafe paths returned wrong statuses",result.statuses.join(",")==="invalid,bootstrap,compatibility,base-unavailable,race-conflict",JSON.stringify(result));
        assert("unsafe paths called compatibility PUT",result.compatibilityWrites===0,JSON.stringify(result));
        assert("failure paths advanced the sync base",result.baseWrites===0,JSON.stringify(result));
        assert("412 retry cap was not exact",result.conditionalWrites===3&&result.attempts===3,JSON.stringify(result));
        assert("retry exhaustion did not return a fresh reviewable remote",result.raceReviewable,JSON.stringify(result));
      }
    });

    await group("failed base persistence is reported after matching remote data", async()=>{
      await cdp.navigate(base+"?base-warning="+Date.now());
      await cdp.wait(`typeof reconcileWebdavProfile==="function"`);
      const result=await cdp.evaluate(`(async()=>{
        const original={fetchRemoteData,getSyncBase:NaviStorage.getSyncBase,putSyncBase:NaviStorage.putSyncBase};
        const bookmark={id:"same",title:"Same",url:"https://same.example",category:"Work",description:"",tags:[],updatedAt:10};
        try{
          state=defaults();
          state.settings.profiles=[{id:"local",name:"Local",type:"local"},{id:"dav-base",name:"DAV",type:"webdav",url:"https://nas.example/base.json",autoSync:false}];
          state.settings.activeProfile="dav-base"; state.bookmarks=[bookmark]; state.categories=["Work"]; state.syncMeta={tombstones:[]};
          saveSilently({tracking:"remote"});
          const snapshot=SyncMerge.fromState(state);
          const remoteData={bookmarks:snapshot.bookmarks,categories:snapshot.categories,calendarEvents:snapshot.calendarEvents,theme:snapshot.theme,view:snapshot.view,settings:snapshot.settings,syncMeta:{tombstones:snapshot.tombstones},sourceVersion:4};
          fetchRemoteData=async()=>({data:remoteData,sourceVersion:4,missing:false,strongEtag:'"same"'});
          NaviStorage.getSyncBase=async()=>({profileId:"dav-base",url:"https://nas.example/base.json",etag:'"old"',snapshot});
          NaviStorage.putSyncBase=async()=>false;
          const outcome=await reconcileWebdavProfile("dav-base",{write:false,silent:true});
          return {status:outcome.status,ok:outcome.ok};
        } finally {
          fetchRemoteData=original.fetchRemoteData;
          NaviStorage.getSyncBase=original.getSyncBase;
          NaviStorage.putSyncBase=original.putSyncBase;
        }
      })()`);
      assert("base storage failure was reported as full success",result.ok&&result.status==="base-warning",JSON.stringify(result));
    });

    await group("corrupt primary is preserved behind recovery UI", async()=>{
      await cdp.navigate(base+"?recovery-setup="+Date.now());
      await cdp.wait(`typeof NaviStorage==="object"`);
      const prepared=await cdp.evaluate(`(async()=>{
        await NaviStorage.clearAll();
        const good=defaults();
        good.settings.lang="en";
        good.bookmarks=[{id:"recover-me",title:"Recover me",url:"https://example.com/recovered",category:"Work",description:"",tags:[]}];
        NaviStorage.persist(good);
        const newer=defaults();
        newer.settings.lang="en";
        newer.bookmarks=[{id:"newer",title:"Newer",url:"https://example.com/newer",category:"Work",description:"",tags:[]}];
        NaviStorage.persist(newer);
        const archived=await NaviStorage.getLastGood();
        if(!archived||archived.state.bookmarks[0]?.id!=="recover-me") throw new Error("last-good revision was not committed");
        localStorage.setItem("navi.dashboard.v3",'{"bookmarks":[');
        return localStorage.getItem("navi.dashboard.v3");
      })()`);
      assert("corrupt fixture was not written",prepared==='{\"bookmarks\":[');

      await cdp.navigate(base+"?recovery="+Date.now());
      const recovery=await cdp.wait(`(()=>{const o=document.querySelector("#recoveryOverlay");return o&&o.classList.contains("open")?{raw:localStorage.getItem("navi.dashboard.v3"),name:o.querySelector(".modal").getAttribute("aria-labelledby"),restore:!document.querySelector("#recoveryRestore").disabled,download:!document.querySelector("#recoveryDownload").disabled,focus:o.contains(document.activeElement),blocked:document.querySelector("header").inert&&document.querySelector(".layout").inert}:null})()`);
      assert("recovery startup changed corrupt raw",recovery.raw==='{\"bookmarks\":[',JSON.stringify(recovery));
      assert("recovery dialog is not named",recovery.name==="recoveryTitle",JSON.stringify(recovery));
      assert("recovery actions, background blocking, or initial focus are wrong",recovery.restore&&recovery.download&&recovery.focus&&recovery.blocked,JSON.stringify(recovery));

      const escape=await cdp.evaluate(`(()=>{document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));return document.querySelector("#recoveryOverlay").classList.contains("open")})()`);
      assert("Escape dismissed the recovery decision",escape);

      await cdp.evaluate(`document.querySelector("#recoveryRestore").click()`);
      await cdp.wait(`state.bookmarks.some(b=>b.id==="recover-me")`);
      const restored=await cdp.evaluate(`({id:state.bookmarks[0]?.id,status:document.documentElement.dataset.recovery||""})`);
      assert("last valid revision was not restored",restored.id==="recover-me",JSON.stringify(restored));
      assert("app stayed in recovery after restore",restored.status!=="true",JSON.stringify(restored));
    });

    await group("recovery without a revision still offers download and confirmed reset", async()=>{
      await cdp.evaluate(`NaviStorage.clearAll()`);
      await cdp.evaluate(`localStorage.setItem("unrelated.same-origin","keep");localStorage.setItem("navi.pdata.remote","remove");localStorage.setItem("navi.dashboard.v2","remove");localStorage.setItem("navi.dashboard.prev","remove");localStorage.setItem("navi.dashboard.v3",'{"bookmarks":[');location.reload()`);
      await cdp.wait(`document.querySelector("#recoveryOverlay")?.classList.contains("open")`);
      const actions=await cdp.wait(`(()=>{const r=document.querySelector("#recoveryRestore");const d=document.querySelector("#recoveryDownload");return r&&!document.querySelector("#recoveryStatus").textContent.includes("Checking")?{restore:r.disabled,download:!d.disabled}:null})()`);
      assert("restore is enabled without a valid revision",actions.restore);
      assert("download is unavailable without a revision",actions.download);
      const downloaded=await cdp.evaluate(`new Promise(resolve=>{downloadBlob=(text,mime,name)=>resolve({text,mime,name});document.querySelector("#recoveryDownload").click()})`);
      assert("download changed corrupt raw",downloaded.text==='{\"bookmarks\":[',JSON.stringify(downloaded));
      assert("download filename is not a dated text file",/^navi-corrupt-data-.+\.txt$/.test(downloaded.name),JSON.stringify(downloaded));
      await cdp.evaluate(`document.querySelector("#recoveryReset").click()`);
      await cdp.wait(`document.querySelector("#confirmOverlay").classList.contains("open")`);
      assert("reset confirmation did not keep recovery visible",await cdp.evaluate(`document.querySelector("#recoveryOverlay").classList.contains("open")`));
      const trapped=await cdp.evaluate(`(()=>{const ok=document.querySelector("#confirmOk");ok.focus();const event=new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true});ok.dispatchEvent(event);return {prevented:event.defaultPrevented,focus:document.activeElement.textContent,inside:document.querySelector("#confirmOverlay").contains(document.activeElement)}})()`);
      assert("Tab escaped the reset confirmation",trapped.prevented&&trapped.inside&&trapped.focus==="Cancel",JSON.stringify(trapped));
      await cdp.evaluate(`document.querySelector("#confirmOk").click()`);
      await cdp.wait(`state.bookmarks.length>0 && localStorage.getItem("navi.dashboard.v3")`);
      const reset=await cdp.evaluate(`({profile:localStorage.getItem("navi.pdata.remote"),legacy:localStorage.getItem("navi.dashboard.v2"),previous:localStorage.getItem("navi.dashboard.prev"),unrelated:localStorage.getItem("unrelated.same-origin")})`);
      assert("confirmed reset left Navi-owned fallback data behind",reset.profile===null&&reset.legacy===null&&reset.previous===null,JSON.stringify(reset));
      assert("reset deleted unrelated same-origin data",reset.unrelated==="keep",JSON.stringify(reset));
    });

    await cdp.navigate(base+"?e2e="+Date.now());
    await cdp.wait(`typeof render==="function" && !!document.querySelector("#viewBtn")`);
    await cdp.evaluate(`(async()=>{await NaviStorage.clearAll();state=defaults();ui={activeCat:"All",query:"",tagFilter:"",selectMode:false,selected:{},editingId:null,importData:null,importMode:"merge",calMonth:new Date().getMonth(),calYear:new Date().getFullYear(),calSelected:null,geoTried:false,weatherPanel:"",worldClockSetup:false};state.settings.lang="en";state.settings.widgetsCollapsed=true;state.settings.animations=false;state.settings.lowPower=true;state.categories=["Work"];state.bookmarks=[{id:"view-fixture",title:"View fixture",url:"https://example.com/view",category:"Work",description:"",tags:[]}];saveSilently();render();oplogInit();return true})()`);

    await group("explicit three-view selector", async()=>{
      const result=await cdp.evaluate(`(()=>{const b=document.querySelector("#viewBtn"),m=document.querySelector("#viewMenu");b.click();const opened=m.classList.contains("open")&&b.getAttribute("aria-expanded")==="true";m.querySelector('[data-view="compact"]').click();return {opened,view:state.view,grid:document.querySelector(".grid")?.className,label:b.getAttribute("aria-label"),selected:m.querySelector('[data-view="compact"]').getAttribute("aria-checked"),focus:document.activeElement===b}})()`);
      assert("view selector did not open",result.opened);
      assert("compact view was not selected",result.view==="compact"&&String(result.grid).includes("compact"),JSON.stringify(result));
      assert("view selection state/focus is wrong",result.selected==="true"&&result.focus&&/Compact/.test(result.label),JSON.stringify(result));
    });

    await group("mobile grouped action sheet and landscape clearance", async()=>{
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:375,height:812,deviceScaleFactor:1,mobile:true}); await delay(80);
      const portrait=await cdp.evaluate(`(()=>{const b=document.querySelector("#moreBtn"),m=document.querySelector("#moreMenu");b.click();const r=m.getBoundingClientRect(),head=m.querySelector(".more-sheet-head").getBoundingClientRect(),title=m.querySelector(".more-sheet-head strong").getBoundingClientRect(),groups=[...m.querySelectorAll("[data-menu-group]")].map(g=>({name:g.dataset.menuGroup,actions:[...g.querySelectorAll("[data-act]")].map(x=>x.dataset.act),cols:getComputedStyle(g.querySelector(".menu-group-actions")).gridTemplateColumns.split(/\\s+/).length}));document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));return {groups,rect:[Math.round(r.top),Math.round(r.bottom),Math.round(r.height)],title:[Math.round(title.height),Math.round(Math.abs((title.left+title.width/2)-(head.left+head.width/2)))],closed:!m.classList.contains("open"),focus:document.activeElement===b}})()`);
      assert("mobile groups are wrong",portrait.groups.map(g=>g.name).join(",")==="transfer,ai,maintenance,danger",JSON.stringify(portrait.groups));
      assert("danger action is not isolated",portrait.groups[3].actions.join(",")==="clear");
      assert("mobile sheet columns/geometry are wrong",portrait.groups.slice(0,3).every(g=>g.cols===2)&&portrait.groups[3].cols===1&&portrait.rect[1]===812&&portrait.rect[2]<=668,JSON.stringify(portrait));
      assert("mobile sheet title is not centered on one line",portrait.title[0]<=24&&portrait.title[1]<=2,JSON.stringify(portrait));
      assert("mobile sheet does not restore focus",portrait.closed&&portrait.focus);

      await cdp.send("Emulation.setDeviceMetricsOverride",{width:812,height:375,deviceScaleFactor:1,mobile:true}); await delay(80);
      const landscape=await cdp.evaluate(`new Promise(resolve=>{state.categories=Array.from({length:10},(_,i)=>"Category "+i);state.bookmarks=Array.from({length:24},(_,i)=>({id:"land"+i,title:"Bookmark "+i,url:"https://example.com/"+i,category:state.categories[i%10],description:"",tags:[]}));state.view="compact";ui.activeCat="All";render();requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=document.querySelector(".actions").getBoundingClientRect(),tabs=document.querySelector("#tabs");scrollTo(0,999999);requestAnimationFrame(()=>{const last=[...document.querySelectorAll(".card")].at(-1).getBoundingClientRect();resolve({doc:document.documentElement.scrollWidth,width:innerWidth,actionTop:Math.round(a.top),actionBottom:Math.round(a.bottom),position:getComputedStyle(document.querySelector(".actions")).position,tabs:[getComputedStyle(tabs).flexWrap,Math.round(tabs.getBoundingClientRect().height),tabs.scrollWidth,tabs.clientWidth],lastBottom:Math.round(last.bottom)});});}));})`);
      assert("landscape has horizontal overflow",landscape.doc<=landscape.width+1,JSON.stringify(landscape));
      assert("landscape navigation is not compact",landscape.position==="fixed"&&landscape.actionBottom===375&&landscape.tabs[0]==="nowrap"&&landscape.tabs[1]<=44&&landscape.tabs[2]>landscape.tabs[3],JSON.stringify(landscape));
      assert("landscape cards are hidden by the bottom bar",landscape.lastBottom<=landscape.actionTop,JSON.stringify(landscape));
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false}); await delay(80);
    });

    await group("settings tabs and modal focus restoration", async()=>{
      const result=await cdp.evaluate(`new Promise(resolve=>{const add=document.querySelector("#addBtn");add.focus();openSettings("general");setTimeout(()=>{const general=document.querySelector("#setTabGeneral");general.focus();general.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));const tab={focus:document.activeElement?.id,selected:document.querySelector("#setTabSync").getAttribute("aria-selected"),generalHidden:document.querySelector("#setPanelGeneral").hidden,syncHidden:document.querySelector("#setPanelSync").hidden};const ov=document.querySelector("#settingsOverlay");ov.dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));ov.dispatchEvent(new MouseEvent("click",{bubbles:true}));setTimeout(()=>resolve({tab,closed:!ov.classList.contains("open"),focus:document.activeElement?.id}),25);},25);})`);
      assert("settings arrow-key tabs failed",result.tab.focus==="setTabSync"&&result.tab.selected==="true"&&result.tab.generalHidden&&!result.tab.syncHidden,JSON.stringify(result));
      assert("backdrop close did not restore focus",result.closed&&result.focus==="addBtn",JSON.stringify(result));
    });

    await group("bookmark add, edit, delete, and undo", async()=>{
      const result=await cdp.evaluate(`(()=>{state.bookmarks=[];state.categories=["Work"];state.trash=[];state.opLog=[];ui.activeCat="All";oplogInit();render();openAdd();document.querySelector("#bmUrl").value="https://e2e.example/page";document.querySelector("#bmName").value="Draft";document.querySelector("#bmDesc").value="Created by browser E2E";document.querySelector("#bmCat").value="Work";document.querySelector("#bmSave").click();const id=state.bookmarks[0]&&state.bookmarks[0].id,added=state.bookmarks.length===1&&state.bookmarks[0].title==="Draft";document.querySelector('[data-edit="'+id+'"]').click();document.querySelector("#bmName").value="Updated";document.querySelector("#bmSave").click();const edited=state.bookmarks[0].title==="Updated";document.querySelector('[data-del="'+id+'"]').click();const deleted=state.bookmarks.length===0&&state.trash.length===1;const undo=[...document.querySelectorAll(".toast .undo-btn")].at(-1);if(undo)undo.click();return {added,edited,deleted,undoButton:!!undo,restored:state.bookmarks.length===1&&state.bookmarks[0].id===id&&state.trash.length===0,title:state.bookmarks[0]&&state.bookmarks[0].title}})()`);
      assert("bookmark add failed",result.added,JSON.stringify(result));
      assert("bookmark edit failed",result.edited&&result.title==="Updated",JSON.stringify(result));
      assert("bookmark delete/undo failed",result.deleted&&result.undoButton&&result.restored,JSON.stringify(result));
    });

    await group("per-conflict choices are accessible, cancellable, and applied safely", async()=>{
      const result=await cdp.evaluate(`(async()=>{
        const original={continueSyncCandidate,presentSyncOutcome};
        const bm=(id,title)=>({id,title,url:"https://"+id+".example",category:"Work",description:"",tags:[],updatedAt:10});
        const snap=(rows)=>SyncMerge.canonicalize({version:4,bookmarks:rows,categories:["Work"],calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"},sync:{protocol:1,tombstones:[]}});
        const baseSnap=snap([bm("a","A"),bm("b","B"),bm("c","C")]);
        const local=snap([bm("b","B local"),bm("a","A local"),bm("c","C")]);
        const remoteSnap=snap([bm("c","C"),bm("a","A remote"),bm("b","B remote")]);
        const mergeResult=SyncMerge.merge(baseSnap,local,remoteSnap);
        const remoteData={bookmarks:remoteSnap.bookmarks,categories:remoteSnap.categories,calendarEvents:remoteSnap.calendarEvents,theme:remoteSnap.theme,view:remoteSnap.view,settings:remoteSnap.settings,syncMeta:{tombstones:remoteSnap.tombstones},sourceVersion:4};
        const outcome=syncOutcome("conflict",{local,remote:{data:remoteData,strongEtag:'"ui"'},base:{snapshot:baseSnap},mergeResult,candidate:mergeResult.candidate});
        let writes=0,captured=null,presented=0;
        try{
          continueSyncCandidate=async(id,candidate)=>{ writes++; captured=candidate; return syncOutcome("synced",{ok:true,candidate}); };
          presentSyncOutcome=async()=>{ presented++; return true; };
          await openSyncConflict("dav-ui",outcome,{});
          const overlay=document.querySelector("#conflictOverlay"),apply=document.querySelector("#conflictApply");
          const rows=[...overlay.querySelectorAll("[data-sync-conflict-key]")];
          const initial={open:overlay.classList.contains("open"),named:overlay.querySelector('[role="dialog"]').getAttribute("aria-labelledby")==="conflictTitle",rows:rows.length,
            applyInitiallyDisabled:apply&&apply.disabled,summary:(document.querySelector("#conflictSummary")||{}).textContent||"",live:(document.querySelector("#conflictStatus")||{}).getAttribute&&document.querySelector("#conflictStatus").getAttribute("aria-live"),
            irrelevantHidden:getComputedStyle(document.querySelector("#conflictDownloadRemote")).display==="none"&&getComputedStyle(document.querySelector("#conflictUseLocalRaw")).display==="none"};
          if(!apply||rows.length!==3){ closeOverlay("conflictOverlay"); return {missing:true,initial}; }
          overlay.dispatchEvent(new MouseEvent("click",{bubbles:true}));
          const guardedBackdrop=overlay.classList.contains("open")&&!!_conflictCtx;
          rows.forEach((row,index)=>row.querySelector('input[value="'+(index%2?"remote":"local")+'"]').click());
          const enabledAfterChoices=!apply.disabled;
          document.querySelector("#conflictCancel").click();
          const cancelled={closed:!overlay.classList.contains("open"),writes,presented};

          await openSyncConflict("dav-ui",outcome,{});
          document.querySelector("#conflictAllLocal").click();
          const bulkEnabled=!document.querySelector("#conflictApply").disabled;
          document.querySelector("#conflictApply").click();
          await new Promise(resolve=>setTimeout(resolve,0));
          return {missing:false,initial,guardedBackdrop,enabledAfterChoices,cancelled,bulkEnabled,writes,presented,
            capturedA:captured&&captured.bookmarks.find(b=>b.id==="a").title,
            capturedB:captured&&captured.bookmarks.find(b=>b.id==="b").title,
            closed:!overlay.classList.contains("open")};
        } finally {
          continueSyncCandidate=original.continueSyncCandidate;
          presentSyncOutcome=original.presentSyncOutcome;
          closeOverlay("conflictOverlay");
        }
      })()`);
      assert("per-conflict controls are missing",result.missing!==true,JSON.stringify(result));
      if(!result.missing){
        assert("conflict dialog semantics, visibility, or summary failed",result.initial.open&&result.initial.named&&result.initial.rows===3&&result.initial.applyInitiallyDisabled&&result.initial.live==="polite"&&result.initial.irrelevantHidden&&/3/.test(result.initial.summary),JSON.stringify(result));
        assert("an unconfirmed backdrop gesture discarded conflict context",result.guardedBackdrop,JSON.stringify(result));
        assert("complete individual choices did not enable Apply",result.enabledAfterChoices,JSON.stringify(result));
        assert("cancel changed data or called sync",result.cancelled.closed&&result.cancelled.writes===0&&result.cancelled.presented===0,JSON.stringify(result));
        assert("bulk local choice did not apply resolved candidate",result.bulkEnabled&&result.writes===1&&result.presented===1&&result.capturedA==="A local"&&result.capturedB==="B local"&&result.closed,JSON.stringify(result));
      }
    });

    await group("first sync always offers local, remote, or reviewed merge", async()=>{
      const result=await cdp.evaluate(`(async()=>{
        const bm=(id,title,url)=>({id,title,url,category:"Work",description:"",tags:[],updatedAt:10});
        const snap=(rows,theme)=>SyncMerge.canonicalize({version:4,bookmarks:rows,categories:["Work"],calendarEvents:[],theme,view:"grid",settings:{lang:"en"},sync:{protocol:1,tombstones:[]}});
        const local=snap([bm("same","Local title","https://same.example")],"light");
        const remoteSnap=snap([bm("same","Remote title","https://same.example")],"dark");
        const mergeResult=SyncMerge.bootstrap(local,remoteSnap);
        const remoteData={bookmarks:remoteSnap.bookmarks,categories:remoteSnap.categories,calendarEvents:remoteSnap.calendarEvents,theme:remoteSnap.theme,view:remoteSnap.view,settings:remoteSnap.settings,syncMeta:{tombstones:remoteSnap.tombstones},sourceVersion:4};
        const outcome=syncOutcome("bootstrap",{local,remote:{data:remoteData,strongEtag:'"bootstrap"'},base:null,mergeResult,candidate:mergeResult.candidate});
        try{
          openSettings("sync");
          await openSyncConflict("dav-bootstrap",outcome,{});
          const settings=document.querySelector("#settingsOverlay"),overlay=document.querySelector("#conflictOverlay"),apply=document.querySelector("#conflictApply"),bootstrap=overlay.querySelector('[data-sync-conflict-key="__bootstrap__"]');
          const underlay={inert:settings.inert,hidden:settings.getAttribute("aria-hidden"),overflow:getComputedStyle(settings).overflow,bodyOverflow:getComputedStyle(document.body).overflow};
          const options=bootstrap?[...bootstrap.querySelectorAll('input[name="sync-conflict-bootstrap"]')].map(input=>input.value):[];
          const conflictRows=[...overlay.querySelectorAll('[data-sync-conflict-key]:not([data-sync-conflict-key="__bootstrap__"])')].length;
          const initialDisabled=apply&&apply.disabled;
          bootstrap&&bootstrap.querySelector('input[value="local"]').click();
          const localReady=apply&&!apply.disabled,localCandidate=syncConflictCandidate(_conflictCtx);
          bootstrap&&bootstrap.querySelector('input[value="merge"]').click();
          const mergeNeedsReview=apply&&apply.disabled;
          document.querySelector("#conflictAllLocal").click();
          const mergeReady=apply&&!apply.disabled,mergeCandidate=syncConflictCandidate(_conflictCtx);
          const priorLang=state.settings.lang; state.settings.lang="zh";
          const localizedHtml=syncConflictRowHtml(mergeResult.conflicts.find(conflict=>conflict.kind==="settings"),0,outcome);
          state.settings.lang=priorLang;
          cancelSyncConflict();
          const restored={inert:settings.inert,hidden:settings.getAttribute("aria-hidden"),open:settings.classList.contains("open")};
          return {options,conflictRows,initialDisabled,localReady,localTitle:localCandidate&&localCandidate.bookmarks[0]&&localCandidate.bookmarks[0].title,
            mergeNeedsReview,mergeReady,mergeTitle:mergeCandidate&&mergeCandidate.bookmarks[0]&&mergeCandidate.bookmarks[0].title,
            localizedCollection:/界面设置/.test(localizedHtml)&&!/Interface settings/.test(localizedHtml),underlay,restored};
        } finally { closeOverlay("conflictOverlay"); closeOverlay("settingsOverlay"); }
      })()`);
      assert("bootstrap choices are missing when first merge has conflicts",result.options.join(",")==="local,remote,merge"&&result.conflictRows>0,JSON.stringify(result));
      assert("bootstrap local choice is not independently actionable",result.initialDisabled&&result.localReady&&result.localTitle==="Local title",JSON.stringify(result));
      assert("bootstrap merge does not require resolving its real conflicts",result.mergeNeedsReview&&result.mergeReady&&result.mergeTitle==="Local title",JSON.stringify(result));
      assert("collection conflict title ignored the active locale",result.localizedCollection,JSON.stringify(result));
      assert("stacked conflict dialog does not isolate and restore its settings underlay",result.underlay.inert&&result.underlay.hidden==="true"&&result.underlay.overflow==="hidden"&&result.underlay.bodyOverflow==="hidden"&&!result.restored.inert&&result.restored.hidden===null&&result.restored.open,JSON.stringify(result));
    });

    await group("unreadable remote stays downloadable and overwrite requires a strong ETag", async()=>{
      const result=await cdp.evaluate(`(async()=>{
        const original={downloadBlob,continueSyncCandidate,presentSyncOutcome};
        const local=SyncMerge.fromState(state); let downloaded=null,writes=0,strongSeen="";
        try{
          downloadBlob=(text,mime,name)=>{ downloaded={text,mime,name}; };
          continueSyncCandidate=async(id,candidate,context)=>{ writes++; strongSeen=context.remote.strongEtag; return syncOutcome("synced",{ok:true,candidate}); };
          presentSyncOutcome=async()=>true;
          await openSyncConflict("dav-ui",syncOutcome("invalid",{local,remote:{unreadable:true,raw:"RAW REMOTE BYTES",strongEtag:""}}),{});
          const weak={rows:document.querySelectorAll("[data-sync-conflict-key]").length,downloadHidden:document.querySelector("#conflictDownloadRemote").hidden,
            overwriteDisabled:document.querySelector("#conflictUseLocalRaw").disabled,status:document.querySelector("#conflictStatus").textContent};
          document.querySelector("#conflictDownloadRemote").click();
          document.querySelector("#conflictCancel").click();

          await openSyncConflict("dav-ui",syncOutcome("invalid",{local,remote:{unreadable:true,raw:"RAW TWO",strongEtag:'"safe"'}}),{});
          const strongEnabled=!document.querySelector("#conflictUseLocalRaw").disabled;
          document.querySelector("#conflictUseLocalRaw").click();
          await new Promise(resolve=>setTimeout(resolve,0));
          return {weak,downloaded,strongEnabled,writes,strongSeen,closed:!document.querySelector("#conflictOverlay").classList.contains("open")};
        } finally {
          downloadBlob=original.downloadBlob;
          continueSyncCandidate=original.continueSyncCandidate;
          presentSyncOutcome=original.presentSyncOutcome;
          closeOverlay("conflictOverlay");
        }
      })()`);
      assert("unreadable remote exposed record choices",result.weak.rows===0,JSON.stringify(result));
      assert("remote raw download or weak-ETag guard failed",!result.weak.downloadHidden&&result.weak.overwriteDisabled&&result.downloaded&&result.downloaded.text==="RAW REMOTE BYTES"&&/^navi-remote-unreadable-/.test(result.downloaded.name),JSON.stringify(result));
      assert("strong-ETag unreadable overwrite did not use safe continuation",result.strongEnabled&&result.writes===1&&result.strongSeen==='"safe"'&&result.closed,JSON.stringify(result));
    });

    await group("weak-ETag conflict choices require confirmation and a fresh read", async()=>{
      const result=await cdp.evaluate(`(async()=>{
        const original={fetchRemoteData,writeSyncCandidate,compatibilityWriteSelectedCandidate,presentSyncOutcome};
        const bm=(title)=>({id:"weak",title,url:"https://weak.example",category:"Work",description:"",tags:[],updatedAt:10});
        const snap=(title)=>SyncMerge.canonicalize({version:4,bookmarks:[bm(title)],categories:["Work"],calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"},sync:{protocol:1,tombstones:[]}});
        const base=snap("Base"),local=snap("Local"),remote=snap("Remote"),mergeResult=SyncMerge.merge(base,local,remote);
        const remoteData={bookmarks:remote.bookmarks,categories:remote.categories,calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"},syncMeta:{tombstones:[]},sourceVersion:4};
        let reads=0,directWrites=0,confirmed=false,uiWrites=0;
        try{
          state.settings.profiles=[{id:"local",name:"Local",type:"local"},{id:"dav-weak",name:"Weak",type:"webdav",url:"https://weak.example/bookmarks.json",autoSync:false}];
          state.settings.activeProfile="dav-weak";
          fetchRemoteData=async()=>{ reads++; return {data:remoteData,sourceVersion:4,etag:'W/"weak"',strongEtag:""}; };
          writeSyncCandidate=async(profile,id,candidate,fresh,baseRecord,opts)=>{ directWrites++; confirmed=opts.compatibilityConfirmed===true; return syncOutcome("compatibility",{ok:true,candidate}); };
          await compatibilityWriteSelectedCandidate("dav-weak",local,{remote:{data:remoteData,strongEtag:""},base:{snapshot:base}});

          compatibilityWriteSelectedCandidate=async()=>{ uiWrites++; return syncOutcome("compatibility",{ok:true,candidate:local}); };
          presentSyncOutcome=async()=>true;
          const outcome=syncOutcome("conflict",{local,remote:{data:remoteData,strongEtag:""},base:{snapshot:base},mergeResult,candidate:mergeResult.candidate});
          await openSyncConflict("dav-weak",outcome,{});
          document.querySelector("#conflictAllLocal").click();
          document.querySelector("#conflictApply").click();
          const confirmationOpen=document.querySelector("#confirmOverlay").classList.contains("open"),beforeConfirm=uiWrites;
          document.querySelector("#confirmOk").click();
          await new Promise(resolve=>setTimeout(resolve,0));
          return {reads,directWrites,confirmed,confirmationOpen,beforeConfirm,uiWrites};
        } finally {
          fetchRemoteData=original.fetchRemoteData;
          writeSyncCandidate=original.writeSyncCandidate;
          compatibilityWriteSelectedCandidate=original.compatibilityWriteSelectedCandidate;
          presentSyncOutcome=original.presentSyncOutcome;
          closeOverlay("confirmOverlay"); closeOverlay("conflictOverlay");
        }
      })()`);
      assert("compatibility continuation did not re-read before writing",result.reads===1&&result.directWrites===1&&result.confirmed,JSON.stringify(result));
      assert("weak-ETag UI wrote before explicit confirmation",result.confirmationOpen&&result.beforeConfirm===0&&result.uiWrites===1,JSON.stringify(result));
    });

    await group("conflict choices fit a narrow mobile viewport", async()=>{
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:375,height:720,deviceScaleFactor:1,mobile:true});
      try{
        const result=await cdp.evaluate(`(async()=>{
          const bm=(id,title)=>({id,title,url:"https://"+id+".example",category:"Work",description:"",tags:[],updatedAt:10});
          const snap=(rows)=>SyncMerge.canonicalize({version:4,bookmarks:rows,categories:["Work"],calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"},sync:{protocol:1,tombstones:[]}});
          const base=snap([bm("a","A")]),local=snap([bm("a","Local")]),remote=snap([bm("a","Remote")]);
          const mergeResult=SyncMerge.merge(base,local,remote),remoteData={bookmarks:remote.bookmarks,categories:remote.categories,calendarEvents:[],theme:"light",view:"grid",settings:{lang:"en"},syncMeta:{tombstones:[]},sourceVersion:4};
          await openSyncConflict("dav-ui",syncOutcome("conflict",{local,remote:{data:remoteData,strongEtag:'"m"'},base:{snapshot:base},mergeResult,candidate:mergeResult.candidate}),{});
          const modal=document.querySelector(".sync-conflict-modal"),choices=document.querySelector(".sync-conflict-choices"),buttons=[...document.querySelectorAll(".sync-conflict-foot .btn:not([hidden])")];
          return {viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,modalWidth:modal.getBoundingClientRect().width,
            columns:getComputedStyle(choices).gridTemplateColumns.split(" ").filter(Boolean).length,minButton:Math.min(...buttons.map(b=>b.getBoundingClientRect().height))};
        })()`);
        assert("mobile conflict dialog overflows or keeps side-by-side choices",result.scroll<=result.viewport&&result.modalWidth<=result.viewport&&result.columns===1&&result.minButton>=44,JSON.stringify(result));
      } finally {
        await cdp.evaluate(`closeOverlay("conflictOverlay")`);
        await cdp.send("Emulation.clearDeviceMetricsOverride");
      }
    });

    console.log("\n✔ Browser E2E passed");
  } finally {
    if(cdp) cdp.close();
    if(child.exitCode===null) child.kill("SIGTERM");
    await delay(150);
    if(child.exitCode===null) child.kill("SIGKILL");
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(profile,{recursive:true,force:true});
  }
}

main().catch(err=>{ console.error("\n✘ Browser E2E failed\n"+(err&&err.stack||err)); process.exit(1); });
