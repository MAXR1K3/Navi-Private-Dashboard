/* i18n.js — 多语言文案与 t() 翻译函数 */
"use strict";

/* ===== i18n ===== */
var I18N = {
  en:{
    customizeTitle:"Customize name & logo", searchPh:"Search bookmarks…", theme:"Toggle theme", view:"Grid / list",
    select:"Select", import:"Import", add:"Add", settings:"Settings", more:"More",
    hideWidgets:"Hide widgets", showWidgets:"Show widgets", exportBm:"Export bookmarks", summarizeMissing:"Summarize descriptions", summariesDone:"Descriptions updated for {n} bookmark(s)", newCategory:"New category", clearAll:"Clear everything",
    dataBackup:"Data & backup", exportJsonLabel:"Export bookmarks.json", exportJsonDesc:"Download a full JSON backup (bookmarks, categories, settings)", exportBtn:"Export", importJsonLabel:"Import bookmarks.json", importJsonDesc:"Restore from a JSON backup file (replaces current data)", importBtnLabel:"Import", restorePrevLabel:"Restore previous version", restorePrevDesc:"Revert to the snapshot saved before the last import/restore", restoreBtn:"Restore",
    backupExported:"Backup exported", backupImported:"Imported {n} bookmark(s)", backupInvalid:"Not a valid bookmarks.json file", noPrevBackup:"No previous version saved yet", prevRestored:"Previous version restored",
    importJsonTitle:"Import backup", importJsonMsg:"Replace your current data with this backup ({n} bookmark(s))? A snapshot of your current data is kept so you can restore it.", importJsonOk:"Import", restorePrevTitle:"Restore previous version", restorePrevMsg:"Revert to the snapshot saved before your last import/restore?", restorePrevOk:"Restore",
    tagline:"Private bookmark dashboard", dashboard:"Dashboard", customize:"Customize",
    webSearch:"Web search", weather:"Weather", calendar:"Calendar", frequentlyUsed:"Frequently used", recentlyOpened:"Recently opened", clock:"Clock",
    ipLocation:"IP & location", ipISP:"ISP", ipError:"Couldn’t load IP info.", ipUnknown:"Unknown location", ipWidget:"IP & location", ipWidgetDesc:"Show your public IP and approximate location",
    goodMorning:"Good morning", goodAfternoon:"Good afternoon", goodEvening:"Good evening", goodNight:"Good night",
    searchGooglePh:"Search Google…", searchWebPh:"Search the web…", searchHint:"Press Enter to search with {engine} in a new tab.",
    setLocation:"Set a location to see local weather.", enterCity:"Enter a city…", setBtn:"Set", useMyLocation:"Use my location",
    couldntLoad:"Couldn’t load weather.", retry:"Retry", orEnterCity:"Or enter a city…", wind:"Wind", humidity:"Humidity",
    weatherSetTo:"Weather set to {city}", cityNotFound:"City not found", couldntLookup:"Couldn’t look up that city", forecast7:"7-day forecast", changeArea:"Change area", areaSearch:"Area search", searchArea:"Search", searchingArea:"Searching areas…", close:"Close",
    today:"Today", smaller:"Smaller", larger:"Larger", dragReorderW:"Drag to reorder",
    frequentEmpty:"Open your bookmarks and your most-used pages show up here.", recentEmpty:"Pages you open will appear here, most recent first.",
    justNow:"just now", dragReorder:"Drag cards to reorder",
    emptyTitle:"Your dashboard is empty", emptyDesc:"Add your first bookmark or import an exported browser file to get started.",
    addFirst:"+ Add bookmark", importFile:"Import a file", nothingHere:"Nothing here", noMatch:"No bookmarks match your search.", noInCat:"No bookmarks in this category yet.", addBookmarkBtn:"+ Add bookmark",
    addBookmark:"Add bookmark", editBookmark:"Edit bookmark", bmSub:"Save a page to your dashboard.",
    urlLabel:"URL", titleLabel:"Title", titlePh:"Auto-filled from the URL", catLabel:"Category", descLabel:"Description", descPh:"Add a note, or click Auto to summarize", autoBtn:"Auto",
    saveBookmark:"Save bookmark", saveChanges:"Save changes", cancel:"Cancel", save:"Save", delete:"Delete", done:"Done",
    renameCat:"Rename “{cat}”", deleteBookmark:"Delete bookmark", deleteBmMsg:"Remove “{name}” from your dashboard?",
    bookmarkOptions:"Bookmark options", pinBookmark:"Keep this bookmark position", pinBookmarkDesc:"Ignore browser sync order for this bookmark.", unpinBookmark:"Follow browser sync order",
    categorySettings:"Category settings", categorySettingsSaved:"Category settings saved", pinCategory:"Keep this category position", pinCategoryDesc:"Ignore browser sync order for this category.", unpinCategory:"Follow browser sync order", categoryColor:"Category name color", categoryColorDesc:"Optional. Only changes the displayed name color.", categoryColorReset:"Default",
    healthMenu:"Link status", healthSetOk:"Mark as valid", healthSetWarn:"Mark as uncertain", healthSetBad:"Mark as invalid", healthSetUnknown:"Clear manual status", healthManual:"Manual", healthManualDesc:"Manually override the detected link status.", linkStatusAuto:"Auto / not checked",
    statusUpdated:"Link status updated",
    deleteCategory:"Delete category", delCatMove:"Move {n} bookmark(s) to “Uncategorized” and remove this category?", delCatEmpty:"Remove this empty category?",
    deleteNTitle:"Delete {n} bookmark(s)", deleteNMsg:"This will permanently remove the selected items.", deleteN:"Delete {n}",
    clearTitle:"Clear everything", clearMsg:"This permanently deletes all bookmarks and categories. This cannot be undone.", deleteAll:"Delete all",
    uncategorized:"Uncategorized", selected:"selected", selectAll:"Select all", clear:"Clear",
    settingsTitle:"Settings", settingsSub:"Personalize your dashboard.", appearance:"Appearance", language:"Language",
    pageName:"Page name", subtitle:"Subtitle", logo:"Logo", logoDesc:"PNG, JPG, SVG or GIF (animated) — replaces the icon", upload:"Upload",
    lowPower:"Low power mode", lowPowerDesc:"Pause decorative effects while browsing",
    motionProfile:"Motion profile", motionProfileDesc:"Choose battery-first or smooth low-cost animation", motionLow:"Low power", motionSmooth:"Smooth",
    animations:"Page animations", animationsDesc:"Smooth entrances and transitions",
    autoTheme:"Auto theme", autoThemeDesc:"Switch dark/light by local sunrise & sunset",
    hideHeader:"Hide top bar on scroll", hideHeaderDesc:"Tuck the top bar away when scrolling down; show it again on scroll up",
    glassEffect:"Liquid glass", glassEffectDesc:"Frosted, translucent panels",
    glassOpacity:"Glass opacity", glassOpacityDesc:"Lower = more see-through", glassRefract:"Glass sheen", glassRefractDesc:"A soft light sheen across panels",
    background:"Background", bgStyle:"Style", bgGradient:"Gradient", bgImage:"Image", bgImageDesc:"Use your own photo as wallpaper", bgLive:"Live", bgWallpaper:"Wallpaper", bgShuffle:"Shuffle", bgShuffled:"New wallpaper loaded", wpSource:"Wallpaper source", wpRotate:"Auto change", wpRotateOff:"Off", wpRotate15:"15 min", wpRotate30:"30 min", wpRotate60:"1 hour", wpRotate180:"3 hours", wpRotate360:"6 hours", wpRotate1440:"Daily",
    wpNature:"Nature", wpCity:"City", wpArchitecture:"Architecture", wpLandscape:"Landscape", wpSpace:"Space", wpOcean:"Ocean", wpMinimal:"Minimal", wpAnimals:"Animals",
    bgImageSet:"Background updated", bgImageReset:"Background reset", bgTooLarge:"Image too large to save — try a smaller one",
    bgDownloadWallpaper:"Download current wallpaper", bgDownloadWallpaperDesc:"Save the online wallpaper currently shown.", bgDownloadWallpaperBtn:"Download", bgDownloadWallpaperOk:"Wallpaper downloaded", bgDownloadWallpaperFallback:"Opened the wallpaper image so you can save it.", bgDownloadWallpaperUnavailable:"Switch to online wallpaper first.",
    widgetsSec:"Widgets", showSeconds:"Show seconds", showSecondsDesc:"Display seconds on the clock", clock24h:"24-hour time", clock24hDesc:"Show the clock in 24-hour format instead of AM/PM", showHolidays:"Show holidays", showHolidaysDesc:"Mark common public holidays in the calendar",
    googleSearch:"Google search", weatherDesc:"Uses your location or a city you set", frequentDesc:"Your most-opened bookmarks",
    categoriesSec:"Categories", categoryStyle:"Category style", layoutTabs:"Tabs", layoutDrawer:"Drawer", layoutDropdown:"Dropdown", categoriesTitle:"Categories",
    importTitle:"Import browser bookmarks", importSub:"Select a bookmarks file exported from Chrome, Edge, Firefox, Safari, Brave or Arc (an .html file).",
    dzClick:"Click to choose a file", dzDrop:"or drop it here", mergeWith:"Merge with existing", replaceAll:"Replace everything",
    bookmarksFound:"Bookmarks found", categoriesN:"Categories", newToAdd:"New to add", total:"Total", importN:"Import {n} bookmark(s)",
    foldersBecome:"Folders from your file become categories.", dupSkipped:"{n} duplicate(s) will be skipped.", reviewConfirm:"Review and confirm below.",
    bookmarkAdded:"Bookmark added", bookmarkUpdated:"Bookmark updated", bookmarkDeleted:"Bookmark deleted",
    categoryRenamed:"Category renamed", categoryDeleted:"Category deleted", categoryInvalid:"Use a unique category name that is not ‘All’", allCleared:"All bookmarks cleared",
    logoUpdated:"Logo updated", logoReset:"Logo reset", logoTooBig:"Image is too large (max ~2 MB).", pleaseUrl:"Please enter a URL", invalidUrl:"Please enter a valid http(s) URL", nothingToExport:"Nothing to export",
    noBookmarksFile:"No bookmarks found in that file", couldntRead:"Couldn’t read that file",
    importedToast:"Imported {a} bookmark(s)", importedSkip:" · skipped {s} duplicate(s)", exportedToast:"Exported {n} bookmarks",
    autoFetching:"Fetching page…", autoOk:"Description added from the page", autoFallback:"Couldn’t read the page (often blocked) — added a basic summary", couldntImage:"Couldn’t load that image", chooseImage:"Please choose an image",
    chromeSync:"Chrome Sync", chromeSyncSec:"Sync bookmarks from your Google account via Chrome.",
    chromeSyncReplace:"Replace on sync", chromeSyncReplaceDesc:"Match the import “Replace everything” rule while reusing unchanged bookmarks where possible.",
    syncNow:"Sync now", syncing:"Syncing…", syncedCount:"Synced {n} bookmarks", browserSyncDone:"Synced {n} bookmarks · +{a} updated {u} removed {r}", lastSynced:"Synced {t} ago", neverSynced:"Not yet synced",
    catBookmarksBar:"Bookmarks bar", catOtherBookmarks:"Other bookmarks", catMobileBookmarks:"Mobile bookmarks",
    notExtension:"Open as Chrome extension to enable.", extensionSetup:"Extension setup guide",
    chromeSyncEnabled:"Chrome sync enabled", chromeSyncDisabled:"Chrome sync disabled", chromeSyncError:"Sync failed",
    autoSyncDesc:"Auto-syncs every 30 min while active"
  },
  zh:{
    customizeTitle:"自定义名称和图标", searchPh:"搜索书签…", theme:"切换主题", view:"网格 / 列表",
    select:"选择", import:"导入", add:"添加", settings:"设置", more:"更多",
    hideWidgets:"隐藏小组件", showWidgets:"显示小组件", exportBm:"导出书签", summarizeMissing:"生成描述摘要", summariesDone:"已更新 {n} 个书签描述", newCategory:"新建分类", clearAll:"清除全部",
    dataBackup:"数据与备份", exportJsonLabel:"导出 bookmarks.json", exportJsonDesc:"下载完整 JSON 备份（书签、分类、设置）", exportBtn:"导出", importJsonLabel:"导入 bookmarks.json", importJsonDesc:"从 JSON 备份文件恢复（会替换当前数据）", importBtnLabel:"导入", restorePrevLabel:"恢复上一个版本", restorePrevDesc:"回到上次导入/恢复前保存的快照", restoreBtn:"恢复",
    backupExported:"已导出备份", backupImported:"已导入 {n} 个书签", backupInvalid:"不是有效的 bookmarks.json 文件", noPrevBackup:"还没有可恢复的上一个版本", prevRestored:"已恢复上一个版本",
    importJsonTitle:"导入备份", importJsonMsg:"用该备份替换当前数据（{n} 个书签）？会先保存当前数据的快照，可随时恢复。", importJsonOk:"导入", restorePrevTitle:"恢复上一个版本", restorePrevMsg:"回到上次导入/恢复前保存的快照？", restorePrevOk:"恢复",
    tagline:"私人书签面板", dashboard:"仪表板", customize:"自定义",
    webSearch:"网页搜索", weather:"天气", calendar:"日历", frequentlyUsed:"常用", recentlyOpened:"最近打开", clock:"时钟",
    ipLocation:"IP 与位置", ipISP:"运营商", ipError:"无法获取 IP 信息。", ipUnknown:"位置未知", ipWidget:"IP 与位置", ipWidgetDesc:"显示你的公网 IP 与大致位置",
    goodMorning:"早上好", goodAfternoon:"下午好", goodEvening:"晚上好", goodNight:"晚安",
    searchGooglePh:"用 Google 搜索…", searchWebPh:"搜索网页…", searchHint:"按回车在新标签页使用 {engine} 搜索。",
    setLocation:"设置位置以查看本地天气。", enterCity:"输入城市…", setBtn:"设置", useMyLocation:"使用我的位置",
    couldntLoad:"无法加载天气。", retry:"重试", orEnterCity:"或输入城市…", wind:"风速", humidity:"湿度",
    weatherSetTo:"天气已设为 {city}", cityNotFound:"未找到城市", couldntLookup:"无法查询该城市", forecast7:"7 日预报", changeArea:"切换地区", areaSearch:"地区查询", searchArea:"查询", searchingArea:"正在查询地区…", close:"关闭",
    today:"今天", smaller:"缩小", larger:"放大", dragReorderW:"拖动以重新排序",
    frequentEmpty:"打开书签后，最常用的页面会显示在这里。", recentEmpty:"你打开的页面会显示在这里（最新在前）。",
    justNow:"刚刚", dragReorder:"拖动卡片重新排序",
    emptyTitle:"你的面板是空的", emptyDesc:"添加第一个书签，或导入浏览器导出的文件开始使用。",
    addFirst:"+ 添加书签", importFile:"导入文件", nothingHere:"这里什么都没有", noMatch:"没有匹配的书签。", noInCat:"此分类暂无书签。", addBookmarkBtn:"+ 添加书签",
    addBookmark:"添加书签", editBookmark:"编辑书签", bmSub:"将网页保存到面板。",
    urlLabel:"网址", titleLabel:"标题", titlePh:"自动从网址填充", catLabel:"分类", descLabel:"描述", descPh:"添加备注，或点击“自动”生成摘要", autoBtn:"自动",
    saveBookmark:"保存书签", saveChanges:"保存更改", cancel:"取消", save:"保存", delete:"删除", done:"完成",
    renameCat:"重命名“{cat}”", deleteBookmark:"删除书签", deleteBmMsg:"从面板中移除“{name}”？",
    bookmarkOptions:"书签选项", pinBookmark:"固定此书签位置", pinBookmarkDesc:"此书签不再跟随浏览器同步顺序移动。", unpinBookmark:"跟随浏览器同步顺序",
    categorySettings:"分类设置", categorySettingsSaved:"分类设置已保存", pinCategory:"固定此分类位置", pinCategoryDesc:"此分类不再跟随浏览器同步顺序移动。", unpinCategory:"跟随浏览器同步顺序", categoryColor:"分类名称颜色", categoryColorDesc:"可选，仅改变分类名称的显示颜色。", categoryColorReset:"默认",
    healthMenu:"链接状态", healthSetOk:"标记为有效", healthSetWarn:"标记为存疑", healthSetBad:"标记为无效", healthSetUnknown:"清除手动状态", healthManual:"手动", healthManualDesc:"手动覆盖自动检测到的链接状态。", linkStatusAuto:"自动 / 未检查",
    statusUpdated:"链接状态已更新",
    deleteCategory:"删除分类", delCatMove:"将 {n} 个书签移到“未分类”并删除此分类？", delCatEmpty:"删除这个空分类？",
    deleteNTitle:"删除 {n} 个书签", deleteNMsg:"这将永久删除所选项目。", deleteN:"删除 {n} 个",
    clearTitle:"清除全部", clearMsg:"这将永久删除所有书签和分类，且无法撤销。", deleteAll:"全部删除",
    uncategorized:"未分类", selected:"已选", selectAll:"全选", clear:"清除",
    settingsTitle:"设置", settingsSub:"个性化你的面板。", appearance:"外观", language:"语言",
    pageName:"页面名称", subtitle:"副标题", logo:"图标", logoDesc:"PNG、JPG、SVG 或 GIF（支持动图）—— 替换图标", upload:"上传",
    lowPower:"低功耗模式", lowPowerDesc:"浏览时暂停装饰动画和高开销磨砂效果",
    motionProfile:"动效模式", motionProfileDesc:"选择优先省电，或启用低开销丝滑动效", motionLow:"低功耗", motionSmooth:"丝滑动效",
    animations:"页面动画", animationsDesc:"平滑的入场和过渡",
    autoTheme:"自动主题", autoThemeDesc:"根据当地日出日落自动切换深浅色",
    hideHeader:"下滑隐藏顶栏", hideHeaderDesc:"向下滚动时收起顶栏，向上滚动时再显示",
    glassEffect:"液态玻璃", glassEffectDesc:"磨砂半透明面板",
    glassOpacity:"玻璃不透明度", glassOpacityDesc:"越低越通透", glassRefract:"玻璃光泽", glassRefractDesc:"面板上的柔和光泽",
    background:"背景", bgStyle:"样式", bgGradient:"渐变", bgImage:"图片", bgImageDesc:"使用你自己的照片作为壁纸", bgLive:"动态", bgWallpaper:"在线壁纸", bgShuffle:"换一张", bgShuffled:"已换一张壁纸", wpSource:"壁纸来源", wpRotate:"定时换图", wpRotateOff:"关闭", wpRotate15:"15 分钟", wpRotate30:"30 分钟", wpRotate60:"1 小时", wpRotate180:"3 小时", wpRotate360:"6 小时", wpRotate1440:"每天",
    wpNature:"自然", wpCity:"城市", wpArchitecture:"建筑", wpLandscape:"风景", wpSpace:"太空", wpOcean:"海洋", wpMinimal:"极简", wpAnimals:"动物",
    bgImageSet:"背景已更新", bgImageReset:"背景已重置", bgTooLarge:"图片太大，无法保存 —— 请换一张更小的",
    bgDownloadWallpaper:"下载当前壁纸", bgDownloadWallpaperDesc:"保存当前正在显示的在线壁纸。", bgDownloadWallpaperBtn:"下载", bgDownloadWallpaperOk:"壁纸已下载", bgDownloadWallpaperFallback:"已打开原图，可在浏览器中保存。", bgDownloadWallpaperUnavailable:"请先切换到在线壁纸。",
    widgetsSec:"小组件", showSeconds:"显示秒", showSecondsDesc:"在时钟上显示秒", clock24h:"24 小时制", clock24hDesc:"以 24 小时制显示时钟（不显示上午/下午）", showHolidays:"显示节假日", showHolidaysDesc:"在日历中标记常见公共节假日",
    googleSearch:"Google 搜索", weatherDesc:"使用你的位置或设定的城市", frequentDesc:"你最常打开的书签",
    categoriesSec:"分类", categoryStyle:"分类样式", layoutTabs:"标签", layoutDrawer:"抽屉", layoutDropdown:"下拉", categoriesTitle:"分类",
    importTitle:"导入浏览器书签", importSub:"选择从 Chrome、Edge、Firefox、Safari、Brave 或 Arc 导出的书签文件（.html）。",
    dzClick:"点击选择文件", dzDrop:"或拖放到此处", mergeWith:"与现有合并", replaceAll:"替换全部",
    bookmarksFound:"找到的书签", categoriesN:"分类", newToAdd:"新增", total:"总计", importN:"导入 {n} 个书签",
    foldersBecome:"文件中的文件夹将成为分类。", dupSkipped:"将跳过 {n} 个重复项。", reviewConfirm:"在下方查看并确认。",
    bookmarkAdded:"已添加书签", bookmarkUpdated:"已更新书签", bookmarkDeleted:"已删除书签",
    categoryRenamed:"已重命名分类", categoryDeleted:"已删除分类", categoryInvalid:"请使用唯一的分类名，且不要命名为“全部/All”", allCleared:"已清除所有书签",
    logoUpdated:"已更新图标", logoReset:"已重置图标", logoTooBig:"图片太大（最大约 2 MB）。", pleaseUrl:"请输入网址", invalidUrl:"请输入有效的 http(s) 网址", nothingToExport:"没有可导出的内容",
    noBookmarksFile:"文件中未找到书签", couldntRead:"无法读取该文件",
    importedToast:"已导入 {a} 个书签", importedSkip:" · 跳过 {s} 个重复项", exportedToast:"已导出 {n} 个书签",
    autoFetching:"正在获取页面…", autoOk:"已从页面添加描述", autoFallback:"无法读取页面（常被拦截）—— 已添加基本摘要", couldntImage:"无法加载该图片", chooseImage:"请选择一张图片",
    chromeSync:"Chrome 同步", chromeSyncSec:"通过 Chrome 同步您 Google 账户中的书签。",
    chromeSyncReplace:"同步时替换全部", chromeSyncReplaceDesc:"规则与导入里的“替换全部”一致，但会尽量复用未变化的书签，只同步差异。",
    syncNow:"立即同步", syncing:"同步中…", syncedCount:"已同步 {n} 个书签", browserSyncDone:"已同步 {n} 个书签 · 新增 {a}，更新 {u}，移除 {r}", lastSynced:"{t}前已同步", neverSynced:"尚未同步",
    catBookmarksBar:"书签栏", catOtherBookmarks:"其他书签", catMobileBookmarks:"移动设备书签",
    notExtension:"以 Chrome 扩展方式运行才可启用。", extensionSetup:"扩展安装指南",
    chromeSyncEnabled:"Chrome 同步已启用", chromeSyncDisabled:"Chrome 同步已关闭", chromeSyncError:"同步失败",
    autoSyncDesc:"活跃时每 30 分钟自动同步"
  },
  es:{
    customizeTitle:"Personalizar nombre y logo", searchPh:"Buscar marcadores…", theme:"Cambiar tema", view:"Cuadrícula / lista",
    select:"Seleccionar", import:"Importar", add:"Añadir", settings:"Ajustes", more:"Más",
    hideWidgets:"Ocultar widgets", showWidgets:"Mostrar widgets", exportBm:"Exportar marcadores", summarizeMissing:"Resumir descripciones", summariesDone:"Descripciones actualizadas para {n} marcador(es)", newCategory:"Nueva categoría", clearAll:"Borrar todo",
    dataBackup:"Datos y copia de seguridad", exportJsonLabel:"Exportar bookmarks.json", exportJsonDesc:"Descarga una copia JSON completa (marcadores, categorías, ajustes)", exportBtn:"Exportar", importJsonLabel:"Importar bookmarks.json", importJsonDesc:"Restaurar desde un archivo JSON (reemplaza los datos actuales)", importBtnLabel:"Importar", restorePrevLabel:"Restaurar versión anterior", restorePrevDesc:"Volver a la instantánea previa a la última importación/restauración", restoreBtn:"Restaurar",
    backupExported:"Copia exportada", backupImported:"{n} marcador(es) importados", backupInvalid:"No es un archivo bookmarks.json válido", noPrevBackup:"Aún no hay versión anterior guardada", prevRestored:"Versión anterior restaurada",
    importJsonTitle:"Importar copia", importJsonMsg:"¿Reemplazar los datos actuales con esta copia ({n} marcadores)? Se guarda una instantánea para poder restaurarla.", importJsonOk:"Importar", restorePrevTitle:"Restaurar versión anterior", restorePrevMsg:"¿Volver a la instantánea previa a la última importación/restauración?", restorePrevOk:"Restaurar",
    tagline:"Panel privado de marcadores", dashboard:"Panel", customize:"Personalizar",
    webSearch:"Búsqueda web", weather:"Clima", calendar:"Calendario", frequentlyUsed:"Más usados", recentlyOpened:"Abiertos recientemente", clock:"Reloj",
    ipLocation:"IP y ubicación", ipISP:"ISP", ipError:"No se pudo cargar la info de IP.", ipUnknown:"Ubicación desconocida", ipWidget:"IP y ubicación", ipWidgetDesc:"Muestra tu IP pública y ubicación aproximada",
    goodMorning:"Buenos días", goodAfternoon:"Buenas tardes", goodEvening:"Buenas noches", goodNight:"Buenas noches",
    searchGooglePh:"Buscar en Google…", searchWebPh:"Buscar en la web…", searchHint:"Pulsa Enter para buscar con {engine} en una pestaña nueva.",
    setLocation:"Define una ubicación para ver el clima local.", enterCity:"Escribe una ciudad…", setBtn:"Definir", useMyLocation:"Usar mi ubicación",
    couldntLoad:"No se pudo cargar el clima.", retry:"Reintentar", orEnterCity:"O escribe una ciudad…", wind:"Viento", humidity:"Humedad",
    weatherSetTo:"Clima configurado para {city}", cityNotFound:"Ciudad no encontrada", couldntLookup:"No se pudo buscar esa ciudad", forecast7:"Previsión 7 días", changeArea:"Cambiar zona", areaSearch:"Buscar zona", searchArea:"Buscar", searchingArea:"Buscando zonas…", close:"Cerrar",
    today:"Hoy", smaller:"Reducir", larger:"Ampliar", dragReorderW:"Arrastra para reordenar",
    frequentEmpty:"Abre tus marcadores y aquí verás los más usados.", recentEmpty:"Las páginas que abras aparecerán aquí, las más recientes primero.",
    justNow:"ahora", dragReorder:"Arrastra las tarjetas para reordenar",
    emptyTitle:"Tu panel está vacío", emptyDesc:"Añade tu primer marcador o importa un archivo del navegador para empezar.",
    addFirst:"+ Añadir marcador", importFile:"Importar un archivo", nothingHere:"Nada por aquí", noMatch:"Ningún marcador coincide con tu búsqueda.", noInCat:"Aún no hay marcadores en esta categoría.", addBookmarkBtn:"+ Añadir marcador",
    addBookmark:"Añadir marcador", editBookmark:"Editar marcador", bmSub:"Guarda una página en tu panel.",
    urlLabel:"URL", titleLabel:"Título", titlePh:"Se completa desde la URL", catLabel:"Categoría", descLabel:"Descripción", descPh:"Añade una nota o pulsa Auto para resumir", autoBtn:"Auto",
    saveBookmark:"Guardar marcador", saveChanges:"Guardar cambios", cancel:"Cancelar", save:"Guardar", delete:"Eliminar", done:"Listo",
    renameCat:"Renombrar «{cat}»", deleteBookmark:"Eliminar marcador", deleteBmMsg:"¿Quitar «{name}» de tu panel?",
    bookmarkOptions:"Opciones del marcador", pinBookmark:"Mantener posición del marcador", pinBookmarkDesc:"Ignora el orden sincronizado del navegador para este marcador.", unpinBookmark:"Seguir orden del navegador",
    categorySettings:"Ajustes de categoría", categorySettingsSaved:"Ajustes de categoría guardados", pinCategory:"Mantener posición de categoría", pinCategoryDesc:"Ignora el orden sincronizado del navegador para esta categoría.", unpinCategory:"Seguir orden del navegador", categoryColor:"Color del nombre", categoryColorDesc:"Opcional. Solo cambia el color del nombre mostrado.", categoryColorReset:"Predeterminado",
    healthMenu:"Estado del enlace", healthSetOk:"Marcar como válido", healthSetWarn:"Marcar como dudoso", healthSetBad:"Marcar como inválido", healthSetUnknown:"Borrar estado manual", healthManual:"Manual", healthManualDesc:"Sobrescribe manualmente el estado detectado del enlace.", linkStatusAuto:"Auto / sin comprobar",
    statusUpdated:"Estado del enlace actualizado",
    deleteCategory:"Eliminar categoría", delCatMove:"¿Mover {n} marcador(es) a «Sin categoría» y eliminar esta categoría?", delCatEmpty:"¿Eliminar esta categoría vacía?",
    deleteNTitle:"Eliminar {n} marcador(es)", deleteNMsg:"Esto eliminará permanentemente los elementos seleccionados.", deleteN:"Eliminar {n}",
    clearTitle:"Borrar todo", clearMsg:"Esto elimina permanentemente todos los marcadores y categorías. No se puede deshacer.", deleteAll:"Eliminar todo",
    uncategorized:"Sin categoría", selected:"seleccionados", selectAll:"Seleccionar todo", clear:"Limpiar",
    settingsTitle:"Ajustes", settingsSub:"Personaliza tu panel.", appearance:"Apariencia", language:"Idioma",
    pageName:"Nombre de la página", subtitle:"Subtítulo", logo:"Logo", logoDesc:"PNG, JPG, SVG o GIF (animado): reemplaza el icono", upload:"Subir",
    lowPower:"Modo de bajo consumo", lowPowerDesc:"Pausa efectos decorativos mientras navegas",
    motionProfile:"Perfil de movimiento", motionProfileDesc:"Elige ahorro de batería o animación fluida eficiente", motionLow:"Bajo consumo", motionSmooth:"Fluido",
    animations:"Animaciones", animationsDesc:"Entradas y transiciones suaves",
    autoTheme:"Tema automático", autoThemeDesc:"Cambia claro/oscuro según amanecer y atardecer local",
    hideHeader:"Ocultar barra al desplazar", hideHeaderDesc:"Oculta la barra superior al bajar; reaparece al subir",
    glassEffect:"Cristal líquido", glassEffectDesc:"Paneles translúcidos esmerilados",
    glassOpacity:"Opacidad del cristal", glassOpacityDesc:"Menor = más transparente", glassRefract:"Brillo del cristal", glassRefractDesc:"Un brillo de luz suave en los paneles",
    background:"Fondo", bgStyle:"Estilo", bgGradient:"Degradado", bgImage:"Imagen", bgImageDesc:"Usa tu propia foto como fondo", bgLive:"Dinámico", bgWallpaper:"Wallpaper", bgShuffle:"Cambiar", bgShuffled:"Nuevo fondo cargado", wpSource:"Fuente", wpRotate:"Cambio automático", wpRotateOff:"Desactivado", wpRotate15:"15 min", wpRotate30:"30 min", wpRotate60:"1 hora", wpRotate180:"3 horas", wpRotate360:"6 horas", wpRotate1440:"Diario",
    wpNature:"Naturaleza", wpCity:"Ciudad", wpArchitecture:"Arquitectura", wpLandscape:"Paisaje", wpSpace:"Espacio", wpOcean:"Océano", wpMinimal:"Minimalista", wpAnimals:"Animales",
    bgImageSet:"Fondo actualizado", bgImageReset:"Fondo restablecido", bgTooLarge:"Imagen demasiado grande para guardar — prueba una más pequeña",
    bgDownloadWallpaper:"Descargar fondo actual", bgDownloadWallpaperDesc:"Guarda el wallpaper online mostrado ahora.", bgDownloadWallpaperBtn:"Descargar", bgDownloadWallpaperOk:"Fondo descargado", bgDownloadWallpaperFallback:"Se abrió la imagen para que puedas guardarla.", bgDownloadWallpaperUnavailable:"Activa primero el wallpaper online.",
    widgetsSec:"Widgets", showSeconds:"Mostrar segundos", showSecondsDesc:"Mostrar los segundos en el reloj", clock24h:"Formato 24 horas", clock24hDesc:"Mostrar el reloj en formato 24 h en vez de AM/PM", showHolidays:"Mostrar festivos", showHolidaysDesc:"Marca festivos públicos comunes en el calendario",
    googleSearch:"Búsqueda de Google", weatherDesc:"Usa tu ubicación o una ciudad", frequentDesc:"Tus marcadores más abiertos",
    categoriesSec:"Categorías", categoryStyle:"Estilo de categorías", layoutTabs:"Pestañas", layoutDrawer:"Cajón", layoutDropdown:"Desplegable", categoriesTitle:"Categorías",
    importTitle:"Importar marcadores del navegador", importSub:"Selecciona un archivo de marcadores exportado de Chrome, Edge, Firefox, Safari, Brave o Arc (.html).",
    dzClick:"Haz clic para elegir un archivo", dzDrop:"o suéltalo aquí", mergeWith:"Combinar con los existentes", replaceAll:"Reemplazar todo",
    bookmarksFound:"Marcadores encontrados", categoriesN:"Categorías", newToAdd:"Nuevos", total:"Total", importN:"Importar {n} marcador(es)",
    foldersBecome:"Las carpetas del archivo se convierten en categorías.", dupSkipped:"Se omitirán {n} duplicado(s).", reviewConfirm:"Revisa y confirma abajo.",
    bookmarkAdded:"Marcador añadido", bookmarkUpdated:"Marcador actualizado", bookmarkDeleted:"Marcador eliminado",
    categoryRenamed:"Categoría renombrada", categoryDeleted:"Categoría eliminada", categoryInvalid:"Usa un nombre de categoría único que no sea ‘All’", allCleared:"Se borraron todos los marcadores",
    logoUpdated:"Logo actualizado", logoReset:"Logo restablecido", logoTooBig:"La imagen es demasiado grande (máx. ~2 MB).", pleaseUrl:"Introduce una URL", invalidUrl:"Introduce una URL http(s) válida", nothingToExport:"Nada para exportar",
    noBookmarksFile:"No se encontraron marcadores en ese archivo", couldntRead:"No se pudo leer ese archivo",
    importedToast:"Importados {a} marcador(es)", importedSkip:" · {s} duplicado(s) omitido(s)", exportedToast:"Exportados {n} marcadores",
    autoFetching:"Obteniendo página…", autoOk:"Descripción añadida desde la página", autoFallback:"No se pudo leer la página (a menudo bloqueada): se añadió un resumen básico", couldntImage:"No se pudo cargar esa imagen", chooseImage:"Elige una imagen",
    chromeSync:"Sincronización Chrome", chromeSyncSec:"Sincroniza marcadores de tu cuenta Google mediante Chrome.",
    chromeSyncReplace:"Reemplazar al sincronizar", chromeSyncReplaceDesc:"Usa la regla “Reemplazar todo” pero reutiliza los marcadores sin cambios cuando sea posible.",
    syncNow:"Sincronizar ahora", syncing:"Sincronizando…", syncedCount:"Sincronizados {n} marcadores", browserSyncDone:"{n} marcadores sincronizados · +{a} actualizados {u} quitados {r}", lastSynced:"Sincronizado hace {t}", neverSynced:"Nunca sincronizado",
    catBookmarksBar:"Barra de marcadores", catOtherBookmarks:"Otros marcadores", catMobileBookmarks:"Marcadores móviles",
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
      healthIssues:"Invalid links", healthIssuesSub:"Review links marked invalid or uncertain after checking.",
      healthIssueAll:"All", healthIssueBad:"Invalid", healthIssueWarn:"Uncertain", healthIssueEmpty:"No invalid or uncertain links.", healthIssueFilteredEmpty:"No links in this status.", healthIssueOpen:"Open", healthIssueEdit:"Edit",
      aiSuggest:"AI category suggestions",
      suggSub:"Based on title, URL, domain and description. Nothing changes until you apply.",
      suggesting:"Analyzing bookmarks…", suggNone:"No suggestions — your bookmarks already look tidy.",
      suggApply:"Apply selected", suggApplied:"{n} bookmarks updated", suggToggle:"Toggle all",
      aiSection:"AI suggestions", aiProvider:"Suggestion engine", aiLocal:"Local rules",
      aiKeyPh:"API key (stored only on this device)",
      aiKeyDesc:"Optional: use Claude or OpenAI for smarter suggestions. The key is stored locally and sent only to the chosen API.",
      aiFailed:"AI request failed — using local rules instead",
      browserSync:"Browser bookmark sync", browserSyncSec:"Chrome and Edge sync through the extension. Safari uses exported bookmark files.",
      syncSource:"Bookmark source", syncSourceChrome:"Chrome", syncSourceEdge:"Edge", syncSourceSafari:"Safari",
      syncMode:"Sync rule", syncModeMerge:"Merge", syncModeSeparate:"Separate", syncModeReplaceSource:"Replace source", syncModeReplaceAll:"Replace all",
      syncModeDesc_merge:"Merge into existing categories and skip duplicate URLs.",
      syncModeDesc_separate:"Keep this browser as an independent source by prefixing its categories.",
      syncModeDesc_replaceSource:"Delete bookmarks from this source, then rebuild only this source.",
      syncModeDesc_replaceAll:"Make local bookmarks match this source, reusing unchanged bookmarks where possible.",
      syncOpenInBrowser:"Open this dashboard as a {browser} extension to read that browser’s bookmarks.",
      syncSafariNote:"Safari bookmarks are imported from an exported HTML file. Direct sync is used only if Safari exposes a bookmarks extension API.",
      syncSafariImport:"Import Safari file", syncSafariImportDesc:"Choose the HTML file exported from Safari Bookmarks.",
      browserSyncEnabled:"Browser sync enabled", browserSyncDisabled:"Browser sync disabled", downloadFiles:"Download files",
      logRetention:"Keep logs", logRetentionDesc:"Expired activity logs are deleted automatically to reduce local storage.",
      logRetNow:"Immediately", logRetNever:"Never delete",
      summaryTitle:"Generate bookmark descriptions", summarySub:"Uses page content and AI when available; falls back to local rules only when needed.",
      summaryScope:"Scope", summaryAll:"All", summaryCurrent:"Current category", summaryCategory:"Choose category",
      summaryMode:"Mode", summaryRegenerate:"Regenerate all", summaryMissingOnly:"Only empty", summaryRun:"Generate",
      summaryTimeHint:"Generating {n} descriptions may take a while — keep this window open.", summaryReviewHint:"Review the {n} generated descriptions. Uncheck any you don't want, then apply.",
      summaryScopeInfo:"{n} will be updated · {total} in scope", summaryProgress:"{done}/{total}: {title}", summaryNone:"No bookmarks need descriptions in this scope.",
      monitorTitle:"Network monitor", monitorSection:"Network monitor",
      monitorWidget:"Status monitor", monitorWidgetDesc:"NAS metrics and service up/down on your dashboard",
      monProvider:"Metrics source", monProviderDesc:"Where to read NAS metrics from. Glances is easiest — run it on the NAS with CORS enabled.",
      monGeneric:"Generic JSON",
      monHostLabel:"Host / API URL", monRefreshLabel:"Refresh every (seconds)",
      monHostHintGlances:"Glances web server address, e.g. http://192.168.1.10:61208 (enable CORS or put it behind a reverse proxy).",
      monHostHintSyno:"Synology DSM address. Native DSM needs a reverse proxy that adds CORS headers, or run as an extension.",
      monHostHintGeneric:"A URL returning JSON like { cpu, mem, temp, net:{up,down}, fs:[...] }.",
      monSynoUser:"DSM username", monSynoPass:"DSM password",
      monServicesLabel:"Services (online / offline)", monServicesDesc:"Add an address per service; left blank = not checked. Reachability is detected from your browser.",
      monSvcName:"Name", monSvcUrl:"http://host:port", monAddService:"Add service", monTestBtn:"Test now", monTesting:"Refreshing…",
      monNoHost:"Set a metrics source to see NAS stats.", monDemoMode:"Preview data until a metrics source is configured.", monPending:"pending", monConfigure:"Configure", monMetricsErr:"Couldn’t reach the metrics source.",
      monCorsHint:"Check the address, and make sure CORS is enabled (or use a reverse proxy / the extension build).",
      monCpu:"CPU", monLoad:"load", monMem:"Memory", monTemp:"Temp", monNet:"Network",
      monDocker:"Docker", monRunning:"running", monSmart:"SMART", monDisks:"disks", monUps:"UPS", monBackup:"Backup", monUptime:"Uptime",
      monOnline:"online", monOffline:"offline", monUnset:"not set",
      setTabGeneral:"General", setTabAppearance:"Appearance", setTabDashboard:"Dashboard", setTabServices:"Monitor & AI", setTabLog:"Activity log", setTabSync:"Sync",
      profilesSec:"Profiles & data source", activeProfile:"Active profile", activeProfileDesc:"Switch the data source shown on your dashboard.", profileAdd:"New", profileName:"Profile name", profileType:"Data source", profileLocal:"Local", profileWebdav:"WebDAV / NAS", deleteBtn:"Delete", profileDelete:"Delete this profile", profileDeleteDesc:"Remove this profile and its cached data.",
      webdavUrl:"bookmarks.json URL", webdavUser:"Username (optional)", webdavPass:"Password (optional)", webdavAuto:"Auto-sync on open", webdavAutoDesc:"Fetch the latest on every open; otherwise use the cached copy.", webdavAutoUpload:"Upload after browser sync", webdavAutoUploadDesc:"After Chrome or Edge bookmark sync finishes, write the latest bookmarks.json to WebDAV/NAS.", syncStatusLabel:"Sync status", syncNow:"Sync now", webdavUploadNow:"Upload to NAS", webdavCorsNote:"PWA reads need CORS or a reverse proxy. The desktop extension can upload the same bookmarks.json with WebDAV PUT.",
      syncStateLocal:"Local data", syncStateRemote:"Remote · latest", syncStateCache:"Cached copy", syncStateFailed:"Sync failed", syncStateSyncing:"Syncing…",
      syncOk:"Synced {n} bookmark(s)", syncFailed:"Sync failed — showing cached/local data", syncBadData:"Remote file isn't valid bookmarks.json", syncNoData:"No cached data yet — sync to load", syncNoUrl:"Enter a bookmarks.json URL first", syncTapToSync:"Tap to sync now", webdavUploadOk:"Uploaded {n} bookmark(s) to NAS", webdavUploadFailed:"Upload failed — check the WebDAV address and permissions",
      profileLocalName:"Local", profileUntitled:"Untitled", profileNewName:"New profile", profileDeleteTitle:"Delete profile", profileDeleteMsg:"Delete profile “{name}” and its cached data?",
      logSection:"Activity log", logSectionDesc:"Every change is recorded and can be undone.", logFilterLabel:"Show", logAll:"All",
      logClear:"Clear log", logClearTitle:"Clear activity log", logClearMsg:"Remove all log entries? Undo history will be lost.", logCleared:"Activity log cleared", logEmpty:"No activity yet.", logUndoTip:"Undo — restore state to before this change",
      logLevel_info:"Info", logLevel_warn:"Warning", logLevel_danger:"Critical",
      logTheme:"Switched theme to {v}", logView:"Switched view to {v}", logClearAll:"Cleared all bookmarks and categories",
      logCatAdd:"Created category “{name}”", logCatRename:"Renamed category “{from}” → “{to}”", logCatDelete:"Deleted category “{name}”", logCatReorder:"Reordered categories", logCatChange:"Changed categories",
      logTrashAdd1:"Moved “{name}” to trash", logTrashAddN:"Moved {n} bookmarks to trash", logRestore1:"Restored “{name}”", logRestoreN:"Restored {n} bookmarks", logTrashEmpty:"Emptied trash", logTrashDelete1:"Permanently deleted “{name}”", logTrashDeleteN:"Permanently deleted {n} items",
      logImport:"Imported {n} bookmarks", logBmAdd:"Added bookmark “{name}”", logBmDelete1:"Deleted bookmark “{name}”", logBmDeleteN:"Deleted {n} bookmarks", logBmEdit1:"Edited bookmark “{name}”", logBmEditN:"Edited {n} bookmarks", logBmReorder:"Reordered bookmarks",
      logSetMotion:"Motion profile → {v}", logSetLang:"Language → {v}", logSetMonitor:"Updated network monitor", logSetAi:"Updated AI suggestions", logSetBg:"Changed background", logSetName:"Changed page name", logSetTag:"Changed subtitle", logSetCatLayout:"Changed category style", logSetClock:"Toggled clock seconds", logSetHolidays:"Toggled holidays", logSetGlass:"Changed glass effect", logSetWidgets:"Changed widget visibility", logSetWidgetOrder:"Reordered widgets", logSetWidgetSize:"Resized a widget", logSetRetention:"Changed retention", logSetSync:"Updated browser sync", logSetLogo:"Changed logo", logSetGeneric:"Changed setting: {k}", logSetMultiple:"Changed {n} settings",
      logUndo:"Undid: {msg}"
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
      healthIssues:"异常链接", healthIssuesSub:"集中维护检查后标记为失效或存疑的链接。",
      healthIssueAll:"全部", healthIssueBad:"失效", healthIssueWarn:"存疑", healthIssueEmpty:"没有失效或存疑链接。", healthIssueFilteredEmpty:"当前状态下没有链接。", healthIssueOpen:"打开", healthIssueEdit:"编辑",
      aiSuggest:"AI 分类建议",
      suggSub:"根据标题、URL、域名和描述生成；应用前不会修改任何书签。",
      suggesting:"正在分析书签…", suggNone:"没有可用建议 —— 书签看起来已经很整齐。",
      suggApply:"应用所选", suggApplied:"已更新 {n} 个书签", suggToggle:"全选/全不选",
      aiSection:"AI 建议", aiProvider:"建议引擎", aiLocal:"本地规则",
      aiKeyPh:"API Key（只保存在本机）",
      aiKeyDesc:"可选：填入 Claude 或 OpenAI 的 Key 获得更智能的建议；Key 仅保存在本地，只发送给所选 API。",
      aiFailed:"AI 请求失败，已回退到本地规则",
      browserSync:"浏览器书签同步", browserSyncSec:"Chrome 和 Edge 通过扩展同步；Safari 使用导出的书签 HTML 文件。",
      syncSource:"书签来源", syncSourceChrome:"Chrome", syncSourceEdge:"Edge", syncSourceSafari:"Safari",
      syncMode:"同步规则", syncModeMerge:"合并", syncModeSeparate:"按来源独立", syncModeReplaceSource:"替换当前来源", syncModeReplaceAll:"替换全部",
      syncModeDesc_merge:"并入现有分类，重复 URL 会跳过或更新已有书签。",
      syncModeDesc_separate:"把该浏览器作为独立来源保留，分类名前会加上来源前缀。",
      syncModeDesc_replaceSource:"先删除当前来源的书签，再只按该来源重新生成。",
      syncModeDesc_replaceAll:"让本地书签与当前来源保持一致，并尽量复用未变化的书签。",
      syncOpenInBrowser:"请以 {browser} 扩展方式打开此面板，才能读取该浏览器的书签。",
      syncSafariNote:"Safari 书签通过导出的 HTML 文件导入；只有 Safari 暴露书签扩展 API 时才会直接同步。",
      syncSafariImport:"导入 Safari 文件", syncSafariImportDesc:"选择从 Safari 书签导出的 HTML 文件。",
      browserSyncEnabled:"浏览器书签同步已启用", browserSyncDisabled:"浏览器书签同步已关闭", downloadFiles:"下载文件",
      logRetention:"日志保留时间", logRetentionDesc:"过期操作日志会自动删除，以减少本地缓存占用。",
      logRetNow:"立即", logRetNever:"不删除",
      summaryTitle:"生成书签描述", summarySub:"优先读取网页内容并调用 AI，总结失败时才回退到本地规则。",
      summaryScope:"范围", summaryAll:"全部书签", summaryCurrent:"当前分类", summaryCategory:"指定分类",
      summaryMode:"模式", summaryRegenerate:"重新生成全部", summaryMissingOnly:"只补空描述", summaryRun:"开始生成",
      summaryTimeHint:"将生成 {n} 条描述，数量较多时会耗时较久，请保持此窗口打开。", summaryReviewHint:"请逐条检查生成的 {n} 条描述，取消勾选不想保留的，再点应用。",
      summaryScopeInfo:"将更新 {n} 个 · 当前范围共 {total} 个", summaryProgress:"{done}/{total}：{title}", summaryNone:"当前范围内没有需要生成描述的书签。",
      monitorTitle:"内网监控", monitorSection:"内网监控",
      monitorWidget:"状态监控", monitorWidgetDesc:"在仪表盘显示 NAS 指标与各服务在线/离线",
      monProvider:"指标来源", monProviderDesc:"从哪里读取 NAS 指标。推荐 Glances —— 在 NAS 上运行并开启 CORS 即可。",
      monGeneric:"通用 JSON",
      monHostLabel:"地址 / API URL", monRefreshLabel:"刷新间隔（秒）",
      monHostHintGlances:"Glances 网页服务地址，例如 http://192.168.1.10:61208（需开启 CORS 或经反向代理）。",
      monHostHintSyno:"群晖 DSM 地址。原生 DSM 需反代加 CORS 头，或在扩展环境下运行。",
      monHostHintGeneric:"返回 JSON 的地址，形如 { cpu, mem, temp, net:{up,down}, fs:[...] }。",
      monSynoUser:"DSM 用户名", monSynoPass:"DSM 密码",
      monServicesLabel:"服务（在线 / 离线）", monServicesDesc:"为每个服务填一个地址；留空则不检测。可达性由你的浏览器探测。",
      monSvcName:"名称", monSvcUrl:"http://主机:端口", monAddService:"添加服务", monTestBtn:"立即检测", monTesting:"正在刷新…",
      monNoHost:"设置指标来源以查看 NAS 状态。", monDemoMode:"未配置指标来源，当前显示示例数据。", monPending:"待配置", monConfigure:"去配置", monMetricsErr:"无法连接到指标来源。",
      monCorsHint:"检查地址，并确认已开启 CORS（或使用反向代理 / 扩展版本）。",
      monCpu:"CPU", monLoad:"负载", monMem:"内存", monTemp:"温度", monNet:"网络",
      monDocker:"Docker", monRunning:"运行中", monSmart:"SMART", monDisks:"块盘", monUps:"UPS", monBackup:"备份", monUptime:"运行时长",
      monOnline:"在线", monOffline:"离线", monUnset:"未配置",
      setTabGeneral:"通用", setTabAppearance:"外观", setTabDashboard:"仪表盘", setTabServices:"监控 & AI", setTabLog:"操作日志", setTabSync:"同步",
      profilesSec:"Profile 与数据源", activeProfile:"当前 Profile", activeProfileDesc:"切换仪表盘展示的数据源。", profileAdd:"新建", profileName:"Profile 名称", profileType:"数据源", profileLocal:"本地", profileWebdav:"WebDAV / NAS", deleteBtn:"删除", profileDelete:"删除此 Profile", profileDeleteDesc:"移除此 Profile 及其缓存数据。",
      webdavUrl:"bookmarks.json 地址", webdavUser:"用户名（可选）", webdavPass:"密码（可选）", webdavAuto:"打开时自动同步", webdavAutoDesc:"每次打开拉取最新；否则使用缓存副本。", webdavAutoUpload:"浏览器同步后上传", webdavAutoUploadDesc:"Chrome 或 Edge 书签同步完成后，把最新 bookmarks.json 写入 WebDAV/NAS。", syncStatusLabel:"同步状态", syncNow:"立即同步", webdavUploadNow:"上传到 NAS", webdavCorsNote:"PWA 读取需要 CORS 或反向代理；桌面扩展可通过 WebDAV PUT 上传同一份 bookmarks.json。",
      syncStateLocal:"本地数据", syncStateRemote:"远程 · 最新", syncStateCache:"缓存副本", syncStateFailed:"同步失败", syncStateSyncing:"同步中…",
      syncOk:"已同步 {n} 个书签", syncFailed:"同步失败 —— 显示缓存/本地数据", syncBadData:"远程文件不是有效的 bookmarks.json", syncNoData:"暂无缓存数据 —— 请同步加载", syncNoUrl:"请先填写 bookmarks.json 地址", syncTapToSync:"点击立即同步", webdavUploadOk:"已上传 {n} 个书签到 NAS", webdavUploadFailed:"上传失败 —— 请检查 WebDAV 地址和写入权限",
      profileLocalName:"本地", profileUntitled:"未命名", profileNewName:"新 Profile", profileDeleteTitle:"删除 Profile", profileDeleteMsg:"删除 Profile “{name}” 及其缓存数据？",
      logSection:"操作日志", logSectionDesc:"所有更改都会被记录，并且可以撤销。", logFilterLabel:"显示", logAll:"全部",
      logClear:"清空日志", logClearTitle:"清空操作日志", logClearMsg:"删除全部日志？撤销历史也会一并丢失。", logCleared:"操作日志已清空", logEmpty:"暂无操作记录。", logUndoTip:"撤销 —— 恢复到此操作之前的状态",
      logLevel_info:"信息", logLevel_warn:"警告", logLevel_danger:"危险",
      logTheme:"切换主题：{v}", logView:"切换视图：{v}", logClearAll:"清空了所有书签与分类",
      logCatAdd:"新建分类「{name}」", logCatRename:"重命名分类「{from}」→「{to}」", logCatDelete:"删除分类「{name}」", logCatReorder:"调整分类顺序", logCatChange:"修改分类",
      logTrashAdd1:"将「{name}」移入回收站", logTrashAddN:"将 {n} 个书签移入回收站", logRestore1:"还原「{name}」", logRestoreN:"还原 {n} 个书签", logTrashEmpty:"清空回收站", logTrashDelete1:"永久删除「{name}」", logTrashDeleteN:"永久删除 {n} 项",
      logImport:"导入 {n} 个书签", logBmAdd:"添加书签「{name}」", logBmDelete1:"删除书签「{name}」", logBmDeleteN:"删除 {n} 个书签", logBmEdit1:"编辑书签「{name}」", logBmEditN:"编辑 {n} 个书签", logBmReorder:"调整书签顺序",
      logSetMotion:"动效模式 → {v}", logSetLang:"语言 → {v}", logSetMonitor:"更新内网监控设置", logSetAi:"更新 AI 建议设置", logSetBg:"更改背景", logSetName:"修改页面名称", logSetTag:"修改副标题", logSetCatLayout:"更改分类样式", logSetClock:"切换时钟秒显示", logSetHolidays:"切换节假日显示", logSetGlass:"更改玻璃质感", logSetWidgets:"调整组件显示", logSetWidgetOrder:"调整组件顺序", logSetWidgetSize:"调整组件大小", logSetRetention:"更改保留时长", logSetSync:"更新浏览器书签同步", logSetLogo:"更改 Logo", logSetGeneric:"更改设置：{k}", logSetMultiple:"更改了 {n} 项设置",
      logUndo:"已撤销：{msg}"
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
      healthIssues:"Enlaces no válidos", healthIssuesSub:"Revisa enlaces marcados como rotos o dudosos tras comprobar.",
      healthIssueAll:"Todos", healthIssueBad:"Inválidos", healthIssueWarn:"Dudosos", healthIssueEmpty:"No hay enlaces inválidos o dudosos.", healthIssueFilteredEmpty:"No hay enlaces con este estado.", healthIssueOpen:"Abrir", healthIssueEdit:"Editar",
      aiSuggest:"Sugerencias de categorías (IA)",
      suggSub:"Basadas en título, URL, dominio y descripción. Nada cambia hasta que apliques.",
      suggesting:"Analizando marcadores…", suggNone:"Sin sugerencias: tus marcadores ya están ordenados.",
      suggApply:"Aplicar seleccionadas", suggApplied:"{n} marcadores actualizados", suggToggle:"Alternar todo",
      aiSection:"Sugerencias IA", aiProvider:"Motor de sugerencias", aiLocal:"Reglas locales",
      aiKeyPh:"Clave API (solo en este dispositivo)",
      aiKeyDesc:"Opcional: usa Claude u OpenAI para mejores sugerencias. La clave se guarda localmente.",
      aiFailed:"Error de IA: se usaron reglas locales",
      browserSync:"Sincronización de marcadores", browserSyncSec:"Chrome y Edge sincronizan con la extensión. Safari usa archivos HTML exportados.",
      syncSource:"Fuente", syncSourceChrome:"Chrome", syncSourceEdge:"Edge", syncSourceSafari:"Safari",
      syncMode:"Regla", syncModeMerge:"Combinar", syncModeSeparate:"Separar", syncModeReplaceSource:"Reemplazar fuente", syncModeReplaceAll:"Reemplazar todo",
      syncModeDesc_merge:"Combina con categorías existentes y omite URLs duplicadas.",
      syncModeDesc_separate:"Mantiene este navegador como fuente independiente con prefijo de categoría.",
      syncModeDesc_replaceSource:"Borra marcadores de esta fuente y la reconstruye.",
      syncModeDesc_replaceAll:"Hace que los marcadores locales coincidan con esta fuente, reutilizando los que no cambiaron.",
      syncOpenInBrowser:"Abre este panel como extensión de {browser} para leer sus marcadores.",
      syncSafariNote:"Safari se importa desde un archivo HTML exportado. La sincronización directa solo se usa si Safari expone una API de marcadores.",
      syncSafariImport:"Importar Safari", syncSafariImportDesc:"Elige el archivo HTML exportado desde los marcadores de Safari.",
      browserSyncEnabled:"Sincronización activada", browserSyncDisabled:"Sincronización desactivada", downloadFiles:"Descargar archivos",
      logRetention:"Conservar registros", logRetentionDesc:"Los registros caducados se eliminan automáticamente para reducir almacenamiento local.",
      logRetNow:"Inmediatamente", logRetNever:"No borrar",
      summaryTitle:"Generar descripciones", summarySub:"Usa contenido de la página e IA cuando esté disponible; recurre a reglas locales solo si hace falta.",
      summaryScope:"Alcance", summaryAll:"Todos", summaryCurrent:"Categoría actual", summaryCategory:"Elegir categoría",
      summaryMode:"Modo", summaryRegenerate:"Regenerar todo", summaryMissingOnly:"Solo vacíos", summaryRun:"Generar",
      summaryTimeHint:"Generar {n} descripciones puede tardar; mantén esta ventana abierta.", summaryReviewHint:"Revisa las {n} descripciones generadas. Desmarca las que no quieras y aplica.",
      summaryScopeInfo:"Se actualizarán {n} · {total} en el alcance", summaryProgress:"{done}/{total}: {title}", summaryNone:"No hay marcadores que necesiten descripción en este alcance.",
      monitorTitle:"Monitor de red", monitorSection:"Monitor de red",
      monitorWidget:"Monitor de estado", monitorWidgetDesc:"Métricas del NAS y estado de servicios en el panel",
      monProvider:"Fuente de métricas", monProviderDesc:"De dónde leer las métricas del NAS. Glances es lo más fácil: ejecútalo en el NAS con CORS activado.",
      monGeneric:"JSON genérico",
      monHostLabel:"Host / URL de API", monRefreshLabel:"Actualizar cada (segundos)",
      monHostHintGlances:"Dirección del servidor web de Glances, p. ej. http://192.168.1.10:61208 (activa CORS o usa un proxy inverso).",
      monHostHintSyno:"Dirección de DSM (Synology). DSM nativo necesita un proxy inverso con cabeceras CORS, o ejecutarlo como extensión.",
      monHostHintGeneric:"Una URL que devuelva JSON como { cpu, mem, temp, net:{up,down}, fs:[...] }.",
      monSynoUser:"Usuario de DSM", monSynoPass:"Contraseña de DSM",
      monServicesLabel:"Servicios (en línea / desconectado)", monServicesDesc:"Añade una dirección por servicio; vacío = no se comprueba. La accesibilidad se detecta desde tu navegador.",
      monSvcName:"Nombre", monSvcUrl:"http://host:puerto", monAddService:"Añadir servicio", monTestBtn:"Probar ahora", monTesting:"Actualizando…",
      monNoHost:"Configura una fuente de métricas para ver el NAS.", monDemoMode:"Vista previa hasta configurar una fuente de métricas.", monPending:"pendiente", monConfigure:"Configurar", monMetricsErr:"No se pudo conectar con la fuente de métricas.",
      monCorsHint:"Revisa la dirección y asegúrate de que CORS esté activado (o usa un proxy inverso / la extensión).",
      monCpu:"CPU", monLoad:"carga", monMem:"Memoria", monTemp:"Temp", monNet:"Red",
      monDocker:"Docker", monRunning:"activos", monSmart:"SMART", monDisks:"discos", monUps:"SAI", monBackup:"Copia", monUptime:"Actividad",
      monOnline:"en línea", monOffline:"desconectado", monUnset:"sin definir",
      setTabGeneral:"General", setTabAppearance:"Apariencia", setTabDashboard:"Panel", setTabServices:"Monitor e IA", setTabLog:"Registro", setTabSync:"Sincronización",
      profilesSec:"Perfiles y fuente de datos", activeProfile:"Perfil activo", activeProfileDesc:"Cambia la fuente de datos del panel.", profileAdd:"Nuevo", profileName:"Nombre del perfil", profileType:"Fuente de datos", profileLocal:"Local", profileWebdav:"WebDAV / NAS", deleteBtn:"Eliminar", profileDelete:"Eliminar este perfil", profileDeleteDesc:"Quita este perfil y sus datos en caché.",
      webdavUrl:"URL de bookmarks.json", webdavUser:"Usuario (opcional)", webdavPass:"Contraseña (opcional)", webdavAuto:"Sincronizar al abrir", webdavAutoDesc:"Trae lo último en cada apertura; si no, usa la copia en caché.", webdavAutoUpload:"Subir tras sincronizar navegador", webdavAutoUploadDesc:"Cuando termine la sincronización de Chrome o Edge, escribe el bookmarks.json actualizado en WebDAV/NAS.", syncStatusLabel:"Estado de sincronización", syncNow:"Sincronizar", webdavUploadNow:"Subir al NAS", webdavCorsNote:"La PWA necesita CORS o un proxy inverso para leer. La extensión de escritorio puede subir el mismo bookmarks.json con WebDAV PUT.",
      syncStateLocal:"Datos locales", syncStateRemote:"Remoto · al día", syncStateCache:"Copia en caché", syncStateFailed:"Fallo de sincronización", syncStateSyncing:"Sincronizando…",
      syncOk:"{n} marcador(es) sincronizados", syncFailed:"Fallo — mostrando datos en caché/locales", syncBadData:"El archivo remoto no es un bookmarks.json válido", syncNoData:"Sin datos en caché — sincroniza para cargar", syncNoUrl:"Introduce primero la URL de bookmarks.json", syncTapToSync:"Toca para sincronizar", webdavUploadOk:"{n} marcador(es) subidos al NAS", webdavUploadFailed:"Error al subir — revisa la URL WebDAV y permisos",
      profileLocalName:"Local", profileUntitled:"Sin título", profileNewName:"Nuevo perfil", profileDeleteTitle:"Eliminar perfil", profileDeleteMsg:"¿Eliminar el perfil «{name}» y sus datos en caché?",
      logSection:"Registro de actividad", logSectionDesc:"Cada cambio se registra y se puede deshacer.", logFilterLabel:"Mostrar", logAll:"Todo",
      logClear:"Borrar registro", logClearTitle:"Borrar el registro", logClearMsg:"¿Eliminar todas las entradas? Se perderá el historial para deshacer.", logCleared:"Registro borrado", logEmpty:"Sin actividad todavía.", logUndoTip:"Deshacer — restaurar el estado anterior a este cambio",
      logLevel_info:"Info", logLevel_warn:"Aviso", logLevel_danger:"Crítico",
      logTheme:"Tema cambiado a {v}", logView:"Vista cambiada a {v}", logClearAll:"Se borraron todos los marcadores y categorías",
      logCatAdd:"Categoría creada «{name}»", logCatRename:"Categoría renombrada «{from}» → «{to}»", logCatDelete:"Categoría eliminada «{name}»", logCatReorder:"Categorías reordenadas", logCatChange:"Categorías modificadas",
      logTrashAdd1:"«{name}» movido a la papelera", logTrashAddN:"{n} marcadores a la papelera", logRestore1:"«{name}» restaurado", logRestoreN:"{n} marcadores restaurados", logTrashEmpty:"Papelera vaciada", logTrashDelete1:"«{name}» eliminado permanentemente", logTrashDeleteN:"{n} elementos eliminados permanentemente",
      logImport:"{n} marcadores importados", logBmAdd:"Marcador añadido «{name}»", logBmDelete1:"Marcador eliminado «{name}»", logBmDeleteN:"{n} marcadores eliminados", logBmEdit1:"Marcador editado «{name}»", logBmEditN:"{n} marcadores editados", logBmReorder:"Marcadores reordenados",
      logSetMotion:"Animación → {v}", logSetLang:"Idioma → {v}", logSetMonitor:"Monitor de red actualizado", logSetAi:"Sugerencias de IA actualizadas", logSetBg:"Fondo cambiado", logSetName:"Nombre cambiado", logSetTag:"Subtítulo cambiado", logSetCatLayout:"Estilo de categorías cambiado", logSetClock:"Segundos del reloj", logSetHolidays:"Festivos", logSetGlass:"Efecto de cristal cambiado", logSetWidgets:"Visibilidad de widgets", logSetWidgetOrder:"Widgets reordenados", logSetWidgetSize:"Tamaño de widget", logSetRetention:"Retención cambiada", logSetSync:"Sincronización de navegador actualizada", logSetLogo:"Logo cambiado", logSetGeneric:"Ajuste cambiado: {k}", logSetMultiple:"{n} ajustes cambiados",
      logUndo:"Deshecho: {msg}"
    }
  };
  Object.keys(extra).forEach(function(k){ if(I18N[k]) Object.assign(I18N[k], extra[k]); });
})();

