#!/usr/bin/env node
/* tools/test.js — 纯逻辑层的回归测试，不开浏览器，秒级跑完。
   只测"改错了会静默出问题"的那些函数：搜索打分、去重规范化、同步指纹与合并、
   代理返回的 markdown 解析、清理分类、存档片段。DOM / 视觉不在这层，那部分靠 dev-check.html。
   用法：node tools/test.js */
"use strict";
const { createEnv, load } = require("./env.js");

const ctx = createEnv();
const failed = load(ctx, ["js/i18n.js","js/state.js","js/icons.js","js/utils.js","js/render.js",
                          "js/suggest.js","js/sync.js","js/cleanup.js","js/snapshots.js",
                          "js/bookmarks.js","js/import-export.js","js/keywords.js"]);
if (failed.length) { console.error("× 模块加载失败：\n  " + failed.join("\n  ")); process.exit(1); }

let pass = 0, fail = 0, group = "";
const G = n => { group = n; };
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; console.log("  ✘ [" + group + "] " + name + (detail ? "\n      " + detail : ""));
}
const eq = (name, got, want) => ok(name, got === want, "期望 " + JSON.stringify(want) + "，实际 " + JSON.stringify(got));

/* ---------- 搜索打分 ---------- */
G("fuzzyScore");
const { fuzzyScore } = ctx;
ok("完全匹配得分最高", fuzzyScore("github", "github.com dev") > fuzzyScore("github", "my git hub notes"));
ok("不相关的词不匹配", fuzzyScore("zzqqxx", "github.com developer tools") === 0);
ok("空查询视为全通过", fuzzyScore("", "anything") === 1);
// —— 以下是"常见字母组合把无关书签全捞出来"这一类回归 ——
// haystack 是标题+URL+分类+描述拼起来的长串，c/o/d/e 这种字母在里面几乎必然凑得齐，
// 松散的子序列和短词编辑距离都会让它命中一切。
ok("code 不匹配散布命中的无关网址", fuzzyScore("code", "example.com some random page") === 0,
   "实际得分 " + fuzzyScore("code", "example.com some random page"));
ok("cod 不匹配（URL 里遍地是 com，距离 1）", fuzzyScore("cod", "example.com some random page") === 0,
   "实际得分 " + fuzzyScore("cod", "example.com some random page"));
ok("code 仍能匹配真正相关的", fuzzyScore("code", "https://code.visualstudio.com VS Code") > 0);
// 收紧的同时这些必须活着：紧凑缩写、拼写容错
ok("gh 仍能匹配 github（紧凑缩写）", fuzzyScore("gh", "github.com https://github.com") > 0);
ok("dcs 仍能匹配 docs（紧凑缩写）", fuzzyScore("dcs", "https://docs.google.com") > 0);
ok("gthub 仍能匹配 github（拼写容错）", fuzzyScore("gthub", "github.com https://github.com") > 0);
ok("dribble 仍能匹配 dribbble", fuzzyScore("dribble", "dribbble.com 设计灵感") > 0);
ok("3 字查询仍走子串匹配", fuzzyScore("mdn", "MDN Web Docs https://developer.mozilla.org") > 0);

/* ---------- 检索缓存与掩码预筛（这次性能优化引入的新面） ---------- */
G("检索派生缓存");
const bm = { id:"x1", title:"React 官方文档", url:"https://react.dev/learn",
             category:"开发", description:"入门指南", tags:["前端"] };
const d1 = ctx.bookmarkSearchData(bm);
ok("内容没变时复用同一份缓存", ctx.bookmarkSearchData(bm) === d1);
bm.title = "Vue 官方文档";
const d2 = ctx.bookmarkSearchData(bm);
ok("改了标题就重算", d2 !== d1 && d2.ch.indexOf("vue") > -1, "ch=" + d2.ch.slice(0, 40));
ok("缓存不进 JSON（否则会写进 localStorage 和导出文件）",
   JSON.stringify(bm).indexOf("_sx") < 0);
