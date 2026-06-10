# Navi — 私人书签导航页

同一套代码支持三种使用方式：

| 方式 | 怎么用 |
|---|---|
| Chrome 扩展（新标签页） | `chrome://extensions` → 加载已解压的扩展程序 → 选本文件夹（改动后点刷新） |
| 本地双击 | 直接打开 `index.html`（file:// 下 PWA 自动跳过，不影响功能） |
| PWA 手机端 | 把整个文件夹静态托管（GitHub Pages / Vercel / Netlify 等，需 HTTPS），手机浏览器打开后"添加到主屏幕"即可像 App 一样使用、离线可用 |

> 手机端走 PWA 模式，不依赖 Chrome 扩展，也不读取 Chrome 书签 API（Chrome Sync 功能只在扩展环境自动启用）。数据存在各端各自的 localStorage，跨端同步可用 导出/导入 HTML。

## 目录结构（模块职责）

```
index.html            页面骨架（无样式/逻辑）
css/app.css           全部样式
js/                   按职责拆分，普通 <script> 顺序加载，无需构建
  i18n.js             多语言文案 + t()
  state.js            状态结构 defaults / state / ui
  icons.js            SVG 图标库
  utils.js            工具函数 + load/save 持久化
  render.js           分类/卡片网格渲染
  widgets.js          时钟/搜索/天气/日历等小组件
  ui-core.js          toast / toastUndo（撤销）/ 模态框
  bookmarks.js        书签增删改 + 自动抓取标题/描述
  categories.js       分类管理 + 多选批量操作
  dragdrop.js         卡片拖拽排序
  import-export.js    浏览器书签 HTML 导入/导出
  settings.js         设置面板（含 AI 引擎/Key）
  menu.js             头部"更多"菜单
  chrome-sync.js      Chrome 书签只读同步（仅扩展环境）
  trash.js            回收站（软删除/保留期/恢复/清空）
  health.js           链接健康检查
  suggest.js          AI 分类建议（本地规则 + 可选 Claude/OpenAI）
  pwa.js              Service Worker 注册（仅 https）
sw.js                 离线缓存（改完代码记得把 CACHE 版本号 +1）
manifest.json         Chrome 扩展清单
manifest.webmanifest  PWA 清单
background.js         扩展后台：离线排队 Chrome 书签事件
```

新增功能时：新建一个 `js/xxx.js`，在 `index.html` 的 `app.js` 之前加一个 `<script>`，并把文件名补进 `sw.js` 的 SHELL 列表。

## 功能说明

- **回收站**：删除（单个/批量）不再直接删数据，先进回收站；"更多菜单 → 回收站"里可恢复/永久删除/清空，保留时长可选 立即/1/3/7/14 天（到期自动清理）。
- **撤销**：删除、批量删除、删除分类（书签被移动）、应用 AI 建议后，右下角 toast 提供约 6 秒的撤销入口。
- **链接健康检查**："更多菜单 → 检查链接有效性"，并发检测全部书签；卡片标题前显示状态点：绿=正常、红=疑似失效、黄=存疑。扩展环境读真实状态码，网页/PWA 环境用 no-cors 探测。
- **AI 分类建议**："更多菜单 → AI 分类建议"。根据标题/URL/域名/描述推荐分类和标签，只生成建议，勾选后手动应用。默认本地规则引擎（离线可用）；设置里可切到 Claude/OpenAI 并填 API Key（仅存本机）获得更智能的建议。
