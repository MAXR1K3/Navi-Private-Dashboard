/* i18n.js — 多语言文案与 t() 翻译函数 */
"use strict";

/* ===== i18n ===== */
var I18N = {
  en:{
    customizeTitle:"Customize name & logo", searchPh:"Search bookmarks…", theme:"Toggle theme", view:"Grid / list",
    select:"Select", import:"Import", add:"Add", settings:"Settings", more:"More",
    hideWidgets:"Hide widgets", showWidgets:"Show widgets", exportBm:"Export bookmarks", summarizeMissing:"Summarize descriptions", summariesDone:"Descriptions updated for {n} bookmark(s)", newCategory:"New category", clearAll:"Clear everything",
    tagline:"Private bookmark dashboard", dashboard:"Dashboard", customize:"Customize",
    webSearch:"Web search", weather:"Weather", calendar:"Calendar", frequentlyUsed:"Frequently used", recentlyOpened:"Recently opened", clock:"Clock",
    goodMorning:"Good morning", goodAfternoon:"Good afternoon", goodEvening:"Good evening", goodNight:"Good night",
    searchGooglePh:"Search Google…", searchWebPh:"Search the web…", searchHint:"Press Enter to search with {engine} in a new tab.",
    setLocation:"Set a location to see local weather.", enterCity:"Enter a city…", setBtn:"Set", useMyLocation:"Use my location",
    couldntLoad:"Couldn’t load weather.", retry:"Retry", orEnterCity:"Or enter a city…", wind:"Wind", humidity:"Humidity",
    weatherSetTo:"Weather set to {city}", cityNotFound:"City not found", couldntLookup:"Couldn’t look up that city",
    today:"Today", smaller:"Smaller", larger:"Larger", dragReorderW:"Drag to reorder",
    frequentEmpty:"Open your bookmarks and your most-used pages show up here.", recentEmpty:"Pages you open will appear here, most recent first.",
    justNow:"just now", dragReorder:"Drag cards to reorder",
    emptyTitle:"Your dashboard is empty", emptyDesc:"Add your first bookmark or import an exported browser file to get started.",
    addFirst:"+ Add bookmark", importFile:"Import a file", nothingHere:"Nothing here", noMatch:"No bookmarks match your search.", noInCat:"No bookmarks in this category yet.", addBookmarkBtn:"+ Add bookmark",
    addBookmark:"Add bookmark", editBookmark:"Edit bookmark", bmSub:"Save a page to your dashboard.",
    urlLabel:"URL", titleLabel:"Title", titlePh:"Auto-filled from the URL", catLabel:"Category", descLabel:"Description", descPh:"Add a note, or click Auto to summarize", autoBtn:"Auto",
    saveBookmark:"Save bookmark", saveChanges:"Save changes", cancel:"Cancel", save:"Save", delete:"Delete", done:"Done",
    renameCat:"Rename “{cat}”", deleteBookmark:"Delete bookmark", deleteBmMsg:"Remove “{name}” from your dashboard?",
    deleteCategory:"Delete category", delCatMove:"Move {n} bookmark(s) to “Uncategorized” and remove this category?", delCatEmpty:"Remove this empty category?",
    deleteNTitle:"Delete {n} bookmark(s)", deleteNMsg:"This will permanently remove the selected items.", deleteN:"Delete {n}",
    clearTitle:"Clear everything", clearMsg:"This permanently deletes all bookmarks and categories. This cannot be undone.", deleteAll:"Delete all",
    uncategorized:"Uncategorized", selected:"selected", selectAll:"Select all", clear:"Clear",
    settingsTitle:"Settings", settingsSub:"Personalize your dashboard.", appearance:"Appearance", language:"Language",
    pageName:"Page name", subtitle:"Subtitle", logo:"Logo", logoDesc:"PNG, JPG or SVG — replaces the icon", upload:"Upload",
    animations:"Page animations", animationsDesc:"Smooth entrances and transitions",
    widgetsSec:"Widgets", showSeconds:"Show seconds", showSecondsDesc:"Display seconds on the clock", showHolidays:"Show holidays", showHolidaysDesc:"Mark common public holidays in the calendar",
    googleSearch:"Google search", weatherDesc:"Uses your location or a city you set", frequentDesc:"Your most-opened bookmarks",
    categoriesSec:"Categories", categoryStyle:"Category style", layoutTabs:"Tabs", layoutDrawer:"Drawer", layoutDropdown:"Dropdown", categoriesTitle:"Categories",
    importTitle:"Import browser bookmarks", importSub:"Select a bookmarks file exported from Chrome, Edge, Firefox, Safari, Brave or Arc (an .html file).",
    dzClick:"Click to choose a file", dzDrop:"or drop it here", mergeWith:"Merge with existing", replaceAll:"Replace everything",
    bookmarksFound:"Bookmarks found", categoriesN:"Categories", newToAdd:"New to add", total:"Total", importN:"Import {n} bookmark(s)",
    foldersBecome:"Folders from your file become categories.", dupSkipped:"{n} duplicate(s) will be skipped.", reviewConfirm:"Review and confirm below.",
    bookmarkAdded:"Bookmark added", bookmarkUpdated:"Bookmark updated", bookmarkDeleted:"Bookmark deleted",
    categoryRenamed:"Category renamed", categoryDeleted:"Category deleted", categoryInvalid:"Use a unique category name that is not ‘All’", allCleared:"All bookmarks cleared",
    logoUpdated:"Logo updated", logoReset:"Logo reset", pleaseUrl:"Please enter a URL", invalidUrl:"Please enter a valid http(s) URL", nothingToExport:"Nothing to export",
    noBookmarksFile:"No bookmarks found in that file", couldntRead:"Couldn’t read that file",
    importedToast:"Imported {a} bookmark(s)", importedSkip:" · skipped {s} duplicate(s)", exportedToast:"Exported {n} bookmarks",
    autoFetching:"Fetching page…", autoOk:"Description added from the page", autoFallback:"Couldn’t read the page (often blocked) — added a basic summary", couldntImage:"Couldn’t load that image", chooseImage:"Please choose an image",
    chromeSync:"Chrome Sync", chromeSyncSec:"Sync bookmarks from your Google account via Chrome (read-only).",
    syncNow:"Sync now", syncing:"Syncing…", syncedCount:"Synced {n} bookmarks", lastSynced:"Synced {t} ago", neverSynced:"Not yet synced",
    notExtension:"Open as Chrome extension to enable.", extensionSetup:"Extension setup guide",
    chromeSyncEnabled:"Chrome sync enabled", chromeSyncDisabled:"Chrome sync disabled", chromeSyncError:"Sync failed",
    autoSyncDesc:"Auto-syncs every 30 min while active"
  },
  zh:{
    customizeTitle:"自定义名称和图标", searchPh:"搜索书签…", theme:"切换主题", view:"网格 / 列表",
    select:"选择", import:"导入", add:"添加", settings:"设置", more:"更多",
    hideWidgets:"隐藏小组件", showWidgets:"显示小组件", exportBm:"导出书签", summarizeMissing:"生成描述摘要", summariesDone:"已更新 {n} 个书签描述", newCategory:"新建分类", clearAll:"清除全部",
    tagline:"私人书签面板", dashboard:"仪表板", customize:"自定义",
    webSearch:"网页搜索", weather:"天气", calendar:"日历", frequentlyUsed:"常用", recentlyOpened:"最近打开", clock:"时钟",
    goodMorning:"早上好", goodAfternoon:"下午好", goodEvening:"晚上好", goodNight:"晚安",
    searchGooglePh:"用 Google 搜索…", searchWebPh:"搜索网页…", searchHint:"按回车在新标签页使用 {engine} 搜索。",
    setLocation:"设置位置以查看本地天气。", enterCity:"输入城市…", setBtn:"设置", useMyLocation:"使用我的位置",
    couldntLoad:"无法加载天气。", retry:"重试", orEnterCity:"或输入城市…", wind:"风速", humidity:"湿度",
    weatherSetTo:"天气已设为 {city}", cityNotFound:"未找到城市", couldntLookup:"无法查询该城市",
    today:"今天", smaller:"缩小", larger:"放大", dragReorderW:"拖动以重新排序",
    frequentEmpty:"打开书签后，最常用的页面会显示在这里。", recentEmpty:"你打开的页面会显示在这里（最新在前）。",
    justNow:"刚刚", dragReorder:"拖动卡片重新排序",
    emptyTitle:"你的面板是空的", emptyDesc:"添加第一个书签，或导入浏览器导出的文件开始使用。",
    addFirst:"+ 添加书签", importFile:"导入文件", nothingHere:"这里什么都没有", noMatch:"没有匹配的书签。", noInCat:"此分类暂无书签。", addBookmarkBtn:"+ 添加书签",
    addBookmark:"添加书签", editBookmark:"编辑书签", bmSub:"将网页保存到面板。",
    urlLabel:"网址", titleLabel:"标题", titlePh:"自动从网址填充", catLabel:"分类", descLabel:"描述", descPh:"添加备注，或点击“自动”生成摘要", autoBtn:"自动",
    saveBookmark:"保存书签", saveChanges:"保存更改", cancel:"取消", save:"保存", delete:"删除", done:"完成",
    renameCat:"重命名“{cat}”", deleteBookmark:"删除书签", deleteBmMsg:"从面板中移除“{name}”？",
    deleteCategory:"删除分类", delCatMove:"将 {n} 个书签移到“未分类”并删除此分类？", delCatEmpty:"删除这个空分类？",
    deleteNTitle:"删除 {n} 个书签", deleteNMsg:"这将永久删除所选项目。", deleteN:"删除 {n} 个",
    clearTitle:"清除全部", clearMsg:"这将永久删除所有书签和分类，且无法撤销。", deleteAll:"全部删除",
    uncategorized:"未分类", selected:"已选", selectAll:"全选", clear:"清除",
    settingsTitle:"设置", settingsSub:"个性化你的面板。", appearance:"外观", language:"语言",
    pageName:"页面名称", subtitle:"副标题", logo:"图标", logoDesc:"PNG、JPG 或 SVG —— 替换图标", upload:"上传",
    animations:"页面动画", animationsDesc:"平滑的入场和过渡",
    widgetsSec:"小组件", showSeconds:"显示秒", showSecondsDesc:"在时钟上显示秒", showHolidays:"显示节假日", showHolidaysDesc:"在日历中标记常见公共节假日",
    googleSearch:"Google 搜索", weatherDesc:"使用你的位置或设定的城市", frequentDesc:"你最常打开的书签",
    categoriesSec:"分类", categoryStyle:"分类样式", layoutTabs:"标签", layoutDrawer:"抽屉", layoutDropdown:"下拉", categoriesTitle:"分类",
    importTitle:"导入浏览器书签", importSub:"选择从 Chrome、Edge、Firefox、Safari、Brave 或 Arc 导出的书签文件（.html）。",
    dzClick:"点击选择文件", dzDrop:"或拖放到此处", mergeWith:"与现有合并", replaceAll:"替换全部",
    bookmarksFound:"找到的书签", categoriesN:"分类", newToAdd:"新增", total:"总计", importN:"导入 {n} 个书签",
    foldersBecome:"文件中的文件夹将成为分类。", dupSkipped:"将跳过 {n} 个重复项。", reviewConfirm:"在下方查看并确认。",
    bookmarkAdded:"已添加书签", bookmarkUpdated:"已更新书签", bookmarkDeleted:"已删除书签",
    categoryRenamed:"已重命名分类", categoryDeleted:"已删除分类", categoryInvalid:"请使用唯一的分类名，且不要命名为“全部/All”", allCleared:"已清除所有书签",
    logoUpdated:"已更新图标", logoReset:"已重置图标", pleaseUrl:"请输入网址", invalidUrl:"请输入有效的 http(s) 网址", nothingToExport:"没有可导出的内容",
    noBookmarksFile:"文件中未找到书签", couldntRead:"无法读取该文件",
    importedToast:"已导入 {a} 个书签", importedSkip:" · 跳过 {s} 个重复项", exportedToast:"已导出 {n} 个书签",
    autoFetching:"正在获取页面…", autoOk:"已从页面添加描述", autoFallback:"无法读取页面（常被拦截）—— 已添加基本摘要", couldntImage:"无法加载该图片", chooseImage:"请选择一张图片",
    chromeSync:"Chrome 同步", chromeSyncSec:"通过 Chrome 同步您 Google 账户中的书签（只读）。",
    syncNow:"立即同步", syncing:"同步中…", syncedCount:"已同步 {n} 个书签", lastSynced:"{t}前已同步", neverSynced:"尚未同步",
    notExtension:"以 Chrome 扩展方式运行才可启用。", extensionSetup:"扩展安装指南",
    chromeSyncEnabled:"Chrome 同步已启用", chromeSyncDisabled:"Chrome 同步已关闭", chromeSyncError:"同步失败",
    autoSyncDesc:"活跃时每 30 分钟自动同步"
  },
  es:{
    customizeTitle:"Personalizar nombre y logo", searchPh:"Buscar marcadores…", theme:"Cambiar tema", view:"Cuadrícula / lista",
    select:"Seleccionar", import:"Importar", add:"Añadir", settings:"Ajustes", more:"Más",
    hideWidgets:"Ocultar widgets", showWidgets:"Mostrar widgets", exportBm:"Exportar marcadores", summarizeMissing:"Resumir descripciones", summariesDone:"Descripciones actualizadas para {n} marcador(es)", newCategory:"Nueva categoría", clearAll:"Borrar todo",
    tagline:"Panel privado de marcadores", dashboard:"Panel", customize:"Personalizar",
    webSearch:"Búsqueda web", weather:"Clima", calendar:"Calendario", frequentlyUsed:"Más usados", recentlyOpened:"Abiertos recientemente", clock:"Reloj",
    goodMorning:"Buenos días", goodAfternoon:"Buenas tardes", goodEvening:"Buenas noches", goodNight:"Buenas noches",
    searchGooglePh:"Buscar en Google…", searchWebPh:"Buscar en la web…", searchHint:"Pulsa Enter para buscar con {engine} en una pestaña nueva.",
    setLocation:"Define una ubicación para ver el clima local.", enterCity:"Escribe una ciudad…", setBtn:"Definir", useMyLocation:"Usar mi ubicación",
    couldntLoad:"No se pudo cargar el clima.", retry:"Reintentar", orEnterCity:"O escribe una ciudad…", wind:"Viento", humidity:"Humedad",
    weatherSetTo:"Clima configurado para {city}", cityNotFound:"Ciudad no encontrada", couldntLookup:"No se pudo buscar esa ciudad",
    today:"Hoy", smaller:"Reducir", larger:"Ampliar", dragReorderW:"Arrastra para reordenar",
    frequentEmpty:"Abre tus marcadores y aquí verás los más usados.", recentEmpty:"Las páginas que abras aparecerán aquí, las más recientes primero.",
    justNow:"ahora", dragReorder:"Arrastra las tarjetas para reordenar",
    emptyTitle:"Tu panel está vacío", emptyDesc:"Añade tu primer marcador o importa un archivo del navegador para empezar.",
    addFirst:"+ Añadir marcador", importFile:"Importar un archivo", nothingHere:"Nada por aquí", noMatch:"Ningún marcador coincide con tu búsqueda.", noInCat:"Aún no hay marcadores en esta categoría.", addBookmarkBtn:"+ Añadir marcador",
    addBookmark:"Añadir marcador", editBookmark:"Editar marcador", bmSub:"Guarda una página en tu panel.",
    urlLabel:"URL", titleLabel:"Título", titlePh:"Se completa desde la URL", catLabel:"Categoría", descLabel:"Descripción", descPh:"Añade una nota o pulsa Auto para resumir", autoBtn:"Auto",
    saveBookmark:"Guardar marcador", saveChanges:"Guardar cambios", cancel:"Cancelar", save:"Guardar", delete:"Eliminar", done:"Listo",
    renameCat:"Renombrar «{cat}»", deleteBookmark:"Eliminar marcador", deleteBmMsg:"¿Quitar «{name}» de tu panel?",
    deleteCategory:"Eliminar categoría", delCatMove:"¿Mover {n} marcador(es) a «Sin categoría» y eliminar esta categoría?", delCatEmpty:"¿Eliminar esta categoría vacía?",
    deleteNTitle:"Eliminar {n} marcador(es)", deleteNMsg:"Esto eliminará permanentemente los elementos seleccionados.", deleteN:"Eliminar {n}",
    clearTitle:"Borrar todo", clearMsg:"Esto elimina permanentemente todos los marcadores y categorías. No se puede deshacer.", deleteAll:"Eliminar todo",
    uncategorized:"Sin categoría", selected:"seleccionados", selectAll:"Seleccionar todo", clear:"Limpiar",
    settingsTitle:"Ajustes", settingsSub:"Personaliza tu panel.", appearance:"Apariencia", language:"Idioma",
    pageName:"Nombre de la página", subtitle:"Subtítulo", logo:"Logo", logoDesc:"PNG, JPG o SVG: reemplaza el icono", upload:"Subir",
    animations:"Animaciones", animationsDesc:"Entradas y transiciones suaves",
    widgetsSec:"Widgets", showSeconds:"Mostrar segundos", showSecondsDesc:"Mostrar los segundos en el reloj", showHolidays:"Mostrar festivos", showHolidaysDesc:"Marca festivos públicos comunes en el calendario",
    googleSearch:"Búsqueda de Google", weatherDesc:"Usa tu ubicación o una ciudad", frequentDesc:"Tus marcadores más abiertos",
    categoriesSec:"Categorías", categoryStyle:"Estilo de categorías", layoutTabs:"Pestañas", layoutDrawer:"Cajón", layoutDropdown:"Desplegable", categoriesTitle:"Categorías",
    importTitle:"Importar marcadores del navegador", importSub:"Selecciona un archivo de marcadores exportado de Chrome, Edge, Firefox, Safari, Brave o Arc (.html).",
    dzClick:"Haz clic para elegir un archivo", dzDrop:"o suéltalo aquí", mergeWith:"Combinar con los existentes", replaceAll:"Reemplazar todo",
    bookmarksFound:"Marcadores encontrados", categoriesN:"Categorías", newToAdd:"Nuevos", total:"Total", importN:"Importar {n} marcador(es)",
    foldersBecome:"Las carpetas del archivo se convierten en categorías.", dupSkipped:"Se omitirán {n} duplicado(s).", reviewConfirm:"Revisa y confirma abajo.",
    bookmarkAdded:"Marcador añadido", bookmarkUpdated:"Marcador actualizado", bookmarkDeleted:"Marcador eliminado",
    categoryRenamed:"Categoría renombrada", categoryDeleted:"Categoría eliminada", categoryInvalid:"Usa un nombre de categoría único que no sea ‘All’", allCleared:"Se borraron todos los marcadores",
    logoUpdated:"Logo actualizado", logoReset:"Logo restablecido", pleaseUrl:"Introduce una URL", invalidUrl:"Introduce una URL http(s) válida", nothingToExport:"Nada para exportar",
    noBookmarksFile:"No se encontraron marcadores en ese archivo", couldntRead:"No se pudo leer ese archivo",
    importedToast:"Importados {a} marcador(es)", importedSkip:" · {s} duplicado(s) omitido(s)", exportedToast:"Exportados {n} marcadores",
    autoFetching:"Obteniendo página…", autoOk:"Descripción añadida desde la página", autoFallback:"No se pudo leer la página (a menudo bloqueada): se añadió un resumen básico", couldntImage:"No se pudo cargar esa imagen", chooseImage:"Elige una imagen",
    chromeSync:"Sincronización Chrome", chromeSyncSec:"Sincroniza marcadores de tu cuenta Google mediante Chrome (solo lectura).",
    syncNow:"Sincronizar ahora", syncing:"Sincronizando…", syncedCount:"Sincronizados {n} marcadores", lastSynced:"Sincronizado hace {t}", neverSynced:"Nunca sincronizado",
    notExtension:"Ábrelo como extensión de Chrome para activarlo.", extensionSetup:"Guía de instalación",
    chromeSyncEnabled:"Sincronización Chrome activada", chromeSyncDisabled:"Sincronización Chrome desactivada", chromeSyncError:"Error al sincronizar",
    autoSyncDesc:"Sincronización automática cada 30 min"
  }
};
var DOWS = { en:["S","M","T","W","T","F","S"], zh:["日","一","二","三","四","五","六"], es:["D","L","M","X","J","V","S"] };
var LOCALE = { en:"en-US", zh:"zh-CN", es:"es-ES" };
var LANGS = ["en","zh","es"]; var LANGCODE = { en:"EN", zh:"中", es:"ES" };
var ENGINES = { google:{label:"Google",url:"https://www.google.com/search?q=",c:"#4285f4"}, bing:{label:"Bing",url:"https://www.bing.com/search?q=",c:"#008373"}, youtube:{label:"YouTube",url:"https://www.youtube.com/results?search_query=",c:"#ff0000"}, reddit:{label:"Reddit",url:"https://www.reddit.com/search/?q=",c:"#ff4500"}, xiaohongshu:{label:"小红书",url:"https://www.xiaohongshu.com/search_result?keyword=",c:"#ff2442"}, zhihu:{label:"知乎",url:"https://www.zhihu.com/search?type=content&q=",c:"#0066ff"}, taobao:{label:"淘宝",url:"https://s.taobao.com/search?q=",c:"#ff5000"}, amazon:{label:"Amazon",url:"https://www.amazon.com/s?k=",c:"#ff9900"}, github:{label:"GitHub",url:"https://github.com/search?q=",c:"#8b949e"} };
var ENGINE_ORDER = ["google","bing","youtube","reddit","xiaohongshu","zhihu","taobao","amazon","github"];
// Engines are displayed sorted by usage (most-used first); the active engine is always pinned first so it stays visible.
function engineDisplayOrder(){
  var cur=currentEngine(), use=(state.settings&&state.settings.engineUsage)||{};
  return ENGINE_ORDER.slice().sort(function(a,b){
    if(a===cur) return -1; if(b===cur) return 1;
    var d=(use[b]||0)-(use[a]||0); if(d) return d;
    return ENGINE_ORDER.indexOf(a)-ENGINE_ORDER.indexOf(b);
  });
}
function bumpEngineUsage(k){ var s=state.settings; if(!s.engineUsage) s.engineUsage={}; s.engineUsage[k]=(s.engineUsage[k]||0)+1; }

