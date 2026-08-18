#!/usr/bin/env node
/* tools/bump.js — 一条命令搞定发版前的两件杂事：
     ① 把 sw.js 的 SHELL 预缓存列表按 index.html 的实际脚本重新生成；
     ② 把版本号（sw.js 的 CACHE、SHELL 里的 app.css?v=、index.html 的 link）三处一起 +1。
   这两件事以前靠手工，漏一个的后果是用户拿到半新半旧的文件——
   加了新 js 忘记进 SHELL，离线就少一个模块；忘了升版本，改动根本不会生效。
   用法：node tools/bump.js [版本号]    不给版本号就在当前基础上 +1 */
"use strict";
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);

let html = read("index.html"), sw = read("sw.js");

const cur = Number((sw.match(/var CACHE\s*=\s*"navi-v(\d+)"/) || [])[1]);
if (!cur) { console.error("× 在 sw.js 里找不到 CACHE 版本号"); process.exit(1); }
const next = process.argv[2] ? Number(process.argv[2]) : cur + 1;
if (!Number.isFinite(next)) { console.error("× 版本号得是数字"); process.exit(1); }

// —— ① SHELL：以 index.html 为准重新生成，顺序也跟着走 ——
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => "./" + m[1]);
const head = ["./", "./index.html", "./manifest.webmanifest", `./css/app.css?v=${next}`];
const icons = ["./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png"];
const shell = [...head, ...scripts, ...icons];

const before = (sw.match(/var SHELL = \[([\s\S]*?)\];/) || [])[1] || "";
sw = sw.replace(/var SHELL = \[[\s\S]*?\];/,
  "var SHELL = [\n" + shell.map(s => '  "' + s + '"').join(",\n") + "\n];");
sw = sw.replace(/var CACHE\s*=\s*"navi-v\d+"/, `var CACHE = "navi-v${next}"`);
html = html.replace(/css\/app\.css\?v=\d+/, `css/app.css?v=${next}`);

write("sw.js", sw); write("index.html", html);

const wasCount = (before.match(/\.\/js\//g) || []).length;
console.log(`✔ 版本 navi-v${cur} → navi-v${next}（sw.js CACHE / SHELL 的 css / index.html 的 link）`);
console.log(`✔ SHELL 已按 index.html 重新生成：${scripts.length} 个脚本` +
            (wasCount !== scripts.length ? `（原来 ${wasCount} 个，差 ${scripts.length - wasCount}）` : "（数量未变）"));
