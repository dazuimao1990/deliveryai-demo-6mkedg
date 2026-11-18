# Review Summary

- 本次需求: 为沸点火锅点单 Demo 新增黑夜模式（Dark Mode）主题切换能力，用户可在顶栏一键切换深色主题，偏好持久化，所有视图适配深色。
- 需求类型: UX / frontend change
- 变更面: UX Design, Functional Requirements, NFR/DFX; 不涉及: API Design, Backend/Data, Metrics; 待确认: 无
- 变更面判断依据: 需求描述（黑夜模式切换入口 + 全视图适配）、代码仓库（`tailwind.config.js` 无 `darkMode`、各组件 JSX 硬编码色名、`useElderlyMode.ts` 提供状态管理先例、`index.html` 内联脚本）、设计系统（`tokens.dark.json` 提供暗色色阶）、上游 PRD 文档（REQ-001~006 已通过质量门禁）
- 差异判断: 产品形态 / 站点 / 环境 / 版本差异: 不涉及; 依据: 单一 SPA 前端主题切换，无多站点/多环境/多版本差异（AGENTS.md 确认纯前端内存态，无后端 API）
- 本次变更关键信息:
  - 新增 `useDarkMode` hook（localStorage 持久化 + `html.dark` class），架构参照 `useElderlyMode`
  - 启用 Tailwind `darkMode: 'class'`，新增 7 个暗色专用色阶（来源 `tokens.dark.json`）
  - 在 `index.html` 内联脚本增加 FOUC 防护
  - TopBar 新增 Moon/Sun 切换按钮，位于老人模式按钮与语言切换按钮之间
  - 全部 13 个视图/组件添加 `dark:` 变体样式，覆盖 5 个页面视图 + TopBar + CartPanel + ServiceSheet + DemoConsole + Button(CVA) + Dialog + 底部导航栏 + 全局 toast
  - 新增 i18n `aria_dark_mode` 中/英文案
  - `paper-noise` 噪点纹理适配深色（`paper-noise-dark`）
- Review 重点:
  - REQ-005 全视图 `dark:` 变体覆盖完整性——是否存在遗漏的浅色残留
  - 暗色色值与 `tokens.dark.json` 一致性及 WCAG AA 对比度（≥ 4.5:1）
  - 黑夜模式与老人模式叠加时的布局兼容性
  - FOUC 防护在 React 挂载前生效的正确性
  - localStorage 降级在隐私模式下的行为

## Scope Note

- Implemented sections: Review Summary, Context, Goals and Non-Goals, Glossary, Functional Requirements, UX Design, NFR/DFX, Traceability, Open Questions
- Not involved: API Design, Backend/Data, Metrics
- Needs confirmation: 无
- Reason: 需求为纯前端 CSS 主题切换，无后端 API/数据变更/埋点需求；代码仓库 AGENTS.md 确认应用为 React SPA 纯前端内存态，`server/` 仅为健康检查不参与业务链路。

---

# Spec: 黑夜模式（Dark Mode）主题切换

> 本 Spec 是面向需求提出、实现和验证三方的最终契约。上游澄清文档（`docs/dark-mode/需求澄清文档.md`）和 PRD 文档（`docs/dark-mode/PRD文档.md`）是背景、目标、范围和业务规则的来源；本 Spec 在其基础上完成产品方案与技术方案设计，作为后续开发与自测节点的唯一执行依据。

---

## 1. Context

上游澄清文档路径：`docs/dark-mode/需求澄清文档.md`（产物节点：需求设计）
上游 PRD 文档路径：`docs/dark-mode/PRD文档.md`（spec_id: PRD-DARK-MODE-001，已通过质量门禁）

本次 Spec 相对澄清文档的增量：

- **TD-1 已决策**：澄清文档中的技术待设计项「暗色色值映射方案」已确定为方案 A（在 `tailwind.config.js` 中扩展暗色色阶，组件中使用 `dark:` 变体覆盖），与现有「颜色类名直接硬编码在 JSX」的约定一致，不引入 CSS 变量层。
- **技术方案明确**：补充了前后端改动范围、接口契约（无变更）、数据模型（localStorage）、测试策略、部署影响和风险控制，满足实现与验证方需求。
- **色值映射规则固化**：基于 `tokens.dark.json` 和现有色板，明确了 11 条浅色→暗色类名映射规则。
- **组件改动清单精确化**：从澄清文档的「17 个影响文件」细化为具体的 `dark:` 变体适配点和色值替换规则。

关联重点特性：老人模式（`useElderlyMode`）、i18n 中/英双语、Tailwind CSS 3.4 自定义色板。

---

## 2. Goals and Non-Goals

沿用需求澄清文档的目标与非目标，以下为 Spec 阶段补充确认：

### Goals

