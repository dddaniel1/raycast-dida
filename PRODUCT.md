# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

个人用户(inferred,已确认):在 Raycast 中快速管理 Dida365/TickTick 任务的中文用户。核心场景是键盘驱动的快速捕捉与检索——quick add、模板、统计、菜单栏计数——而非重度项目治理。

## Product Purpose

把 Dida365/TickTick 的日常任务管理带进 Raycast:不打开官方 App 就能建任务、浏览与筛选列表、完成/删除/移动、看统计。成功意味着"想记录→已记录"的路径尽可能短,且数据始终与官方 Open API 一致。

## Positioning

严格构建在公开 Open API 之上(11/11 官方端点,无私有接口)的 Raycast 原生 Dida365 客户端;中国区(dida365.com)与国际区(ticktick.com)同一套扩展即可切换。

## Operating Context

- Raycast 桌面环境,所有界面由 Raycast 原生组件(List/Form/ActionPanel/MenuBarExtra)渲染。
- 语言环境:界面框架文案以英文为主,任务/重复/日期相关的本地化短语用中文(如"每天"、"明天")。
- 用户需要自行配置 API Token、时区、API 区域和 Inbox Project ID(Open API 项目列表不返回收集箱)。

## Capabilities and Constraints

已确认能力:11 个公开 Open API 端点的完整覆盖;quick add 自然语言解析(日期/优先级/项目标记/重复);任务模板;任务统计;菜单栏计数;Inbox 通过 account-specific projectId 支持。

硬约束:
- 只用公开 Open API;请求限额(项目/已完成任务读取最多 200;批量操作每组最多 50 项)。
- 日期序列化尊重配置的 IANA 时区。
- API Token 永不出现在日志、错误信息或文档中。
- 任务 id 与 projectId 必须成对显式处理。

## Brand Commitments

无已确认的品牌承诺。扩展名 "Dida 365 for Raycast" 与官方 logo 资产(assets/icon.png)为既成事实,但无进一步视觉/语气规范。

## Evidence on Hand

- 完整可运行源码(src/,严格 TypeScript,React + Raycast API)。
- dida-openapi.md:官方 Open API 端点契约。
- README.md:安装与 API 覆盖说明。
- 无用户访谈、无使用数据、无推广素材——未来工作不得虚构这些。

## Product Principles

1. **键盘优先**:每个高频动作都有快捷键或可从键盘直达的路径。
2. **API 忠实**:展示的数据与行为永远以官方 Open API 为准,不发明能力、不猜测语义。
3. **失败可见**:配置错误或网络失败要给出可操作的下一步,绝不静默吞掉。
4. **最小惊讶**:遵循 Raycast 原生交互惯例,不重新发明控件或动效。

## Accessibility & Inclusion

依赖 Raycast 宿主的原生可访问性(键盘导航、VoiceOver 走查由宿主保证)。扩展自身需要保证的是:错误文案可操作、中英文文案与上下文一致、不依赖颜色单独传达语义(优先级同时有 Flag 图标与文字标签)。
