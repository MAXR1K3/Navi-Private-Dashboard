/* bookmarks.js — 书签增删改 + 自动抓取标题/描述（autoDescribe） */
"use strict";

/* ===== bookmark add/edit ===== */
function fillCatSelect(sel){ var s=$("#bmCat"); s.innerHTML=state.categories.map(function(c){ return '<option value="'+escapeHtml(c)+'"'+(c===sel?" selected":"")+'>'+escapeHtml(catLabel(c))+'</option>'; }).join(""); if(state.categories.indexOf("Uncategorized")===-1){ s.innerHTML+='<option value="Uncategorized"'+(sel==="Uncategorized"?" selected":"")+'>'+escapeHtml(t("uncategorized"))+'</option>'; } }
function openAdd(){ ui.editingId=null; $("#bmTitle").textContent=t("addBookmark"); $("#bmSave").textContent=t("saveBookmark"); $("#bmUrl").value=""; $("#bmName").value=""; $("#bmDesc").value=""; fillCatSelect((ui.activeCat!=="All")?ui.activeCat:(state.categories[0]||"Uncategorized")); openOverlay("bmOverlay"); setTimeout(function(){ $("#bmUrl").focus(); },50); }
function openEdit(id){ var b=byId(id); if(!b) return; ui.editingId=id; $("#bmTitle").textContent=t("editBookmark"); $("#bmSave").textContent=t("saveChanges"); $("#bmUrl").value=b.url; $("#bmName").value=b.title; $("#bmDesc").value=b.description||""; fillCatSelect(b.category); openOverlay("bmOverlay"); setTimeout(function(){ $("#bmName").focus(); },50); }
function saveBookmark(){
  var url=normalizeUrl($("#bmUrl").value); if(!url){ toast(t("pleaseUrl"),"err"); $("#bmUrl").focus(); return; }
  if(!isWebUrl(url)){ toast(t("invalidUrl"),"err"); $("#bmUrl").focus(); return; }
  var name=$("#bmName").value.trim()||getDomain(url)||url, cat=cleanCatName($("#bmCat").value)||"Uncategorized", desc=$("#bmDesc").value.trim();
  if(!desc) desc=smartSummary(url,name,cat,"");
  if(isReservedCat(cat)) cat="Uncategorized";
  if(state.categories.indexOf(cat)===-1) state.categories.push(cat);
  if(ui.editingId){ var b=byId(ui.editingId); if(b){ b.url=url; b.title=name; b.category=cat; b.description=desc; delete b._seed; } toast(t("bookmarkUpdated"),"ok"); }
  else { state.bookmarks.unshift({ id:uid(), title:name, url:url, category:cat, description:desc, clicks:0, lastOpened:0 }); toast(t("bookmarkAdded"),"ok"); }
  save(); closeOverlay("bmOverlay"); render();
}
$("#bmSave").addEventListener("click", saveBookmark);
$("#bmUrl").addEventListener("keydown", function(e){ if(e.key==="Enter") $("#bmName").focus(); });
$("#bmName").addEventListener("keydown", function(e){ if(e.key==="Enter") $("#bmDesc").focus(); });
// URL 失焦：先用域名占位，再后台静默抓取真实标题与描述自动填入（不覆盖用户已输入的内容）
var autoFillSeq=0;
$("#bmUrl").addEventListener("blur", function(){
  var raw=$("#bmUrl").value.trim(); if(!raw) return;
  var url=normalizeUrl(raw); if(!isWebUrl(url)) return;
  var nameEl=$("#bmName"), descEl=$("#bmDesc");
  if(!nameEl.value.trim()) nameEl.value=getDomain(url);
  if(descEl.value.trim()&&nameEl.value.trim()!==getDomain(url)) return;
  var seq=++autoFillSeq, snapshot=$("#bmUrl").value;
  autoDescribe(url, function(desc, fellback, title){
    if(seq!==autoFillSeq) return;
    if(!$("#bmOverlay").classList.contains("open")) return;
    if($("#bmUrl").value!==snapshot) return;
    if(title){ var curN=nameEl.value.trim(); if(!curN||curN===getDomain(url)) nameEl.value=title; }
    if(!fellback&&desc&&!descEl.value.trim()) descEl.value=desc;
  });
});
$("#bmNewCat").addEventListener("click", function(){ openPrompt(t("newCategory"),"",function(v){ v=uniqueCatName(v); if(!v){ toast(t("categoryInvalid"),"err"); return; } state.categories.push(v); fillCatSelect(v); save(); }); });

