/* keywords.js — 从书签自身的文字里就地提取关键词，用来推荐标签。
   完全本地：不联网、不调 API、不经代理。有存档正文就用正文（信号最强），
   没有就退回标题+描述+URL 路径。

   中文没有词边界，所以不做分词，改用「字符 n-gram + 共现筛选」：
   先数 2/3/4 字片段的出现次数，再把"只是碰巧连在一起"的片段去掉。
   这条路子不需要词典，代价是偶尔会切出半个词——所以最终只作为「建议」，由人点选。 */
"use strict";

/* 停用词：英文常见虚词 + 中文高频字。中文按"单字"过滤，因为 n-gram 里
   只要含有这些字，多半就不是一个有意义的词。 */
var KW_STOP_EN=("the a an and or but of to in for on at by with from as is are was were be been being " +
  "this that these those it its it's you your we our they their he she his her i me my " +
  "not no yes can will would should could may might must do does did done have has had " +
  "how what when when where why which who whom will just about into over under more most other some any " +
  "through throughout during before after between within without also then than there here their them " +
  "each every both few many much such same own only very via per etc need needs first last next " +
  "com www http https html org net page site web home index new all one two get set use using used " +
  "如何 什么 怎么 为什么").split(/\s+/);
var KW_STOP_ZH="的了是在和有就不我们你他她它这那也都很还要会对与及等一个可以进行没有自己之上下前后中很再又或而与被把从来去做能说着过只很非常如果因为所以但是然后什么怎样一些这个那个";
var COHESION_MIN=2.2;   // 经验阈值：低于它基本都是跨词切出来的碎片
var _kwStopEn=null;
function kwStopEn(){ if(!_kwStopEn){ _kwStopEn={}; KW_STOP_EN.forEach(function(w){ _kwStopEn[w]=1; }); } return _kwStopEn; }

function kwIsCjk(ch){ var c=ch.charCodeAt(0); return (c>=0x3400&&c<=0x9fff)||(c>=0x3040&&c<=0x30ff)||(c>=0xac00&&c<=0xd7af); }
function kwHasStopZh(s){ for(var i=0;i<s.length;i++){ if(KW_STOP_ZH.indexOf(s.charAt(i))>-1) return true; } return false; }

