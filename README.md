# Navi - Private Bookmark Dashboard

Language / 语言: [中文](#中文) | [English](#english)

Navi is a local-first bookmark dashboard that can run as a normal web page, a browser extension, or an installable PWA. It is designed for people who want a private start page, visual bookmark management, browser bookmark sync, NAS/WebDAV backup, and useful daily widgets without needing an account or a server.

<a id="中文"></a>

## 中文

[English](#english)

### 这是什么

Navi 是一个本地优先的私人书签导航页。它可以作为桌面首页、浏览器扩展、手机 PWA 使用，也可以通过 WebDAV/NAS 在不同设备之间同步同一份 `bookmarks.json`。

它适合这些场景：

- 把 Chrome、Edge、Safari 或其他浏览器书签整理成更好看的导航页。
- 在电脑上管理书签，在手机 PWA 上读取同一份书签。
- 把常用网页、最近打开、天气、日历、时钟、内网监控放在一个入口里。
- 在不注册账号、不依赖外部后端的情况下保存自己的导航数据。

界面语言可以在右上角语言按钮快速切换，也可以进入 `设置 -> 通用 -> 语言` 选择。当前应用内置 English、中文、Español；本 README 提供中文和 English 两个阅读版本。

### 最快开始

#### 方式一：直接体验

双击 `index.html` 即可打开。这个方式最适合先看界面、手动添加书签、导入浏览器导出的书签 HTML 文件。

注意：`file://` 本地文件环境不会启用 PWA 离线缓存，也不能读取 Chrome/Edge 原生书签。

#### 方式二：作为 Chrome 或 Edge 扩展

如果你希望读取浏览器原生书签，推荐用扩展方式打开。

1. 打开扩展管理页：Chrome 使用 `chrome://extensions`，Edge 使用 `edge://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择这个项目文件夹。
5. 点击工具栏里的 Navi 图标打开页面。
6. 进入 `设置 -> 同步` 配置浏览器书签同步和 WebDAV/NAS。

扩展同步会读取浏览器书签并生成 Navi 面板数据，不会反向修改浏览器原生书签。

#### 方式三：作为手机 PWA

把项目部署到 HTTPS 静态网站后，在手机浏览器中打开并选择“添加到主屏幕”。PWA 支持离线访问，适合手机端长期使用。

如果 PWA 只作为 `Chrome -> NAS -> 手机 PWA` 链路中的读取端，可以只配置 WebDAV/NAS Profile，隐藏或忽略浏览器同步类设置。

### 推荐工作流

#### 桌面浏览器到手机 PWA

1. 在桌面 Chrome 或 Edge 中以扩展方式打开 Navi。
2. 进入 `设置 -> 同步`，新建或选择 `WebDAV / NAS` Profile。
3. 填写 NAS 上的 `bookmarks.json` 地址、用户名和密码。
4. 点击“上传到 NAS”写入一次数据。
5. 打开“浏览器同步后上传”，让浏览器同步完成后自动更新 NAS。
6. 手机 PWA 使用同一个 WebDAV/NAS 地址读取数据。

移动端读取 WebDAV 时通常需要 NAS 或反向代理允许 CORS。

#### Safari 或其他浏览器

Safari 推荐先从浏览器导出书签 HTML，然后在 Navi 中点击“导入”。其他浏览器也可以用同样方式导入标准书签 HTML 文件。

### 书签与分类

Navi 支持：

- 添加、编辑、删除书签。
- 标题、描述、分类、标签、常用收藏、链接状态。
- 网格、列表等显示模式。
- 分类标签栏、侧边栏、下拉分类布局。
- 分类重命名、删除、拖拽排序、名称颜色。
- 分类和书签可选择固定位置，不再跟随浏览器同步顺序移动。
- 批量选择、批量删除、回收站恢复。

默认情况下，浏览器书签栏下的书签会归入“书签栏”，更接近 Chrome/Edge 自身的书签管理逻辑。

### 同步规则

浏览器书签同步支持 Chrome、Edge，以及通过导出文件导入的 Safari/其他浏览器书签。同步时可以选择不同规则：

| 规则 | 适合场景 |
| --- | --- |
| 合并 | 把新来源并入现有面板，尽量保留已有书签与设置 |
| 按来源独立 | Chrome、Edge、Safari 等来源分开管理 |
| 替换当前来源 | 只替换当前来源的旧书签 |
| 替换全部 | 使用当前来源重建全部书签和分类 |

同步会尽量复用已有书签记录，只更新差异、顺序、分类和来源信息，避免把一次同步表现成大量“删除后重建”的操作。

### AI 与描述摘要

书签描述可以手动填写，也可以点击书签编辑页里的“自动”生成。更多菜单中的“生成描述摘要”支持：

- 全部书签。
- 当前分类。
- 指定分类。
- 只补空描述。
- 重新生成全部描述。

AI 设置位于 `设置 -> 监控 & AI`。默认 `local` 模式使用本地规则，不需要联网。配置 Claude 或 OpenAI API Key 后，Navi 会优先根据页面标题、URL、已有描述和可读取到的网页内容生成更准确、简短的描述。

摘要规则会尽量保持一句话、短而清楚。中文默认控制在较短字符数内，英文默认控制在较短词数内，避免把卡片描述变成冗长介绍。

### 链接维护

“更多 -> 检查链接有效性”可以集中检查书签是否可访问。检查后可以打开“异常链接”菜单，按全部、无效、存疑筛选并继续维护。

受浏览器跨域限制，普通网页或 PWA 中的检测结果可能不如扩展环境准确。你也可以在书签编辑页中手动更正链接状态。

### 小组件

可在 `设置 -> 仪表盘` 开关和调整小组件：

- 时钟：支持秒、24 小时制、世界时钟、搜索城市或时区添加时钟。
- 天气：支持地区查询、摄氏/华氏、7 日预报。
- 日历：支持年份月份跳转、选中日期详情、几天前/几天后、提醒事项、完成后是否继续显示角标。
- 常用：自动统计常用书签，也可以手动添加常用收藏网页。
- 最近打开：记录最近访问，可清除。
- 概览：显示书签数量、异常链接、存储占用等。
- IP 与位置：显示公网 IP 和大致位置。
- 内网监控：可接入 NAS、Glances 或通用 JSON 接口；未配置时也会显示示例状态。
- 便签：保存简单文本。

移动端或安卓设备如果出现卡顿，建议使用 `设置 -> 外观 -> 低功耗模式`，并减少高透明玻璃、强动效和在线背景刷新。

### 外观

外观设置包括：

- 深浅色主题和自动主题。
- 页面名称、副标题、Logo。
- 渐变、图片、动态背景、在线壁纸。
- 在线壁纸来源、分类、定时换图、下载当前在线壁纸。
- 玻璃效果、不透明度、光泽、动效模式。
- 顶栏滚动隐藏开关。

### 数据、备份与隐私

Navi 默认把数据保存在当前浏览器的 `localStorage` 中。

这意味着：

- 不需要账号。
- 不会自动上传到服务器。
- 不同入口的数据彼此独立，例如 `chrome-extension://`、`file://`、HTTPS/PWA 是不同数据空间。
- 清除浏览器站点数据、卸载 PWA、删除扩展都可能删除本地数据。

建议整理完成后定期备份：

- “更多 -> 导出书签”导出通用浏览器书签 HTML。
- `设置 -> 通用 -> 数据与备份` 导出完整 `bookmarks.json`，包含书签、分类和设置。
- 使用 WebDAV/NAS Profile 保存远程副本。

API Key 只保存在当前浏览器本地。启用云端 AI 时，相关书签标题、URL、描述和可读取到的网页内容可能会发送给你选择的 AI 服务商。

### 操作日志与回收站

重要修改会进入操作日志，方便查看和撤销。日志保留时长可以在 `设置 -> 操作日志` 中设置，默认 2 天，可选：

`立即、1 天、2 天、3 天、5 天、7 天、14 天、30 天、不删除`

删除的书签会先进入回收站，可恢复或永久删除。回收站也可以设置自动保留时长。

### PWA 更新说明

PWA 依赖 Service Worker 缓存。如果你修改了代码但手机端仍显示旧版本，通常需要：

1. 更新 `sw.js` 顶部缓存版本号。
2. 确认新增文件在缓存列表中。
3. 在浏览器中刷新，必要时移除并重新添加 PWA。

### 文件结构

```text
index.html              页面结构、弹窗、设置面板
css/app.css             样式、响应式布局、PWA/移动端适配
js/state.js             默认状态、设置、localStorage key
js/i18n.js              多语言文案
js/utils.js             通用工具、保存读取、主题和语言应用
js/render.js            书签、分类、列表渲染
js/bookmarks.js         书签增删改、描述摘要、AI 摘要入口
js/categories.js        分类管理
js/import-export.js     书签 HTML 和 JSON 导入导出
js/chrome-sync.js       Chrome、Edge、Safari 来源同步
js/sync.js              WebDAV/NAS Profile 同步
js/settings.js          设置面板和设置项绑定
js/widgets.js           时钟、天气、日历、常用、最近、概览等小组件
js/monitor.js           内网监控小组件
js/health.js            链接健康检查与异常链接列表
js/suggest.js           AI 分类建议
js/oplog.js             操作日志与撤销
js/trash.js             回收站
js/palette.js           Ctrl/Command + K 命令面板
js/pwa.js               Service Worker 注册和 PWA 读取端适配
sw.js                   PWA 离线缓存
manifest.json           浏览器扩展清单
manifest.webmanifest    PWA 清单
background.js           扩展后台脚本
```

### 修改与调试

这个项目不需要构建工具。修改文件后直接刷新页面即可。扩展模式下修改代码后，需要回到扩展管理页刷新扩展。

本地调试 PWA 或 Service Worker 时，可以在项目目录启动一个简单静态服务：

```bash
python3 -m http.server 8767
```

然后访问 `http://localhost:8767/`。

### 安全提醒

- 不要把包含个人书签数据的导出文件发给不可信的人。
- 不要把未鉴权的 NAS、Glances 或内网服务接口暴露到公网。
- API Key 只建议保存在你信任的设备和浏览器中。
- 在清除站点数据、卸载 PWA 或删除扩展前，先导出备份。

<a id="english"></a>

## English

[中文](#中文)

### What Is Navi?

Navi is a local-first private bookmark dashboard. It can be used as a desktop start page, a browser extension, or an installable mobile PWA. With WebDAV/NAS profiles, different devices can read and write the same `bookmarks.json`.

It is useful if you want to:

- Turn Chrome, Edge, Safari, or exported browser bookmarks into a visual dashboard.
- Manage bookmarks on desktop and read the same data from a mobile PWA.
- Keep bookmarks, weather, calendar, world clocks, recent pages, favorites, and network monitoring in one place.
- Avoid accounts and hosted backends for your personal navigation data.

The app language can be changed with the language button in the top bar or from `Settings -> General -> Language`. The app currently includes English, Chinese, and Spanish UI text; this README provides Chinese and English sections.

### Quick Start

#### Option 1: Try It Directly

Open `index.html` in your browser. This is the fastest way to try the interface, add bookmarks manually, or import an exported browser bookmarks HTML file.

Note: when running from `file://`, PWA offline caching and native Chrome/Edge bookmark reading are not available.

#### Option 2: Use It As A Chrome Or Edge Extension

Use the extension mode if you want Navi to read native browser bookmarks.

1. Open the extensions page: `chrome://extensions` for Chrome, or `edge://extensions` for Edge.
2. Enable Developer mode.
3. Choose "Load unpacked".
4. Select this project folder.
5. Open Navi from the toolbar icon.
6. Go to `Settings -> Sync` to configure browser bookmark sync and WebDAV/NAS.

Extension sync reads browser bookmarks and turns them into Navi dashboard data. It does not write changes back to the browser's native bookmarks.

#### Option 3: Use It As A Mobile PWA

Deploy the project to an HTTPS static site, open it on your phone, and add it to the home screen. The PWA supports offline access and works well as a mobile bookmark reader.

If the PWA is only the read side of a `Chrome -> NAS -> mobile PWA` workflow, you can configure only the WebDAV/NAS profile and ignore desktop-only browser sync settings.

### Recommended Workflow

#### Desktop Browser To Mobile PWA

1. Open Navi as a Chrome or Edge extension on desktop.
2. Go to `Settings -> Sync`, then create or select a `WebDAV / NAS` profile.
3. Enter the `bookmarks.json` URL, username, and password.
4. Click "Upload to NAS" once to create the remote file.
5. Enable "Upload after browser sync" if you want the remote copy to update after browser sync.
6. Use the same WebDAV/NAS URL from the mobile PWA.

Mobile WebDAV reads usually require CORS support from your NAS or reverse proxy.

#### Safari Or Other Browsers

For Safari, export bookmarks as an HTML file first, then import that file in Navi. Other browsers can use the same standard bookmarks HTML import path.

### Bookmarks And Categories

Navi supports:

- Add, edit, and delete bookmarks.
- Titles, descriptions, categories, tags, favorite shortcuts, and link status.
- Grid and list-style views.
- Category tabs, drawer, and dropdown layouts.
- Rename, delete, reorder, and color category names.
- Pin categories or bookmarks so they stop following browser sync order.
- Multi-select, batch delete, and trash restore.

Bookmarks under the browser bookmarks bar are placed in the "Bookmarks bar" category by default, matching Chrome/Edge behavior more closely.

### Sync Rules

Browser bookmark sync supports Chrome, Edge, and exported Safari/other browser files. You can choose how incoming bookmarks are applied:

| Rule | Best For |
| --- | --- |
| Merge | Add a source into the existing dashboard while keeping existing data |
| Separate by source | Keep Chrome, Edge, Safari, and other sources visibly separated |
| Replace current source | Replace only bookmarks from the current source |
| Replace everything | Rebuild all bookmarks and categories from the current source |

Sync tries to reuse existing bookmark records and update only differences, order, category, and source data. This keeps sync behavior and notifications closer to "bookmarks synced" instead of "many items deleted and recreated".

### AI And Description Summaries

Bookmark descriptions can be written manually or generated with the "Auto" button in the bookmark editor. The "Summarize descriptions" action in the More menu supports:

- All bookmarks.
- Current category.
- A selected category.
- Empty descriptions only.
- Regenerate all descriptions.

AI settings live in `Settings -> Monitor & AI`. The default `local` provider uses local rules and does not require network access. If you configure a Claude or OpenAI API key, Navi can use the page title, URL, existing description, and readable page content to create a more accurate concise summary.

Summary prompts favor one short, clear sentence. Chinese summaries are kept to a short character limit, while English summaries are kept to a short word limit.

### Link Maintenance

"More -> Check links" checks whether bookmarks are reachable. After a check, open "Invalid links" to review all, invalid, or uncertain links and continue maintenance.

Because of browser cross-origin restrictions, checks are more reliable in extension mode than in a normal web page or PWA. You can also manually override link status from the bookmark editor.

### Widgets

Widgets can be enabled and adjusted from `Settings -> Dashboard`:

- Clock: seconds, 24-hour time, world clocks, city/timezone search.
- Weather: area search, Celsius/Fahrenheit, 7-day forecast.
- Calendar: year/month jump, selected-day details, relative day count, reminders, and completed-reminder badges.
- Frequently used: automatic usage ranking plus manually chosen favorite pages.
- Recently opened: recent visit history with a clear action.
- Overview: bookmark counts, link health, and storage usage.
- IP & location: public IP and approximate location.
- Network monitor: NAS, Glances, or generic JSON status; demo data is shown before configuration.
- Notes: lightweight local notes.

On Android or lower-power devices, use `Settings -> Appearance -> Low power mode` and reduce heavy glass effects, animations, and online wallpaper refreshes if the UI feels unstable.

### Appearance

Appearance settings include:

- Light/dark theme and auto theme.
- Page name, subtitle, and logo.
- Gradient, image, live, and online wallpaper backgrounds.
- Wallpaper source, category, rotation interval, and download current online wallpaper.
- Glass effect, opacity, sheen, and motion profile.
- Top bar hide-on-scroll toggle.

### Data, Backup, And Privacy

Navi stores data in the current browser's `localStorage` by default.

That means:

- No account is required.
- Data is not uploaded automatically.
- Different entry points use different data spaces, such as `chrome-extension://`, `file://`, and HTTPS/PWA.
- Clearing site data, uninstalling the PWA, or removing the extension can delete local data.

Recommended backup options:

- Use "More -> Export bookmarks" for a browser-compatible bookmarks HTML file.
- Use `Settings -> General -> Data & backup` for a full `bookmarks.json` backup with bookmarks, categories, and settings.
- Use a WebDAV/NAS profile for a remote copy.

API keys are stored only in the current browser. When a cloud AI provider is enabled, bookmark titles, URLs, descriptions, and readable page content may be sent to the provider you selected.

### Activity Log And Trash

Important changes are recorded in the activity log for review and undo. Log retention is configured in `Settings -> Activity log`; the default is 2 days. Options are:

`Immediately, 1 day, 2 days, 3 days, 5 days, 7 days, 14 days, 30 days, never delete`

Deleted bookmarks go to the trash first and can be restored or permanently deleted. Trash retention can also be configured.

### PWA Updates

The PWA uses Service Worker caching. If a phone still shows an old version after code changes:

1. Update the cache version at the top of `sw.js`.
2. Make sure new files are listed in the cache list.
3. Refresh the browser, or remove and reinstall the PWA if needed.

### File Structure

```text
index.html              Page structure, modals, settings panels
css/app.css             Styles, responsive layout, PWA/mobile adaptation
js/state.js             Default state, settings, localStorage key
js/i18n.js              UI translations
js/utils.js             Shared helpers, persistence, theme and language application
js/render.js            Bookmark, category, and list rendering
js/bookmarks.js         Bookmark CRUD, description summaries, AI summary entry points
js/categories.js        Category management
js/import-export.js     Bookmarks HTML and JSON import/export
js/chrome-sync.js       Chrome, Edge, and Safari source sync
js/sync.js              WebDAV/NAS profile sync
js/settings.js          Settings panel bindings
js/widgets.js           Clock, weather, calendar, favorites, recent, overview, and more
js/monitor.js           Network monitor widget
js/health.js            Link health checks and invalid-link review
js/suggest.js           AI category suggestions
js/oplog.js             Activity log and undo
js/trash.js             Trash
js/palette.js           Ctrl/Command + K command palette
js/pwa.js               Service Worker registration and PWA reader adaptation
sw.js                   PWA offline cache
manifest.json           Browser extension manifest
manifest.webmanifest    PWA manifest
background.js           Extension background script
```

### Development

No build step is required. Edit files and refresh the page. In extension mode, refresh the unpacked extension from the browser extensions page after code changes.

For local PWA or Service Worker testing, start a simple static server in the project folder:

```bash
python3 -m http.server 8767
```

Then open `http://localhost:8767/`.

### Safety Notes

- Do not share exported files that contain private bookmarks with untrusted people.
- Do not expose unauthenticated NAS, Glances, or internal service endpoints to the public internet.
- Store API keys only on devices and browsers you trust.
- Export a backup before clearing site data, uninstalling the PWA, or removing the extension.
