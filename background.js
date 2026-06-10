// Navi background.js v1.1 — queues Chrome bookmark events while the dashboard is closed
const ROOTS=['Bookmarks bar','Bookmarks Bar','Other bookmarks','Other Bookmarks',
  'Mobile bookmarks','Mobile Bookmarks','书签栏','其他书签','移动设备书签'];
const MAX_QUEUE=500; // prevent unbounded growth

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