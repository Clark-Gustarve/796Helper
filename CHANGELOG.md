# 796Helper 更新日志

所有显著的项目变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循语义化版本。

---

## [v2.0.6] - 2026-03-12

### 修复
- **PanSearch 页面可见内容被截断导致直链丢失**：Worker 解析 `pansearch.me/search` 时，优先读取 Next.js 的 `__NEXT_DATA__` JSON，从完整 `content` 字段提取真实网盘链接，而不再只依赖页面卡片上的截断 HTML
- **搜索结果继续命中修复前缓存**：前端缓存 schema 升级到 `2.0.6`，避免浏览器继续复用旧的空结果或搜索页结果缓存

### 文档
- **部署验收与技术说明同步收敛**：更新 `部署后验收清单.md` 与 `796Helper-技术文档.md`，统一为 `v2.0.6`、`PanSearch` 真实网盘直链、`workers.dev` 默认入口的当前口径

### 验证
- 已直接抓取 `PanSearch` 搜索页源码，确认真实网盘链接位于 `__NEXT_DATA__` 的 `props.pageProps.data.data[].content`
- 已通过 `worker/index.js`、`js/pages/movie-search.js` 的 linter 检查；`js/pages/movie-search.js` 仅保留原有 `document.execCommand` 弃用提示
- 已通过 `wrangler deployments status --name 796helper-movie-search --json` 确认生产版本 `ec7874ec-4ce2-4392-b2b9-b171af123a76` 以 `100%` 流量生效
- 已确认当前网络对 `workers.dev` 存在访问层异常：`796helper-movie-search.clown8379.workers.dev` 解析为 `31.13.95.169`、`workers.dev` 解析为 `128.242.240.221`，`/health` HTTPS 请求报“基础连接已经关闭”；问题更接近本地 DNS/TLS 干扰，而不是 `worker/index.js` 缺少路由


---

## [v2.0.5] - 2026-03-11

### 调整
- **影视搜索改为 PanSearch 直链优先**：Worker 不再并发请求或合并 `UP云搜` 结果，`/api/search` 只返回通过 `PanSearch` 解析出的真实网盘链接
- **前端兜底入口收敛**：代理不可达或超时时，结果区只保留 `PanSearch` 搜索页入口，不再生成 `UP云搜` 搜索页卡片
- **旧缓存失效处理**：前端缓存 schema 升级到 `2.0.5`，避免历史 `UP云搜` 搜索页结果继续命中缓存

### 验证
- 已通过 `js/pages/movie-search.js` 与 `worker/index.js` 的静态复核
- 已通过针对修改文件的 linter 检查；`js/pages/movie-search.js` 仅保留原有 `document.execCommand` 弃用提示
- 当前为代码层调整，未在本地完成外网实时搜索验收

---

## [v2.0.4] - 2026-03-11


### 修复
- **影视搜索单一代理失效即整体失败**：前端搜索改为优先读取 `window.__796HELPER_CONFIG__.movieSearch.apiBases`，按顺序轮询代理地址；默认仍兼容既有 `workers.dev` 地址
- **代理不可达时只能报错或展示随机演示数据**：当所有代理都不可用或搜索超时时，自动生成 `PanSearch` 与 `UP云搜` 的真实站外搜索入口，并在结果区显示提示横幅，避免用户持续看到“搜索失败”
- **Worker 响应结构不稳定**：`/api/search` 新增统一 `version` / `code` / `source` 字段，`/health` 补充 `routes` 信息，便于前端兼容与线上排障

### 验证
- 已通过 `js/pages/movie-search.js`、`worker/index.js`、`index.html` 的静态复核
- 已通过针对修改文件的 linter 检查；`js/pages/movie-search.js` 仅保留原有 `document.execCommand` 弃用提示
- 当前环境下外网 Worker 地址仍不可达，未完成线上实时搜索验收

---

## [v2.0.2] - 2026-03-11


### 修复
- **影视资源旧缓存污染新结果**：为前端 `sessionStorage` 搜索缓存增加 `2.0.2` schema 版本隔离，首次读取时自动清理旧 `796h-mc-` 命名空间，避免继续命中历史 UP 云搜搜索页链接
- **PanSearch 直链提取失配**：Worker 端新增 `extractPanUrls()` 链路，补齐裸链接、`data-url`/`data-link`/`href` 属性、转义字符串与 URL 编码场景的真实网盘链接提取
- **健康检查版本不同步**：`/health` 改为返回 `WORKER_VERSION` 常量，避免线上版本号与代码实现不一致

