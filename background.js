// Navi background.js v1.6 — queues bookmark events while the dashboard is closed,
// and captures pages/links/images into a pending queue the dashboard drains on open.
const api=(typeof browser!=='undefined'&&browser.bookmarks)?browser:chrome;
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

async function enqueueCapture(item){
  if(!isWebLink(item&&item.url)) return false;
  try{
    const d=await asPromise(api.storage.local.get('naviCaptures'));
    const q=(d&&d.naviCaptures)||[];
    // 同一 URL 已在队列里就不重复入队
    if(q.some(x=>x&&x.url===item.url)) { await refreshBadge(); return true; }
    q.push({ url:item.url, title:item.title||'', at:Date.now() });
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
    await enqueueCapture({url,title});
  });
}

if(api.commands&&api.commands.onCommand){
  api.commands.onCommand.addListener(async(cmd)=>{
    if(cmd!=='navi-save-page') return;
    try{
      const tabs=await asPromise(api.tabs.query({active:true,currentWindow:true}));
      const tab=(tabs||[])[0]; if(!tab) return;
      await enqueueCapture({url:tab.url,title:tab.title||''});
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

async function enqueue(ev){
  try{
    const d=await asPromise(api.storage.local.get('naviPending'));
    const q=(d&&d.naviPending)||[];
    q.push(ev);
    await asPromise(api.storage.local.set({naviPending:q.length>MAX_QUEUE?q.slice(q.length-MAX_QUEUE):q}));
  }catch(_){}
}

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