| 目标 | 衡量方式 | 目标值 / 判断标准 |
|------|----------|-------------------|
| 提供黑夜模式切换入口 | 顶栏存在可见的切换按钮 | 用户可在任意视图（home 除外）顶栏找到黑夜模式切换按钮 |
| 全视图深色适配 | 视觉检查所有视图 | home/welcome/menu/order/checkout 五个视图及所有弹窗在暗色下无浅色残留 |
| 偏好持久化 | 刷新页面后保持主题 | 用户切换黑夜模式后刷新页面，主题保持不变 |
| 平滑过渡 | 切换时的视觉体验 | 主题切换有 250ms 平滑过渡，无闪烁 |
| FOUC 防护 | 首屏主题正确 | 页面加载时首屏主题与 localStorage 偏好一致，无浅色→暗色闪烁 |

### Non-Goals

- 不做跟随系统偏好（`prefers-color-scheme`）的自动模式——本次仅支持用户手动切换。
- 不做主题定制市场或自定义颜色选择。
- 不修改 `server/` 目录（仅健康检查，无业务逻辑）。
- 不引入后端 API 调用或新的 UI 库。
- 不改变现有功能逻辑和交互流程。
- 不对菜品图片做暗色滤镜处理（保持食欲感）。
- 不引入 CSS 变量层（与现有「颜色类名直接硬编码」约定保持一致）。

---

## 3. Glossary

| 术语 | 定义 |
|------|------|
| Dark Mode / 黑夜模式 | 应用界面使用深色背景 + 浅色文字的主题方案，降低夜间屏幕亮度 |
| FOUC | Flash of Unstyled Content / 主题闪烁——页面加载时先闪现浅色主题再切换为暗色的视觉缺陷 |
| `dark:` 变体 | Tailwind CSS 的 dark mode 前缀，仅在 `html.dark` class 存在时生效 |
| `tokens.dark.json` | 设计系统提供的暗色 token 方案文件，定义了暗色背景/文字/边框/填充等完整色阶 |
| 老人模式 | 现有主题切换功能，通过 `html.elderly` class 放大字号 + 增强对比度 |
| CVA | class-variance-authority，用于 Button 组件的变体样式管理 |

---

## 4. Functional Requirements

### REQ-001: 黑夜模式切换入口

- **User Story**: As a 门店顾客/店员, I want 在顶栏找到黑夜模式切换按钮, so that 在夜间或弱光环境下快速切换至深色主题减少屏幕刺激。
- **Priority**: P0
- **Description**: 在 TopBar 工具栏区域新增一个图标按钮，位于老人模式按钮和语言切换按钮之间。浅色模式显示 Moon 图标，暗色模式显示 Sun 图标（chili-500 高亮）。点击切换当前主题。

Acceptance Requirements (EARS):
- REQ-001.1: The system shall 在 TopBar 工具栏老人模式按钮与语言切换按钮之间显示一个黑夜模式切换按钮。
- REQ-001.2: When 浅色模式下用户点击黑夜模式按钮, the system shall 在 250ms 内将界面切换为深色主题。
- REQ-001.3: When 暗色模式下用户点击黑夜模式按钮, the system shall 在 250ms 内将界面切换回浅色主题。
- REQ-001.4: The system shall 根据当前主题正确切换按钮图标（浅色显 Moon，暗色显 Sun）。
- REQ-001.5: The system shall 提供中/英双语 aria-label（中文「切换黑夜模式」/ 英文「Toggle dark mode」），随语言切换更新。
- REQ-001.6: When 处于暗色模式, the system shall 将 Sun 图标以 `chili-500` 色高亮显示。

Gherkin:
```gherkin
Scenario: 浅色模式切换至黑夜模式
  Given 用户处于浅色模式，顶栏黑夜模式按钮显示 Moon 图标
  When 用户点击黑夜模式按钮
  Then 界面在 250ms 内切换为深色主题
  And 按钮图标变为 Sun 且以 chili-500 色高亮
  And localStorage 中 dark-mode 值为 'true'

Scenario: 暗色模式切换回浅色模式
  Given 用户处于暗色模式，顶栏黑夜模式按钮显示 Sun 图标
  When 用户点击黑夜模式按钮
  Then 界面在 250ms 内切换为浅色主题
  And 按钮图标变为 Moon
  And localStorage 中 dark-mode 值为 'false'
```

### REQ-002: 黑夜模式状态管理

- **User Story**: As a 用户, I want 我的主题偏好被记住, so that 刷新页面后无需重新切换。
- **Priority**: P0
- **Description**: 新建 `src/hooks/useDarkMode.ts` hook，架构参照 `useElderlyMode.ts`。通过 `localStorage`（key: `dark-mode`，值 `'true'`/`'false'`）持久化，在 `document.documentElement` 上添加/移除 `dark` class 驱动 Tailwind `dark:` 变体。默认关闭。

Acceptance Requirements (EARS):
- REQ-002.1: The system shall 首次访问应用时默认为浅色模式，`html` 元素无 `dark` class。
- REQ-002.2: When 用户切换至暗色模式, the system shall 在 `html` 元素添加 `dark` class 并将 `localStorage` 中 `dark-mode` 设为 `'true'`。
- REQ-002.3: When 页面刷新, the system shall 从 `localStorage` 恢复主题偏好，无 FOUC。
- REQ-002.4: If `localStorage` 不可用（如隐私模式）, then the system shall 降级为内存态运行，切换功能正常但不持久化，不抛出错误。