/* ===== 日历增强文案 ===== */
(function(){
  var extra={
    en:{
      calToday:"Today", calYesterday:"Yesterday", calTomorrow:"Tomorrow", calDaysAgo:"{n} days ago", calDaysLater:"In {n} days",
      calWeekday:"Weekday", calWeekend:"Weekend", calWeekNo:"Week {n}", calNoReminder:"No reminders for this day.",
      calAddReminder:"Add", calReminderPh:"Add a reminder…", calReminderAdded:"Reminder added", calReminderDone:"Reminder completed", calReminderRestored:"Reminder reopened", calReminderDeleted:"Reminder deleted",
      calToggleDone:"Toggle done", calUpcoming:"Upcoming", calJumpMonth:"Jump to month", calJumpYear:"Jump to year", calShowDoneBadges:"Show badge after reminders are completed",
      worldClock:"World clocks", worldClockEmpty:"Add a city or time zone to compare time.", worldClockPh:"Search city or time zone…", addClock:"Add", removeClock:"Remove clock", clockStack:"Stack", clockCompact:"Compact",
      worldClockAdded:"World clock added", worldClockExists:"That clock already exists", worldClockNotFound:"No matching time zone found",
      clearRecent:"Clear recent", clearFrequent:"Clear usage", recentCleared:"Recently opened cleared", frequentCleared:"Usage counts cleared",
      favoriteBookmark:"Favorite shortcut", favoriteBookmarkDesc:"Show this bookmark first in the frequently used widget.", addFavorite:"Add favorite", addFavoritePage:"Add favorite page", removeFavorite:"Remove favorite", favoriteAdded:"Added to favorites", favoriteRemoved:"Removed from favorites"
    },
    zh:{
      calToday:"今天", calYesterday:"昨天", calTomorrow:"明天", calDaysAgo:"{n} 天前", calDaysLater:"{n} 天后",
      calWeekday:"工作日", calWeekend:"周末", calWeekNo:"第 {n} 周", calNoReminder:"这一天还没有提醒事项。",
      calAddReminder:"添加", calReminderPh:"添加提醒事项…", calReminderAdded:"已添加提醒", calReminderDone:"已完成提醒", calReminderRestored:"已恢复提醒", calReminderDeleted:"已删除提醒",
      calToggleDone:"切换完成状态", calUpcoming:"即将到来", calJumpMonth:"跳转月份", calJumpYear:"跳转年份", calShowDoneBadges:"提醒完成后仍显示日期角标",
      worldClock:"世界时钟", worldClockEmpty:"添加城市或时区，快速对照时间。", worldClockPh:"搜索城市或时区…", addClock:"添加", removeClock:"移除时钟", clockStack:"堆栈", clockCompact:"紧凑",
      worldClockAdded:"已添加世界时钟", worldClockExists:"该时钟已存在", worldClockNotFound:"没有匹配的时区",
      clearRecent:"清空最近", clearFrequent:"清空统计", recentCleared:"已清空最近打开", frequentCleared:"已清空常用统计",
      favoriteBookmark:"常用收藏", favoriteBookmarkDesc:"在常用小组件中优先显示这个书签。", addFavorite:"设为常用", addFavoritePage:"添加常用网页", removeFavorite:"取消常用", favoriteAdded:"已加入常用收藏", favoriteRemoved:"已取消常用收藏"
    },
    es:{
      calToday:"Hoy", calYesterday:"Ayer", calTomorrow:"Mañana", calDaysAgo:"Hace {n} días", calDaysLater:"En {n} días",
      calWeekday:"Laborable", calWeekend:"Fin de semana", calWeekNo:"Semana {n}", calNoReminder:"No hay recordatorios para este día.",
      calAddReminder:"Añadir", calReminderPh:"Añadir recordatorio…", calReminderAdded:"Recordatorio añadido", calReminderDone:"Recordatorio completado", calReminderRestored:"Recordatorio reabierto", calReminderDeleted:"Recordatorio eliminado",
      calToggleDone:"Cambiar estado", calUpcoming:"Próximos", calJumpMonth:"Ir al mes", calJumpYear:"Ir al año", calShowDoneBadges:"Mostrar insignia tras completar recordatorios",
      worldClock:"Relojes mundiales", worldClockEmpty:"Añade una ciudad o zona horaria.", worldClockPh:"Buscar ciudad o zona horaria…", addClock:"Añadir", removeClock:"Quitar reloj", clockStack:"Pila", clockCompact:"Compacto",
      worldClockAdded:"Reloj añadido", worldClockExists:"Ese reloj ya existe", worldClockNotFound:"No se encontró zona horaria",
      clearRecent:"Borrar recientes", clearFrequent:"Borrar uso", recentCleared:"Recientes borrados", frequentCleared:"Uso borrado",
      favoriteBookmark:"Acceso favorito", favoriteBookmarkDesc:"Mostrar este marcador primero en el widget de frecuentes.", addFavorite:"Añadir favorito", addFavoritePage:"Añadir página favorita", removeFavorite:"Quitar favorito", favoriteAdded:"Añadido a favoritos", favoriteRemoved:"Quitado de favoritos"
    }
  };
  Object.keys(extra).forEach(function(k){ if(I18N[k]) Object.assign(I18N[k], extra[k]); });
})();

