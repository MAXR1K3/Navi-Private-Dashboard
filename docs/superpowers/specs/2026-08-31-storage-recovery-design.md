# Navi 存储基础与数据恢复设计

**日期：** 2026-08-31

**状态：** 已批准

**范围：** 长期数据架构的第一个独立子项目

## 1. 目标

在不改变 Navi 现有功能和本地优先定位的前提下，建立统一的存储边界，并确保主数据损坏、格式不兼容或读取失败时不会自动初始化、不会覆盖原始数据，用户始终拥有明确的恢复路径。

本阶段同时为后续 IndexedDB 主存储迁移建立稳定接口，但不在一次改动中重写全部同步式业务代码。

## 2. 当前问题

当前 `load()` 直接读取 `navi.dashboard.v3`。如果 JSON 解析失败或结构不符合预期，程序会落入 `seed()`，显示演示数据。此后任意保存动作都可能用演示数据覆盖异常的原始数据。

当前业务代码还直接依赖全局 `state`、同步式 `save()` 和 `localStorage`。若立即把所有读写改为异步 IndexedDB，会同时影响书签、分类、回收站、操作日志、设置、同步和小组件，扩大一次发布的回归面。

## 3. 决策

采用渐进式 IndexedDB 路线：

1. 本阶段先引入统一的 `NaviStorage` 接口。
2. 当前主数据继续使用原 `localStorage` key，保持现有同步业务兼容。
3. 最近有效版本存入 IndexedDB 恢复仓库，避免在约 5 MB 的 `localStorage` 配额内复制整库。
4. 启动过程改为显式区分“正常数据、首次启动、需要恢复”三种结果。
5. 后续阶段可以在不改变恢复界面和业务调用语义的情况下，将主存储实现切换到 IndexedDB。

不采用以下方案：

- 不长期维护两份完整的 `localStorage` 主数据，因为会显著压缩可用容量。
- 不在本阶段进行大爆炸式 IndexedDB 迁移，因为它会把所有保存路径同时改成异步。
- 不使用哈希、冻结契约或额外发布门禁；这里的具体风险是损坏数据被初始化数据覆盖，普通版本号、结构校验、恢复副本和测试足以防止或发现该问题。

## 4. 存储边界

新增 `js/storage.js`，集中负责原始数据的读取、验证、持久化和恢复版本管理。业务模块不得新增直接访问主数据 key 的代码。

第一阶段公开接口：

```text
NaviStorage.inspectPrimary()
  -> { status: "ok", state, raw }
  -> { status: "first-run" }
  -> { status: "recovery", reason, raw }

NaviStorage.persist(state)
  -> boolean

NaviStorage.getLastGood()
  -> Promise<{ state, raw, savedAt } | null>

NaviStorage.restore(raw)
  -> Promise<boolean>

NaviStorage.clearAll()
  -> Promise<void>
```

`inspectPrimary()` 与 `persist()` 在第一阶段保持同步，以兼容现有调用；IndexedDB 恢复仓库通过串行队列异步更新。接口内部负责捕获失败并向现有存储告警机制报告。

## 5. 数据验证

新增纯函数 `validateDashboardState(value)`，只验证继续启动所必需的最小结构：

- 根值是普通对象。
- `bookmarks` 必须是数组。
- `categories`、`trash`、`calendarEvents` 和 `opLog` 如果存在，必须是数组；缺失时由现有迁移逻辑补齐。
- `settings` 是对象。
- `theme` 与 `view` 能被现有归一化逻辑接受。

旧版 `navi.dashboard.v2` 和缺少显式 schema 版本的 v3 数据仍可读取。首次成功保存时写入根级 `schemaVersion`，以后只通过普通版本迁移处理格式变化。

结构校验不尝试拒绝每个未知字段，也不把当前对象形状冻结成永久契约。导入书签的 URL 清理与分类归一化仍由现有业务函数负责。

## 6. 有效版本记录

IndexedDB 数据库名为 `navi-storage`，第一阶段只包含一个 `revisions` object store：

```text
id: auto-increment
savedAt: number
schemaVersion: number
raw: string
```

保存流程：

1. 序列化候选 `state`。
2. 立即重新解析并通过 `validateDashboardState` 验证。
3. 读取当前主 key；如果当前内容仍是有效状态，将它作为“上一有效版本”加入串行恢复队列。
4. 使用单次 `localStorage.setItem` 替换主 key。
5. 恢复仓库只保留最近 3 个不同版本，删除更早版本。

如果 `localStorage.setItem` 失败，主数据保持原样，沿用现有容量告警。恢复仓库写入失败不会谎报主数据保存失败，但会显示一次“恢复副本未更新”的非阻塞告警。

恢复仓库只记录保存前的有效主数据，避免某次逻辑错误立即把所有恢复版本替换成同一份候选数据。

## 7. 启动状态机

`app.js` 改为先检查存储，再启动会写数据的初始化器。

### 正常数据