Gherkin:
```gherkin
Scenario: 首次访问默认浅色
  Given localStorage 中无 dark-mode 键
  When 用户首次打开应用
  Then html 元素无 dark class
  And 界面呈现浅色主题

Scenario: localStorage 不可用时降级
  Given 浏览器 localStorage 不可用（隐私模式）
  When 用户点击黑夜模式按钮
  Then 界面切换为深色主题
  And 不抛出 JavaScript 错误
  But 刷新后不保持暗色偏好
```

### REQ-003: 页面加载防闪烁（FOUC 防护）

- **User Story**: As a 用户, I want 页面加载时首屏直接呈现正确的主题, so that 不会看到浅色闪现后切换为暗色。
- **Priority**: P0
- **Description**: 在 `index.html` 的内联脚本中，React 挂载前读取 `localStorage` 的 `dark-mode` 值，若为 `'true'` 则立即在 `document.documentElement` 上添加 `dark` class。此操作在 CSS 解析前完成。

Acceptance Requirements (EARS):
- REQ-003.1: When `dark-mode` 为 `'true'` 时页面刷新, the system shall 首屏直接呈现暗色主题，无浅色闪烁。
- REQ-003.2: When `dark-mode` 不存在或为 `'false'` 时页面刷新, the system shall 首屏为浅色主题。
- REQ-003.3: The system shall 在内联脚本中 `try/catch` 包裹 localStorage 读取，不可用时静默降级。

### REQ-004: Tailwind 暗色配置

- **User Story**: As a 开发者, I want Tailwind 配置支持暗色模式, so that 组件可以使用 `dark:` 变体实现深色适配。
- **Priority**: P0
- **Description**: 在 `tailwind.config.js` 中设置 `darkMode: 'class'`，并在 `theme.extend.colors` 中新增 7 个暗色专用色阶。

Acceptance Requirements (EARS):
- REQ-004.1: The system shall 在 `tailwind.config.js` 中配置 `darkMode: 'class'`。
- REQ-004.2: The system shall 新增以下暗色色阶（来源 `tokens.dark.json`）：
  - `dark-bg`: `#1d1d1d`（页面背景，对应 `colorBgLayout`）
  - `dark-surface`: `#141414`（卡片/容器背景，对应 `colorBgContainer`）
  - `dark-elevated`: `#272727`（弹窗/提升面背景，对应 `colorBgElevated`）
  - `dark-border`: `#3e3e3e`（边框，对应 `colorBorder`）
  - `dark-text`: `#dcdcdc`（正文文字，对应 `colorText`）
  - `dark-text-secondary`: `#adadad`（次级文字，对应 `colorTextSecondary`）
  - `dark-fill`: `#303030`（填充背景，对应 `colorFillSecondary`）
- REQ-004.3: When `html` 元素存在 `dark` class, the system shall 使组件中 `dark:` 前缀的类名生效。

### REQ-005: 全视图深色主题适配

- **User Story**: As a 用户, I want 黑夜模式下所有界面元素视觉协调, so that 不会有浅色残留影响使用体验。
- **Priority**: P0
- **Description**: 为以下所有视图和组件添加 `dark:` 变体样式，确保暗色模式下无浅色残留。

**受影响组件清单**：

| 组件 | 文件路径 | 适配内容 |
|------|----------|----------|
| HomeView | `src/components/HomeView.tsx` | 页面背景、模糊光斑、桌台卡片、按钮、输入区域 |
| WelcomeView | `src/components/WelcomeView.tsx` | 背景、卡片、按钮 |
| TopBar | `src/components/TopBar.tsx` | 顶栏背景、banner、导航按钮、图标按钮、桌台标签、会员卡片 |
| MenuView | `src/components/MenuView.tsx` | Hero 区域（保持 charcoal-900 背景）、搜索框、分类标签、菜品卡片、价格文字、规格选择弹窗、OptionRow |
| OrderView | `src/components/OrderView.tsx` | 进度面板（保持 charcoal-900 背景）、订单列表卡片、按钮、空状态 |
| CheckoutView | `src/components/CheckoutView.tsx` | 账单卡片、支付方式卡片、成功页卡片、返回按钮 |
| CartPanel | `src/components/CartPanel.tsx` | 购物车面板、空状态、价格区域、数量调节器 |
| ServiceSheet | `src/components/ServiceSheet.tsx` | 弹窗内容、服务按钮卡片、呼叫记录列表 |
| DemoConsole | `src/components/DemoConsole.tsx` | 弹窗内容、控制台卡片、售罄开关按钮 |
| Button (CVA) | `src/components/ui/button.tsx` | 所有变体（default/secondary/outline/ghost）的暗色样式 |
| Dialog | `src/components/ui/dialog.tsx` | 弹窗背景、标题、内容区、关闭按钮 |
| 底部导航栏 | `src/App.tsx` (MobileNav) | 背景、激活态、文字色 |
| 全局 toast | `src/App.tsx` | toast 背景、文字 |
| App 根容器 | `src/App.tsx` | `bg-rice-100` → `dark:bg-dark-bg`，协同提示卡片 |

