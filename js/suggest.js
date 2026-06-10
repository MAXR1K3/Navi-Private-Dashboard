/* suggest.js — AI 分类建议：根据标题/URL/域名/描述推荐分类和标签。
   只生成建议，由用户勾选后应用；默认本地规则引擎，设置里可填 Claude/OpenAI Key 启用 API 模式。 */
"use strict";

var SUGGEST_CATS={
  dev:["Development","开发","Desarrollo"], ai:["AI","AI","IA"], video:["Video","视频","Vídeo"],
  social:["Social","社交","Social"], news:["News","资讯","Noticias"], shopping:["Shopping","购物","Compras"],
  design:["Design","设计","Diseño"], docs:["Docs & Reference","文档资料","Documentación"],
  edu:["Learning","学习","Aprendizaje"], finance:["Finance","财经","Finanzas"],
  music:["Music","音乐","Música"], games:["Games","游戏","Juegos"], tools:["Tools","工具","Herramientas"],
  work:["Work","办公","Trabajo"], reading:["Reading","阅读","Lectura"], travel:["Travel","旅行","Viajes"]
};
var SUGGEST_RULES=[
  {cat:"dev",     kws:["github","gitlab","stackoverflow","stack overflow","leetcode","npm","pypi","devops","docker","kubernetes","linux","vscode","programming","coding","developer","framework","sdk","api","编程","开发","代码","前端","后端","算法"]},
  {cat:"ai",      kws:["openai","anthropic","claude","chatgpt","gpt","llm","huggingface","hugging face","machine learning","deep learning","midjourney","stable diffusion","人工智能","大模型","机器学习","神经网络"]},
  {cat:"video",   kws:["youtube","bilibili","netflix","twitch","vimeo","youku","iqiyi","douyin","tiktok","video","movie","film","视频","电影","剧集","番剧","直播"]},
  {cat:"social",  kws:["twitter","x.com","facebook","instagram","reddit","weibo","zhihu","discord","telegram","linkedin","v2ex","forum","微博","知乎","论坛","社区"]},
  {cat:"news",    kws:["news","reuters","bloomberg","nytimes","bbc","cnn","guardian","techcrunch","hackernews","hacker news","36kr","新闻","资讯","日报","时报"]},
  {cat:"shopping",kws:["amazon","taobao","tmall","jd.com","pinduoduo","ebay","aliexpress","temu","shop","store","deal","coupon","淘宝","京东","拼多多","购物","商城","优惠"]},
  {cat:"design",  kws:["figma","dribbble","behance","sketch","canva","font","icon","palette","design","ui","ux","设计","字体","图标","配色","素材"]},
  {cat:"docs",    kws:["docs","documentation","wiki","wikipedia","manual","reference","mdn","w3school","cheatsheet","文档","手册","百科","词典"]},
  {cat:"edu",     kws:["course","tutorial","udemy","coursera","edx","khan","mooc","university","exam","learn","学习","课程","教程","慕课","考试","题库"]},
  {cat:"finance", kws:["stock","invest","finance","bank","crypto","bitcoin","trading","fund","雪球","股票","基金","理财","银行","财经","汇率"]},
  {cat:"music",   kws:["spotify","soundcloud","music","playlist","album","网易云","音乐","歌单","电台"]},
  {cat:"games",   kws:["steam","epicgames","epic games","playstation","xbox","nintendo","switch","game","gaming","游戏","原神","主机"]},
  {cat:"tools",   kws:["tool","converter","generator","calculator","translate","regex","utility","在线工具","工具","翻译","转换","生成器"]},
  {cat:"work",    kws:["notion","slack","jira","asana","trello","confluence","feishu","dingtalk","office","gmail","outlook","docs.google","sheet","飞书","钉钉","办公","邮箱","会议"]},
  {cat:"reading", kws:["blog","medium","substack","novel","book","goodreads","douban","rss","博客","阅读","小说","豆瓣","书"]},
  {cat:"travel",  kws:["travel","trip","flight","hotel","airbnb","booking.com","map","旅行","机票","酒店","地图","攻略"]}
];

