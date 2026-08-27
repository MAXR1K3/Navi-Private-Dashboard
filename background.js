// Navi background.js v1.7 — queues bookmark events while the dashboard is closed,
// and captures pages/links/images into a pending queue the dashboard drains on open.
const api=(typeof browser!=='undefined'&&browser.runtime)?browser:chrome;   // Safari 两个命名空间都有，但都没有 bookmarks
const MAX_QUEUE=500;
const MAX_CAPTURES=200;

function asPromise(v){ return v&&typeof v.then==='function'?v:Promise.resolve(v); }

/* ===== 右键 / 快捷键收藏（捕获入口） ===== */
const MENU_LABELS={
  en:{ page:'Save this page to Navi', link:'Save link to Navi', image:'Save image to Navi' },
  zh:{ page:'保存此页面到 Navi',   link:'保存链接到 Navi',   image:'保存图片到 Navi' },
  es:{ page:'Guardar esta página en Navi', link:'Guardar enlace en Navi', image:'Guardar imagen en Navi' }
};
function isWebLink(u){ return typeof u==='string' && /^https?:\/\//i.test(u); }

async function buildMenus(){
  if(!api.contextMenus) return;
  let lang='en';
  try{ const d=await asPromise(api.storage.local.get('naviLang')); if(d&&MENU_LABELS[d.naviLang]) lang=d.naviLang; }catch(_){}
  const L=MENU_LABELS[lang]||MENU_LABELS.en;
  try{ await asPromise(api.contextMenus.removeAll()); }catch(_){}
  try{
    api.contextMenus.create({ id:'navi-save-page',  title:L.page,  contexts:['page','frame','selection'] });
    api.contextMenus.create({ id:'navi-save-link',  title:L.link,  contexts:['link'] });
    api.contextMenus.create({ id:'navi-save-image', title:L.image, contexts:['image'] });
  }catch(_){}
}


/* ===== 页面存档：在目标标签页里就地抽取正文 =====
   关键优势是这里拿到的是「渲染后」的 DOM —— innerText 会自动忽略 CSS 隐藏的元素，
   JS 渲染出来的内容也在，这两点是抓原始 HTML 再解析永远做不到的。 */
function naviExtractArticle(){
  function clean(s){ return String(s||"").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim(); }
  function tlen(el){ return ((el&&el.innerText)||"").trim().length; }
  /* 顺序即优先级：先试「一定是正文」的容器，再退到 article/main 这类可能连导航一起
     包进来的泛容器。之前是所有选择器里取最长——结果维基百科总是选中 main，
     把「Article / Talk / Tools / 24 languages」这些页面骨架也抽了进来。 */
  var sels=[".mw-parser-output","#mw-content-text",".post-content",".entry-content",
            ".article-content",".markdown-body",".post-body","article","main","[role=main]",
            "#content",".content"];
  var best=null;
  for(var i=0;i<sels.length&&!best;i++){
    var els=document.querySelectorAll(sels[i]);
    for(var j=0;j<els.length;j++){ if(tlen(els[j])>=400&&tlen(els[j])>tlen(best)) best=els[j]; }
  }
  // 语义容器都找不到时，退回正文密度最高的块
  if(!best){
    var bestLen=0, all=document.body?document.body.querySelectorAll("div,section"):[];
    for(var k=0;k<all.length;k++){
      var el=all[k], txt=(el.innerText||"").trim();
      if(txt.length<400||txt.length<=bestLen) continue;
      var links=el.querySelectorAll("a").length;
      if(txt.length/(1+links)<40) continue;      // 链接列表型区块跳过
      bestLen=txt.length; best=el;
    }
  }
  /* 再往下钻：只要某个子节点独占了 85% 以上的文字，说明外层只是布局壳，
     钻进去能顺手甩掉侧栏、面包屑、页脚这类边角内容。 */
  if(best) for(var g=0;g<6;g++){
    var pl=tlen(best), ch=best.children, pick=null;
    for(var c=0;c<ch.length;c++){ if(tlen(ch[c])>=pl*0.85){ pick=ch[c]; break; } }
    if(!pick) break; best=pick;
  }
  var text=clean(best?best.innerText:(document.body?document.body.innerText:""));
  var MAX=200000;                                 // 单篇上限 ~200KB，防止超长页面撑爆存储
  var truncated=text.length>MAX;
  if(truncated) text=text.slice(0,MAX);
  function meta(n){ var m=document.querySelector('meta[name="'+n+'"],meta[property="'+n+'"]'); return m?(m.getAttribute("content")||""):""; }
  return {
    title:(document.title||"").trim(),
    url:location.href,
    text:text,
    excerpt:clean(meta("description")||meta("og:description")||text.slice(0,200)).slice(0,300),
    byline:clean(meta("author")||meta("article:author")).slice(0,80),
    chars:text.length, truncated:truncated, at:Date.now()
  };
}

/* 在指定标签页里执行抽取；失败（如 chrome:// 页面）返回 null */
async function captureSnapshot(tabId){
  if(!api.scripting||!api.scripting.executeScript||tabId==null) return null;
  try{
    const res=await asPromise(api.scripting.executeScript({ target:{tabId:tabId}, func:naviExtractArticle }));
    const r=(res&&res[0]&&res[0].result)||null;
    return (r&&r.text&&r.text.length>=200)?r:null;   // 太短的不值得存
  }catch(_){ return null; }
}

async function enqueueCapture(item){
  if(!isWebLink(item&&item.url)) return false;
  try{
    const d=await asPromise(api.storage.local.get('naviCaptures'));
    const q=(d&&d.naviCaptures)||[];
    // 同一 URL 已在队列里就不重复入队
    if(q.some(x=>x&&x.url===item.url)) { await refreshBadge(); return true; }
    q.push({ url:item.url, title:item.title||'', at:Date.now(), snap:item.snap||null });
    await asPromise(api.storage.local.set({ naviCaptures:q.length>MAX_CAPTURES?q.slice(q.length-MAX_CAPTURES):q }));
    await refreshBadge();
    return true;
  }catch(_){ return false; }
}

async function refreshBadge(){
  if(!api.action||!api.action.setBadgeText) return;
  try{
    const d=await asPromise(api.storage.local.get('naviCaptures'));
    const n=((d&&d.naviCaptures)||[]).length;
    await asPromise(api.action.setBadgeText({ text:n?String(n):'' }));
    if(api.action.setBadgeBackgroundColor) await asPromise(api.action.setBadgeBackgroundColor({ color:'#6d5efc' }));
  }catch(_){}
}

if(api.contextMenus&&api.contextMenus.onClicked){
  api.contextMenus.onClicked.addListener(async(info,tab)=>{
    let url='', title='';
    if(info.menuItemId==='navi-save-link'){ url=info.linkUrl; title=(info.selectionText||'').trim()||info.linkUrl; }
    else if(info.menuItemId==='navi-save-image'){ url=info.srcUrl; title=(tab&&tab.title)||info.srcUrl; }
    else if(info.menuItemId==='navi-save-page'){ url=(tab&&tab.url)||info.pageUrl; title=(tab&&tab.title)||''; }
    else return;
    // 只有「保存此页面」才可能存档：右键链接/图片时当前页并不是目标页
    const snap=(info.menuItemId==='navi-save-page'&&tab)?await captureSnapshot(tab.id):null;
    await enqueueCapture({url,title,snap});
  });
}

if(api.commands&&api.commands.onCommand){
  api.commands.onCommand.addListener(async(cmd)=>{
    if(cmd!=='navi-save-page') return;
    try{
      const tabs=await asPromise(api.tabs.query({active:true,currentWindow:true}));
      const tab=(tabs||[])[0]; if(!tab) return;
      const snap=await captureSnapshot(tab.id);
      await enqueueCapture({url:tab.url,title:tab.title||'',snap});
    }catch(_){}
  });
}

// 语言变化时重建菜单文案；队列被面板清空时同步角标
if(api.storage&&api.storage.onChanged){
  api.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local') return;
    if(changes.naviLang) buildMenus();
    if(changes.naviCaptures) refreshBadge();
  });
}
if(api.runtime.onInstalled) api.runtime.onInstalled.addListener(()=>{ buildMenus(); refreshBadge(); });
if(api.runtime.onStartup) api.runtime.onStartup.addListener(()=>{ buildMenus(); refreshBadge(); });
buildMenus(); refreshBadge();