**暗色色值映射规则**（基于 `tokens.dark.json`）：

| 浅色类名 | 暗色替换 | 说明 |
|----------|----------|------|
| `bg-rice-50` / `bg-rice-100` | `dark:bg-dark-bg` | 页面背景 → #1d1d1d |
| `bg-white` | `dark:bg-dark-surface` | 卡片背景 → #141414 |
| `bg-rice-200` | `dark:bg-dark-elevated` | 次级面板 → #272727 |
| `text-charcoal-900` | `dark:text-dark-text` | 主文字 → #dcdcdc |
| `text-charcoal-500` / `text-charcoal-700` | `dark:text-dark-text-secondary` | 次级文字 → #adadad |
| `border-charcoal-900/5` / `border-charcoal-900/10` | `dark:border-dark-border` | 边框 → #3e3e3e |
| `bg-charcoal-900` | 保持不变 | 深色区域在暗色下仍为深色（Hero/进度面板） |
| `text-chili-500` | 保持不变 | 强调色在暗色下保持品牌红 |
| `bg-chili-50` | `dark:bg-chili-500/15` | 浅红背景 → 半透明红 |
| `bg-amber-100` | `dark:bg-amber-400/15` | 浅琥珀 → 半透明琥珀 |
| `paper-noise` | `dark:paper-noise-dark` | 噪点纹理适配深色 |

Acceptance Requirements (EARS):
- REQ-005.1: When 切换至暗色模式, the system shall 使所有视图背景为深色（#1d1d1d），无大面积白色残留。
- REQ-005.2: The system shall 使卡片、弹窗、面板背景为 #141414 或 #272727，与页面背景有层次区分。
- REQ-005.3: The system shall 确保暗色模式下文字在深色背景上对比度满足 WCAG AA 标准（≥ 4.5:1）。
- REQ-005.4: The system shall 使按钮在暗色模式下保持可辨识性：default（chili-500 红底白字不变）、secondary（dark-fill 填充 + dark-text 文字）、outline（dark-border 边框 + dark-surface 背景）、ghost（dark-text-secondary 文字）。
- REQ-005.5: The system shall 使边框线在暗色模式下可见但不过于突兀（#3e3e3e）。
- REQ-005.6: The system shall 使底部导航栏背景为深色（dark-surface/95 backdrop-blur），激活态保持 chili-500/15 半透明。
- REQ-005.7: The system shall 使全局 toast 背景适配深色（dark-elevated + dark-text）。
- REQ-005.8: The system shall 使 `paper-noise` 纹理在暗色模式下使用 `paper-noise-dark` 变体（降低噪点透明度适配深色背景）。

Gherkin:
```gherkin
Scenario: 全视图暗色无残留
  Given 用户已切换至暗色模式
When 用户依次浏览 home/welcome/menu/order/checkout 五个视图
  And 打开 CartPanel/ServiceSheet/DemoConsole/规格选择弹窗
  Then 所有视图和弹窗背景均为深色
  And 无大面积白色或浅色残留区域
  And 文字在深色背景上清晰可读
```

### REQ-006: i18n 文案支持

- **User Story**: As a 用户, I want 切换按钮的无障碍标签随语言切换, so that 不同语言下都有正确的无障碍描述。
- **Priority**: P1
- **Description**: 在 `src/i18n.ts` 的 `common` 分组中新增 `aria_dark_mode` 键。

Acceptance Requirements (EARS):
- REQ-006.1: When 中文环境下, the system shall 将按钮 aria-label 设为「切换黑夜模式」。
- REQ-006.2: When 英文环境下, the system shall 将按钮 aria-label 设为「Toggle dark mode」。

---

## UX Design

### 体验目标与设计原则

- **舒适优先**：暗色主题以降低屏幕亮度为核心目标，背景使用 #1d1d1d 而非纯黑，减少 OLED 屏幕的黑色拖影感。
- **品牌一致**：chili-500 品牌红在暗色下保持不变，维持品牌识别度；amber-400 进度色保持不变。
- **层次清晰**：页面背景 #1d1d1d → 卡片 #141414 → 弹窗 #272727，三层灰度递进确保信息层级。
- **不滤镜图片**：菜品图片在暗色下保持原样，维持食欲感。

### 页面 / 模块 / 入口范围

| 入口 | 位置 | 可见条件 |
|------|------|----------|
| 黑夜模式切换按钮 | TopBar 工具栏，老人模式按钮与语言切换按钮之间 | 非 home 视图（home 无 TopBar） |

### 核心体验路径

