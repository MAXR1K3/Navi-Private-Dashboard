/* auto-theme.js — 根据当地日出/日落自动切换深色/浅色主题 */
"use strict";

var _autoThemeTimer = null;

/* ===== USNO 日出/日落算法（精度约 ±1 分钟）===== */
function calcSunTimes(lat, lon, date) {
  var zenith = 90.833; // 官方日出日落仰角（含大气折射修正）
  var latR   = lat * Math.PI / 180;
  var d      = new Date(date);
  var dayOfYear = Math.ceil(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000
  );

  function calcTime(rising) {
    var lngHour = lon / 15;
    var t = rising ? dayOfYear + (6 - lngHour) / 24 : dayOfYear + (18 - lngHour) / 24;
    var M    = 0.9856 * t - 3.289;
    var Lraw = M + 1.916 * Math.sin(M * Math.PI / 180) + 0.020 * Math.sin(2 * M * Math.PI / 180) + 282.634;
    var L    = ((Lraw % 360) + 360) % 360;
    var RAraw= Math.atan(0.91764 * Math.tan(L * Math.PI / 180)) * 180 / Math.PI;
    var RA   = ((RAraw % 360) + 360) % 360;
    RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
    var sinDec = 0.39782 * Math.sin(L * Math.PI / 180);
    var cosDec = Math.cos(Math.asin(sinDec));
    var cosH   = (Math.cos(zenith * Math.PI / 180) - sinDec * Math.sin(latR)) / (cosDec * Math.cos(latR));
    if (cosH > 1 || cosH < -1) return null; // 极夜或极昼
    var H = rising ? (360 - Math.acos(cosH) * 180 / Math.PI) / 15 : Math.acos(cosH) * 180 / Math.PI / 15;
    var T = H + RA - 0.06571 * t - 6.622;
    var UT = ((T - lngHour) % 24 + 24) % 24;
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) + UT * 3600000;
  }

  return { sunrise: calcTime(true), sunset: calcTime(false) };
}

/* ===== 获取坐标（已授权则用精确值，否则从时区偏移估算）===== */
function _autoCoords() {
  var c = state.settings.autoThemeCoords;
  if (c && c.lat != null && c.lon != null) return c;
  // 时区偏移 → 经度（4 分钟/度），纬度取 35°（全球人口加权中纬度近似值）
  return { lat: 35, lon: Math.max(-180, Math.min(180, -(new Date().getTimezoneOffset()) / 4)) };
}

/* ===== 将 "auto" 解析为实际主题 ===== */
function resolveTheme() {
  if (state.theme !== "auto") return state.theme;
  var coords = _autoCoords();
  var times  = calcSunTimes(coords.lat, coords.lon, Date.now());
  if (!times || times.sunrise == null || times.sunset == null) return "light";
  var now = Date.now();
  return (now >= times.sunrise && now < times.sunset) ? "light" : "dark";
}

/* ===== 立即将自动主题写入 DOM ===== */
function applyAutoTheme() {
  if (state.theme !== "auto") return;
  document.documentElement.setAttribute("data-theme", resolveTheme());
  var btn = document.getElementById("themeBtn");
  if (btn) btn.innerHTML = ICONS.autoTheme;
}

/* ===== 在下次日出/日落时刻安排切换 ===== */
function scheduleAutoTheme() {
  if (_autoThemeTimer) { clearTimeout(_autoThemeTimer); _autoThemeTimer = null; }
  if (state.theme !== "auto") return;
  var coords = _autoCoords();
  var times  = calcSunTimes(coords.lat, coords.lon, Date.now());
  var now    = Date.now();
  var next   = null;
  if (times) {
    if      (times.sunrise != null && now < times.sunrise) { next = times.sunrise; }
    else if (times.sunset  != null && now < times.sunset)  { next = times.sunset;  }
    else {
      var tom = calcSunTimes(coords.lat, coords.lon, now + 86400000);
      if (tom && tom.sunrise != null) next = tom.sunrise;
    }
  }
  if (next == null) return;
  _autoThemeTimer = setTimeout(function() {
    applyAutoTheme();
    scheduleAutoTheme();
  }, Math.max(next - Date.now(), 1000));
}

/* ===== 请求定位以提高精度（仅在用户主动开启、且尚无缓存坐标时弹一次）===== */
function requestAutoThemeGeo() {
  if (!navigator.geolocation) return;
  if (state.settings.autoThemeCoords) return; // 已有坐标，永不再弹权限框
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      state.settings.autoThemeCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      save();
      applyAutoTheme();
      scheduleAutoTheme();
    },
    function() { /* 已拒绝，保持时区估算，静默忽略 */ },
    { timeout: 5000, maximumAge: 86400000 }
  );
}

/* ===== 页面启动时调用 ===== */
function initAutoTheme() {
  if (state.theme === "auto") {
    applyAutoTheme();
    scheduleAutoTheme();
    // 页面启动绝不弹定位权限：直接用缓存坐标或时区估算。
    // 只有用户主动开启自动主题时（按钮/开关）才请求一次定位。
  }
  // 设备从休眠恢复或切换回前台时重新校验
  document.addEventListener("visibilitychange", function() {
    if (!document.hidden && state.theme === "auto") {
      applyAutoTheme();
      scheduleAutoTheme();
    }
  });
}

/* ===== 设置面板复选框联动 ===== */
(function() {
  var chk = document.getElementById("setAutoTheme");
  if (!chk) return;
  chk.addEventListener("change", function() {
    if (chk.checked) {
      state.theme = "auto";
      save(); render();
      scheduleAutoTheme();
      requestAutoThemeGeo();
    } else {
      if (_autoThemeTimer) { clearTimeout(_autoThemeTimer); _autoThemeTimer = null; }
      state.theme = resolveTheme(); // 保留当前实际亮/暗色
      save(); render();
    }
  });
})();