ok("缓存不出现在 Object.keys 里", Object.keys(bm).indexOf("_sx") < 0);
// 改了内容后搜索结果要跟着变——缓存类改动最容易在这里翻车
ctx.state.bookmarks = [{ id:"c1", title:"独一无二的旧标题", url:"https://example.org/a",
                         category:"c", description:"", tags:[] }];
ctx.state.categories = ["c"]; ctx.ui.activeCat = "All"; ctx.ui.tagFilter = ""; ctx.ui.query = "旧标题";
eq("改名前能搜到", ctx.visibleBookmarks().length, 1);
ctx.state.bookmarks[0].title = "换成了别的名字";
eq("改名后旧词搜不到", ctx.visibleBookmarks().length, 0);
ctx.ui.query = "别的名字";
eq("改名后新词能搜到", ctx.visibleBookmarks().length, 1);
ctx.ui.query = "";

G("掩码预筛不会漏匹配");
// 先确认掩码本身有区分力——写坏成"全都一样"时预筛会静默失效（结果仍对，只是白算）
ok("不同字符集的掩码不同", ctx.charMask("abc") !== ctx.charMask("xyz"));
eq("缺失字符数计算正确", ctx.popcount(ctx.charMask("abcd") & ~ctx.charMask("abxy")), 2);
eq("完全包含时缺失为 0", ctx.popcount(ctx.charMask("abc") & ~ctx.charMask("xabcy")), 0);
// 预筛的前提：查询里有 k+1 个字符在目标里根本不存在时，编辑距离必然 > k。
// 这条不成立的话，预筛就会把真匹配挡掉——用随机串做属性测试来守住它。
let violations = 0, checked = 0;
const alpha = "abcdefghijklmnopqrstuvwxyz0123456789";
const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
for (let i = 0; i < 4000; i++) {
  const la = 3 + Math.floor(rnd() * 8), lb = 3 + Math.floor(rnd() * 8);
  let a = "", b = "";
  for (let j = 0; j < la; j++) a += alpha[Math.floor(rnd() * alpha.length)];
  for (let j = 0; j < lb; j++) b += alpha[Math.floor(rnd() * alpha.length)];
  if (rnd() < 0.5) { const cut = Math.floor(rnd() * a.length); b = a.slice(0, cut) + alpha[Math.floor(rnd()*alpha.length)] + a.slice(cut + 1); }
  for (const k of [0, 1, 2]) {
    const dist = ctx.editDistance(a, b, k);
    if (dist <= k) { checked++; if (ctx.popcount(ctx.charMask(a) & ~ctx.charMask(b)) > k) violations++; }
  }
}
ok("真匹配从不被预筛挡掉（" + checked + " 个样本）", violations === 0, violations + " 个反例");
ok("样本量足够", checked > 200, "只验证了 " + checked + " 个");
// 上面那条只验证了数学不等式本身，验证不到"代码有没有正确地用它"。
// 真正该守的是：加了预筛之后，打分结果必须和不加预筛完全一致。
let diff = 0, pairs = 0, sample = "";
const HAYS = ["React 官方文档 https://react.dev/learn 开发 前端",
              "MDN Web API https://developer.mozilla.org/en-US/docs/Web/API 学习",
              "Stack Overflow python tagged questions https://stackoverflow.com/questions",
              "知乎问题 如何入门机器学习 https://zhihu.com/question/123456 学习",
              "npm lodash package https://npmjs.com/package/lodash 工具",
              "Bookmark 42 https://example42.com/some/path Cat2 desc"];
const QS = ["react","documentation","python","机器学习","lodash","stackoverflow","exa","gi",
            "docs","mdn","reac","pyton","stackoverflw","zh","例子","example42","npm包"];
