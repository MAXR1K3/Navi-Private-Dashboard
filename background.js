// Navi background.js v1.4 — queues Chrome bookmark events while the dashboard is closed,
// and opens/focuses the dashboard from the toolbar icon (no new-tab override).
const ROOTS=['Bookmarks bar','Bookmarks Bar','Other bookmarks','Other Bookmarks',
  'Mobile bookmarks','Mobile Bookmarks','书签栏','其他书签','移动设备书签'];
const MAX_QUEUE=500; // prevent unbounded growth

// Toolbar icon: focus the existing dashboard tab, or open a new one.
chrome.action.onClicked.addListener(async()=>{
  const dashUrl=chrome.runtime.getURL('index.html');
  try{
    const tabs=await chrome.tabs.query({});
    const existing=tabs.find(t=>t.url&&t.url.indexOf(dashUrl)===0);
    if(existing){
      await chrome.tabs.update(existing.id,{active:true});
      if(existing.windowId!=null) await chrome.windows.update(existing.windowId,{focused:true});
    }else{
      await chrome.tabs.create({url:dashUrl});
    }
  }catch(_){ chrome.tabs.create({url:dashUrl}); }
});

async function enqueue(ev){
  try{
    const d=await chrome.storage.local.get('naviPending');
    const q=d.naviPending||[];
    q.push(ev);
    // Trim oldest entries if queue exceeds cap
    const trimmed=q.length>MAX_QUEUE?q.slice(q.length-MAX_QUEUE):q;
    await chrome.storage.local.set({naviPending:trimmed});
  }catch(_){}
}

chrome.bookmarks.onCreated.addListener(async(id,node)=>{
  if(!node.url) return;
  let parentTitle='';
  try{ const [p]=await chrome.bookmarks.get(node.parentId); parentTitle=p?.title||''; }catch(_){}
  await enqueue({type:'created',id,node,parentTitle});
});

chrome.bookmarks.onRemoved.addListener(async(id,removeInfo)=>{
  // removeInfo.node.url is undefined for folders — skip folder-removal events
  if(removeInfo?.node&&!removeInfo.node.url) return;
  await enqueue({type:'removed',id});
});

chrome.bookmarks.onChanged.addListener(async(id,changes)=>{
  await enqueue({type:'changed',id,changes});
});

chrome.bookmarks.onMoved.addListener(async(id,info)=>{
  let parentTitle='';
  try{ const [p]=await chrome.bookmarks.get(info.parentId); parentTitle=p?.title||''; }catch(_){}
  await enqueue({type:'moved',id,parentId:info.parentId,parentTitle});
});