function t(key, vars){
  var lang = state.settings.lang || "en";
  var s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  if(vars){ for(var k in vars){ s = s.replace(new RegExp("\\{"+k+"\\}","g"), vars[k]); } }
  return s;
}
// count phrasing
function nBookmarks(n){ var l=state.settings.lang; if(l==="zh") return n+" 个书签"; if(l==="es") return n+(n===1?" marcador":" marcadores"); return n+" bookmark"+(n===1?"":"s"); }
function nResults(n,q){ var l=state.settings.lang; if(l==="zh") return "找到 "+n+" 个结果：“"+q+"”"; if(l==="es") return n+(n===1?" resultado":" resultados")+" para «"+q+"»"; return "<b>"+n+"</b> result"+(n===1?"":"s")+" for “"+q+"”"; }
function nInCat(n,cat){ var l=state.settings.lang; if(l==="zh") return cat+" 中有 "+n+" 个"; if(l==="es") return n+" en "+cat; return "<b>"+n+"</b> in "+cat; }
function timeAgo(ts){
  var s=Math.floor((Date.now()-ts)/1000), l=state.settings.lang;
  if(s<60) return t("justNow");
  var m=Math.floor(s/60); if(m<60) return l==="zh"?(m+" 分钟前"):l==="es"?("hace "+m+" min"):(m+"m ago");
  var h=Math.floor(m/60); if(h<24) return l==="zh"?(h+" 小时前"):l==="es"?("hace "+h+" h"):(h+"h ago");
  var d=Math.floor(h/24); if(d<7) return l==="zh"?(d+" 天前"):l==="es"?("hace "+d+" d"):(d+"d ago");
  var w=Math.floor(d/7); return l==="zh"?(w+" 周前"):l==="es"?("hace "+w+" sem"):(w+"w ago");
}

