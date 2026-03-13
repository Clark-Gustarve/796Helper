---
name: abandon-custom-domain-search
overview: 放弃以 Cloudflare 自定义域名作为影视搜索正式方案，改为用不依赖自定义域名的可用搜索路径完善体验，并同步收敛前端默认行为、提示文案与相关文档。
todos:
  - id: scan-references
    content: 使用[subagent:code-explorer]复核自定义域名与workers.dev引用
    status: completed
  - id: refactor-search-flow
    content: 重构js/pages/movie-search.js默认站外搜索与增强回退
    status: completed
    dependencies:
      - scan-references
  - id: align-config-ui
    content: 调整index.html与css/pages.css的默认配置和文案
    status: completed
    dependencies:
      - refactor-search-flow
  - id: cleanup-custom-domain
    content: 清理Cloudflare自定义域名说明Markdown与HTML
    status: completed
    dependencies:
      - align-config-ui
  - id: sync-docs
    content: 更新部署清单、CHANGELOG与技术文档口径
    status: completed
    dependencies:
      - cleanup-custom-domain
  - id: verify-search-modes
    content: 验证无增强服务、增强服务和缓存隔离场景
    status: completed
    dependencies:
      - sync-docs
---

## 用户需求

- 放弃把自定义域名作为影视搜索的主方案。
- 在不配置额外域名的情况下，搜索页仍要能正常使用，并给用户明确、可继续操作的结果入口。
- 页面说明、设置区、帮助文档与验收内容统一到新方案，不再出现误导性的旧说明。

## 产品概览

- 影视搜索页保留现有搜索框、来源选择、结果卡片和状态切换。
- 默认搜索体验应更直接：用户输入关键词后，能快速看到可继续打开的搜索结果入口，而不是长时间等待后反复报错。
- 设置区继续使用折叠卡片样式，但内容改为“可选增强搜索”，视觉上保持简洁、清晰、易理解。

## 核心功能

- 默认可用搜索：无额外配置时也能继续查找资源。
- 增强搜索可选：有可用增强服务时返回更完整结果，没有时自动回到站外搜索入口。
- 明确状态提示：区分普通搜索、增强搜索失败与站外搜索模式。
- 统一说明内容：清理旧的自定义域名引导，保证页面和文档表达一致。

## Tech Stack Selection

- 前端沿用现有原生 HTML、CSS、JavaScript 单页应用结构。
- 页面模块继续复用 `js/pages/movie-search.js` 的 IIFE 页面模式与 `css/pages.css` 的页面级样式组织方式。
- 运行时配置继续使用 `index.html` 中的 `window.__796HELPER_CONFIG__.movieSearch`。
- 兼容现有可选增强服务接口约定：`/api/search` 与 `/health`，不强制依赖自定义域名。

## Implementation Approach

- 将影视搜索默认路径从“固定先请求默认服务地址”调整为“无增强服务时直接进入站外搜索入口；有增强服务时再尝试直链搜索”。这样可以在不依赖自定义域名的前提下立即可用，同时保留后续接入任意兼容服务地址的扩展能力。
- 复用现有 `getApiConfig`、`requestSearchFromApis`、`generateFallbackResults`、`CacheManager`、`AbortController`、筛选与复制链路，只收敛搜索决策、默认配置和提示文案，避免重写整套状态机。
- 性能上保持当前优势：配置判定为 O(1)，服务轮询为 O(n)，缓存读写为 O(1)。主要瓶颈仍是网络延迟；通过“空服务列表直接跳过请求”“保留防抖、取消、缓存隔离”减少无意义等待。

## Implementation Notes

- 不在浏览器端新增对 `PanSearch` 的直接抓取解析，避免跨域限制与上游结构波动带来的高回归风险；真实直链能力继续复用现有兼容 `/api/search` 的服务实现。
- `index.html` 不再内置单一 `workers.dev` 默认地址；搜索页文案也不再把“自定义域名”作为推荐路径，统一改为“可选增强搜索服务地址”。
- 保留本地保存地址与代理签名缓存隔离，避免切换服务后命中旧缓存。
- 控制改动范围在影视搜索页、运行时配置与文档层，避免影响路由、主题、聊天等无关模块。