for (const h of HAYS) {
  const withMask = { ch: ctx.compactSearch(h), ht: ctx.looseText(h).split(/\s+/).filter(Boolean) };
  withMask.hm = withMask.ht.map(ctx.charMask);
  const noMask = { ch: withMask.ch, ht: withMask.ht, hm: null };
  for (const q of QS) {
    const qd = ctx.queryData(q); pairs++;
    const a = ctx.fuzzyScoreData(qd, withMask), b = ctx.fuzzyScoreData(qd, noMask);
    if (a !== b) { diff++; if (!sample) sample = '"' + q + '" → 有预筛 ' + a + "，无预筛 " + b; }
  }
}
ok("预筛不改变任何打分结果（" + pairs + " 组）", diff === 0, diff + " 组不一致，例如 " + sample);
// 手工用例的"缺失字符数"几乎都是 0，碰不到 popcount 恰好等于容错上限的边界，
// 而预筛写错（<= 写成 <）正是在这个边界上翻车。用随机串把边界扫出来。
let rdiff = 0, rpairs = 0, hitBoundary = 0, rsample = "";
for (let i = 0; i < 3000; i++) {
  const la = 4 + Math.floor(rnd() * 6);
  let base = "";
  for (let j = 0; j < la; j++) base += alpha[Math.floor(rnd() * alpha.length)];
  // 在 base 上做 1~2 处改动当查询，保证有相当比例落在编辑距离容错边界上
  let q = base;
  const edits = 1 + Math.floor(rnd() * 2);
  for (let e = 0; e < edits; e++) {
    const at = Math.floor(rnd() * q.length);
    q = q.slice(0, at) + alpha[Math.floor(rnd() * alpha.length)] + q.slice(at + 1);
  }
  const h = "title " + base + " https://" + base + ".com/x cat desc";
  const wm = { ch: ctx.compactSearch(h), ht: ctx.looseText(h).split(/\s+/).filter(Boolean) };
  wm.hm = wm.ht.map(ctx.charMask);
  const nm = { ch: wm.ch, ht: wm.ht, hm: null };
  const qd = ctx.queryData(q); rpairs++;
  const maxd = q.length <= 3 ? 0 : (q.length <= 6 ? 1 : 2);
  for (const tok of wm.ht) if (ctx.popcount(ctx.charMask(q) & ~ctx.charMask(tok)) === maxd) { hitBoundary++; break; }
  const a = ctx.fuzzyScoreData(qd, wm), b = ctx.fuzzyScoreData(qd, nm);
  if (a !== b) { rdiff++; if (!rsample) rsample = '"' + q + '" vs "' + base + '"：有预筛 ' + a + "，无预筛 " + b; }
}
ok("随机串上预筛同样不改变结果（" + rpairs + " 组）", rdiff === 0, rdiff + " 组不一致，例如 " + rsample);
ok("随机样本确实覆盖到了边界（popcount 恰等于容错上限）", hitBoundary > 50, "只覆盖到 " + hitBoundary + " 组");

G("fuzzyScore 字符串入口");
// palette.js 仍然用 fuzzyScore(q, 字符串)，两条入口的结果必须一致
const hay = "React 官方文档 https://react.dev/learn 开发 前端";
ok("字符串入口与数据入口结果相同",
   ctx.fuzzyScore("react", hay) ===
   ctx.fuzzyScoreData(ctx.queryData("react"), { ch: ctx.compactSearch(hay),
     ht: ctx.looseText(hay).split(/\s+/).filter(Boolean), hm: null }));
ok("字符串入口仍能正常匹配", ctx.fuzzyScore("react", hay) > 0);

/* ---------- URL 去重规范化 ---------- */
G("normForDup");
const { normForDup } = ctx;
eq("补协议", normForDup("example.com/a"), "https://example.com/a");
eq("去尾斜杠", normForDup("https://example.com/a/"), "https://example.com/a");
eq("大小写归一", normForDup("https://Example.COM/A"), "https://example.com/a");
ok("有无尾斜杠算同一条", normForDup("https://x.com/p/") === normForDup("https://x.com/p"));

