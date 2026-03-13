---
name: diagnose-worker-health-unreachable
overview: 排查 `796helper-movie-search` 的 `workers.dev/health` 无法访问问题，确认是 Worker 路由代码、部署配置还是 Cloudflare 域名/账号侧可达性问题，并准备最小修复方案。
todos:
  - id: trace-worker-scope
    content: 使用 [subagent:code-explorer] 复核 Worker 配置、路由与前端引用链
    status: completed
  - id: verify-cloudflare-access
    content: 核查 workers.dev 子域、部署版本与线上日志定位不可达原因
    status: completed
    dependencies:
      - trace-worker-scope
  - id: apply-minimal-fix
    content: 按排查结果修复 Worker 可达性及前端默认地址
    status: completed
    dependencies:
      - verify-cloudflare-access
  - id: regress-health-search
    content: 回归验证 /health、/api/search 与前端影视搜索链路
    status: completed
    dependencies:
      - apply-minimal-fix
  - id: sync-docs
    content: 更新 CHANGELOG、验收清单与 796Helper 技术文档
    status: completed
    dependencies:
      - regress-health-search
---

## User Requirements

- 排查并修复线上健康检查地址无法打开的问题，确保 `health` 地址可直接访问并返回合法状态信息。
- 在不影响现有影视搜索功能的前提下，确认搜索服务入口地址一致、可用，避免前端继续指向不可访问的服务地址。
- 若问题不在页面逻辑而在部署或线上配置，也需要形成可执行的排查与修复闭环。

## Product Overview

- 当前需要恢复影视搜索服务的基础可达性，重点是让健康检查地址可正常打开，并能作为后续验收与排障入口。
- 前端页面视觉上无需新增界面，仅保持现有搜索页与提示行为稳定；修复后用户可正常访问服务地址，不再出现链接无法打开的问题。

## Core Features

- 健康检查地址可访问，返回明确状态、版本和可用路由信息。
- 前端默认服务地址与实际可用地址保持一致，避免请求打到失效地址。
- 保留现有搜索链路与兜底行为，避免为修复健康检查引入无关回归。
- 同步更新验收文档与技术文档，保证部署、排查、验收口径一致。

## Tech Stack Selection

- 前端：原生 HTML、CSS、JavaScript 单页应用
- 路由与页面组织：Hash 路由 + IIFE 页面模块
- 后端代理：Cloudflare Workers
- 部署配置：`worker/wrangler.toml`
- 文档：`CHANGELOG.md`、`部署后验收清单.md`、796Helper 技术文档

## Implementation Approach

### 高层策略

当前代码中 `worker/index.js` 已显式处理 `/health` 与 `/api/search`，因此本次优先按“访问层 → 部署层 → 运行时层 → 前端引用层”顺序排查，而不是先做大范围代码改造。
若确认是 Cloudflare 侧可达性或账号子域问题，则优先修正部署与地址引用；只有在日志或运行结果证明存在运行时异常时，才对 Worker 代码做最小化增强。

### 关键技术决策

- **先排部署与域名，再动代码**：已验证仓库内 `/health` 路由存在，盲改代码的收益低、误改风险高。
- **保持前后端地址单一来源一致**：`index.html` 与 `js/pages/movie-search.js` 都引用同一 `workers.dev` 地址，若实际地址变化必须同步，避免一处修好另一处仍失效。
- **最小化改动 Worker**：若需要代码修复，仅增强入口错误保护、健康检查稳定性或默认根路径诊断能力，不改动搜索主流程，降低对 `PanSearch` 解析链路的影响。
- **文档与验收同步收口**：修复后立即更新部署验收清单、变更日志与技术文档，避免再次出现“代码口径已变、文档仍指向旧地址”的问题。

### 性能与可靠性

- `/health` 应保持 O(1) 返回，不依赖上游抓取，避免被 `PanSearch` 可用性拖垮。
- 搜索接口继续维持现有超时与去重逻辑，不引入额外请求轮次或重复解析。
- 若增加错误日志，仅记录错误摘要、请求路径、状态信息，不输出大段上游 HTML，避免日志噪声和敏感数据扩散。

## Implementation Notes

- 复用现有 `jsonResponse()` 与 `WORKER_VERSION`，避免健康检查与搜索接口返回结构再次分叉。
- 如需增强异常处理，优先包裹 `fetch` 入口或请求分发层，不改动 `searchPanSearch()` 的正常解析逻辑。
- 若确认 `workers.dev` 地址变更，只同步已验证的两个前端入口：`index.html` 配置项与 `js/pages/movie-search.js` 默认代理列表。
- 控制影响面：不调整页面结构、不改缓存 schema、不改筛选与复制逻辑，除非排查结果直接证明这些模块受影响。

## Architecture Design

现有调用链已明确：

- 前端运行时配置位于 `index.html`
- 影视搜索页默认代理位于 `js/pages/movie-search.js`
- Worker 入口位于 `worker/index.js`
- 部署标识位于 `worker/wrangler.toml`

本次修复应围绕以下关系保持一致：

1. 前端默认代理地址
2. Wrangler 部署出的公开地址
3. Worker 内部 `/health` 与 `/api/search` 路由
4. 验收文档中的线上检查地址

## Directory Structure

### Directory Structure Summary

本次优先排查线上可达性与地址一致性；若确认需要代码修复，仅在现有 Worker 与前端配置文件上做最小修改，并同步所有部署文档。

```text
e:/MY Project/796Helper/
├── worker/
│   ├── index.js
│   │   # [MODIFY] Worker 请求入口与健康检查逻辑。仅在确认存在运行时异常、根路径诊断缺失或健康检查稳定性问题时增强保护与返回信息。
│   └── wrangler.toml
│       # [MODIFY] Worker 部署配置。若排查确认名称、环境或公开地址绑定不一致，在此修正并与线上实际部署保持一致。
├── index.html
│   # [MODIFY] 前端运行时 `movieSearch.apiBases` 配置。若 Worker 公网地址变化，需要将最新地址放在首位。
├── js/
│   └── pages/
│       └── movie-search.js
│           # [MODIFY] 影视搜索默认代理地址。与 `index.html` 保持一致，避免页面仍回落到失效地址。
├── 部署后验收清单.md
│   # [MODIFY] 补充或修正健康检查、Cloudflare 排查步骤、最新地址与验收标准。
├── CHANGELOG.md
│   # [MODIFY] 记录本次健康检查不可达问题的修复或配置同步内容。
```

```text
c:/Users/leyanlin/AppData/Roaming/CodeBuddy CN/User/globalStorage/tencent-cloud.coding-copilot/brain/b152d7d6967648eea73e72e4b28fec15/
└── 796Helper-技术文档.md
    # [MODIFY] 按项目规则同步记录 Worker 可达性修复结果、最新地址口径、部署与验收说明。
```

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核 Worker 相关配置、前端引用、文档口径和影响文件，确保修复范围完整且不遗漏地址同步点。
- Expected outcome: 得到一份经过核实的受影响文件清单与调用链，支持最小改动完成修复并同步文档。