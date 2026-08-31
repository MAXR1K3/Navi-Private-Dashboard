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
      const result=await cdp.wait(`(()=>{const s=document.querySelector("#sum");return s&&!s.textContent.includes("running")?{summary:s.textContent,failed:document.querySelectorAll(".chk.fail").length}:null})()`,12000);
      assert("dev-check failures",result.failed===0,result.summary);
    });

    await cdp.navigate(base+"?e2e="+Date.now());
    await cdp.wait(`typeof render==="function" && !!document.querySelector("#viewBtn")`);
    await cdp.evaluate(`(()=>{localStorage.clear();state=defaults();ui={activeCat:"All",query:"",tagFilter:"",selectMode:false,selected:{},editingId:null,importData:null,importMode:"merge",calMonth:new Date().getMonth(),calYear:new Date().getFullYear(),calSelected:null,geoTried:false,weatherPanel:"",worldClockSetup:false};state.settings.lang="en";state.settings.widgetsCollapsed=true;state.settings.animations=false;state.settings.lowPower=true;state.categories=["Work"];state.bookmarks=[{id:"view-fixture",title:"View fixture",url:"https://example.com/view",category:"Work",description:"",tags:[]}];saveSilently();render();oplogInit();return true})()`);

    await group("explicit three-view selector", async()=>{
      const result=await cdp.evaluate(`(()=>{const b=document.querySelector("#viewBtn"),m=document.querySelector("#viewMenu");b.click();const opened=m.classList.contains("open")&&b.getAttribute("aria-expanded")==="true";m.querySelector('[data-view="compact"]').click();return {opened,view:state.view,grid:document.querySelector(".grid")?.className,label:b.getAttribute("aria-label"),selected:m.querySelector('[data-view="compact"]').getAttribute("aria-checked"),focus:document.activeElement===b}})()`);
      assert("view selector did not open",result.opened);
      assert("compact view was not selected",result.view==="compact"&&String(result.grid).includes("compact"),JSON.stringify(result));
      assert("view selection state/focus is wrong",result.selected==="true"&&result.focus&&/Compact/.test(result.label),JSON.stringify(result));
    });

    await group("mobile grouped action sheet and landscape clearance", async()=>{
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:375,height:812,deviceScaleFactor:1,mobile:true}); await delay(80);
      const portrait=await cdp.evaluate(`(()=>{const b=document.querySelector("#moreBtn"),m=document.querySelector("#moreMenu");b.click();const r=m.getBoundingClientRect(),groups=[...m.querySelectorAll("[data-menu-group]")].map(g=>({name:g.dataset.menuGroup,actions:[...g.querySelectorAll("[data-act]")].map(x=>x.dataset.act),cols:getComputedStyle(g.querySelector(".menu-group-actions")).gridTemplateColumns.split(/\\s+/).length}));document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));return {groups,rect:[Math.round(r.top),Math.round(r.bottom),Math.round(r.height)],closed:!m.classList.contains("open"),focus:document.activeElement===b}})()`);
      assert("mobile groups are wrong",portrait.groups.map(g=>g.name).join(",")==="transfer,ai,maintenance,danger",JSON.stringify(portrait.groups));
      assert("danger action is not isolated",portrait.groups[3].actions.join(",")==="clear");
      assert("mobile sheet columns/geometry are wrong",portrait.groups.slice(0,3).every(g=>g.cols===2)&&portrait.groups[3].cols===1&&portrait.rect[1]===812&&portrait.rect[2]<=668,JSON.stringify(portrait));
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

    await group("sync conflict presentation and remote resolution", async()=>{
      const result=await cdp.evaluate(`new Promise(async resolve=>{const remote={bookmarks:[{id:"remote-1",title:"Remote copy",url:"https://remote.example",category:"Remote",description:"",tags:[]}],categories:["Remote"],trash:[],calendarEvents:[],theme:"light",view:"grid",settings:null};await openSyncConflict("local",remote,{});const ov=document.querySelector("#conflictOverlay"),shown=ov.classList.contains("open"),named=ov.querySelector('[role="dialog"]').getAttribute("aria-labelledby")==="conflictTitle",body=document.querySelector("#conflictBody").textContent,mergeVisible=getComputedStyle(document.querySelector("#conflictMerge")).display!=="none";document.querySelector('[data-conflict="remote"]').click();await openSyncConflict("local",null,{});const unreadableMergeHidden=getComputedStyle(document.querySelector("#conflictMerge")).display==="none";closeOverlay("conflictOverlay");resolve({shown,named,body,mergeVisible,remoteApplied:state.bookmarks.length===1&&state.bookmarks[0].id==="remote-1",unreadableMergeHidden,closed:!ov.classList.contains("open")});})`);
      assert("sync conflict dialog did not present correctly",result.shown&&result.named&&result.mergeVisible&&/1/.test(result.body),JSON.stringify(result));
      assert("remote conflict resolution failed",result.remoteApplied,JSON.stringify(result));
      assert("unreadable conflict offers an invalid merge",result.unreadableMergeHidden&&result.closed,JSON.stringify(result));
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