/* ===== 命令面板 (⌘/Ctrl-K) 文案 ===== */
(function(){
  var extra={
    en:{
      palTitle:"Command palette",
      palPlaceholder:"Search bookmarks, run a command, or enter a URL…",
      palCmds:"Commands", palBookmarks:"Bookmarks", palCategories:"Categories", palWeb:"Web",
      palSearchWeb:"Search the web for “{q}”", palOpenUrl:"Open {url}",
      palEmpty:"No matches", palNav:"navigate", palOpen:"open", palClose:"close"
    },
    zh:{
      palTitle:"命令面板",
      palPlaceholder:"搜索书签、执行命令，或输入网址…",
      palCmds:"命令", palBookmarks:"书签", palCategories:"分类", palWeb:"网页",
      palSearchWeb:"在网页搜索“{q}”", palOpenUrl:"打开 {url}",
      palEmpty:"没有匹配项", palNav:"切换", palOpen:"打开", palClose:"关闭"
    },
    es:{
      palTitle:"Paleta de comandos",
      palPlaceholder:"Busca marcadores, ejecuta un comando o escribe una URL…",
      palCmds:"Comandos", palBookmarks:"Marcadores", palCategories:"Categorías", palWeb:"Web",
      palSearchWeb:"Buscar en la web «{q}»", palOpenUrl:"Abrir {url}",
      palEmpty:"Sin coincidencias", palNav:"mover", palOpen:"abrir", palClose:"cerrar"
    }
  };
  Object.keys(extra).forEach(function(k){ if(I18N[k]) Object.assign(I18N[k], extra[k]); });
})();

