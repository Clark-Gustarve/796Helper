---
name: fix-movie-direct-pan-link
overview: 修复影视搜索结果打开后仍落到 UP云搜 搜索页的问题，优先恢复并验证真实网盘直链返回链路，同时处理可能导致旧链接持续出现的前端缓存问题。
todos:
  - id: recheck-scope
    content: 用[subagent:code-explorer]复核直链解析、缓存与未提交改动范围
    status: completed
  - id: fix-worker-links
    content: 增强worker/index.js直链提取、归一化与直链优先合并
    status: completed
    dependencies:
      - recheck-scope
  - id: invalidate-stale-cache
    content: 更新js/pages/movie-search.js缓存版本并绕过旧结果
    status: completed
    dependencies:
      - fix-worker-links
  - id: verify-link-flow
    content: 联调打开链接、复制内容与无直链兜底场景
    status: completed
    dependencies:
      - fix-worker-links
      - invalidate-stale-cache
  - id: sync-docs
    content: 更新CHANGELOG与796Helper技术文档
    status: completed
    dependencies:
      - verify-link-flow
---

## User Requirements

- 修复当前版本影视搜索结果“打开链接后仍进入 UP 云搜搜索页”的问题。
- 当搜索源能够提供真实网盘地址时，应优先打开百度网盘、夸克网盘、阿里云盘等直链，而不是搜索页链接。
- 仅在确实拿不到真实网盘地址时，才保留 UP 云搜搜索页作为兜底。
- 避免升级后继续命中旧缓存，导致页面仍展示旧的搜索页链接。

## Product Overview

- 保持现有影视搜索页的卡片样式、按钮位置、筛选方式和交互不变，重点修正结果链接的实际指向。
- 用户点击“打开链接”后，更多结果应直接进入对应网盘页面；只有兜底结果才继续跳转到搜索页。
- 复制按钮的表现继续与链接类型一致：直链复制网盘地址，兜底结果复制资源信息。

## Core Features

- 优先展示并打开真实网盘直链
- 保留搜索页兜底，但不覆盖直链结果
- 隔离旧缓存，避免旧链接残留
- 同步更新变更说明与技术文档

## Tech Stack Selection

- 前端：原生 HTML / CSS / JavaScript 单页应用
- 页面模块：IIFE 闭包 + Hash 路由
- 后端代理：Cloudflare Workers（JavaScript）

## Implementation Approach

采用“Worker 端修正直链解析 + 前端缓存失效隔离”的最小改动方案。前端 `js/pages/movie-search.js` 当前只是消费接口返回的 `data.data[].link`，真正决定是否为直链的关键在 `worker/index.js` 的 `parsePanSearchResults()` 与双源合并逻辑；同时现有 `sessionStorage` 缓存 key 未带版本信息，升级后仍可能复用旧的 UP 云搜结果。

关键决策：

1. **优先修 Worker 解析能力**：增强 PanSearch 结果中的真实链接提取、归一化和去重，保证能拿到直链时就返回直链。
2. **保留现有 API 契约**：继续使用现有 `link/source/sourceLabel/code/time` 字段，避免前端渲染层大改。
3. **增加缓存版本隔离**：在前端缓存 key 中加入显式版本或 schema 标识，避免旧缓存继续污染新结果。
4. **保持兜底能力**：UP 云搜搜索页仍作为无直链时的 fallback，但不应覆盖同标题/同资源的直链结果。

性能与可靠性：

- Worker 解析保持基于单次 HTML 文本处理与有限上下文提取，避免引入重型解析器。
- 直链归一化、去重和优先级排序可控制在结果集 O(n) 级别，主要瓶颈仍是上游站点响应时间。
- 前端缓存版本化是 O(1) 变更，不增加额外渲染开销。

## Implementation Notes

- 复用现有 `isDirectPanLink()`、复制逻辑和结果卡片结构，不改 UI 布局。
- `worker/index.js` 只输出必要错误信息，避免记录整段 HTML、完整资源链接或提取码，防止日志噪声与敏感信息泄露。
- `js/pages/movie-search.js`、`worker/index.js`、`CHANGELOG.md` 当前已有未提交修改，实施时需在现有内容上合并，不能覆盖用户工作区变更。
- 缓存失效只针对影视搜索缓存命名空间处理，不使用全量 `sessionStorage.clear()`，避免影响其他页面状态。

## Architecture Design

当前架构保持不变，仅修正链路中的两个节点：

1. **前端页面层**

- `MovieSearchPage.performSearch()` 发起 `/api/search`
- 命中缓存时直接展示结果；本次调整为“版本化缓存”，避免旧结果复用
- UI 继续依据 `link` 类型展示“打开网盘链接/搜索页”按钮提示

2. **Worker 聚合层**

- `searchPanSearch()`：负责抓取并解析真实网盘直链
- `searchUpyunso()`：仅提供搜索页兜底结果
- `searchMovieResources()`：调整直链优先级、去重和 fallback 合并顺序，确保直链优先

3. **外部搜索源**

- PanSearch：主直链来源
- UP 云搜：兜底搜索页来源

## Directory Structure

### Directory Structure Summary

本次实现不新增模块，主要修复现有影视搜索链路中的 Worker 直链解析、前端缓存失效以及文档同步。

- `e:/MY Project/796Helper/worker/index.js` `[MODIFY]`
- **Purpose**: Cloudflare Workers 影视搜索代理核心实现
- **Functionality**: 增强 PanSearch 真实网盘链接提取、链接归一化、结果去重与直链优先合并；保留 UP 云搜兜底
- **Implementation requirements**: 保持 `/api/search` 返回结构不变；优先保留真实网盘链接；避免搜索页结果覆盖同资源直链

- `e:/MY Project/796Helper/js/pages/movie-search.js` `[MODIFY]`
- **Purpose**: 影视搜索页面数据请求与结果展示
- **Functionality**: 为缓存增加版本隔离或旧结果绕过逻辑，确保页面不继续展示历史 UP 云搜链接
- **Implementation requirements**: 不改现有 UI 结构；继续复用 `isDirectPanLink()`、复制逻辑与搜索状态管理

- `e:/MY Project/796Helper/CHANGELOG.md` `[MODIFY]`
- **Purpose**: 记录本次链接修复内容
- **Functionality**: 补充“直链优先”和“缓存失效修复”说明
- **Implementation requirements**: 与实际改动一致，不覆盖现有未提交内容

- `c:\Users\leyanlin\AppData\Roaming\CodeBuddy CN\User\globalStorage\tencent-cloud.coding-copilot\brain\b152d7d6967648eea73e72e4b28fec15\796Helper-技术文档.md` `[MODIFY]`
- **Purpose**: 同步项目技术文档
- **Functionality**: 更新影视搜索链接策略、缓存策略与修复说明
- **Implementation requirements**: 与代码行为保持一致，修正文档中“直链优先”与实际行为不一致的问题

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核 `worker/index.js`、`js/pages/movie-search.js`、`CHANGELOG.md` 与技术文档的受影响范围，并确认未遗漏链接解析、缓存或调用点
- Expected outcome: 产出准确修改边界、回归检查点，以及与现有未提交改动兼容的实施范围