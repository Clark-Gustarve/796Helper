---
name: movie-search-failure-diagnosis-and-fix
overview: 排查并修复“影视搜索一直失败”的链路，重点覆盖前端请求逻辑、Worker 可达性依赖和线上接口降级策略，确保页面能稳定返回结果而不是持续报错。
todos:
  - id: trace-call-chain
    content: 用 [subagent:code-explorer] 复核影视搜索请求链路与配置入口
    status: completed
  - id: harden-frontend-search
    content: 改造 movie-search.js 的多地址回退与失败呈现
    status: completed
    dependencies:
      - trace-call-chain
  - id: stabilize-worker-errors
    content: 增强 worker/index.js 错误码与健康响应兼容
    status: completed
    dependencies:
      - trace-call-chain
  - id: wire-runtime-config
    content: 调整 index.html 的运行时 API 配置入口
    status: completed
    dependencies:
      - trace-call-chain
  - id: sync-docs-regression
    content: 用 [subagent:code-explorer] 回归验收并更新 CHANGELOG 与技术文档
    status: completed
    dependencies:
      - harden-frontend-search
      - stabilize-worker-errors
      - wire-runtime-config
---

## User Requirements

- 排查“影视搜索一直失败”的真实原因，并修复导致搜索不可用的关键链路。
- 修复后，用户输入影视名称应能稳定拿到真实搜索结果；当服务不可达、超时或返回异常时，页面要给出明确、可重试的失败提示。
- 保持现有搜索页的搜索框、来源筛选、加载态、错误态、重试按钮、打开链接和复制内容等交互连续可用。

## Product Overview

- 影视搜索页继续在当前结果区域内展示欢迎态、加载态、结果态、空态和错误态。
- 成功时仍显示结果卡片、来源标识和操作按钮；失败时改为更清晰的错误反馈，避免用户只看到笼统的“搜索失败”。

## Core Features

- 支持搜索服务地址容错，避免单一地址异常时整页持续失败。
- 区分网络不可达、服务超时、服务返回错误等场景，并提供对应提示与重试入口。
- 保持真实搜索结果、结果筛选、缓存与链接操作的一致性，避免误导性的降级内容。

## Tech Stack Selection

- 前端沿用现有静态站点方案：`index.html` + 原生 JavaScript 页面模块，按脚本顺序加载，页面模块采用 IIFE 暴露 `title / render / init`。
- 影视搜索前端逻辑位于 `E:\MY Project\796Helper\js\pages\movie-search.js`。
- 搜索代理后端沿用现有 Cloudflare Worker，入口位于 `E:\MY Project\796Helper\worker\index.js`，部署配置位于 `E:\MY Project\796Helper\worker\wrangler.toml`。
- 文档沿用仓库内 `E:\MY Project\796Helper\CHANGELOG.md` 与外部技术文档 `c:\Users\leyanlin\AppData\Roaming\CodeBuddy CN\User\globalStorage\tencent-cloud.coding-copilot\brain\b152d7d6967648eea73e72e4b28fec15\796Helper-技术文档.md`。

## Implementation Approach

### 方法与总体策略

本次优先修复“前端对单一 `workers.dev` 地址硬依赖”和“失败分支不够稳定、反馈不够明确”两条主链路，尽量不动现有结果解析与 UI 骨架。方案是在前端增加可配置的 API 地址解析与失败切换机制，并将 Worker 错误返回补齐为更可判定的结构，前后端共同把“搜索失败”收敛为可诊断、可重试、可扩展的稳定行为。

### 高层工作方式

- 前端不再只依赖单个固定 `API_BASE`，而是按优先级解析可用地址，并缓存最近一次可用地址。
- 搜索请求失败时区分网络异常、超时、非预期响应、服务端显式错误；仅在全部候选地址都不可用时进入明确错误态。
- Worker 保持现有 `/api/search` 与 `/health` 契约不变，在错误响应中补充机器可读字段，便于前端精准展示。

### 关键技术决策

- 复用当前 `movie-search.js` 的状态管理、`AbortController`、`CacheManager`、`renderErrorState()`、`updateContent()`，避免引入新框架或大规模重构。
- 运行时 API 配置采用轻量入口，和现有全局脚本加载模式保持一致，后续接入自定义域名时无需再次改动搜索页主逻辑。
- 保留 Worker 当前 PanSearch 与 UP云搜双源策略，不把本轮问题误判为上游解析问题；上游站点当前仍可访问，故不扩大改动面。