1. `inspectPrimary()` 返回 `ok`。
2. 应用现有迁移和归一化逻辑。
3. 启动回收站清理、操作日志、同步和渲染。

### 首次启动

只有主 key 和旧版 key 都不存在时才属于首次启动。此时可以生成演示数据，并立即保存为新的主数据。

### 需要恢复

JSON 无法解析、根结构错误或迁移失败时：

1. 保留原始主 key，不进行任何覆盖。
2. 不调用 `seed()`、`purgeTrash()`、同步初始化或其他可能保存数据的函数。
3. 异步读取 IndexedDB 最近有效版本。
4. 显示专用恢复界面。

## 8. 恢复界面

恢复界面阻止进入普通仪表盘，并清楚说明数据未被删除。提供三个动作：

1. **恢复上一版本**：仅在 IndexedDB 存在有效版本时启用；恢复前仍保留当前异常原文，恢复成功后刷新应用。
2. **下载异常原始数据**：将当前主 key 原文下载为带日期的 `.json` 或 `.txt` 文件，不尝试修复内容。
3. **重置 Navi**：危险操作，需二次确认；只在确认后删除 `navi.dashboard.v3`、`navi.dashboard.v2`、`navi.dashboard.prev`、所有 `navi.pdata.*` Profile 缓存和 `navi-storage` 恢复版本，然后重新创建初始数据。不得调用 `localStorage.clear()`，页面存档 IndexedDB 和不属于本应用的同源数据不在本动作范围内。

界面必须满足现有弹窗键盘规则：具名 `role="dialog"`、初始焦点、Escape 不得绕过恢复决策、错误信息通过 live region 宣告。

## 9. 数据迁移与回退

本阶段不删除 `navi.dashboard.v2`。从旧 key 成功迁移后，保留旧原文作为只读回退；至少到 IndexedDB 主存储阶段完成前都不自动清理。

后续切换 IndexedDB 主存储时：

- 从当前 `NaviStorage` 接口内部迁移，不让 UI 模块直接接触数据库。
- 一次性迁移成功后，原 `localStorage` 主数据保留为只读回退，不立即删除。
- 只有 IndexedDB 事务提交成功后，应用才标记迁移完成。

## 10. 错误处理

- 无数据与坏数据必须是不同状态。
- 任何解析异常都保留原始字符串。
- 恢复版本本身也必须重新解析和验证，不能因为它来自 IndexedDB 就默认可信。
- 如果主数据和恢复版本都无效，仍允许下载原文和明确重置。
- 页面关闭时尚未写完恢复版本不会影响主数据；下一次保存继续更新恢复仓库。

## 11. 测试策略

严格采用 RED → GREEN：

### 纯逻辑测试

- 合法当前状态返回 `ok`。
- 主 key 完全不存在返回 `first-run`。
- JSON 截断、根值错误、数组字段错误返回 `recovery`。
- 坏数据绝不调用 `seed()` 或写主 key。
- 保存前只归档有效旧版本。
- 恢复版本保留数量最多为 3。
- 旧 v2 数据仍能迁移。

### 真实浏览器 E2E

- 注入损坏的主 key 后打开页面，显示恢复界面且原文不变。
- 存在上一有效版本时可以恢复并重新进入仪表盘。
- 不存在恢复版本时恢复按钮禁用，但下载和重置仍可用。
- 重置必须经过确认。
- 键盘焦点和屏幕阅读器名称正确。

### 回归验证

- 全部现有逻辑测试。
- 全部真实 Chrome E2E。
- JavaScript 语法检查。
- Service Worker shell 与页面脚本列表一致。

## 12. 本阶段文件范围

预计新增：

- `js/storage.js`

预计修改：

- `index.html`：恢复界面与脚本加载顺序。
- `js/utils.js`：让现有 `load/save` 委托给存储接口。
- `js/app.js`：启动状态机。
- `js/i18n.js`：恢复文案。
- `css/app.css`：恢复界面样式。
- `tools/test.js`：纯逻辑回归。
- `tools/e2e.js`：真实浏览器恢复流程。
- `sw.js`：通过现有 bump 工具纳入新增脚本并更新缓存版本。
- `README.md`：数据恢复说明。

## 13. 明确不在本阶段完成

- WebDAV ETag、三方合并和删除墓碑。
- API Key、WebDAV、Synology 凭据隔离。
- IndexedDB 成为全部主数据的唯一来源。
- 书签按记录增量写入。
- UI 视觉重做或框架迁移。

这些内容分别进入后续独立设计、计划和实现周期，避免把三套高风险数据改动合并成一次发布。

## 14. 完成标准

- 损坏数据不会自动进入演示数据流程，也不会被启动副作用覆盖。
- 用户能恢复最近有效版本、下载异常原文或明确重置。
- 正常现有数据无需手工操作即可继续使用。
- 新的存储边界能在后续替换为 IndexedDB 主实现。
- 所有现有及新增自动化测试通过，工作区无意外生成文件。