/* ===== 标签与置顶 文案 ===== */
(function(){
  var extra={
    en:{
      tagsLabel:"Tags", tagsPh:"Separate with commas",
      filterByTag:"Filter by #{tag}", tagFilterClear:"Clear tag filter",
      pinToTop:"Pin to top", unpin:"Unpin", pinnedLabel:"Pinned",
      pinBookmark:"Pin to top", pinBookmarkDesc:"Keep this bookmark at the top and lock its position during browser sync."
    },
    zh:{
      tagsLabel:"标签", tagsPh:"用逗号分隔",
      filterByTag:"按 #{tag} 筛选", tagFilterClear:"清除标签筛选",
      pinToTop:"置顶", unpin:"取消置顶", pinnedLabel:"已置顶",
      pinBookmark:"置顶", pinBookmarkDesc:"让该书签固定在顶部，并在浏览器同步时保持位置。"
    },
    es:{
      tagsLabel:"Etiquetas", tagsPh:"Separa con comas",
      filterByTag:"Filtrar por #{tag}", tagFilterClear:"Quitar filtro de etiqueta",
      pinToTop:"Fijar arriba", unpin:"Quitar fijado", pinnedLabel:"Fijado",
      pinBookmark:"Fijar arriba", pinBookmarkDesc:"Mantén este marcador arriba y conserva su posición al sincronizar."
    }
  };
  Object.keys(extra).forEach(function(k){ if(I18N[k]) Object.assign(I18N[k], extra[k]); });
})();