function localSuggest(b){
  var hay=((b.title||"")+" "+(b.url||"")+" "+(getDomain(b.url)||"")+" "+(b.description||"")).toLowerCase();
  var dom=(getDomain(b.url)||"").toLowerCase();
  var best=null,bestScore=0,bestHits=[];
  SUGGEST_RULES.forEach(function(rule){
    var score=0,hits=[];
    rule.kws.forEach(function(kw){
      if(hay.indexOf(kw)>-1){ score+=(dom.indexOf(kw)>-1)?3:1; hits.push(kw); }
    });
    if(score>bestScore){ bestScore=score; best=rule; bestHits=hits; }
  });
  if(!best||bestScore<2) return null; // 信号太弱不出建议，避免噪音
  var names=SUGGEST_CATS[best.cat], label=names[langIdx()];
  // 优先复用用户已有的同义分类，减少新分类数量
  var existing=null;
  state.categories.forEach(function(c){
    var cl=String(c).toLowerCase();
    names.forEach(function(alias){
      var al=alias.toLowerCase();
      if(cl===al||cl.indexOf(al)>-1||al.indexOf(cl)>-1) existing=existing||c;
    });
  });
  var tags=[];
  bestHits.sort(function(a,b){ return (dom.indexOf(b)>-1)-(dom.indexOf(a)>-1); })
    .slice(0,3).forEach(function(h){ h=h.replace(/\.(com|org|net|cn)$/,""); if(tags.indexOf(h)===-1) tags.push(h); });
  return {category:existing||label, tags:tags};
}

function aiApiSuggest(list, cb){
  var s=state.settings, key=(s.aiKey||"").trim(), prov=s.aiProvider;
  if(!key||(prov!=="anthropic"&&prov!=="openai")){ cb(null); return; }
  var items=list.slice(0,80).map(function(b){
    return {id:b.id,title:b.title,url:b.url,description:String(b.description||"").slice(0,140),category:b.category};
  });
  var prompt="You are organizing browser bookmarks. Existing categories: "+JSON.stringify(state.categories)+
    ". For each bookmark suggest the best category (prefer existing categories; only invent a concise new one when clearly needed; write category names in language '"+s.lang+"') and 1-3 short lowercase tags. "+
    "Reply ONLY a JSON array like [{\"id\":\"…\",\"category\":\"…\",\"tags\":[\"…\"]}]. Bookmarks: "+JSON.stringify(items);
  var req;
  if(prov==="anthropic"){
    req=fetch("https://api.anthropic.com/v1/messages",{method:"POST",
      headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-haiku-4-5",max_tokens:4000,messages:[{role:"user",content:prompt}]})
    }).then(function(r){ return r.json(); }).then(function(j){ return (j&&j.content&&j.content[0]&&j.content[0].text)||""; });
  } else {
    req=fetch("https://api.openai.com/v1/chat/completions",{method:"POST",
      headers:{"content-type":"application/json","authorization":"Bearer "+key},
      body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"user",content:prompt}]})
    }).then(function(r){ return r.json(); }).then(function(j){ return (j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||""; });
  }
  req.then(function(text){
    var m=String(text||"").match(/\[[\s\S]*\]/); if(!m) throw 0;
    var arr=JSON.parse(m[0]), map={};
    arr.forEach(function(it){
      if(it&&it.id&&it.category) map[it.id]={category:String(it.category).slice(0,40),tags:Array.isArray(it.tags)?it.tags.slice(0,3).map(function(x){return String(x).slice(0,24);}):[]};
    });
    cb(map);
  }).catch(function(){ cb(null); });
}