### Performance &amp; Reliability

- 地址探测复杂度为 O(k)，k 为候选 API 地址数量，且只在冷启动或当前地址失效时触发；正常搜索仍保持单次请求路径，额外开销可控。
- 继续复用现有前端 30 秒超时与 Worker 25 秒整体超时，避免无限等待。
- 通过记忆最近成功地址、仅在失败时切换，避免每次搜索重复探测造成额外网络成本。

### Avoiding Technical Debt

- 不新增独立状态管理层，不改动现有页面模块接口。
- 不修改无关页面、路由、侧边栏逻辑。
- Worker 响应采用“增量字段”方式兼容现有 `success / error / data / total` 结构，减少联动风险。

## Implementation Notes

- 前端需要显式处理 `fetch` 拒绝、非 2xx、非 JSON 响应与 `success=false` 四类情况，不能再把真实故障吞掉。
- 当前 `generateDemoData()` 仅适合演示场景，生产搜索链路应避免静默回退为演示数据，以免用户误判搜索成功。
- API 地址选择结果建议做会话级缓存；地址失效时再清除缓存并切换，避免频繁健康探测。
- 保留当前缓存 key 与结果筛选逻辑，避免对已修复的 `sessionStorage` 版本隔离造成回归。
- Worker 错误返回应避免泄露过多上游原始内容，只暴露可用于前端分支判断的简洁错误码和版本信息。

## Architecture Design

### 当前修改后的结构关系

- `movie-search.js`
- 负责搜索页状态、API 地址解析、请求发起、失败切换、结果展示
- `index.html`
- 提供轻量运行时配置入口，供搜索页读取候选 API 地址
- `worker/index.js`
- 负责 `/api/search`、`/health`、双上游搜索与统一错误响应
- 文档
- 记录新地址策略、错误语义与部署验收方式

### 数据流

- 用户输入关键词
- 前端解析当前可用 API 地址
- 请求 `/api/search`
- Worker 并发访问 PanSearch 与 UP云搜
- Worker 返回成功结果或标准化错误
- 前端渲染结果态、空态或明确错误态，并支持重试

## Directory Structure

## Directory Structure Summary

本次实现聚焦影视搜索的请求稳定性与错误处理，不扩散到其他页面。主要改动会集中在搜索页模块、入口配置、Worker 错误响应以及文档同步。

- `E:\MY Project\796Helper\js\pages\movie-search.js`  [MODIFY]  
影视搜索页面主模块。增加 API 地址优先级解析、可用地址记忆、失败后切换重试、非预期响应识别、明确错误态展示；保留现有缓存、筛选、复制、重试和加载态逻辑。

- `E:\MY Project\796Helper\index.html`  [MODIFY]  
应用入口文件。增加轻量运行时配置入口，用于声明影视搜索 API 地址或候选地址列表，并保持现有脚本加载顺序与全局模块模式兼容。

- `E:\MY Project\796Helper\worker\index.js`  [MODIFY]  
Cloudflare Worker 搜索代理。保持现有双源搜索与 `/health` 路由，补充标准化错误码、版本或诊断字段，确保前端能准确区分超时、上游不可用和服务异常，同时维持原有 JSON 结构兼容。

- `E:\MY Project\796Helper\CHANGELOG.md`  [MODIFY]  
更新本次影视搜索稳定性修复记录，说明 API 地址容错、错误提示优化及兼容性调整。

- `c:\Users\leyanlin\AppData\Roaming\CodeBuddy CN\User\globalStorage\tencent-cloud.coding-copilot\brain\b152d7d6967648eea73e72e4b28fec15\796Helper-技术文档.md`  [MODIFY]  
按项目规则同步补充新请求链路、API 地址配置方式、失败分支语义、部署注意事项与验收要点。

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核影视搜索涉及的多文件请求链路、配置入口、调用关系与文档落点，防止遗漏受影响模块。
- Expected outcome: 得到完整的修改文件清单与调用范围，并在实施后复查 API 地址解析、错误分支和文档同步是否一致。