/* ===== 隐私模式 / 存储用量 / 分块渲染 文案 ===== */
(function(){
  var extra={
    en:{
      privacySec:"Privacy", privacyMode:"Privacy mode",
      privacyModeDesc:"Stop automatic external requests: no site icons from Google, no page fetching for auto-descriptions. Weather, IP and online wallpapers stay under their own settings.",
      privacyOn:"Privacy mode on — no automatic external requests", privacyOff:"Privacy mode off",
      storageUsage:"Local storage used", storageUsageDesc:"About {kb} KB used ({pct}% of the ~5 MB browser limit). Export a backup if it gets high.",
      storageFull:"Local storage is full — export a backup and clear old items to free space.",
      showMore:"Show more ({n})"
    },
    zh:{
      privacySec:"隐私", privacyMode:"隐私模式",
      privacyModeDesc:"关闭自动外部请求：不再向 Google 请求站点图标、不再抓取网页生成摘要。天气、IP、在线壁纸仍由各自的设置控制。",
      privacyOn:"隐私模式已开启 —— 不再发起自动外部请求", privacyOff:"隐私模式已关闭",
      storageUsage:"本地存储占用", storageUsageDesc:"已用约 {kb} KB（约为浏览器 5 MB 上限的 {pct}%）。占用过高时请导出备份。",
      storageFull:"本地存储已满 —— 请导出备份并清理旧数据以释放空间。",
      showMore:"显示更多（{n}）"
    },
    es:{
      privacySec:"Privacidad", privacyMode:"Modo privado",
      privacyModeDesc:"Detiene las solicitudes externas automáticas: sin iconos de sitio de Google ni descarga de páginas para descripciones. El clima, la IP y los fondos en línea siguen sus propios ajustes.",
      privacyOn:"Modo privado activado: sin solicitudes externas automáticas", privacyOff:"Modo privado desactivado",
      storageUsage:"Almacenamiento local usado", storageUsageDesc:"Unos {kb} KB usados ({pct}% del límite de ~5 MB del navegador). Exporta una copia si sube mucho.",
      storageFull:"El almacenamiento local está lleno: exporta una copia y borra elementos antiguos.",
      showMore:"Mostrar más ({n})"
    }
  };
  Object.keys(extra).forEach(function(k){ if(I18N[k]) Object.assign(I18N[k], extra[k]); });
})();