/* 拉丁词：按非字母数字切开，去停用词与纯数字 */
function kwLatinCounts(text, out){
  var toks=String(text||"").toLowerCase().split(/[^a-z0-9+#]+/), stop=kwStopEn();
  for(var i=0;i<toks.length;i++){
    var w=toks[i];
    if(w.length<3||w.length>24) continue;
    if(stop[w]||/^\d+$/.test(w)) continue;
    out[w]=(out[w]||0)+1;
  }
}
/* 中日韩：连续汉字段落里取 1~4 字 n-gram。
   1-gram 本身不做候选词，但后面算「凝固度」要用到它们的频次。 */
function kwCjkCounts(text, out, all, runs){
  var s=String(text||""), run="", total=0;
  function flush(){
    if(run.length){ runs.push(run);
      for(var n=1;n<=4;n++)
        for(var i=0;i+n<=run.length;i++){
          var g=run.substr(i,n);
          all[g]=(all[g]||0)+1;
          if(n>=2&&!kwHasStopZh(g)) out[g]=(out[g]||0)+1;
        }
      total+=run.length;
    }
    run="";
  }
  for(var i=0;i<s.length;i++){ var ch=s.charAt(i); if(kwIsCjk(ch)) run+=ch; else flush(); }
  flush();
  return total;
}

/* 左右自由度：真正的词会出现在各种上下文里，前后跟着的字五花八门；
   而"器学习入"这种跨词碎片永远只出现在"机器学习入门"里面——左边永远是"机"，
   右边永远是"门"。所以只要某一侧的邻居永远是同一个字，就判定它不是独立的词。
   （段落边界算一种独立的上下文，出现在句首句尾本身就是成词的证据。）
   只对已经过了词频门槛的候选词做这一步，避免为整篇文章的所有 n-gram 建表。 */
function kwFreedom(runs, cand){
  var L={}, R={};
  for(var k=0;k<runs.length;k++){
    var run=runs[k];
    for(var n=2;n<=4;n++)
      for(var i=0;i+n<=run.length;i++){
        var g=run.substr(i,n);
        if(!cand[g]) continue;
        (L[g]||(L[g]={}))[i>0?run.charAt(i-1):"\u0000"]=1;
        (R[g]||(R[g]={}))[i+n<run.length?run.charAt(i+n):"\u0000"]=1;
      }
  }
  return function(g){
    var lm=L[g]||{}, rm=R[g]||{};
    // 出现在段落/标点边界上算"自由"：一个总是位于句首的词（"神经网络是…"）
    // 左邻居永远是边界符，但那恰恰说明它能独立成词，不该因此被判成碎片
    var lFree=Object.keys(lm).length>=2||!!lm["\u0000"];
    var rFree=Object.keys(rm).length>=2||!!rm["\u0000"];
    return lFree&&rFree;
  };
}

/* 凝固度：一个片段如果只是两个常见部分碰巧挨在一起（"器学习入"、"械键盘采"），
   它的出现次数会远低于两部分各自频次的乘积所预期的水平。
   取所有切分点里最保守的那个，低于阈值就判定不是词。
   这是无词典分词的常规做法，好处是不用维护中文词库。 */
function kwCohesion(g, all, total){
  if(g.length<2||!total) return Infinity;
  var n=all[g]||0, worst=Infinity;
  for(var i=1;i<g.length;i++){
    var l=all[g.slice(0,i)]||0, r=all[g.slice(i)]||0;
    if(!l||!r) continue;
    var expected=(l/total)*(r/total)*total;      // 两部分独立时的期望次数
    if(expected>0) worst=Math.min(worst, n/expected);
  }
  return worst;
}

/* 短片段被更长的片段完全包含、而且次数差不多时，留长的那个。
   例："机器"出现 5 次、"机器学习"出现 5 次 —— "机器"只是它的一部分，丢掉。 */
function kwDropSubsumed(list){
  return list.filter(function(a){
    return !list.some(function(b){
      return b.w!==a.w && b.w.length>a.w.length && b.w.indexOf(a.w)>-1 && b.n>=a.n*0.4;
    });
  });
}

/* 英文里 transactions / transactional / transaction 会挤成三个几乎一样的标签。
   不引入完整词干库，只削掉几个最常见的后缀做归并，展示时保留出现最多的那个写法。 */
function kwStem(w){
  if(kwIsCjk(w.charAt(0))||w.length<5) return w;
  return w.replace(/(ies|ied)$/,"y").replace(/(ations|ation|ings|ing|ers|er|ies|es|ed|al|ly|s)$/,"");
}
function kwMergeStems(list){
  var byStem={};
  list.forEach(function(x){
    var k=kwStem(x.w);
    var g=byStem[k];
    if(!g){ byStem[k]={w:x.w,n:x.n}; return; }
    g.n+=x.n;
    // 保留更常用的写法；次数相同就用短的
    if(x.n>g.n-x.n || (x.n===g.n-x.n && x.w.length<g.w.length)) g.w=x.w;
  });
  return Object.keys(byStem).map(function(k){ return byStem[k]; });
}

/* 词频 × 长度权重。长词信息量更大，但不能让超长词无脑压过高频词 */
function kwScore(w, n){
  var lenBoost = kwIsCjk(w.charAt(0)) ? Math.min(w.length,4)/2 : Math.min(w.length,10)/4;
  return n*(1+lenBoost);
}

/* 带词频的候选列表。相关页面推荐需要权重，不只是词本身 */
function keywordVector(text, limit, docFreq, docTotal){
  return scoreKeywords(text, docFreq, docTotal).slice(0, limit||30)
    .map(function(x){ return {w:x.w, n:x.n}; });
}

/* 主入口。docFreq 可选：{词: 出现在多少篇文档里}，用来压低"每篇都有"的词 */
function extractKeywords(text, limit, docFreq, docTotal){
  return scoreKeywords(text, docFreq, docTotal).slice(0, limit||8).map(function(x){ return x.w; });
}
function scoreKeywords(text, docFreq, docTotal){
  var counts={}, all={}, runs=[];
  kwLatinCounts(text, counts);
  var cjkTotal=kwCjkCounts(text, counts, all, runs);
  // 先按词频粗筛出候选，再对候选算左右自由度（全量算太贵）
  var cand={}, candN=0;
  for(var w0 in counts){
    var c=counts[w0];
    if(!kwIsCjk(w0.charAt(0))) continue;
    // 中文 n-gram 必须重复出现才可信：只出现一次时，跨词碎片和真词无从区分。
    // 拉丁词不受此限，"asynchronous" 这种长词出现一次也有意义。
    if(c<2) continue;
    if(kwCohesion(w0,all,cjkTotal)<COHESION_MIN) continue;
    cand[w0]=1; candN++;
  }
  var isFree=candN?kwFreedom(runs,cand):function(){ return true; };
  var list=[];
  for(var w in counts){
    var isCjk=kwIsCjk(w.charAt(0));
    if(isCjk){ if(!cand[w]||!isFree(w)) continue; }
    else if(!(counts[w]>=2||w.length>=6)) continue;
    list.push({w:w,n:counts[w]});
  }
  list=kwMergeStems(kwDropSubsumed(list));
  list.forEach(function(x){
    x.s=kwScore(x.w,x.n);
    // 出现在越多文档里的词越没有区分度（"文档""教程"这种），按 IDF 压一压
    if(docFreq&&docTotal>1){
      var df=docFreq[x.w]||0;
      x.s*=Math.log((docTotal+1)/(df+1))+0.2;
    }
  });
  list.sort(function(a,b){ return b.s-a.s || b.n-a.n || a.w.length-b.w.length; });
  return list;
}

/* 单条书签的可用文本：存档正文最强，没有就用标题+描述+URL 路径 */
function bookmarkText(b, snapText){
  var parts=[b.title||"", b.description||""];
  if(snapText) parts.push(snapText);
  try{
    var u=new URL(normalizeUrl(b.url));
    parts.push(u.pathname.replace(/[-_/.]+/g," "));
  }catch(e){}
  return parts.join(" ");
}

/* ----- 编辑弹窗里的建议标签 ----- */
/* 语料层面的文档频次：某个词在你的书签库里到处都是（"文档""教程"），
   拿来当标签就没有区分度，用它压低这类词的权重。 */
var _kwDocFreq=null, _kwDocTotal=0;
function kwBuildDocFreq(){
  var df={}, n=0;
  (state.bookmarks||[]).forEach(function(b){
    var words=extractKeywords(bookmarkText(b), 12);
    var seen={};
    words.forEach(function(w){ if(!seen[w]){ seen[w]=1; df[w]=(df[w]||0)+1; } });
    n++;
  });
  _kwDocFreq=df; _kwDocTotal=n;
}
function renderTagSuggest(b){
  var box=$("#tagSuggest"); if(!box||!b) return;
  box.innerHTML="";
  function show(words, fromSnapshot){
    var have={};
    parseTags($("#bmTags")?$("#bmTags").value:"").forEach(function(t){ have[t.toLowerCase()]=1; });
    var picks=words.filter(function(w){ return !have[w.toLowerCase()]; }).slice(0,6);
    if(!picks.length){ box.innerHTML=""; return; }
    box.innerHTML='<span class="ts-label">'+escapeHtml(t(fromSnapshot?"tagSuggestFromSnap":"tagSuggestFrom"))+'</span>'+
      picks.map(function(w){ return '<button type="button" class="ts-chip" data-tag-add="'+escapeHtml(w)+'">+ '+escapeHtml(w)+'</button>'; }).join("");
  }
  if(!_kwDocFreq) kwBuildDocFreq();
  // 有存档就用正文，那是信号最强的来源；没有就退回标题+描述+URL
  if(typeof snapGet==="function"){
    snapGet(b.url).then(function(rec){
      var txt=bookmarkText(b, rec&&rec.text);
      show(extractKeywords(txt, 10, _kwDocFreq, _kwDocTotal), !!(rec&&rec.text));
    }).catch(function(){ show(extractKeywords(bookmarkText(b), 10, _kwDocFreq, _kwDocTotal), false); });
  } else {
    show(extractKeywords(bookmarkText(b), 10, _kwDocFreq, _kwDocTotal), false);
  }
}
(function wireTagSuggest(){
  var box=$("#tagSuggest"); if(!box) return;
  box.addEventListener("click", function(e){
    var chip=e.target.closest("[data-tag-add]"); if(!chip) return;
    var input=$("#bmTags"), cur=input.value.trim();
    input.value=(cur?cur.replace(/[,，\s]*$/,"")+", ":"")+chip.getAttribute("data-tag-add");
    chip.remove();
    if(!box.querySelector(".ts-chip")) box.innerHTML="";
  });
})();

/* ----- 离线摘要 -----
   抽取式：从正文里挑几句最能代表全文的原话，不生成新句子。
   好处是不需要模型、不联网，也不会编造原文没有的内容；
   代价是句子来自原文，读起来不如生成式顺。对书签描述这种场景够用。 */
function splitSentences(text){
  var s=String(text||"").replace(/\s+/g," ");
  // 中英文标点都作为断句点；把标点保留在句尾
  var parts=s.split(/(?<=[。！？；!?;])\s*|(?<=\.)\s+(?=[A-Z“"'(])/);
  var out=[];
  parts.forEach(function(p){ p=p.trim(); if(p) out.push(p); });
  return out;
}
function kwTextWeight(s){ var c=(s.match(/[㐀-鿿぀-ヿ가-힯]/g)||[]).length; return s.length+c*1.5; }

function summarizeText(text, maxChars, opts){
  opts=opts||{};
  var sents=splitSentences(text);
  if(!sents.length) return "";
  maxChars=maxChars||200;
  // 关键词权重表：句子里出现的主题词越重要、越多，这句越有代表性
  var scored=scoreKeywords(text), weight={};
  scored.slice(0,25).forEach(function(x,i){ weight[x.w]=x.s/(1+i*0.06); });
  var lo=[];
  var picks=sents.map(function(s,i){
    var low=s.toLowerCase(), sum=0;
    for(var w in weight) if(low.indexOf(w)>-1) sum+=weight[w];
    var len=kwTextWeight(s);
    // 除以 sqrt(长度)：否则永远是最长的那句赢；太短的句子（标题、导航残留）也压一压
    var sc=sum/Math.sqrt(Math.max(len,8));
    if(len<12) sc*=0.3;
    if(len>220) sc*=0.6;
    sc*=(i<3?1.25:(i<8?1.05:1));      // 开头几句通常在点题，给一点加成
    return {i:i, s:s, sc:sc, len:len};
  });
  picks.sort(function(a,b){ return b.sc-a.sc; });
  var chosen=[], used=0;
  for(var k=0;k<picks.length&&used<maxChars;k++){
    var p=picks[k];
    if(p.sc<=0) break;
    // 和已选句子重复度太高就跳过，避免同一件事说两遍
    var dup=chosen.some(function(c){ return kwOverlap(c.s,p.s)>0.6; });
    if(dup) continue;
    chosen.push(p); used+=p.len;
  }
  chosen.sort(function(a,b){ return a.i-b.i; });          // 还原成原文顺序
  function join(list){
    // 中文句子自带句号，再补空格会变成"。 "这种双分隔；英文则需要空格
    return list.reduce(function(acc,c){
      if(!acc) return c.s;
      return acc+(/[。！？；]$/.test(acc)?"":" ")+c.s;
    },"");
  }
  var out=join(chosen);
  if(kwTextWeight(out)>maxChars*1.35&&chosen.length>1){
    chosen.pop(); chosen.sort(function(a,b){ return a.i-b.i; });
    out=join(chosen);
  }
  return out;
}
/* 两句话的字符重合比例，用来去重 */
function kwOverlap(a,b){
  var sa={}, n=0, hit=0;
  for(var i=0;i+2<=a.length;i++) sa[a.substr(i,2)]=1;
  for(var j=0;j+2<=b.length;j++){ n++; if(sa[b.substr(j,2)]) hit++; }
  return n?hit/n:0;
}