/* ---------- 同步指纹 ---------- */
G("syncFingerprint");
const { syncFingerprint } = ctx;
const mk = (id, url, title) => ({ id, url, title, category: "c", description: "", tags: [] });
const A = [mk("1","https://a.com","A"), mk("2","https://b.com","B")];
const B = [mk("2","https://b.com","B"), mk("1","https://a.com","A")];   // 只是顺序不同
const C = [mk("1","https://a.com","A 改过了"), mk("2","https://b.com","B")];
eq("纯换顺序不算改动", syncFingerprint(A), syncFingerprint(B));
ok("改了标题就要变", syncFingerprint(A) !== syncFingerprint(C));

/* ---------- 远端内容识别 ---------- */
G("looksLikeBookmarkExport");
// NAS 反代在会话过期时常对任何请求回一个 200 登录页；登录页里也有 <a href>，
// 以前会被当成书签文件整份采纳，把本地库替换成登录页上的几个链接。
const loginPage = '<!doctype html><html><head><title>DSM Login</title></head><body><h1>Sign in</h1>' +
  '<a href="https://www.synology.com/support">Support</a>' +
  '<a href="https://account.synology.com/reset">Forgot password</a></body></html>';
ok("登录页不算书签文件", ctx.looksLikeBookmarkExport(loginPage) === false);
ok("目录列表不算", ctx.looksLikeBookmarkExport('<html><body><ul><li><a href="https://x.com/a">a</a></li></ul></body></html>') === false);
ok("错误页不算", ctx.looksLikeBookmarkExport("<html><body>404 Not Found</body></html>") === false);
// 真正的浏览器导出文件必须继续认得
ok("带 NETSCAPE 声明的认得",
   ctx.looksLikeBookmarkExport('<!DOCTYPE NETSCAPE-Bookmark-file-1><HTML><BODY><DL><DT><A HREF="https://x.com">X</A></DL>') === true);
ok("只有 DT/A 结构也认得",
   ctx.looksLikeBookmarkExport('<DL><p><DT><A HREF="https://x.com" ADD_DATE="1">X</A></DL>') === true);
ok("空内容不算", ctx.looksLikeBookmarkExport("") === false);

/* ---------- 推送决策（这条错一次就是别人的数据被抹掉） ---------- */
G("syncPushDecision");
const bmk=[{id:"1",url:"https://a.com",title:"A",category:"c",description:"",tags:[]}];
const fpOf=ctx.syncFingerprint(bmk);
eq("远程不存在 → 直接写", ctx.syncPushDecision({missing:true}, undefined), "upload");
eq("远程不存在且有基准 → 直接写", ctx.syncPushDecision({missing:true}, fpOf), "upload");
eq("远程读不懂 → 交给用户", ctx.syncPushDecision({unreadable:true}, fpOf), "conflict");
// 这条是回归：以前没有基准指纹时直接上传，把另一台设备的数据整份覆盖掉还报成功
eq("没有基准指纹但远程有内容 → 交给用户", ctx.syncPushDecision({data:{bookmarks:bmk}}, undefined), "conflict");
eq("基准为空字符串同样不算基准", ctx.syncPushDecision({data:{bookmarks:bmk}}, ""), "conflict");
eq("指纹一致 → 直接写", ctx.syncPushDecision({data:{bookmarks:bmk}}, fpOf), "upload");
eq("指纹不一致 → 交给用户", ctx.syncPushDecision({data:{bookmarks:bmk}}, "别的指纹"), "conflict");
eq("拿不到远端信息 → 保守处理", ctx.syncPushDecision(null, fpOf), "conflict");

/* ---------- 远端合并 ---------- */
G("mergeRemoteIntoLocal");
ctx.state.bookmarks = [mk("L1","https://same.com","本地版本"), mk("L2","https://local-only.com","只在本地")];
ctx.state.categories = ["c"];
ctx.state.trash = [{ bm: mk("T1","https://deleted.com","本地删掉的"), deletedAt: Date.now() }];
const merged = ctx.mergeRemoteIntoLocal({
  bookmarks: [mk("R1","https://same.com","远端版本"), mk("R2","https://remote-only.com","只在远端"),
              mk("R3","https://deleted.com","本地删掉的")],
  categories: ["c","远端新分类"]
});
const urls = merged.bookmarks.map(b => b.url);
ok("远端独有的会并进来", urls.indexOf("https://remote-only.com") > -1);
ok("本地独有的不会丢", urls.indexOf("https://local-only.com") > -1);
eq("同一 URL 本地版本优先",
   (merged.bookmarks.find(b => b.url === "https://same.com") || {}).title, "本地版本");