1. 用户进入应用（home → welcome → menu），界面为浅色主题。
2. 用户点击顶栏黑夜模式按钮（Moon 图标）。
3. 界面在 250ms 内平滑过渡为深色主题，按钮图标变为 Sun（chili-500 高亮）。
4. 用户继续点餐、查看订单、结账，所有界面均为深色主题。
5. 用户刷新页面，首屏直接呈现暗色主题（无闪烁）。
6. 用户再次点击按钮（Sun 图标），切回浅色主题。

### 分支路径 / 异常路径

| 场景 | 系统行为 |
|------|----------|
| 首次访问（无 localStorage） | 默认浅色主题 |
| 隐私模式（localStorage 不可用） | 切换功能正常但不持久化，不报错 |
| 老人模式 + 黑夜模式叠加 | 两个 class 同时生效（`html.elderly.dark`），字号放大 + 深色主题并存 |
| 页面刷新（暗色偏好已存储） | 首屏直接暗色，无 FOUC |

### 交互与状态说明

| 操作 | 前置状态 | 目标状态 | 用户可见反馈 |
|------|----------|----------|--------------|
| 点击黑夜模式按钮 | light | dark | 界面 250ms 过渡为深色，按钮图标变 Sun（chili-500 高亮） |
| 点击黑夜模式按钮 | dark | light | 界面 250ms 过渡为浅色，按钮图标变 Moon |
| 页面刷新 | dark | dark | 首屏直接暗色，无闪烁 |

### 文案与可理解性

| 文案键 | 中文 | 英文 | 位置 |
|--------|------|------|------|
| `common.aria_dark_mode` | 切换黑夜模式 | Toggle dark mode | 黑夜模式按钮 aria-label |

### 视觉与响应式约束

- 暗色色值来源：`knowledge/design-system/demo/system/tokens.dark.json`
- 全局过渡：复用现有 `src/index.css` 的 `html * { transition-property: background-color, border-color, color, fill, stroke; transition-duration: 250ms; }`，无需新增过渡动画。
- 响应式：暗色适配不改变现有响应式断点布局（`sm:` / `lg:` / `md:`），仅替换色值。

---

## Backend/Data

本需求不涉及后端行为、数据结构、存储、权限、状态流转或迁移变更。

说明：应用为 React SPA 纯前端内存态（AGENTS.md 确认），`server/` 仅为健康检查 Express 应用不参与业务链路。唯一持久化为 `localStorage` 中的 `dark-mode` 键（string，`'true'`/`'false'`，默认 `'false'`），与现有 `elderly-mode` 和 `i18nextLng` 模式一致，无 schema 迁移需求。

---

## API Design

本需求不涉及对外 API、SDK、Webhook、CLI 或客户集成契约变更。

---

## Metrics

本需求不涉及新增或变更埋点、日志、Dashboard 或指标口径。

---

## NFR / DFX

