/* tools/env.js — 让浏览器里的 js/*.js 能在 node 里被加载。
   这些模块是直接跑在全局作用域上的（没有模块系统），加载时就会去碰 DOM：
   $("#x").addEventListener(...)、document.querySelectorAll(...) 之类。
   所以这里不是"模拟浏览器"，只是给出足够让它们**加载不报错**的空壳——
   真正被测的是纯逻辑函数，DOM 行为不在这层测。 */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");

/* 任取属性都返回自身、任意调用都不报错的空壳节点 */
function stubNode() {
  const target = function () { return proxy; };
  const proxy = new Proxy(target, {
    get(_, k) {
      if (k === "classList") return { add(){}, remove(){}, toggle(){}, contains(){ return false; } };
      if (k === "style") return {};
      if (k === "dataset") return {};
      if (k === "children" || k === "childNodes") return [];
      if (k === "value" || k === "textContent" || k === "innerHTML" || k === "className") return "";
      if (k === "parentNode" || k === "offsetParent") return null;
      if (k === Symbol.toPrimitive || k === "toString") return () => "[stub]";
      if (k === "then") return undefined;            // 别被误当成 thenable
      return proxy;
    },
    apply() { return proxy; },
    set() { return true; }
  });
  return proxy;
}

function makeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => m.set(String(k), String(v)),
    removeItem: k => m.delete(String(k)),
    key: i => [...m.keys()][i] ?? null,
    clear: () => m.clear(),
    get length() { return m.size; }
  };
}

function createEnv() {
  const node = stubNode();
  const doc = {
    documentElement: node, body: node, title: "",
    querySelector: () => node, querySelectorAll: () => [],
    getElementById: () => node, createElement: () => node,
    addEventListener(){}, removeEventListener(){},
    createTextNode: t => ({ nodeValue: t })
  };
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Promise, Math, JSON, Date, URL, URLSearchParams, RegExp, Intl,
    document: doc, localStorage: makeStorage(), sessionStorage: makeStorage(),
    navigator: { language: "en", userAgent: "node", onLine: true },
    location: { href: "http://localhost/", search: "", pathname: "/", origin: "http://localhost" },
    history: { replaceState(){} },
    requestAnimationFrame: cb => setTimeout(cb, 0),
    matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
    fetch: () => Promise.reject(new Error("网络在测试里被禁用")),
    indexedDB: undefined,
    // 这些是各模块加载期就会调用的，给成空操作，避免测试互相污染
    alert(){}, confirm(){ return true; }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  return ctx;
}

/* 按 index.html 里的顺序加载指定模块 */
function load(ctx, files) {
  const failed = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    try { vm.runInContext(src, ctx, { filename: f }); }
    catch (e) { failed.push(f + ": " + e.message); }
  }
  return failed;
}

module.exports = { createEnv, load, stubNode, root };
