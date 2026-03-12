---
name: movie-search-pansearch-direct-link-alignment
overview: 按用户最新要求，将未完成任务从“切换自定义域名”调整为“确保影视搜索通过 PanSearch 直接提取真实网盘链接”，并同步清理与该目标不一致的代码文档口径。
todos:
  - id: audit-pansearch-chain
    content: 使用[subagent:code-explorer]复核PanSearch直链链路与旧口径
    status: completed
  - id: align-runtime-behavior
    content: 对齐`worker/index.js`与`js/pages/movie-search.js`实现口径
    status: completed
    dependencies:
      - audit-pansearch-chain
  - id: refresh-acceptance-doc
    content: 更新`部署后验收清单.md`为v2.0.6直链验收标准
    status: completed
    dependencies:
      - audit-pansearch-chain
  - id: sync-doc-history
    content: 同步`CHANGELOG.md`与`796Helper-技术文档.md`
    status: completed
    dependencies:
      - align-runtime-behavior
      - refresh-acceptance-doc
---

## User Requirements

- 不再执行“将默认访问入口切换为自定义域名”的方案。
- 影视搜索需要直接从 `PanSearch` 抓取对应影视资源的真实网盘链接，而不是只返回搜索页地址。
- 保持当前页面的搜索、来源筛选、复制、失败提示与兜底体验不变。
- 同步修正文档与验收口径，使说明与当前实现目标一致。

## Product Overview

- 页面布局、视觉样式和操作流程保持现状，不新增页面模块。
- 正常搜索时继续展示资源标题、来源、提取码、时间和可直接打开的网盘链接。
- 当代理异常或超时时，仍保留 `PanSearch` 搜索页兜底入口与提示横幅。

## Core Features

- 直接抓取 `PanSearch` 内容并返回真实网盘直链
- 提取来源、提取码、发布时间并完成结果去重
- 保留现有搜索源选择、来源筛选和复制体验
- 统一更新验收文档、更新日志和技术文档

## Tech Stack Selection

- 前端：原生 HTML、CSS、JavaScript 单页应用
- 页面搜索模块：`E:\MY Project\796Helper\js\pages\movie-search.js`
- 代理服务：Cloudflare Workers，入口为 `E:\MY Project\796Helper\worker\index.js`
- 运行时配置：`E:\MY Project\796Helper\index.html` 中的 `window.__796HELPER_CONFIG__.movieSearch`
- 文档：`部署后验收清单.md`、`CHANGELOG.md`、`796Helper-技术文档.md`

## Implementation Approach

- 保留当前 `workers.dev` 默认入口与 `apiBases` 运行时覆盖机制，不再进行域名切换。
- 以现有 Worker 直链链路为核心：`searchPanSearch()` 抓取 `PanSearch`，优先通过 `extractNextDataResults()` 解析 `__NEXT_DATA__` 中的完整内容，未命中时再回退 `extractPanUrls()` 做 HTML 兜底提取，最后由 `searchMovieResources()` 完成来源过滤、去重与结果截断。
- 前端继续复用现有 `requestSearchFromApis()`、`CacheManager`、`generateFallbackResults()`、来源筛选与复制逻辑，保证用户优先看到真实网盘直链，只有代理失败时才看到 `PanSearch` 搜索页兜底。
- 性能上沿用已验证方案：主路径优先读取 `__NEXT_DATA__`，减少全文正则扫描；前端 5 分钟缓存与 Worker 边缘缓存继续降低重复请求成本。结果处理主要受 `PanSearch` 页面大小与返回条数影响，现有去重与最多 30 条返回可控。

## Implementation Notes

- `index.html` 当前只保留现有默认 `apiBases` 配置，本次不改默认入口，避免任务目标偏回“域名切换”。
- `worker/index.js` 与 `js/pages/movie-search.js` 仅做必要对齐，优先保证实现说明、版本口径和兜底文案与当前行为一致，避免无关重构。
- `部署后验收清单.md` 需把旧的 `v2.0.5` 口径统一到 `v2.0.6`，并明确验收重点是“真实网盘直链来自 `PanSearch` 抓取结果”。
- 技术文档需同步第 5.3、6、12、13 节，去掉“切自定义域名”的预期，保留现有运行时代理配置能力。
- 继续复用当前最小日志策略，避免在 Worker 异常日志中输出大块 HTML 或无关敏感内容。

## Architecture Design

- 架构保持现状：
- `index.html` 提供影视搜索运行时代理配置
- `js/pages/movie-search.js` 负责请求代理、缓存、筛选、复制和兜底展示
- `worker/index.js` 负责抓取 `PanSearch` 并返回统一 JSON 结果
- 文档层负责部署、验收、版本说明对齐
- 本次任务重点是统一“实现与文档口径”，不是新增页面、服务或配置通道。

## Directory Structure

本次以现有实现为基础做最小补齐，核心是复核直链链路并统一文档说明；`index.html` 当前无需改动默认入口。

- `E:\MY Project\796Helper\worker\index.js`  [MODIFY]  
影视搜索代理主逻辑。复核 `searchPanSearch()`、`extractNextDataResults()`、`parsePanSearchResults()`、`searchMovieResources()` 的直链抓取链路；若实现与文档口径存在偏差，仅做最小化对齐。

- `E:\MY Project\796Helper\js\pages\movie-search.js`  [MODIFY]  
前端影视搜索页。保持当前请求、缓存、筛选、复制与兜底行为不变，必要时仅同步版本说明、提示文案或与 Worker 的口径对齐。

- `E:\MY Project\796Helper\部署后验收清单.md`  [MODIFY]  
部署与验收文档。统一为 `v2.0.6` 验收口径，重点验证真实网盘直链、`PanSearch` 兜底、缓存命名空间与回归项。

- `E:\MY Project\796Helper\CHANGELOG.md`  [MODIFY]  
更新日志。补充本次“继续完成任务”的最终口径，明确当前目标是从 `PanSearch` 直接提取真实网盘链接，并记录文档与验收同步。

- `c:\Users\leyanlin\AppData\Roaming\CodeBuddy CN\User\globalStorage\tencent-cloud.coding-copilot\brain\b152d7d6967648eea73e72e4b28fec15\796Helper-技术文档.md`  [MODIFY]  
项目技术文档。同步第 5.3、6、12、13 节的功能说明、部署说明、API 口径与版本历史，确保与当前代码一致。

## Key Code Structures

- 已验证的关键链路为：`searchPanSearch()`、`extractNextDataResults()`、`extractPanUrls()`、`parsePanSearchResults()`、`searchMovieResources()`、`requestSearchFromApis()`。
- 已验证的关键版本口径为：Worker `WORKER_VERSION = 2.0.6`，前端缓存 `CACHE_SCHEMA_VERSION = 2.0.6`。

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核 `worker/index.js`、`js/pages/movie-search.js` 与文档中所有 `PanSearch`、版本号、兜底说明和旧方案引用点
- Expected outcome: 输出完整对齐范围，避免遗漏旧 `v2.0.5` 或“自定义域名切换”口径