| 类别 | 要求 | 验收方法 |
|------|------|----------|
| 兼容性 | 黑夜模式与老人模式可同时启用，互不冲突（`html.elderly.dark` 双 class 并存） | 同时开启两种模式，视觉检查 5 个视图 + 弹窗 |
| 性能 | 主题切换不引起页面重排/重绘性能问题；复用现有全局 250ms CSS transition | 切换时 Chrome DevTools Performance 检查无长任务 |
| 可访问性 | 暗色模式下文字对比度 ≥ 4.5:1（WCAG AA） | 使用对比度检查工具验证 dark-text(#dcdcdc) vs dark-bg(#1d1d1d) = 13.6:1，dark-text-secondary(#adadad) vs dark-bg(#1d1d1d) = 8.1:1 |
| 可用性 | localStorage 不可用时功能降级但不报错 | 隐私模式下测试切换功能 |
| 一致性 | 暗色色值来源于设计系统 tokens.dark.json | 与 `tokens.dark.json` 色值逐一对照 |
| 回滚 | 纯前端 CSS 切换，回滚方式为移除 `dark` class 即恢复浅色，风险极低 | 手动移除 html.dark class 验证恢复浅色 |
| 部署影响 | 无灰度需求，无后端部署变更；前端构建产物（dist/）正常部署即可 | `npm run build` 验证构建通过 |

---

## Open Questions

| ID | 问题 | 影响 | 建议负责人 | 状态 |
|---|---|---|---|---|
| OQ-001 | 是否需要在未来迭代中支持跟随系统偏好 `prefers-color-scheme` | 未来范围扩展 | PM | 本次不做，记录为后续迭代项，不阻塞当前交付 |

---

## Traceability

| REQ ID | UX Design | NFR | 实现文件 | QA focus |
|--------|-----------|-----|----------|----------|
| REQ-001 | TopBar 切换按钮入口 | 可访问性（aria-label） | `src/components/TopBar.tsx`, `src/App.tsx` | 按钮位置/图标切换/aria-label 中英文 |
| REQ-002 | 状态管理交互 | 兼容性、可用性 | `src/hooks/useDarkMode.ts`, `src/App.tsx` | localStorage 持久化/降级/默认关闭 |
| REQ-003 | FOUC 防护 | 性能 | `index.html` | 刷新首屏无闪烁/localStorage 不可用降级 |
| REQ-004 | — | 一致性 | `tailwind.config.js` | darkMode 配置/7 个色阶值与 tokens.dark.json 一致 |
| REQ-005 | 全视图暗色适配 | 可访问性、一致性 | 全部 13 个组件文件 | 逐视图检查无浅色残留/对比度 ≥ 4.5:1 |
| REQ-006 | i18n 文案 | — | `src/i18n.ts` | 中英文 aria-label 正确 |

---

## 技术方案设计

> 本节为实现方提供具体技术方案，明确前后端改动范围、接口契约、数据模型、测试策略、部署影响和风险控制。仅允许基于本 Spec 生成代码，不得修改本 Spec。

### 技术改动总览

| 文件 | 变更类型 | 说明 | 关联 REQ |
|------|----------|------|----------|
| `tailwind.config.js` | 修改 | 启用 `darkMode: 'class'`，新增 7 个暗色色阶 | REQ-004 |
| `src/hooks/useDarkMode.ts` | **新增** | 黑夜模式状态管理 hook | REQ-002 |
| `src/index.css` | 修改 | 新增 `paper-noise-dark` 暗色噪点纹理 utility | REQ-005 |
| `index.html` | 修改 | 内联脚本增加 FOUC 防护 | REQ-003 |
| `src/i18n.ts` | 修改 | 新增 `aria_dark_mode` 中/英文案 | REQ-006 |
| `src/components/TopBar.tsx` | 修改 | 新增黑夜模式切换按钮，新增 `darkMode`/`onToggleDarkMode` props | REQ-001, REQ-005 |
| `src/App.tsx` | 修改 | 接入 `useDarkMode`，传递 props 给 TopBar，根容器 + 底部导航 + toast 添加 `dark:` | REQ-001, REQ-002, REQ-005 |
| `src/components/ui/button.tsx` | 修改 | CVA 4 个变体添加 `dark:` 前缀 | REQ-005 |
| `src/components/ui/dialog.tsx` | 修改 | Dialog 背景和文字添加 `dark:` 变体 | REQ-005 |
| `src/components/HomeView.tsx` | 修改 | 添加 `dark:` 变体 | REQ-005 |
| `src/components/WelcomeView.tsx` | 修改 | 添加 `dark:` 变体 | REQ-005 |
| `src/components/MenuView.tsx` | 修改 | 添加 `dark:` 变体（含 OptionRow） | REQ-005 |
| `src/components/OrderView.tsx` | 修改 | 添加 `dark:` 变体 | REQ-005 |
| `src/components/CheckoutView.tsx` | 修改 | 添加 `dark:` 变体 | REQ-005 |
| `src/components/CartPanel.tsx` | 修改 | 添加 `dark:` 变体 | REQ-005 |
| `src/components/ServiceSheet.tsx` | 修改 | 添加 `dark:` 变体 | REQ-005 |
| `src/components/DemoConsole.tsx` | 修改 | 添加 `dark:` 变体 | REQ-005 |

共 17 个文件变更（1 新增 + 16 修改），不涉及 `server/` 目录。

### 前端改动范围

#### 1. `tailwind.config.js` — 启用暗色模式 + 新增暗色色阶

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',  // ← 新增
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rice: { 50: '#fffdf8', 100: '#fbf5ea', 200: '#f3e6d0' },
        chili: { 50: '#fff1ef', 100: '#ffddd8', 500: '#e13b2b', 600: '#c92f21', 700: '#a9231a' },
        amber: { 100: '#fff2c7', 400: '#f5b83f', 500: '#e69b18' },
        charcoal: { 500: '#5f5b55', 700: '#34312d', 900: '#211f1c' },
        // ↓ 新增：暗色专用色阶（来源：tokens.dark.json）
        'dark-bg': '#1d1d1d',
        'dark-surface': '#141414',
        'dark-elevated': '#272727',
        'dark-border': '#3e3e3e',
        'dark-text': '#dcdcdc',
        'dark-text-secondary': '#adadad',
        'dark-fill': '#303030',
      },
      // boxShadow / fontFamily / keyframes / animation 保持不变
    },
  },
  plugins: [],
}
```

#### 2. `src/hooks/useDarkMode.ts` — 新增 hook

架构完全参照 `src/hooks/useElderlyMode.ts`：
- `useState` 初始化时调用 `getInitialDarkMode()` 读取 localStorage 并 `applyDarkMode()`
- `useEffect` 监听 `enabled` 变化调用 `applyDarkMode()`
- `toggle` 回调内 `setPrev(!prev)`，`try/catch` 写 localStorage
- `applyDarkMode` 在 `document.documentElement` 上 add/remove `dark` class
- localStorage key: `dark-mode`，值 `'true'`/`'false'`，默认 `false`

#### 3. `index.html` — FOUC 防护

在现有内联 `<script>` 中（与语言初始化并列）增加：

```js
try {
  var darkMode = localStorage.getItem('dark-mode');
  if (darkMode === 'true') {
    document.documentElement.classList.add('dark');
  }
} catch (e) { }
```

#### 4. `src/index.css` — 新增暗色噪点纹理

在 `@layer utilities` 中新增：

```css
.paper-noise-dark {
  background-image: radial-gradient(rgba(255, 255, 255, .04) .7px, transparent .7px);
  background-size: 12px 12px;
}
```

#### 5. `src/i18n.ts` — 新增文案

在 `common` 分组中新增（zh 和 en 两处同步）：
- zh: `aria_dark_mode: '切换黑夜模式'`
- en: `aria_dark_mode: 'Toggle dark mode'`

#### 6. `src/components/TopBar.tsx` — 新增切换按钮

- `TopBarProps` 新增 `darkMode: boolean` 和 `onToggleDarkMode: () => void`
- import `{ Moon, Sun }` from `lucide-react`
- 在老人模式按钮和语言切换按钮之间插入按钮：
  ```tsx
  <Button variant="outline" size="icon" onClick={onToggleDarkMode} aria-label={t('common.aria_dark_mode')}>
    {darkMode ? <Sun size={18} className="text-chili-500" /> : <Moon size={18} />}
  </Button>
  ```
- 顶栏 header 背景：`bg-rice-50/95` → 添加 `dark:bg-dark-bg/95`
- banner `bg-charcoal-900` 保持不变
- 桌台标签 `bg-rice-200` → 添加 `dark:bg-dark-elevated`
- 会员卡片内 `bg-white` → 添加 `dark:bg-dark-surface`

#### 7. `src/App.tsx` — 接入 hook + 全局适配

- import `useDarkMode`，在 App 组件内调用 `const { enabled: darkMode, toggle: toggleDarkMode } = useDarkMode()`
- 传递 `darkMode={darkMode}` `onToggleDarkMode={toggleDarkMode}` 给 `<TopBar>`
- 根容器 `bg-rice-100 paper-noise` → 添加 `dark:bg-dark-bg dark:paper-noise-dark`
- 协同提示卡片 `bg-amber-100/70` → 添加 `dark:bg-amber-400/15`，文字添加 `dark:text-dark-text-secondary`
- 底部导航栏 `bg-white/95` → 添加 `dark:bg-dark-surface/95`，`border-charcoal-900/5` → 添加 `dark:border-dark-border`
- MobileNav 激活态 `bg-chili-50 text-chili-500` → 添加 `dark:bg-chili-500/15`；非激活 `text-charcoal-500` → 添加 `dark:text-dark-text-secondary`
- 全局 toast `bg-charcoal-900/90 text-white` → 添加 `dark:bg-dark-elevated dark:text-dark-text`

#### 8. `src/components/ui/button.tsx` — CVA 变体暗色

| 变体 | 浅色（保持） | 新增 dark: |
|------|-------------|-----------|
| default | `bg-chili-500 text-white shadow-md hover:bg-chili-600` | 无变化（红底白字在暗色下不变） |
| secondary | `bg-rice-200 text-charcoal-900 hover:bg-amber-100` | `dark:bg-dark-fill dark:text-dark-text dark:hover:bg-amber-400/15` |
| outline | `border border-charcoal-900/10 bg-white text-charcoal-900 hover:border-chili-500/30 hover:bg-chili-50` | `dark:border-dark-border dark:bg-dark-surface dark:text-dark-text dark:hover:bg-chili-500/15` |
| ghost | `text-charcoal-700 hover:bg-rice-200` | `dark:text-dark-text-secondary dark:hover:bg-dark-fill` |

#### 9. `src/components/ui/dialog.tsx` — Dialog 暗色

- Content 背景 `bg-rice-50` → 添加 `dark:bg-dark-bg`
- Title `text-charcoal-900` → 添加 `dark:text-dark-text`
- Close 按钮 `bg-white text-charcoal-500` → 添加 `dark:bg-dark-surface dark:text-dark-text-secondary`
- Overlay `bg-charcoal-900/40` 保持不变

#### 10-17. 各 View 组件 — 添加 `dark:` 变体

按「暗色色值映射规则」表逐组件替换。关键适配点：

- **HomeView**：`bg-rice-100 paper-noise` → `dark:bg-dark-bg dark:paper-noise-dark`；模糊光斑保持半透明不变；桌台卡片 `bg-white` → `dark:bg-dark-surface`；文字适配
- **WelcomeView**：`bg-rice-100 paper-noise` → `dark:bg-dark-bg dark:paper-noise-dark`；卡片 `bg-white/90` → `dark:bg-dark-surface/90`；badge `bg-chili-50` → `dark:bg-chili-500/15`
- **MenuView**：Hero 区域 `bg-charcoal-900` 保持不变；搜索框 `bg-white` → `dark:bg-dark-surface`；分类标签非激活 `bg-white text-charcoal-500` → `dark:bg-dark-surface dark:text-dark-text-secondary`；菜品卡片 `bg-white` → `dark:bg-dark-surface`；售罄遮罩 `bg-white/55` → `dark:bg-dark-surface/70`；OptionRow 按钮适配
- **OrderView**：进度面板 `bg-charcoal-900` 保持不变；订单列表卡片 `bg-white` → `dark:bg-dark-surface`；空状态图标 `bg-white` → `dark:bg-dark-surface`
- **CheckoutView**：账单卡片 `bg-white` → `dark:bg-dark-surface`；支付方式卡片适配；成功页 `bg-white` → `dark:bg-dark-surface`；emerald 色保持不变
- **CartPanel**：面板 `bg-white` → `dark:bg-dark-surface`；空状态 `bg-rice-100` → `dark:bg-dark-elevated`；价格区 `bg-rice-100` → `dark:bg-dark-elevated`；数量调节器 `bg-rice-100` → `dark:bg-dark-elevated`，`bg-white` → `dark:bg-dark-surface`
- **ServiceSheet**：服务按钮卡片 `bg-white` → `dark:bg-dark-surface`；呼叫记录 `bg-rice-100` → `dark:bg-dark-elevated`，`bg-white` → `dark:bg-dark-surface`
- **DemoConsole**：控制台卡片 `bg-white` → `dark:bg-dark-surface`；stage 按钮 `bg-rice-50` → `dark:bg-dark-elevated`；售罄按钮适配

### 接口契约

不涉及。无新增/变更对外 API、SDK、Webhook 或 CLI 契约。

### 数据模型

| 存储位置 | Key | 类型 | 默认值 | 校验规则 | 关联 REQ |
|----------|-----|------|--------|----------|----------|
| localStorage | `dark-mode` | string | `'false'` | `'true'` / `'false'` | REQ-002 |

无 schema 迁移；与现有 `elderly-mode` 和 `i18nextLng` 模式一致。

### 测试策略

| 测试类型 | 范围 | 方法 | 关联 REQ |
|----------|------|------|----------|
| 单元测试 | `useDarkMode` hook | 验证 toggle 状态切换、localStorage 读写、降级行为 | REQ-002 |
| 类型检查 | 全项目 | `npx tsc -b --noEmit` 零错误 | 全部 |
| Lint | 全项目 | `npm run lint` 零警告 | 全部 |
| 构建 | 全项目 | `npm run build` 成功 | 全部 |
| E2E | 视觉验证 | `npx playwright test` 现有用例不回归；手动验证暗色模式切换 + 全视图无浅色残留 | REQ-001, REQ-005 |
| 手动验证 | FOUC | 刷新页面检查首屏主题正确 | REQ-003 |
| 手动验证 | 兼容性 | 老人模式 + 黑夜模式同时开启 | NFR 兼容性 |
| 手动验证 | 降级 | 隐私模式下切换功能正常 | NFR 可用性 |

**技术侧重点评估事项**（需开发关注）：
1. **`dark:` 变体覆盖完整性**：17 个文件中大量 `bg-white`/`text-charcoal-*`/`border-charcoal-*` 类名需逐一添加 `dark:` 变体，遗漏会导致局部浅色残留。建议逐视图开发完成后立即在暗色模式下视觉检查。
2. **MenuView 组件复杂度最高**：含搜索框、分类标签、菜品卡片、规格选择弹窗、OptionRow、售罄遮罩、本桌已点 badge 等多个子元素，每个都需暗色适配。
3. **CVA Button 变体影响全局**：Button 组件被所有视图使用，dark 变体修改后需全局回归。
4. **`paper-noise-dark` 新增 utility**：需在 `src/index.css` 的 `@layer utilities` 中定义，确保 Tailwind 能正确生成。
5. **老人模式叠加**：`html.elderly.dark` 双 class 下，老人模式的 `font-size: 125%` 与暗色主题并存，需检查关键视图布局是否溢出。

### 部署影响

- 无后端部署变更。
- 前端构建产物（`dist/`）正常部署到 GitHub Pages 即可。
- 无灰度需求（纯前端 CSS 切换，回滚方式为移除 `dark` class）。
- `npm run build`（`tsc -b && vite build`）需通过。

### 风险控制

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `dark:` 变体覆盖遗漏导致局部浅色残留 | 视觉不一致 | 逐视图开发 + 暗色模式视觉检查 + E2E 截图对比 |
| 老人模式 + 黑夜模式叠加时字号放大影响布局 | 布局溢出 | 两种模式同时启用时检查 5 个关键视图 |
| Button CVA 变体修改影响全局 | 按钮样式异常 | 修改后全视图回归测试 |
| FOUC 防护脚本执行时机 | 首屏闪烁 | 确保 `index.html` 内联脚本在 CSS 解析前执行 |
| Tailwind `dark:` 类名未生成 | 暗色样式不生效 | 确保 `tailwind.config.js` 的 `content` 配置覆盖所有组件文件（已有配置 `./src/**/*.{js,ts,jsx,tsx}` 满足） |