/* ===== 新功能文案：回收站 / 撤销 / 健康检查 / AI 建议 ===== */
(function(){
  var extra={
    en:{
      trash:"Trash", trashSub:"Deleted bookmarks are kept here until they expire.", trashEmptyMsg:"Trash is empty.",
      restore:"Restore", deleteForever:"Delete forever", emptyTrash:"Empty trash",
      emptyTrashMsg:"Permanently delete all {n} bookmarks in the trash?", trashEmptied:"Trash emptied",
      retention:"Keep deleted items", retImmediate:"Delete immediately", retDays:"{n} days",
      movedToTrash:"Moved to Trash", movedNToTrash:"{n} bookmarks moved to Trash",
      undo:"Undo", undone:"Action undone", expDays:"{d}d left", expToday:"expires today", restored:"Bookmark restored",
      healthCheck:"Check links", healthRunning:"Checking links… this may take a moment", healthBusy:"A link check is already running",
      healthDone:"Link check done: {ok} OK · {warn} unsure · {bad} broken",
      hOk:"Link OK · checked {ago}", hBad:"Link appears dead · checked {ago}", hWarn:"Link may be unavailable · checked {ago}", hUnknown:"Not checked yet",
      aiSuggest:"AI category suggestions",
      suggSub:"Based on title, URL, domain and description. Nothing changes until you apply.",
      suggesting:"Analyzing bookmarks…", suggNone:"No suggestions — your bookmarks already look tidy.",
      suggApply:"Apply selected", suggApplied:"{n} bookmarks updated", suggToggle:"Toggle all",
      aiSection:"AI suggestions", aiProvider:"Suggestion engine", aiLocal:"Local rules",
      aiKeyPh:"API key (stored only on this device)",
      aiKeyDesc:"Optional: use Claude or OpenAI for smarter suggestions. The key is stored locally and sent only to the chosen API.",
      aiFailed:"AI request failed — using local rules instead"
    },
    zh:{
      trash:"回收站", trashSub:"已删除的书签会保留在这里，到期后自动清除。", trashEmptyMsg:"回收站是空的。",
      restore:"恢复", deleteForever:"永久删除", emptyTrash:"清空回收站",
      emptyTrashMsg:"永久删除回收站中的全部 {n} 个书签？", trashEmptied:"回收站已清空",
      retention:"删除项保留时长", retImmediate:"立即删除", retDays:"{n} 天",
      movedToTrash:"已移入回收站", movedNToTrash:"已将 {n} 个书签移入回收站",
      undo:"撤销", undone:"已撤销", expDays:"剩 {d} 天", expToday:"今天到期", restored:"书签已恢复",
      healthCheck:"检查链接有效性", healthRunning:"正在检查链接…可能需要一点时间", healthBusy:"已有检查正在进行",
      healthDone:"检查完成：{ok} 正常 · {warn} 存疑 · {bad} 失效",
      hOk:"链接正常 · {ago}检查", hBad:"链接疑似失效 · {ago}检查", hWarn:"链接可能异常 · {ago}检查", hUnknown:"尚未检查",
      aiSuggest:"AI 分类建议",
      suggSub:"根据标题、URL、域名和描述生成；应用前不会修改任何书签。",
      suggesting:"正在分析书签…", suggNone:"没有可用建议 —— 书签看起来已经很整齐。",
      suggApply:"应用所选", suggApplied:"已更新 {n} 个书签", suggToggle:"全选/全不选",
      aiSection:"AI 建议", aiProvider:"建议引擎", aiLocal:"本地规则",
      aiKeyPh:"API Key（只保存在本机）",
      aiKeyDesc:"可选：填入 Claude 或 OpenAI 的 Key 获得更智能的建议；Key 仅保存在本地，只发送给所选 API。",
      aiFailed:"AI 请求失败，已回退到本地规则"
    },
    es:{
      trash:"Papelera", trashSub:"Los marcadores eliminados se guardan aquí hasta caducar.", trashEmptyMsg:"La papelera está vacía.",
      restore:"Restaurar", deleteForever:"Eliminar definitivamente", emptyTrash:"Vaciar papelera",
      emptyTrashMsg:"¿Eliminar permanentemente los {n} marcadores de la papelera?", trashEmptied:"Papelera vaciada",
      retention:"Conservar eliminados", retImmediate:"Eliminar de inmediato", retDays:"{n} días",
      movedToTrash:"Movido a la papelera", movedNToTrash:"{n} marcadores movidos a la papelera",
      undo:"Deshacer", undone:"Acción deshecha", expDays:"quedan {d} d", expToday:"caduca hoy", restored:"Marcador restaurado",
      healthCheck:"Comprobar enlaces", healthRunning:"Comprobando enlaces…", healthBusy:"Ya hay una comprobación en curso",
      healthDone:"Comprobación: {ok} OK · {warn} dudosos · {bad} rotos",
      hOk:"Enlace OK · {ago}", hBad:"Enlace roto · {ago}", hWarn:"Enlace dudoso · {ago}", hUnknown:"Sin comprobar",
      aiSuggest:"Sugerencias de categorías (IA)",
      suggSub:"Basadas en título, URL, dominio y descripción. Nada cambia hasta que apliques.",
      suggesting:"Analizando marcadores…", suggNone:"Sin sugerencias: tus marcadores ya están ordenados.",
      suggApply:"Aplicar seleccionadas", suggApplied:"{n} marcadores actualizados", suggToggle:"Alternar todo",
      aiSection:"Sugerencias IA", aiProvider:"Motor de sugerencias", aiLocal:"Reglas locales",
      aiKeyPh:"Clave API (solo en este dispositivo)",
      aiKeyDesc:"Opcional: usa Claude u OpenAI para mejores sugerencias. La clave se guarda localmente.",
      aiFailed:"Error de IA: se usaron reglas locales"
    }
  };
  Object.keys(extra).forEach(function(k){ if(I18N[k]) Object.assign(I18N[k], extra[k]); });
})();