## Architecture Design

- 运行时配置层：`index.html` 提供可选的 `movieSearch.apiBases`。
- 页面状态层：`MovieSearchPage` 读取本地保存地址与运行时配置，判断当前是否存在增强搜索服务。
- 搜索执行层：
- 无服务地址：直接生成 `PanSearch` 搜索结果页入口，并展示清晰说明。
- 有服务地址：按现有顺序请求兼容 `/api/search` 的服务；成功时展示真实网盘结果，失败时回退到站外搜索入口。
- 可选服务层：保留 `worker/index.js` 当前接口约定，作为后续可迁移的增强服务实现，但不再作为默认必经入口。

## Directory Structure

整体只收敛影视搜索入口、运行时配置与文档口径，不引入新的页面架构。

- `e:/MY Project/796Helper/js/pages/movie-search.js` [MODIFY]
- Purpose: 影视搜索主状态机与结果渲染入口。
- Functionality: 移除“默认必须依赖固定服务地址”的前提，增加“无增强服务时直接站外搜索”的默认决策，调整设置面板与提示文案。
- Implementation requirements: 继续复用缓存、防抖、AbortController、结果筛选与复制逻辑。

- `e:/MY Project/796Helper/index.html` [MODIFY]
- Purpose: 提供影视搜索运行时默认配置。
- Functionality: 去掉以自定义域名或固定 `workers.dev` 为默认入口的配置倾向，保留可选增强服务注入能力。
- Implementation requirements: 兼容已有 `window.__796HELPER_CONFIG__.movieSearch` 结构。

- `e:/MY Project/796Helper/css/pages.css` [MODIFY]
- Purpose: 影视搜索页设置区与提示区样式。
- Functionality: 收敛“代理设置”相关视觉文案承载，必要时补充默认站外搜索说明的样式。
- Implementation requirements: 沿用当前玻璃态卡片风格与移动端断点。

- `e:/MY Project/796Helper/部署后验收清单.md` [MODIFY]
- Purpose: 上线与回归验收标准。
- Functionality: 改为覆盖“无增强服务默认站外搜索”“有增强服务返回直链”“缓存隔离”三类场景。
- Implementation requirements: 删除“先绑自定义域名再上线”的前提描述。

- `e:/MY Project/796Helper/CHANGELOG.md` [MODIFY]
- Purpose: 记录本次搜索策略收敛。
- Functionality: 补充版本条目，说明默认搜索入口、可选增强服务和文档调整。
- Implementation requirements: 保持现有 Keep a Changelog 结构。

- `c:/Users/leyanlin/AppData/Roaming/CodeBuddy CN/User/globalStorage/tencent-cloud.coding-copilot/brain/b152d7d6967648eea73e72e4b28fec15/796Helper-技术文档.md` [MODIFY]
- Purpose: 项目正式技术说明。
- Functionality: 同步默认搜索模式、可选增强服务口径、版本号与文件说明。
- Implementation requirements: 修正当前文档头部版本与正文不一致问题。

- `e:/MY Project/796Helper/Cloudflare Worker自定义域名操作清单.md` [REMOVE]
- Purpose: 旧的自定义域名专用说明。
- Functionality: 删除或下线，避免与新方案冲突。
- Implementation requirements: 若保留历史记录，应在正式文档中注明该方案已不再作为主路径。

- `e:/MY Project/796Helper/cloudflare-checklist.html` [REMOVE]
- Purpose: 旧的自定义域名 HTML 说明页。
- Functionality: 删除或下线，避免继续引导错误方案。
- Implementation requirements: 不再让该页面成为当前搜索方案的有效说明入口。

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核项目中自定义域名、`workers.dev`、影视搜索配置与文档引用的全量落点。
- Expected outcome: 产出完整受影响文件清单，确保代码、说明与验收口径一次性收敛，不遗漏旧文案与旧入口。