### 验证
- 已完成 `worker/index.js` 与 `js/pages/movie-search.js` 的静态链路复核
- 已通过针对修改文件的 linter 检查；外网接口在线请求在当前环境下不可达，未完成实时接口验收

---

## [v2.0.1] - 2026-03-11

### 修复
- **事件委托路由切换后失效**：移除 `delegatesAttached` 守卫，每次 `init()` 重新绑定事件委托（路由切换会重建 DOM，旧绑定失效）
- **Worker 竞速策略改为真正竞速**：使用 `Promise.race` 替代固定顺序等待，PanSearch 和 UP 云搜谁先返回充足结果就先用谁

---

## [v2.0.0] - 2026-03-10

### 新增
- **双搜索源竞速策略**：Worker 端同时请求 PanSearch + UP 云搜，PanSearch 优先返回真实网盘链接，UP 云搜兜底补充
  - PanSearch 搜索源：直接从 HTML 中提取真实的网盘链接（`pan.baidu.com`、`drive.quark.cn`、`www.alipan.com` 等），包含提取码
  - UP 云搜搜索源（兜底）：当 PanSearch 结果不足 3 条时自动启用
  - 双源结果智能合并：PanSearch 真实链接优先排列，UP 云搜结果追加
- **URL 域名来源检测**：新增 `detectSourceByUrl()` 函数，通过网盘链接域名自动识别来源类型
- **智能去重**：基于链接 URL + 标题前20字符双重去重

### 优化
- **复制逻辑优化**：网盘直链 → 直接复制链接（+ 提取码）；搜索页链接 → 复制标题 + 链接
- **复制按钮智能提示**：网盘直链显示"复制网盘链接"，搜索页显示"复制资源信息"
- **健康检查增强**：`/health` 端点新增版本号和搜索源列表

---

## [v1.5.0] - 2026-03-10

### 修复
- **影视搜索链接无法打开**：修复搜索结果链接指向无效地址（`example.com`）的问题
  - Worker 端新增真实网盘链接提取能力（正则匹配百度网盘、夸克网盘、阿里云盘等直链）
  - Worker 端新增 `data-url`/`data-link` 等自定义属性的链接提取
  - 前端演示数据（API 不可用时的 fallback）链接从 `example.com` 改为 UP 云搜搜索页真实链接
  - 链接按钮根据链接类型显示不同的图标和提示文案（直链 vs 搜索引擎页）

### 优化
- **链接按钮智能提示**：新增 `isDirectPanLink()` 函数，自动识别链接类型，网盘直链显示"打开网盘链接"，搜索页链接显示"前往搜索引擎查看资源"
- **Worker 链接解析增强**：新增 `extractPanUrls()` 函数，支持从 HTML 中提取百度网盘、夸克网盘、阿里云盘、迅雷网盘、天翼云盘、115网盘、蓝奏云等平台的直链

---

## [v1.4.0] - 2026-03-10

### 新增
- **全面移动端适配**：系统性优化手机端浏览体验，覆盖所有页面和组件
- **CSS 变量断点覆盖**：在 `variables.css` 中新增 768px/480px 断点的设计令牌动态覆盖（字体大小、间距、header 高度自动缩放）
- **触摸设备优化**：通过 `@media (hover: none)` 禁用卡片/按钮的 hover 上浮动画，消除触摸屏粘滞态
- **全局触摸交互增强**：添加 `touch-action: manipulation`（消除 300ms 点击延迟）、`-webkit-tap-highlight-color: transparent`（消除点击高亮）
- **dvh 视口单位支持**：body、.app、.sidebar、.main-content 使用 `100dvh`（fallback `100vh`），解决移动端浏览器地址栏收缩时的高度跳变
- **safe-area 安全区域适配**：viewport-fit=cover + `env(safe-area-inset-*)` 处理，支持刘海屏/异形屏
- **Dashboard 页 480px 断点**：补全小屏适配（紧凑间距、缩小字体、缩减 grid 间隙）
- **Chat 页 480px 断点**：补全小屏适配（消息气泡/头像缩小、输入区紧凑化、隐藏输入提示）
- **Chat 输入区 safe-area**：聊天输入区底部补偿安全区域，防止被手机底部横条遮挡
- **Chat 输入框 16px 字体**：避免 iOS 自动缩放（font-size < 16px 触发）
- **Header 移动端紧凑化**：768px 时高度缩至 52px、480px 时缩至 48px，标题字体缩小
- **通用组件响应式**：components.css 新增 768px/480px 双断点（按钮最小触摸区 44px、卡片紧凑 padding、输入框 16px 字体、标签/徽章缩小）
- **影视搜索触摸优化**：结果卡片、来源选项、操作按钮禁用 hover 效果，Toast 适配 safe-area
- **侧边栏导航触摸优化**：移动端 nav-item 最小高度 44px，满足触摸目标尺寸规范
- **Layout 480px 断点**：补全 header/按钮在小屏手机的进一步紧凑适配
- **动画性能优化**：移动端动画时长缩短至 0.2s，减少性能开销