/* ===== 统一上下文菜单 / 动作面板 文案 ===== */
(function(){
  var extra={
    en:{
      ctxActions:"Actions", ctxCancel:"Cancel", back:"Back",
      ctxOpen:"Open", ctxMoveTo:"Move to category", ctxCopyLink:"Copy link",
      ctxLinkCopied:"Link copied", ctxMoved:"Moved to “{cat}”", ctxOpenCat:"Open category",
      palTip:"Command palette"
    },
    zh:{
      ctxActions:"操作", ctxCancel:"取消", back:"返回",
      ctxOpen:"打开", ctxMoveTo:"移动到分类", ctxCopyLink:"复制链接",
      ctxLinkCopied:"链接已复制", ctxMoved:"已移动到“{cat}”", ctxOpenCat:"打开分类",
      palTip:"命令面板"
    },
    es:{
      ctxActions:"Acciones", ctxCancel:"Cancelar", back:"Atrás",
      ctxOpen:"Abrir", ctxMoveTo:"Mover a categoría", ctxCopyLink:"Copiar enlace",
      ctxLinkCopied:"Enlace copiado", ctxMoved:"Movido a «{cat}»", ctxOpenCat:"Abrir categoría",
      palTip:"Paleta de comandos"
    }
  };
  Object.keys(extra).forEach(function(k){ if(I18N[k]) Object.assign(I18N[k], extra[k]); });
})();