// auto-describe
var SITE_DESC={
  // code / dev
  "github.com":["Code hosting and collaboration for software projects.","代码托管与开发协作平台。","Alojamiento de código y colaboración para proyectos de software."],
  "gitlab.com":["DevOps platform for Git repositories, CI and deployment.","面向 Git、CI 和部署的 DevOps 平台。","Plataforma DevOps para repositorios Git, CI y despliegue."],
  "stackoverflow.com":["Programming Q&A community for solving development problems.","用于解决开发问题的编程问答社区。","Comunidad de preguntas y respuestas para resolver problemas de programación."],
  "developer.mozilla.org":["Reference documentation for web standards, browsers and APIs.","Web 标准、浏览器和 API 的参考文档。","Documentación de referencia sobre estándares web, navegadores y APIs."],
  "npmjs.com":["npm — JavaScript package registry for installing and sharing modules.","npm：JavaScript 包注册表，用于安装和共享模块。","npm: registro de paquetes JavaScript para instalar y compartir módulos."],
  "pypi.org":["PyPI — Python package index for discovering and installing libraries.","PyPI：用于查找和安装 Python 库的包索引。","PyPI: índice de paquetes Python para descubrir e instalar librerías."],
  "codepen.io":["Online code editor and front-end playground for web demos.","用于 Web 演示的在线代码编辑器和前端练习场。","Editor de código en línea y playground de front-end para demos web."],
  "replit.com":["Browser-based IDE for coding, hosting and collaboration.","基于浏览器的 IDE，支持编码、托管与协作。","IDE en el navegador para programar, alojar y colaborar."],
  "leetcode.com":["Coding challenges and interview prep for software engineers.","面向软件工程师的编程题和面试备考平台。","Retos de programación y preparación de entrevistas para ingenieros."],
  "vercel.com":["Frontend cloud platform for deploying web applications.","用于部署 Web 应用的前端云平台。","Plataforma en la nube para desplegar aplicaciones web."],
  "cloudflare.com":["CDN, security and cloud connectivity platform.","CDN、安全与云网络平台。","Plataforma de CDN, seguridad y conectividad en la nube."],
  "huggingface.co":["Platform for AI models, datasets and spaces.","AI 模型、数据集和应用的开放平台。","Plataforma para modelos de IA, datasets y espacios."],
  // AI
  "openai.com":["OpenAI — AI research and products including ChatGPT.","OpenAI：AI 研究与产品，包括 ChatGPT。","OpenAI: investigación y productos de IA, incluyendo ChatGPT."],
  "anthropic.com":["Anthropic — AI safety company and maker of Claude.","Anthropic：AI 安全公司，Claude 的开发者。","Anthropic: empresa de seguridad en IA y creadora de Claude."],
  "claude.ai":["Claude — AI assistant by Anthropic for writing, analysis and coding.","Claude：Anthropic 开发的 AI 助手，用于写作、分析和编程。","Claude: asistente de IA de Anthropic para escritura, análisis y programación."],
  "chat.openai.com":["ChatGPT — conversational AI assistant by OpenAI.","ChatGPT：OpenAI 的对话式 AI 助手。","ChatGPT: asistente de IA conversacional de OpenAI."],
  "gemini.google.com":["Gemini — AI assistant by Google for writing and reasoning tasks.","Gemini：Google 的 AI 助手，用于写作和推理任务。","Gemini: asistente de IA de Google para escritura y razonamiento."],
  // video / media
  "youtube.com":["Video platform for tutorials, entertainment and channels.","用于教程、娱乐和频道内容的视频平台。","Plataforma de vídeo para tutoriales, entretenimiento y canales."],
  "open.spotify.com":["Music, podcasts and audio streaming.","音乐、播客和音频流媒体。","Música, podcasts y streaming de audio."],
  "spotify.com":["Music, podcasts and audio streaming.","音乐、播客和音频流媒体。","Música, podcasts y streaming de audio."],
  "bilibili.com":["Video platform for animation, gaming and knowledge content.","以动漫、游戏和知识内容为主的视频平台。","Plataforma de vídeo para animación, juegos y contenido educativo."],
  "tiktok.com":["Short-form video platform for entertainment and creators.","短视频娱乐与创作平台。","Plataforma de vídeos cortos para entretenimiento y creadores."],
  // social
  "reddit.com":["Community discussions, links and topic-based forums.","社区讨论、链接分享和主题论坛。","Debates comunitarios, enlaces y foros por tema."],
  "twitter.com":["X (Twitter) — social network for news and real-time discussion.","X（推特）：新闻与实时讨论的社交网络。","X (Twitter): red social para noticias y debate en tiempo real."],
  "x.com":["X (Twitter) — social network for news and real-time discussion.","X（推特）：新闻与实时讨论的社交网络。","X (Twitter): red social para noticias y debate en tiempo real."],
  "instagram.com":["Photo, video and stories sharing platform.","图片、视频与故事分享平台。","Plataforma de fotos, vídeos e historias."],
  "facebook.com":["Social network for connecting with friends and communities.","连接好友和社群的社交网络。","Red social para conectar con amigos y comunidades."],
  "discord.com":["Chat and community platform for groups and gaming.","面向社群和游戏的聊天与社区平台。","Plataforma de chat y comunidad para grupos y juegos."],
  "slack.com":["Team messaging and collaboration workspace.","团队消息与协作工作台。","Espacio de mensajería y colaboración en equipo."],
  "linkedin.com":["Professional networking, jobs and company updates.","职业社交、招聘和公司动态。","Red profesional, empleo y novedades de empresas."],
  "weibo.com":["Chinese microblogging and social media platform.","微博：中文微博与社交媒体平台。","Weibo: plataforma china de microblogging y redes sociales."],
  "zhihu.com":["Chinese Q&A and knowledge community.","知乎：中文问答与知识社区平台。","Zhihu: comunidad china de preguntas, respuestas y conocimiento."],
  "douban.com":["Chinese community for books, films and music reviews.","豆瓣：中文书影音点评与社区平台。","Douban: comunidad china de reseñas de libros, películas y música."],
  // productivity
  "notion.so":["Workspace for notes, docs, projects and knowledge management.","用于笔记、文档、项目和知识管理的工作区。","Espacio de trabajo para notas, documentos, proyectos y conocimiento."],
  "figma.com":["Collaborative design and interface prototyping tool.","协作设计与界面原型工具。","Herramienta colaborativa de diseño y prototipado de interfaces."],
  "canva.com":["Online design tool for graphics, presentations and social posts.","用于图形、演示文稿和社交内容的在线设计工具。","Herramienta de diseño en línea para gráficos, presentaciones y redes sociales."],
  "miro.com":["Online whiteboard for brainstorming and visual collaboration.","用于头脑风暴和视觉协作的在线白板。","Pizarra en línea para brainstorming y colaboración visual."],
  "airtable.com":["Flexible database and collaboration tool for teams.","面向团队的灵活数据库与协作工具。","Base de datos flexible y herramienta de colaboración para equipos."],
  "linear.app":["Project and issue tracking tool for software teams.","面向软件团队的项目与问题追踪工具。","Herramienta de gestión de proyectos e incidencias para equipos de software."],
  "mail.google.com":["Gmail inbox for email communication.","Gmail 邮箱与邮件沟通。","Bandeja de Gmail para comunicación por correo."],
  "calendar.google.com":["Google Calendar for schedules, reminders and events.","用于日程、提醒和活动的 Google 日历。","Google Calendar para agenda, recordatorios y eventos."],
  "docs.google.com":["Online documents, spreadsheets and collaborative files.","在线文档、表格和协作文件。","Documentos, hojas de cálculo y archivos colaborativos en línea."],
  "drive.google.com":["Cloud storage and shared files on Google Drive.","Google Drive 云端存储与共享文件。","Almacenamiento en la nube y archivos compartidos en Google Drive."],
  // reading / knowledge
  "wikipedia.org":["Online encyclopedia for reference and background knowledge.","用于查询资料和背景知识的在线百科。","Enciclopedia en línea para consulta y conocimiento general."],
  "medium.com":["Publishing platform for articles, essays and stories.","文章、随笔与故事的发布平台。","Plataforma de publicación de artículos, ensayos e historias."],
  "substack.com":["Newsletter platform for writers and independent media.","面向作者和独立媒体的邮件通讯平台。","Plataforma de newsletters para escritores y medios independientes."],
  "news.ycombinator.com":["Technology and startup news community.","科技与创业新闻社区。","Comunidad de noticias de tecnología y startups."],
  "theverge.com":["Technology news, reviews and digital culture.","科技新闻、评测与数字文化。","Noticias de tecnología, reseñas y cultura digital."],
  "juejin.cn":["Chinese developer community for tech articles and sharing.","面向开发者的技术文章与分享社区。","Comunidad china de desarrolladores para artículos técnicos."],
  // shopping
  "amazon.com":["Online marketplace for shopping and product research.","用于购物和商品研究的在线市场。","Mercado en línea para compras e investigación de productos."],
  "taobao.com":["Chinese online marketplace for shopping and goods.","淘宝：中国在线购物市场。","Taobao: mercado en línea chino para compras y productos."],
  "jd.com":["Chinese e-commerce platform for electronics and goods.","京东：以电子产品为主的中国电商平台。","JD.com: plataforma china de e-commerce de electrónica y productos."],
  // learning
  "coursera.org":["Online courses and degrees from universities and companies.","来自大学和企业的在线课程与学位项目。","Cursos y títulos en línea de universidades y empresas."],
  "udemy.com":["Online learning platform with courses on skills and technology.","涵盖技能与技术的在线学习平台。","Plataforma de aprendizaje en línea con cursos de habilidades y tecnología."]
};
var TOPIC_RULES=[
  {k:["github","gitlab","code","api","developer","docs","npm","stack","vercel","netlify","javascript","python","react"], d:["Development resource for code, documentation or engineering workflows.","面向代码、文档或工程流程的开发资源。","Recurso de desarrollo para código, documentación o flujos de ingeniería."]},
  {k:["design","figma","ui","ux","prototype","color","font","icon"], d:["Design resource for interfaces, visuals or creative workflows.","面向界面、视觉或创意流程的设计资源。","Recurso de diseño para interfaces, visuales o flujos creativos."]},
  {k:["news","blog","article","journal","reuters","bbc","nytimes","verge","medium"], d:["Reading source for news, articles and timely updates.","用于新闻、文章和近期动态的阅读来源。","Fuente de lectura para noticias, artículos y novedades."]},
  {k:["video","youtube","watch","stream","movie","music","podcast","spotify","netflix"], d:["Media destination for videos, music or streaming content.","用于视频、音乐或流媒体内容的媒体网站。","Destino multimedia para vídeos, música o streaming."]},
  {k:["shop","store","product","amazon","cart","buy","price","deal"], d:["Shopping or product-research page.","购物或商品研究页面。","Página de compras o investigación de productos."]},
  {k:["mail","calendar","docs","drive","notion","task","project","slack","trello","asana"], d:["Productivity workspace for communication, planning or files.","用于沟通、计划或文件管理的效率工作区。","Espacio de productividad para comunicación, planificación o archivos."]},
  {k:["bank","finance","pay","invoice","crypto","stock","market","portfolio"], d:["Finance-related page for accounts, payments or market information.","与账户、支付或市场信息相关的金融页面。","Página financiera para cuentas, pagos o información de mercado."]},
  {k:["learn","course","wiki","reference","school","university","tutorial","guide"], d:["Learning and reference page for research or study.","用于研究或学习的知识参考页面。","Página de aprendizaje y consulta para investigar o estudiar."]},
  {k:["travel","hotel","flight","map","restaurant","booking","trip"], d:["Travel or local-planning page for places, routes or bookings.","用于地点、路线或预订的旅行/本地规划页面。","Página de viajes o planificación local para lugares, rutas o reservas."]}
];
function langIdx(){ return state.settings.lang==="zh"?1:(state.settings.lang==="es"?2:0); }
function cleanSummaryText(x){ return String(x||"").replace(/\s+/g," ").replace(/[\u0000-\u001f]+/g," ").trim(); }
function clipSummary(x,n){ x=cleanSummaryText(x); n=n||190; if(x.length<=n) return x; var cut=x.slice(0,n), i=Math.max(cut.lastIndexOf("."),cut.lastIndexOf("。"),cut.lastIndexOf(";"),cut.lastIndexOf("；"),cut.lastIndexOf(","),cut.lastIndexOf("，")); return (i>80?cut.slice(0,i):cut).replace(/[,.，。;；:]$/,'')+"…"; }
function knownSiteDesc(url){ var d=getDomain(url).toLowerCase(), ix=langIdx(); for(var k in SITE_DESC){ if(d===k||d.indexOf(k)>-1) return SITE_DESC[k][ix]; } return ""; }
function inferTopicSummary(url,title,cat,extra){
  var d=getDomain(url).toLowerCase(), text=(d+" "+(title||"")+" "+(cat||"")+" "+(extra||"")).toLowerCase(), ix=langIdx();
  for(var i=0;i<TOPIC_RULES.length;i++){ for(var j=0;j<TOPIC_RULES[i].k.length;j++){ if(text.indexOf(TOPIC_RULES[i].k[j])>-1) return TOPIC_RULES[i].d[ix]; } }
  if(state.settings.lang==="zh") return (cat?cat+" · ":"")+d+" 的主题网页。";
  if(state.settings.lang==="es") return (cat?cat+" · ":"")+"Página temática en "+d+".";
  return (cat?cat+" · ":"")+"Themed page on "+d+".";
}
// 从 URL 路径中提取可读性描述（blog slug、docs 路径等），知名站点和主题匹配都失败时使用
function urlPathHint(url){
  try{
    var pu=new URL(normalizeUrl(url));
    // extract search query params first
    var qval=pu.searchParams.get("q")||pu.searchParams.get("query")||pu.searchParams.get("search")||
             pu.searchParams.get("keyword")||pu.searchParams.get("s")||pu.searchParams.get("kw")||"";
    if(qval.trim().length>3) return qval.replace(/[+%20]+/g," ").trim();
    var segs=pu.pathname.replace(/\.(html?|php|aspx?|jsp|py|cfm)$/i,'').split('/').filter(Boolean)
      .map(function(p){ return p.replace(/[-_+.]/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').trim(); })
      .filter(function(p){
        if(p.length<2) return false;
        if(/^(20|19)\d{2}$/.test(p.replace(/ /g,''))) return false; // year
        if(/^\d{4}[ -]\d{2}/.test(p)) return false;                 // date prefix
        if(/^[\da-f-]{8,}$/i.test(p.replace(/ /g,''))) return false; // uuid/hash
        if(/^\d+$/.test(p.replace(/ /g,''))) return false;           // pure number
        var kw=['www','com','org','net','edu','gov','html','index','home','page','p',
                'category','categories','tag','tags','post','posts','article','articles',
                'blog','news','archive','feed','rss','amp','en','zh','cn'];
        return kw.indexOf(p.replace(/ /g,'').toLowerCase())===-1;
      });
    if(!segs.length) return '';
    var text=segs.slice(-2).map(function(p){ return p.charAt(0).toUpperCase()+p.slice(1); }).join(' › ');
    return clipSummary(text,190);
  }catch(e){ return ''; }
}
function smartSummary(url,title,cat,extra){ return knownSiteDesc(url)||urlPathHint(url)||inferTopicSummary(url,title,cat,extra); }
function hasAiSummaryApi(){
  var s=state.settings||{};
  return !!((s.aiKey||"").trim()&&(s.aiProvider==="anthropic"||s.aiProvider==="openai"));
}
function aiSummaryLimit(){
  var l=state.settings.lang;
  if(l==="zh") return {words:"36 个中文字符", chars:36, instruction:"用简体中文写一句书签描述，最多 36 个中文字符。"};
  if(l==="es") return {words:"18 palabras", chars:130, instruction:"Escribe una descripción breve en español, una sola frase, máximo 18 palabras."};
  return {words:"18 words", chars:120, instruction:"Write one concise bookmark description in English, one sentence, max 18 words."};
}
function cleanAiSummary(x){
  var lim=aiSummaryLimit(), s=cleanSummaryText(x).split(/\n/)[0]||"";
  s=s.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g,"").replace(/^(description|summary|描述|摘要|resumen|descripción)\s*[:：]\s*/i,"");
  s=s.replace(/^[\-*•\d.)\s]+/,"").trim();
  if(!s) return "";
  if(state.settings.lang!=="zh"){
    var words=s.split(/\s+/).filter(Boolean);
    if(words.length>18) s=words.slice(0,18).join(" ").replace(/[,.，。;；:]$/,"")+"…";
  }
  return clipSummary(s, lim.chars);
}
function aiSummaryPrompt(ctx){
  var lim=aiSummaryLimit(), l=state.settings.lang||"en";
  return [
    "You are writing a bookmark description for a private bookmark dashboard.",
    lim.instruction,
    "Make it specific, plain, and easy to scan. No markdown, no labels, no quotes.",
    "Prefer the page metadata/content when available. If content is thin, infer cautiously from the domain, URL path, title, and category. Do not invent specific claims.",
    "Current UI language: "+l+".",
    "Bookmark JSON: "+JSON.stringify({
      url:ctx.url||"",
      domain:getDomain(ctx.url||""),
      title:ctx.title||"",
      category:ctx.category||"",
      fallbackDescription:ctx.fallbackDesc||"",
      pageDescription:ctx.meta||"",
      pageSignals:String(ctx.pageText||"").slice(0,900)
    })
  ].join("\n");
}
function aiSummarizeBookmark(ctx, cb){
  var s=state.settings||{}, key=(s.aiKey||"").trim(), prov=s.aiProvider;
  if(!hasAiSummaryApi()){ cb(""); return; }
  var prompt=aiSummaryPrompt(ctx), req, ctrl=null, timer=null;
  if(window.AbortController){
    ctrl=new AbortController();
    timer=setTimeout(function(){ try{ ctrl.abort(); }catch(e){} }, 9000);
  }
  if(prov==="anthropic"){
    req=fetch("https://api.anthropic.com/v1/messages",{method:"POST",signal:ctrl&&ctrl.signal,
      headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-haiku-4-5",max_tokens:160,messages:[{role:"user",content:prompt}]})
    }).then(function(r){ return r.json(); }).then(function(j){ return (j&&j.content&&j.content[0]&&j.content[0].text)||""; });
  } else {
    req=fetch("https://api.openai.com/v1/chat/completions",{method:"POST",signal:ctrl&&ctrl.signal,
      headers:{"content-type":"application/json","authorization":"Bearer "+key},
      body:JSON.stringify({model:"gpt-4o-mini",max_tokens:120,messages:[{role:"user",content:prompt}]})
    }).then(function(r){ return r.json(); }).then(function(j){ return (j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||""; });
  }
  req.then(function(text){ if(timer) clearTimeout(timer); cb(cleanAiSummary(text)); })
    .catch(function(){ if(timer) clearTimeout(timer); cb(""); });
}
function finishSmartDescription(ctx, fellback, done){
  ctx.fallbackDesc=ctx.fallbackDesc||smartSummary(ctx.url,ctx.title,ctx.category,ctx.pageText||ctx.meta||"");
  ctx.fallbackDesc=cleanAiSummary(ctx.fallbackDesc)||ctx.fallbackDesc;
  if(!ctx.title) ctx.title=ctx.fallbackTitle||"";
  aiSummarizeBookmark(ctx,function(aiDesc){
    done(aiDesc||ctx.fallbackDesc, aiDesc?false:fellback, ctx.title||ctx.fallbackTitle||"");
  });
}
function heuristicDesc(url){ var b=ui.editingId?byId(ui.editingId):null; var title=$("#bmName")?$("#bmName").value:""; var cat=b?catLabel(b.category):($("#bmCat")?$("#bmCat").value:""); return smartSummary(url,title,cat,""); }
function metaContent(doc,sel){ var m=doc.querySelector(sel); return m?(m.getAttribute("content")||"").trim():""; }
function pageSignals(doc){
  var bits=[];
  ["title",'meta[property="og:title"]','meta[name="twitter:title"]','meta[name="keywords"]','h1','h2'].forEach(function(sel){ var v=sel==="title"?(doc.title||""):(sel.indexOf("meta")===0?metaContent(doc,sel):((doc.querySelector(sel)||{}).textContent||"")); if(v) bits.push(v); });
  $all("main p, article p, p",doc).slice(0,3).forEach(function(p){ var tx=cleanSummaryText(p.textContent||""); if(tx.length>40) bits.push(tx); });
  return cleanSummaryText(bits.join(" · "));
}
function extractJsonLd(doc){
  try{
    var scripts=doc.querySelectorAll('script[type="application/ld+json"]');
    for(var i=0;i<scripts.length;i++){
      var txt=scripts[i].textContent||"";
      if(!txt.trim()) continue;
      var obj=JSON.parse(txt);
      var arr=Array.isArray(obj)?obj:[obj];
      for(var j=0;j<arr.length;j++){
        var d=(arr[j].description||arr[j].headline||
              (arr[j].mainEntity&&arr[j].mainEntity.description)||"");
        d=cleanSummaryText(d);
        if(d.length>30) return d;
      }
    }
  }catch(e){}
  return "";
}
function parseLlmsTxt(text){
  if(!text||typeof text!=="string") return "";
  var lines=text.split(/\r?\n/);
  var capture=false;
  for(var i=0;i<lines.length;i++){
    var l=lines[i].trim();
    if(!l) continue;
    if(/^#\s/.test(l)){ capture=true; continue; }
    if(capture&&!/^#{1,6}\s/.test(l)&&l.length>20)
      return clipSummary(l.replace(/^[>*-]+\s*/,""),210);
  }
  return "";
}
// 从页面提取干净的标题：优先 og:title / twitter:title，再退回 <title>，并剥离“ | 站点名”类后缀
function extractTitle(doc){
  var s=metaContent(doc,'meta[property="og:title"]')||metaContent(doc,'meta[name="twitter:title"]')||(doc.title||"");
  s=cleanSummaryText(s);
  var parts=s.split(/\s+[|｜·•—–-]\s+/);
  if(parts.length>1&&parts[0].trim().length>=4) s=parts[0].trim();
  return clipSummary(s,80);
}
function summarizeDoc(url,doc,title,cat){
  var meta=metaContent(doc,'meta[property="og:description"]')||metaContent(doc,'meta[name="description"]')||metaContent(doc,'meta[name="twitter:description"]');
  if(meta&&cleanSummaryText(meta).length>35) return clipSummary(meta,210);
  var jld=extractJsonLd(doc);
  if(jld&&jld.length>35) return clipSummary(jld,210);
  var sig=pageSignals(doc), ttl=title||(doc.title||"").replace(/[|｜-].*$/,"");
  if(sig.length>80) return clipSummary(sig,210);
  return smartSummary(url,ttl,cat||"",sig);
}
function describeUrlForSummary(url, titleGetter, catGetter, done){
  var u=normalizeUrl(url);
  var finished=false, pending=0, ctrls=[], backupHtml=null, backupTitle="";
  var bmName=titleGetter||function(){return $("#bmName")?$("#bmName").value:"";};
  var bmCat=catGetter||function(){return $("#bmCat")?$("#bmCat").value:"";};
  function abortAll(){ ctrls.forEach(function(c){try{c.abort();}catch(e){}});}
  function finalize(){
    if(backupHtml){
      try{
        var doc=new DOMParser().parseFromString(backupHtml,"text/html");
        finishSmartDescription({url:u,title:extractTitle(doc)||bmName()||backupTitle,category:bmCat(),fallbackTitle:backupTitle,fallbackDesc:summarizeDoc(u,doc,bmName(),bmCat()),pageText:pageSignals(doc),meta:metaContent(doc,'meta[property="og:description"]')||metaContent(doc,'meta[name="description"]')||metaContent(doc,'meta[name="twitter:description"]')}, false, done);
        return;
      }catch(e){}
    }
    finishSmartDescription({url:u,title:bmName()||backupTitle,category:bmCat(),fallbackTitle:backupTitle,fallbackDesc:smartSummary(u,bmName()||backupTitle,bmCat(),""),pageText:"",meta:""}, true, done);
  }
  var globalTo=setTimeout(function(){
    if(finished) return; finished=true; abortAll(); finalize();
  }, 12000);
  // tryHtml: parse HTML, check quality.
  //   high quality (has meta/JSON-LD desc > 35 chars) → call done immediately, return true
  //   medium quality (page signals > 80 chars, no meta desc) → store as backup, return false
  //   low quality → return false
  function tryHtml(html){
    if(finished) return true;
    try{
      var doc=new DOMParser().parseFromString(html,"text/html");
      var meta=metaContent(doc,'meta[property="og:description"]')||
               metaContent(doc,'meta[name="description"]')||
               metaContent(doc,'meta[name="twitter:description"]')||
               extractJsonLd(doc);
      meta=cleanSummaryText(meta||"");
      if(!backupTitle){ var bt=extractTitle(doc); if(bt) backupTitle=bt; }
      if(meta.length>35){
        finished=true; clearTimeout(globalTo); abortAll();
        finishSmartDescription({url:u,title:extractTitle(doc)||bmName(),category:bmCat(),fallbackDesc:clipSummary(meta,210),pageText:pageSignals(doc),meta:meta}, false, done);
        return true;
      }
      if(!backupHtml && pageSignals(doc).length>80) backupHtml=html;
    }catch(e){}
    return false;
  }
  function tryDone(){
    pending--;
    if(!finished&&pending<=0){ finished=true; clearTimeout(globalTo); finalize(); }
  }
  function makeCtrl(ms){
    if(!window.AbortController) return {signal:undefined,_t:null};
    var c=new AbortController(); ctrls.push(c);
    var t=setTimeout(function(){ try{c.abort();}catch(e){}}, ms);
    return {signal:c.signal, _t:t};
  }
  // source 1: direct fetch (5 s) — works for CORS-permissive or same-origin pages
  pending++;
  (function(){
    var ctrl=makeCtrl(5000);
    fetch(u,{signal:ctrl.signal})
      .then(function(r){ if(!r.ok) throw r.status; return r.text(); })
      .then(function(html){ if(ctrl._t)clearTimeout(ctrl._t); tryHtml(html)||tryDone(); })
      .catch(function(){ if(ctrl._t)clearTimeout(ctrl._t); tryDone(); });
  })();
  // source 2: allorigins.win proxy (8 s)
  pending++;
  (function(){
    var ctrl=makeCtrl(8000);
    fetch("https://api.allorigins.win/get?url="+encodeURIComponent(u),{signal:ctrl.signal})
      .then(function(r){ return r.json(); })
      .then(function(j){ if(ctrl._t)clearTimeout(ctrl._t); (j&&j.contents)?tryHtml(j.contents)||tryDone():tryDone(); })
      .catch(function(){ if(ctrl._t)clearTimeout(ctrl._t); tryDone(); });
  })();
  // source 3: corsproxy.io (8 s)
  pending++;
  (function(){
    var ctrl=makeCtrl(8000);
    fetch("https://corsproxy.io/?"+encodeURIComponent(u),{signal:ctrl.signal})
      .then(function(r){ if(!r.ok) throw r.status; return r.text(); })
      .then(function(html){ if(ctrl._t)clearTimeout(ctrl._t); tryHtml(html)||tryDone(); })
      .catch(function(){ if(ctrl._t)clearTimeout(ctrl._t); tryDone(); });
  })();
  // source 4: llms.txt machine-readable description (4 s)
  pending++;
  (function(){
    try{
      var llmsUrl=new URL(u).origin+"/llms.txt";
      var ctrl=makeCtrl(4000);
      fetch(llmsUrl,{signal:ctrl.signal})
        .then(function(r){ return r.ok?r.text():Promise.reject(); })
        .then(function(txt){
          if(ctrl._t)clearTimeout(ctrl._t);
          var d=parseLlmsTxt(txt);
          d?tryHtml("<meta name='description' content='"+d.replace(/'/g,"&#39;")+"'>")||tryDone():tryDone();
        })
        .catch(function(){ if(ctrl._t)clearTimeout(ctrl._t); tryDone(); });
    }catch(e){ tryDone(); }
  })();
}
function autoDescribe(url, done){
  describeUrlForSummary(url,
    function(){ return $("#bmName")?$("#bmName").value:""; },
    function(){ return $("#bmCat")?$("#bmCat").value:""; },
    done
  );
}
function describeBookmarkData(url,title,cat,done){
  describeUrlForSummary(url,
    function(){ return title||""; },
    function(){ return cat||""; },
    done
  );
}
$("#bmAuto").addEventListener("click", function(){
  var url=$("#bmUrl").value.trim(); if(!url){ toast(t("pleaseUrl"),"err"); $("#bmUrl").focus(); return; }
  var btn=$("#bmAuto"); btn.disabled=true; var old=btn.innerHTML; btn.innerHTML='<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5"/></svg> '+escapeHtml(t("autoFetching"));
  autoDescribe(url, function(desc, fellback, title){
    $("#bmDesc").value=desc||"";
    // 同时把抓到的真实标题填入名称（仅当名称为空或还是域名占位时）
    if(title){ var nm=$("#bmName"), curN=nm.value.trim(); if(!curN||curN===getDomain(normalizeUrl(url))) nm.value=title; }
    btn.disabled=false; btn.innerHTML=old; toast(fellback?t("autoFallback"):t("autoOk"), fellback?"":"ok");
  });
});

var summaryUi={scope:"all",mode:"all",running:false};
function summaryCategories(){
  var seen={}, arr=[];
  (state.categories||[]).forEach(function(c){ c=cleanCatName(c); if(c&&!seen[c]){ seen[c]=1; arr.push(c); } });
  (state.bookmarks||[]).forEach(function(b){ var c=cleanCatName(b.category)||"Uncategorized"; if(!seen[c]){ seen[c]=1; arr.push(c); } });
  return arr;
}
function fillSummaryCatSelect(){
  var sel=$("#summaryCat"); if(!sel) return;
  var current=(ui.activeCat&&ui.activeCat!=="All")?ui.activeCat:(state.categories[0]||"Uncategorized");
  sel.innerHTML=summaryCategories().map(function(c){ return '<option value="'+escapeHtml(c)+'"'+(c===current?" selected":"")+'>'+escapeHtml(catLabel(c))+'</option>'; }).join("");
}
function setSummaryScope(scope){
  summaryUi.scope=scope||"all";
  $all("[data-summary-scope]").forEach(function(btn){ btn.classList.toggle("on", btn.getAttribute("data-summary-scope")===summaryUi.scope); });
  var catField=$("#summaryCatField");
  if(catField) catField.style.display=summaryUi.scope==="category"?"":"none";
  syncSummaryOverlay();
}
function setSummaryMode(mode){
  summaryUi.mode=mode||"all";
  $all("[data-summary-mode]").forEach(function(btn){ btn.classList.toggle("on", btn.getAttribute("data-summary-mode")===summaryUi.mode); });
  syncSummaryOverlay();
}
function summaryBaseList(){
  var scope=summaryUi.scope, cat="";
  if(scope==="current"&&ui.activeCat&&ui.activeCat!=="All") cat=ui.activeCat;
  if(scope==="category") cat=$("#summaryCat")?$("#summaryCat").value:"";
  return (state.bookmarks||[]).filter(function(b){ return !cat || b.category===cat; });
}
function summaryTargetList(){
  var list=summaryBaseList();
  if(summaryUi.mode==="missing") list=list.filter(function(b){ return !String(b.description||"").trim(); });
  return list;
}
function syncSummaryOverlay(){
  var info=$("#summaryScopeInfo"), run=$("#summaryRunBtn"); if(!info) return;
  var base=summaryBaseList(), target=summaryTargetList();
  info.textContent=t("summaryScopeInfo",{n:target.length,total:base.length});
  if(run) run.disabled=summaryUi.running||!target.length;
}
function openSummaryOverlay(){
  if(summaryUi.running){ openOverlay("summaryOverlay"); return; }
  fillSummaryCatSelect();
  summaryUi.running=false;
  $("#summaryProgress").textContent="";
  setSummaryMode("all");
  setSummaryScope("all");
  openOverlay("summaryOverlay");
}
function lockSummaryControls(locked){
  summaryUi.running=locked;
  $all("#summaryOverlay button, #summaryOverlay select").forEach(function(el){
    if(el.id==="summaryRunBtn") el.disabled=locked;
    else el.disabled=locked;
  });
}
function runSummaryDescriptions(){
  if(summaryUi.running) return;
  var list=summaryTargetList();
  if(!list.length){ toast(t("summaryNone"),""); syncSummaryOverlay(); return; }
  var btn=$("#summaryRunBtn"), progress=$("#summaryProgress"), old=btn.innerHTML;
  lockSummaryControls(true);
  var i=0,n=0;
  function finish(){
    if(n){ save(); renderContent(); renderWidgets(); }
    lockSummaryControls(false);
    btn.innerHTML=old;
    progress.textContent="";
    closeOverlay("summaryOverlay");
    toast(t("summariesDone",{n:n}), n?"ok":"");
  }
  function next(){
    if(i>=list.length){ finish(); return; }
    var b=list[i++], label=b.title||getDomain(b.url)||b.url;
    progress.textContent=t("summaryProgress",{done:i,total:list.length,title:clipSummary(label,54)});
    describeBookmarkData(b.url,b.title,b.category,function(desc){
      b.description=desc||smartSummary(b.url,b.title,b.category,"");
      n++;
      next();
    });
  }
  btn.innerHTML='<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5"/></svg> '+escapeHtml(t("autoFetching"));
  next();
}
function summarizeMissingDescriptions(){ openSummaryOverlay(); }
if($("#summaryScopeSeg")){
  $("#summaryScopeSeg").addEventListener("click", function(e){ var btn=e.target.closest("[data-summary-scope]"); if(btn&&!summaryUi.running) setSummaryScope(btn.getAttribute("data-summary-scope")); });
  $("#summaryModeSeg").addEventListener("click", function(e){ var btn=e.target.closest("[data-summary-mode]"); if(btn&&!summaryUi.running) setSummaryMode(btn.getAttribute("data-summary-mode")); });
  $("#summaryCat").addEventListener("change", syncSummaryOverlay);
  $("#summaryRunBtn").addEventListener("click", runSummaryDescriptions);
}

// 删除 = 软删除：移入回收站并提供短时撤销，无需确认弹窗
function deleteBookmark(id){
  var b=byId(id); if(!b) return;
  delete ui.selected[id];
  var undo=moveToTrash([id]);
  render();
  toastUndo(t("movedToTrash"), undo);
}