---

## [v1.3.0] - 2026-03-10

### 优化
- **Worker 端竞速策略**：P1 结果 ≥ 10 条时不等 P2 直接返回，节省 2-5 秒响应时间
- **Worker 端预编译正则**：所有正则表达式提升为模块级常量，避免每次调用重新创建
- **Worker 端 HTML 截取**：解析前截取 `<body>` 内容，减少 60%+ 扫描范围
- **Worker 端代码精简**：移除未使用的 `parseSearchResults` 通用解析函数
- **Worker 端来源检测优化**：`detectSource` 按关键词长度降序匹配，命中即返回
- **前端持久化缓存**：搜索缓存从内存 Map 升级为 sessionStorage（CacheManager），页面刷新不丢失
- **搜索防抖**：Enter 键和搜索源切换新增 300ms 防抖，避免重复请求
- **搜索按钮状态锁**：搜索进行中禁用按钮并显示 Loading 态，防止重复点击
- **Loading 实时计时器**：搜索等待期间显示实时耗时（秒），改善用户心理预期
- **事件委托重构**：复制/筛选/重试/搜索源切换改为事件委托，消除 `bindDynamicEvents` 重复绑定
- **局部 DOM 更新**：筛选切换时仅更新结果列表和标签栏，不全量重写内容区
- **createIcons 优化**：仅在 innerHTML 实际变化时调用 `lucide.createIcons()`

---

## [v1.1.0] - 2026-03-10

### 新增
- **影视资源搜索**：全新功能页面，支持通过影视名称搜索网盘资源
- 资源来源筛选：支持按百度网盘、夸克网盘、迅雷网盘、阿里云盘等来源分类筛选
- Cloudflare Workers 后端代理服务：转发爬虫请求，解决跨域限制，支持 HTML 解析与缓存
- 搜索结果卡片：展示资源标题、来源标签、提取码、时间，支持一键复制链接与提取码
- 热门搜索推荐：欢迎页展示热门影视关键词，点击即搜
- 多状态 UI：欢迎态、加载态、空结果态、错误态（含重试），交互完整
- 仪表盘新增影视搜索功能入口卡片
- 侧边栏"工具"分区新增影视搜索导航项
- 影视搜索页面完整移动端响应式适配（768px / 480px 双断点）

---

## [v1.0.2] - 2026-03-10

### 变更
- 默认首页从 AI 助手切换为仪表盘页面
- 侧边栏导航顺序调整：仪表盘置顶为第一项
- 顶部栏默认标题同步更新为"仪表盘"
- 路由注册顺序调整，仪表盘优先

---

## [v1.0.1] - 2026-03-10

### 新增
- 项目托管至 GitHub 仓库：https://github.com/Clark-Gustarve/796Helper
- 启用 GitHub Pages 部署，在线访问地址：https://clark-gustarve.github.io/796Helper/

---

## [v1.0] - 2026-03-10

### 新增
- 项目初始化，搭建基础网页框架
- 侧边栏导航：支持折叠/展开，移动端抽屉式呼出，导航项高亮联动路由
- 顶部栏：页面标题动态更新、主题切换按钮、用户头像
- Hash 路由系统：支持 SPA 页面切换，动态注册页面模块
- 深色/浅色双主题：CSS Variables 令牌体系，localStorage 持久化，跟随系统偏好
- AI 聊天页面：消息气泡（用户/AI 区分）、本地模拟对话、欢迎状态、快捷标签、自动滚动、Shift+Enter 换行
- 仪表盘页面：时段问候语、功能卡片网格、版本信息
- 响应式布局：768px 断点适配桌面端与移动端
- Glassmorphism 玻璃态设计风格，微动画交互效果