/* ===== 便签 / 概览 组件 文案 ===== */
(function(){
  var extra={
    en:{
      notesTitle:"Notes", notesDesc:"A quick local scratchpad — stays on this device", notesPh:"Jot anything down… (saved locally)",
      overviewTitle:"Overview", overviewDesc:"At-a-glance counts, link health and storage",
      ovBookmarks:"Bookmarks", ovCategories:"Categories", ovDeadLinks:"Issues", ovStorage:"Storage",
      ovTrash:"{n} in trash", ovLastSync:"Synced {t}", ovLastCheck:"Links checked {t}"
    },
    zh:{
      notesTitle:"便签", notesDesc:"本地速记，仅保存在本设备", notesPh:"随手记点什么…（本地保存）",
      overviewTitle:"概览", overviewDesc:"书签/分类数量、链接健康与存储一目了然",
      ovBookmarks:"书签", ovCategories:"分类", ovDeadLinks:"问题链接", ovStorage:"存储",
      ovTrash:"回收站 {n} 项", ovLastSync:"{t}同步", ovLastCheck:"{t}检查链接"
    },
    es:{
      notesTitle:"Notas", notesDesc:"Bloc local rápido — se queda en este dispositivo", notesPh:"Anota lo que sea… (guardado local)",
      overviewTitle:"Resumen", overviewDesc:"Conteos, salud de enlaces y almacenamiento de un vistazo",
      ovBookmarks:"Marcadores", ovCategories:"Categorías", ovDeadLinks:"Problemas", ovStorage:"Almacenam.",
      ovTrash:"{n} en papelera", ovLastSync:"Sincronizado {t}", ovLastCheck:"Enlaces {t}"
    }
  };
  Object.keys(extra).forEach(function(k){ if(I18N[k]) Object.assign(I18N[k], extra[k]); });
})();
