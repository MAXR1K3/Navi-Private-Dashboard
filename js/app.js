/* app.js — 应用启动入口（必须最后加载） */
"use strict";

/* ===== init ===== */
load(); purgeTrash(); oplogInit(); applyI18n(); initPerformanceGuards(); render(); initAutoTheme(); initChromeSync();