api.action.onClicked.addListener(async()=>{
  const dashUrl=api.runtime.getURL('index.html');
  try{
    const tabs=await asPromise(api.tabs.query({}));
    const existing=(tabs||[]).find(t=>t.url&&t.url.indexOf(dashUrl)===0);
    if(existing){
      await asPromise(api.tabs.update(existing.id,{active:true}));
      if(existing.windowId!=null) await asPromise(api.windows.update(existing.windowId,{focused:true}));
    }else{
      await asPromise(api.tabs.create({url:dashUrl}));
    }
  }catch(_){ api.tabs.create({url:dashUrl}); }
});

/* Safari 的扩展 API 里没有 bookmarks（苹果从不把书签暴露给扩展）。
   下面这些监听如果不加判断，在 Safari 上会直接抛异常，
   整个后台脚本随之挂掉——连右键保存、快捷键这些本来能用的功能也一起没了。 */
const HAS_BOOKMARKS = !!(api && api.bookmarks && api.bookmarks.onCreated);

async function enqueue(ev){
  try{
    const d=await asPromise(api.storage.local.get('naviPending'));
    const q=(d&&d.naviPending)||[];
    q.push(ev);
    await asPromise(api.storage.local.set({naviPending:q.length>MAX_QUEUE?q.slice(q.length-MAX_QUEUE):q}));
  }catch(_){}
}

if(HAS_BOOKMARKS){
  api.bookmarks.onCreated.addListener(async(id,node)=>{
    if(!node.url) return;
    await enqueue({type:'created',id,node});
  });

  api.bookmarks.onRemoved.addListener(async(id,info)=>{
    if(info&&info.node&&!info.node.url) return;
    await enqueue({type:'removed',id});
  });

  api.bookmarks.onChanged.addListener(async(id,changes)=>{
    await enqueue({type:'changed',id,changes});
  });

  api.bookmarks.onMoved.addListener(async(id,info)=>{
    await enqueue({type:'moved',id,parentId:info.parentId});
  });
}