function buildSuggestions(cb){
  var list=state.bookmarks;
  function finish(apiMap){
    var out=[];
    list.forEach(function(b){
      var s=(apiMap&&apiMap[b.id])||localSuggest(b);
      if(!s||!s.category) return;
      var sameCat=String(s.category).toLowerCase()===String(b.category).toLowerCase()||
                  String(s.category).toLowerCase()===catLabel(b.category).toLowerCase();
      var curTags=(b.tags||[]).map(function(x){return String(x).toLowerCase();});
      var newTags=(s.tags||[]).filter(function(tg){ return curTags.indexOf(String(tg).toLowerCase())===-1; });
      if(sameCat&&!newTags.length) return; // 没有新信息就不打扰
      out.push({id:b.id,category:s.category,tags:s.tags||[],sameCat:sameCat});
    });
    cb(out);
  }
  var s=state.settings;
  if((s.aiKey||"").trim()&&(s.aiProvider==="anthropic"||s.aiProvider==="openai")){
    aiApiSuggest(list,function(map){ if(!map) toast(t("aiFailed"),"err"); finish(map); });
  } else finish(null);
}

var _suggCache=[];
function openSuggest(){
  $("#suggestBody").innerHTML='<div class="w-empty">'+escapeHtml(t("suggesting"))+'</div>';
  $("#suggApplyBtn").disabled=true;
  openOverlay("suggestOverlay");
  buildSuggestions(function(out){
    if(!$("#suggestOverlay").classList.contains("open")) return;
    _suggCache=out;
    if(!out.length){ $("#suggestBody").innerHTML='<div class="w-empty">'+escapeHtml(t("suggNone"))+'</div>'; return; }
    $("#suggestBody").innerHTML=out.map(function(sg,i){
      var b=byId(sg.id); if(!b) return "";
      return '<label class="sugg-item"><input type="checkbox" data-sugg="'+i+'" checked />'+
        '<div class="min0"><div class="tt">'+escapeHtml(b.title||getDomain(b.url))+'</div>'+
          '<div class="tu">'+escapeHtml(prettyUrl(b.url))+'</div>'+
          '<div class="sline">'+
            (sg.sameCat?'<span class="schip cur">'+escapeHtml(catLabel(b.category))+'</span>':
              '<span class="schip cur">'+escapeHtml(catLabel(b.category))+'</span><span class="sarr">→</span><span class="schip new">'+escapeHtml(sg.category)+'</span>')+
            sg.tags.map(function(tg){ return '<span class="tag-chip">#'+escapeHtml(String(tg))+'</span>'; }).join("")+
          '</div></div></label>';
    }).join("");
    $("#suggApplyBtn").disabled=false;
  });
}
$("#suggToggleBtn").addEventListener("click", function(){
  var boxes=$all('#suggestBody [data-sugg]');
  var any=boxes.some(function(b){ return b.checked; });
  boxes.forEach(function(b){ b.checked=!any; });
});
$("#suggApplyBtn").addEventListener("click", function(){
  var prev=[], n=0;
  $all('#suggestBody [data-sugg]').forEach(function(cbx){
    if(!cbx.checked) return;
    var sg=_suggCache[Number(cbx.getAttribute("data-sugg"))], b=sg&&byId(sg.id); if(!b) return;
    prev.push({id:b.id,category:b.category,tags:(b.tags||[]).slice()});
    if(!sg.sameCat){
      var cat=cleanCatName(sg.category)||b.category;
      if(isReservedCat(cat)) cat=b.category;
      if(state.categories.indexOf(cat)===-1) state.categories.push(cat);
      b.category=cat;
    }
    var tags=(b.tags||[]).slice();
    sg.tags.forEach(function(tg){
      tg=String(tg).trim();
      if(tg&&!tags.some(function(x){ return String(x).toLowerCase()===tg.toLowerCase(); })) tags.push(tg);
    });
    b.tags=tags.slice(0,6);
    n++;
  });
  if(!n) return;
  save(); render(); closeOverlay("suggestOverlay");
  toastUndo(t("suggApplied",{n:n}), function(){
    prev.forEach(function(p){ var b=byId(p.id); if(b){ b.category=p.category; b.tags=p.tags; } });
    rebuildCategories(); save(); render();
  });
});