ok("远端新分类会并进来", merged.categories.indexOf("远端新分类") > -1);
eq("新增计数正确", merged.added, 1);
ok("回收站作为墓碑，删掉的不会被远端复活",
   urls.indexOf("https://deleted.com") < 0, "实际: " + JSON.stringify(urls));

/* ---------- r.jina.ai 的 markdown 解析 ---------- */
G("parseJina");
const jina = [
  "Title: Service worker", "", "URL Source: https://en.wikipedia.org/wiki/Service_worker", "",
  "Markdown Content:",
  "[Jump to content](https://en.wikipedia.org/wiki/Service_worker#bodyContent)",
  "- [x] Main menu ", "move to sidebar hide",
  "*   [Main page](https://en.wikipedia.org/wiki/Main_Page \"Visit the main page\")",
  "*   [Contents](https://en.wikipedia.org/wiki/Wikipedia:Contents \"Guides\")",
  "这是真正的正文段落，长度足够超过阈值，里面没有密集的链接，应该被当作描述抽出来，用于验证按行筛选的规则确实有效。"
].join("\n");
const jr = ctx.parseJina(jina) || "";
ok("抽到了正文", jr.indexOf("这是真正的正文段落") > -1);
ok("导航块被丢掉", jr.indexOf("Main menu") < 0 && jr.indexOf("move to sidebar") < 0, jr.slice(0, 160));
ok("标题被识别", jr.indexOf("Service worker") > -1);
ok("正文太少时返回 null", ctx.parseJina("Title: x\n\nMarkdown Content:\n短") === null);
// 中文正文一段常常只有五六十字，按字符数卡 80 会整段丢掉
const zh = ["Title: 中文页面","","Markdown Content:","*   [导航](https://x.com \"导航\")","跳转到内容",
  "这是一段正常长度的中文正文，介绍了页面的主要内容，通常五六十个字就足以说明白一件事。"].join("\n");
const zr = ctx.parseJina(zh) || "";
ok("中文正文不会被长度阈值丢掉", zr.indexOf("这是一段正常长度的中文正文") > -1, zr.slice(0,120) || "(null)");
ok("中文导航短句仍被丢掉", zr.indexOf("跳转到内容") < 0 && zr.indexOf("导航") < 0);

/* ---------- 清理分类 ---------- */
G("cleanupScan");
const now = Date.now(), day = 86400000;
ctx.state.bookmarks = [
  { id:"a", url:"https://dup.com", title:"留下的", clicks:9, lastOpened:now-day, description:"x", category:"c" },
  { id:"b", url:"https://dup.com/", title:"重复的", clicks:0, lastOpened:0, description:"", category:"c" },
  { id:"c", url:"https://never.com", title:"从没打开", clicks:0, lastOpened:0, category:"c" },
  { id:"d", url:"https://stale.com", title:"很久没开", clicks:3, lastOpened:now-400*day, category:"c" },
  { id:"e", url:"https://dead.com", title:"失效", clicks:1, lastOpened:now-day, category:"c", health:{status:"bad"} }
];
const scan = ctx.cleanupScan();
eq("重复识别出 1 条", scan.dup.length, 1);
eq("重复项保留点击多的那条", scan.dup[0].keep.id, "a");
ok("被判重复的不再进其它分类",
   !scan.never.concat(scan.stale, scan.dead).some(x => x.b.id === "b"));
eq("从没打开", scan.never.length, 1);
eq("长期未用", scan.stale.length, 1);
eq("失效链接", scan.dead.length, 1);

/* ---------- 本地关键词提取 ---------- */
G("extractKeywords");
const zhText = "机器学习入门指南。本文介绍机器学习的基本概念，包括监督学习、无监督学习和强化学习。" +
               "机器学习模型的训练需要大量数据，深度学习是机器学习的一个分支，神经网络是深度学习的核心。" +
               "我们会用 Python 和 PyTorch 实现一个简单的神经网络。";
const zhKw = ctx.extractKeywords(zhText, 8);
ok("中文抽出真正的词", zhKw.indexOf("机器学习") > -1 && zhKw.indexOf("神经网络") > -1, zhKw.join("/"));
// 中文没有词边界，n-gram 会切出"器学习入"这种跨词碎片，必须被过滤掉
ok("不出现跨词碎片", !zhKw.some(w => ["器学习入","学习入门","习入门指","是机器学"].indexOf(w) > -1), zhKw.join("/"));
ok("被长词吸收的短词不重复出现", zhKw.indexOf("学习") < 0, zhKw.join("/"));
// 这是有意的取舍：中文片段只出现一次时无法与跨词碎片区分，宁可漏也不给噪声
ok("只出现一次的中文词不进候选", ctx.extractKeywords("量子计算很有趣。今天天气不错，我去买了一杯咖啡然后回家。", 8)
   .indexOf("量子计算") < 0);
ok("中英混排时英文词照常抽出", zhKw.indexOf("pytorch") > -1 || zhKw.indexOf("python") > -1, zhKw.join("/"));

const enText = "Using IndexedDB. This tutorial walks you through using the asynchronous API of IndexedDB. " +
               "IndexedDB is a transactional database system. Transactions in IndexedDB are scoped to object stores.";
const enKw = ctx.extractKeywords(enText, 8);
ok("英文抽到主题词", enKw.indexOf("indexeddb") > -1, enKw.join("/"));
ok("停用词被剔除", !enKw.some(w => ["the","this","through","using","are","you"].indexOf(w) > -1), enKw.join("/"));
ok("同词根只保留一个", enKw.filter(w => w.indexOf("transaction") === 0).length <= 1, enKw.join("/"));

// 每篇都出现的词没有区分度，应该被 IDF 压下去
const df = { 教程: 20, 神经网络: 1 };
const idfKw = ctx.extractKeywords("神经网络教程。神经网络教程讲解神经网络。教程教程教程教程。", 3, df, 20);
ok("语料里到处都有的词被压低", idfKw.indexOf("神经网络") > -1 && idfKw[0] !== "教程", idfKw.join("/"));

G("跨词碎片过滤（左右自由度）");
// n-gram 会切出"器学习入"这种跨词碎片。判据不是频次也不是凝固度，
// 而是左右自由度：真词出现在各种上下文里，碎片永远被夹在同一个短语中间。
const frag = "机器学习入门 机器学习入门指南。机器学习的基本概念包括监督学习和无监督学习。" +
             "机器学习模型需要大量训练数据。深度学习是机器学习的一个分支。神经网络是深度学习的核心。神经网络有很多层。";
const fk = ctx.extractKeywords(frag, 12);
ok("真词都在", ["机器学习","监督学习","深度学习","神经网络"].every(w => fk.indexOf(w) > -1), fk.join("/"));
ok("碎片一个不留", !["器学习入","学习入门","习入门指","是机器学","度学习是","经网络是"].some(w => fk.indexOf(w) > -1), fk.join("/"));
// 总在句首出现的词，左邻居永远是边界符——那是成词的证据，不能因此判成碎片
const head = "神经网络很重要。神经网络有很多层。神经网络需要训练。";
ok("总在句首的词不被误杀", ctx.extractKeywords(head, 5).indexOf("神经网络") > -1,
   ctx.extractKeywords(head, 5).join("/"));

G("summarizeText 抽取式摘要");
const artZh = "跳转到内容。主菜单。机器学习入门指南。本文介绍机器学习的基本概念。" +
  "机器学习是人工智能的一个分支，它让计算机从数据中学习规律，而不需要显式编程。" +
  "监督学习使用带标签的数据训练模型，无监督学习则从无标签数据中发现结构。" +
  "深度学习是机器学习的一个子领域，它使用多层神经网络。神经网络的训练依赖反向传播算法。版权所有。联系我们。";
const sZh = ctx.summarizeText(artZh, 120);
ok("摘出的是原文里的句子", artZh.indexOf(sZh.split("。")[0]) > -1, sZh);
ok("跳过导航与页脚残留", ["跳转到内容","主菜单","版权所有","联系我们"].every(j => sZh.indexOf(j) < 0), sZh);
ok("长度受控", ctx.kwTextWeight(sZh) < 120 * 1.4, "权重长度 " + Math.round(ctx.kwTextWeight(sZh)));
ok("中文句子之间不留多余空格", !/。\s/.test(sZh), sZh);

const artEn = "Skip to content. Menu. Using IndexedDB. IndexedDB is a low-level API for client-side storage " +
  "of significant amounts of structured data. This tutorial walks you through using the asynchronous API. " +
  "You create an object store and then add records to it. Last modified on Feb 8. View this page on GitHub.";
const sEn = ctx.summarizeText(artEn, 140);
ok("英文摘要抓住主题", sEn.toLowerCase().indexOf("indexeddb") > -1, sEn);
ok("英文跳过导航", sEn.indexOf("Skip to content") < 0 && sEn.indexOf("View this page") < 0, sEn);
ok("句子按原文顺序排列", (function(){
  const parts = sEn.split(/(?<=\.)\s+/).filter(Boolean);
  let last = -1;
  return parts.every(p => { const at = artEn.indexOf(p.trim()); const ok2 = at > last; last = at; return ok2; });
})(), sEn);
eq("空文本返回空", ctx.summarizeText("", 100), "");
ok("重复内容不会被选两遍", (function(){
  const dup = "神经网络很重要。神经网络很重要。神经网络确实很重要。这是另一件完全不同的事情，讲的是数据库事务。";
  const s = ctx.summarizeText(dup, 200);
  return (s.match(/神经网络很重要/g) || []).length <= 1;
})());

G("keywordVector");
const kv = ctx.keywordVector(frag, 10);
ok("返回带词频的结构", kv.length > 0 && typeof kv[0].w === "string" && typeof kv[0].n === "number");
ok("按权重排序，主题词在前", kv[0].w === "机器学习", JSON.stringify(kv.slice(0,3)));
ok("同样不含碎片", !kv.some(x => x.w === "器学习入"), kv.map(x=>x.w).join("/"));

G("bookmarkText");
const bt = ctx.bookmarkText({ title: "标题", description: "描述", url: "https://x.com/some-path/here" });
ok("含标题", bt.indexOf("标题") > -1);
ok("含描述", bt.indexOf("描述") > -1);
ok("含 URL 路径分词", bt.indexOf("some path here") > -1, bt);
ok("有存档时把正文接上", ctx.bookmarkText({ title:"t", url:"https://x.com" }, "正文内容").indexOf("正文内容") > -1);

/* ---------- 存档片段 ---------- */
G("snapshots");
const { snapSnippet, snapKey } = ctx;
const long = "前置内容".repeat(40) + "关键命中词" + "后置内容".repeat(40);
const sn = snapSnippet(long, "关键命中词");
ok("片段包含命中词", sn.indexOf("关键命中词") > -1);
ok("片段两端有省略号", sn.startsWith("…") && sn.endsWith("…"), sn.slice(0, 40));
ok("片段长度受控", sn.length < 200, "实际 " + sn.length);
eq("查不到时返回空", snapSnippet("毫不相干的正文", "找不到"), "");
ok("存档键与去重规范化一致", snapKey("https://X.com/p/") === snapKey("https://x.com/p"));

/* ---------- 概念搜索 ---------- */
G("conceptMatchGroups");
ok("已知概念词能命中分组", (ctx.conceptMatchGroups("视频") || []).length > 0);
ok("无意义词不命中", (ctx.conceptMatchGroups("qwzxjk") || []).length === 0);

console.log((fail ? "\n✘ " : "✔ ") + pass + " passed" + (fail ? ", " + fail + " failed" : ""));
process.exit(fail ? 1 : 0);
