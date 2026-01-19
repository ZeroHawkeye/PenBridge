# AGENTS.md - PenBridge 多平台文章管理与发布工具

本文档为 AI 编程助手提供项目指南，帮助理解项目结构和开发规范。

## 项目概述

PenBridge 是一个多平台文章管理与发布工具，支持：
- 文章编辑与管理（Milkdown 所见即所得编辑器 + CodeMirror 源码编辑器）
- 多平台发布（腾讯云开发者社区、掘金）
- 自动登录各平台（首次手动登录，之后自动保存登录状态）
- 定时发布功能
- AI 辅助写作（支持 OpenAI 兼容 API、GitHub Copilot）
- 数据导入导出（支持加密）

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + TanStack Router + shadcn/ui + Tailwind CSS 4 + TanStack Query 4 + tRPC 10 + Milkdown + CodeMirror |
| 后端 | Bun + Hono + tRPC + TypeORM + sql.js + AI SDK |
| 桌面端 | Electron 34 + electron-builder |
| 数据库 | SQLite（通过 sql.js，存储在 `packages/server/data/`） |
| 部署 | Docker + GitHub Actions + Vercel (官网) |

## 项目结构

```
pen-bridge/
├── package.json              # 工作区根配置 (Bun workspaces)
├── docker-compose.yml        # Docker 本地开发配置
├── .github/workflows/        # CI/CD 配置
│   └── build.yml             # 多平台构建和发布流程
├── electron/                 # Electron 桌面应用（独立于 packages）
│   ├── src/
│   │   ├── main.ts           # Electron 主进程入口
│   │   ├── preload.ts        # 预加载脚本（contextBridge 安全 API）
│   │   ├── store.ts          # electron-store 持久化配置
│   │   ├── autoUpdater.ts    # 自动更新模块
│   │   ├── localServer.ts    # 本地后端服务器管理
│   │   └── auth/             # 认证模块
│   │       ├── tencentAuth.ts    # 腾讯云社区认证
│   │       ├── juejinAuth.ts     # 掘金认证
│   │       ├── copilotAuth.ts    # GitHub Copilot 认证辅助
│   │       └── authUI.ts         # 通用认证 UI 组件
│   ├── electron-builder.yml  # electron-builder 打包配置
│   ├── forge.config.ts       # Electron Forge 配置（Windows/macOS）
│   └── forge.config.linux.ts # Electron Forge Linux 配置
├── packages/
│   ├── server/               # 后端服务
│   │   ├── src/
│   │   │   ├── index.ts      # Hono 服务器入口
│   │   │   ├── db/index.ts   # TypeORM + sql.js 数据库配置
│   │   │   ├── entities/     # TypeORM 实体
│   │   │   ├── services/     # 业务服务
│   │   │   ├── trpc/         # tRPC API
│   │   │   │   ├── router.ts # 路由聚合
│   │   │   │   ├── shared.ts # 共享中间件（认证）
│   │   │   │   └── routers/  # 各模块路由（15个）
│   │   │   ├── routes/       # Hono 原生路由（上传、AI流式）
│   │   │   └── prompts/      # AI 系统提示词
│   │   ├── Dockerfile        # 多阶段 Docker 构建
│   │   └── data/             # SQLite 数据库文件（gitignore）
│   ├── web/                  # 前端应用
│   │   ├── src/
│   │   │   ├── main.tsx      # 应用入口
│   │   │   ├── routes/       # TanStack Router 路由
│   │   │   ├── components/   # 组件
│   │   │   │   ├── ui/       # shadcn/ui 组件（27个）
│   │   │   │   ├── ai-chat/  # AI 聊天组件
│   │   │   │   ├── editors/  # 编辑器切换组件
│   │   │   │   ├── file-tree/# 文件树组件
│   │   │   │   ├── settings/ # 设置页面组件
│   │   │   │   ├── dashboard/# 仪表盘组件
│   │   │   │   └── milkdown-plugins/ # Milkdown 插件
│   │   │   ├── hooks/        # 自定义 hooks
│   │   │   ├── utils/        # 工具函数
│   │   │   └── lib/utils.ts  # cn() 类名合并
│   │   ├── components.json   # shadcn/ui 配置
│   │   └── vite.config.ts    # Vite 构建配置
│   ├── shared/               # 共享模块
│   │   ├── types.ts          # 核心类型定义
│   │   └── markdown/         # Markdown 扩展语法处理
│   │       ├── types.ts      # 扩展语法类型
│   │       ├── directives.ts # 语法注册表（对齐等）
│   │       └── platformConfig.ts # 平台语法支持配置
│   └── website/              # 官网（部署到 Vercel）
│       ├── src/routes/       # 页面路由
│       ├── src/content/docs/ # MDX 文档
│       ├── api/              # Vercel Serverless Functions
│       └── vercel.json       # Vercel 部署配置
└── scripts/                  # 构建脚本
    └── convert-icons.js      # 图标转换工具
```

**注意**: `electron/` 目录位于项目根目录，不在 `packages/` 内。请勿在 `packages/` 下创建 `electron` 目录。

---

## 后端服务详情

### 数据库实体 (entities/)

| 实体 | 表名 | 说明 |
|------|------|------|
| `AdminUser` | admin_users | 管理员账号（支持超级管理员角色） |
| `AdminSession` | admin_sessions | 管理员会话 |
| `User` | users | 平台用户信息 |
| `Article` | articles | 文章（含腾讯云/掘金发布状态） |
| `Folder` | folders | 文件夹（支持嵌套） |
| `ScheduledTask` | scheduled_tasks | 定时发布任务 |
| `AIProvider` | ai_providers | AI 供应商配置 |
| `AIChat` | ai_chat | AI 聊天会话和消息 |
| `CopilotAuth` | copilot_auth | GitHub Copilot 认证信息 |
| `EmailConfig` | email_configs | 邮件通知配置 |

### tRPC 路由模块 (trpc/routers/)

项目共有 **15 个路由模块**，约 **95 个 API 端点**：

| 路由 | 前缀 | 说明 |
|------|------|------|
| `adminAuth` | adminAuth | 管理员登录/登出/密码修改 |
| `adminUser` | adminUser | 管理员账号管理（超级管理员权限） |
| `auth` | auth | 腾讯云认证状态和 Cookie 管理 |
| `juejinAuth` | juejinAuth | 掘金认证状态和 Cookie 管理 |
| `copilotAuth` | copilotAuth | GitHub Copilot 设备授权流程 |
| `article` | article | 文章 CRUD（支持分离加载 content） |
| `articleExt` | articleExt | 文章扩展操作（移动/重命名） |
| `folder` | folder | 文件夹树结构和操作 |
| `sync` | sync | 腾讯云同步/发布/状态检查 |
| `juejin` | juejin | 掘金同步/发布/标签/分类 |
| `schedule` | schedule | 定时发布任务管理 |
| `emailConfig` | emailConfig | 邮件 SMTP 配置和测试 |
| `aiConfig` | aiConfig | AI 供应商和模型配置 |
| `aiChat` | aiChat | AI 聊天会话和消息管理 |
| `dataTransfer` | dataTransfer | 数据导入导出（支持加密） |

### 业务服务 (services/)

| 服务 | 文件 | 功能 |
|------|------|------|
| 腾讯云 API | `tencentApi.ts` | 文章发布、草稿管理、标签搜索 |
| 腾讯云认证 | `tencentAuth.ts` | Cookie 管理、登录状态检测 |
| 掘金 API | `juejinApi.ts` | 文章发布、草稿管理、分类标签 |
| 掘金认证 | `juejinAuth.ts` | Cookie 管理、会话状态 |
| 掘金同步 | `juejinSync.ts` | 文章同步、Markdown 转换 |
| AI 适配器 | `aiProviderAdapter.ts` | 统一 AI SDK 接口封装 |
| AI 工具 | `aiTools.ts` | AI 工具定义（更新标题/内容等） |
| Copilot 认证 | `githubCopilotAuth.ts` | GitHub OAuth 设备流程 |
| 文章同步 | `articleSync.ts` | 腾讯云文章同步逻辑 |
| 定时调度 | `scheduler.ts` | 定时任务执行器 |
| 图片上传 | `imageUpload.ts` | 本地图片存储管理 |
| 图片清理 | `imageCleanup.ts` | 未引用图片自动清理 |
| 邮件服务 | `emailService.ts` | SMTP 邮件发送 |
| Markdown 转换 | `markdownTransformer.ts` | 平台特定语法转换 |
| 提示词模板 | `promptTemplate.ts` | AI 系统提示词加载 |
| 数据导入导出 | `dataExportImport.ts` | ZIP 打包/解包、加密 |
| 日志 | `logger.ts` | 统一日志输出 |

### Hono 原生路由 (routes/)

| 路由 | 文件 | 功能 |
|------|------|------|
| `/api/upload` | `upload.ts` | 图片上传接口 |
| `/api/ai/chat/stream` | `aiChatStream.ts` | AI 流式聊天（SSE） |
| `/api/ai/tool/execute` | `aiToolExecute.ts` | AI 工具执行 |
| `/api/ai/warmup` | `aiWarmup.ts` | AI 服务预热 |

---

## 前端应用详情

### 路由结构 (routes/)

| 路径 | 文件 | 功能 |
|------|------|------|
| `/` | `index.tsx` | 仪表盘（统计、快捷操作） |
| `/login` | `login.tsx` | 登录页面 |
| `/setup` | `setup.tsx` | 首次配置（本地/云端模式） |
| `/settings` | `settings.tsx` | 设置中心（多 Tab） |
| `/articles` | `articles/index.tsx` | 文章列表 |
| `/articles/new` | `articles/new.tsx` | 新建文章 |
| `/articles/$id/edit` | `articles/$id/edit.tsx` | 编辑文章 |

### 主要组件

#### 编辑器相关
| 组件 | 功能 |
|------|------|
| `MilkdownEditor` | 所见即所得 Markdown 编辑器 |
| `CodeMirrorEditor` | 源码编辑器 |
| `EditorSwitcher` | 编辑器模式切换 |
| `ArticleEditorLayout` | 编辑器布局（目录、AI面板） |
| `TableOfContents` | 文章目录导航 |
| `EditorSearchBox` | 编辑器内搜索（Ctrl+F） |

#### AI 聊天 (ai-chat/)
| 组件/Hook | 功能 |
|------|------|
| `AIChatPanel` | AI 聊天侧边栏面板 |
| `useAIChat` | 核心聊天逻辑（SSE 流式、工具调用、AI Loop） |
| `useChatSession` | 会话管理 |
| `MessageItem` | 消息渲染（支持 Markdown） |
| `ToolCallBlock` | 工具调用展示 |
| `ThinkingBlock` | 深度思考过程展示 |
| `InlineDiffPreview` | 内联 Diff 预览组件 |
| `ToolPermissionDialog` | 工具权限配置 |

#### 文件树 (file-tree/)
| 组件 | 功能 |
|------|------|
| `FileTree` | 文件夹/文章树形结构 |
| `TreeNodeItem` | 树节点（支持拖拽排序） |
| `EditableInput` | 重命名输入框 |

#### 设置页面 (settings/)
| 组件 | 功能 |
|------|------|
| `TencentAuthSettings` | 腾讯云认证 |
| `JuejinAuthSettings` | 掘金认证 |
| `AIConfigSettings` | AI 配置（供应商/模型管理） |
| `CopilotConnect` | GitHub Copilot 连接 |
| `ScheduleTaskSettings` | 定时任务管理 |
| `EmailNotificationSettings` | 邮件通知配置 |
| `UserManagementSettings` | 用户管理（超级管理员） |
| `AccountSecuritySettings` | 账号安全 |
| `EditorSettings` | 编辑器设置 |
| `DataTransferSettings` | 数据导入导出 |

### 工具函数 (utils/)

| 文件 | 功能 |
|------|------|
| `trpc.ts` | tRPC 客户端创建 |
| `auth.ts` | Token 和用户信息管理 |
| `serverConfig.ts` | 服务器配置（本地/云端模式） |
| `fontSettings.ts` | 字体设置 |
| `spellCheck.ts` | 拼写检查配置 |
| `wordCount.ts` | 字数统计 |
| `wordToMarkdown.ts` | Word 文档转 Markdown |

---

## Electron 桌面端详情

### 主进程功能 (main.ts)

- **窗口管理**: 无边框窗口，自定义标题栏
- **应用模式**: 本地模式（启动内置后端）/ 云端模式
- **IPC 处理器**: 窗口控制、认证、服务器配置等
- **本地服务器**: 端口 36925，异步启动不阻塞窗口

### 预加载 API (preload.ts)

通过 `window.electronAPI` 暴露给前端：

| API | 功能 |
|-----|------|
| `window.*` | 最小化/最大化/关闭窗口 |
| `appMode.*` | 本地/云端模式切换 |
| `auth.*` | 腾讯云认证 |
| `juejinAuth.*` | 掘金认证 |
| `copilotAuth.*` | Copilot 认证辅助 |
| `serverConfig.*` | 服务器配置 |
| `updater.*` | 自动更新 |
| `shell.openExternal()` | 打开外部链接 |

### 认证模块 (auth/)

| 模块 | 功能 |
|------|------|
| `tencentAuth.ts` | 腾讯云登录窗口、Cookie 提取 |
| `juejinAuth.ts` | 掘金登录窗口、Cookie 提取 |
| `copilotAuth.ts` | 打开验证页面、复制用户码 |
| `authUI.ts` | 通用认证 UI（注入"获取鉴权"按钮） |

### 存储配置 (store.ts)

使用 `electron-store` 持久化存储：
- 腾讯云/掘金 Cookies 和用户信息
- 应用模式配置（local/cloud）
- 服务器配置（baseUrl）

---

## 共享模块详情

### types.ts 核心类型

| 类型 | 说明 |
|------|------|
| `ArticleStatus` | 文章状态枚举（draft/scheduled/published/failed） |
| `Article` | 文章接口（含平台发布状态） |
| `ElectronAPI` | Electron 暴露 API 类型 |
| `ExportData` / `ImportResult` | 数据导入导出类型 |
| `AISDKType` / `ModelCapabilities` | AI 配置类型 |

### markdown/ Markdown 扩展

| 文件 | 功能 |
|------|------|
| `directives.ts` | 对齐指令（left/right/center/justify） |
| `platformConfig.ts` | 平台语法支持（腾讯云支持对齐，掘金不支持） |

---

## 构建和运行命令

### 开发模式
```bash
# 启动后端（端口 3000）
bun run dev:server

# 启动前端（端口 5173）
bun run dev:web

# 同时启动 Electron 开发模式
bun run dev:electron
```

### 构建
```bash
# Web/Docker 部署构建
bun run build:web          # 使用绝对路径 /
bun run build:server       # Bun target

# Electron 构建
bun run build:web:electron # 使用相对路径 ./
bun run build:server:electron:win   # Windows 可执行文件
bun run build:server:electron:mac   # macOS x64
bun run build:server:electron:mac-arm  # macOS ARM64
bun run build:server:electron:linux # Linux
```

### Electron 打包
```bash
# Windows
bun run dist:electron:win

# macOS
bun run dist:electron

# 产物位置: electron/release/
```

### Docker 部署
```bash
# 本地构建部署
docker-compose up -d --build

# 使用预构建镜像
docker pull ghcr.io/zerohawkeye/penbridge:latest
docker compose -f packages/server/docker-compose.prod.yml up -d
```

### 添加依赖
```bash
# 必须使用 bun add，不要直接修改 package.json
bun add <package> --cwd packages/server   # 后端依赖
bun add <package> --cwd packages/web      # 前端依赖
bun add -d <package>                       # 根目录开发依赖
```

---

## 代码风格规范

### TypeScript 配置
- **严格模式**: 所有包都启用 `strict: true`
- **前端**: `noUnusedLocals`, `noUnusedParameters` 启用
- **后端**: 启用 `experimentalDecorators` 和 `emitDecoratorMetadata`（TypeORM 需要）

### 导入顺序
```typescript
// 1. 外部库
import { Hono } from "hono";
import { z } from "zod";

// 2. 内部模块（相对路径）
import { AppDataSource } from "../db";
import { User } from "../entities/User";

// 3. 类型导入
import type { BrowserWindow, Cookie } from "electron";
```

### 命名规范
| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | camelCase (组件用 PascalCase) | `tencentAuth.ts`, `User.ts` |
| 变量/函数 | camelCase | `authStatus`, `handleLogout` |
| 类/接口/类型 | PascalCase | `ArticleStatus`, `AppRouter` |
| 常量 | UPPER_SNAKE_CASE 或 camelCase | `ArticleStatus.DRAFT` |
| React 组件 | PascalCase | `LoginPage`, `RootComponent` |

### TypeORM 实体规范
```typescript
@Entity("table_name")
export class EntityName {
  @PrimaryGeneratedColumn()
  id!: number;  // 使用 ! 断言非空

  @Column({ nullable: true })
  optionalField?: string;  // 可选字段用 ?

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### tRPC 路由规范
```typescript
// 使用 zod 进行输入验证
t.procedure
  .input(z.object({
    id: z.number(),
    title: z.string().min(1),
  }))
  .query(async ({ input }) => {
    // 处理逻辑
  });

// 使用认证中间件
import { protectedProcedure, superAdminProcedure } from "../shared";

// 需要登录
protectedProcedure.query(async ({ ctx }) => {
  const userId = ctx.userId;
  // ...
});

// 需要超级管理员
superAdminProcedure.mutation(async ({ ctx, input }) => {
  // ...
});
```

### React 组件规范
```typescript
// 使用函数组件 + hooks
function ComponentName() {
  // 1. hooks 调用
  const { data, isLoading } = trpc.xxx.useQuery();
  const mutation = trpc.xxx.useMutation();

  // 2. 事件处理函数
  const handleClick = () => { /* ... */ };

  // 3. 渲染
  return <div>...</div>;
}

// 路由导出
export const Route = createFileRoute("/path")({
  component: ComponentName,
});
```

### 错误处理
```typescript
// 后端：让错误自然抛出，tRPC 会处理
throw new Error("描述性错误信息");

// 前端：使用 mutation 的 onError
const mutation = trpc.xxx.useMutation({
  onSuccess: () => message.success("操作成功"),
  onError: (error: Error) => message.error(`失败: ${error.message}`),
});
```

---

## 重要注意事项

- 专注于当前任务，不修改无关代码
- 严禁直接修改 package.json，需要使用包管理工具管理依赖

### 版本兼容性
- **React Query**: 使用 v4.x（`isLoading` 而非 `isPending`）
- **tRPC**: 使用 v10.x（`useContext()` 而非 `useUtils()`）
- **Bun**: 不支持 `better-sqlite3`，使用 `sql.js` 替代
- **Electron**: v34.x，使用 electron-builder 打包

### tRPC 类型处理
前端 tRPC 客户端使用 `any` 类型断言绕过严格类型检查：
```typescript
// packages/web/src/utils/trpc.ts
const _trpc = createTRPCReact<any>();
export const trpc = _trpc as any;
```

### 数据库
- 使用 `synchronize: true` 自动迁移，无需手动创建表
- 数据库文件: `packages/server/data/pen-bridge.db`
- 该目录已在 `.gitignore` 中

### 路由文件
- `routeTree.gen.ts` 由 TanStack Router Vite 插件自动生成
- **不要手动编辑此文件**
- 新增路由只需在 `routes/` 目录创建文件

### Vite 构建配置
- Electron 构建使用相对路径 `./`（通过 `BUILD_TARGET=electron` 环境变量）
- Web/Docker 构建使用绝对路径 `/`
- 代码分割：antd、radix、milkdown、codemirror 分包加载

### Electron 本地服务器
- 端口: 36925（固定端口，避免冲突）
- 异步启动，不阻塞窗口显示
- 支持多架构：x64、arm64

---

## 禁止操作

1. **不要运行 `dev` 或 `start` 命令启动服务**，使用 `build` 命令验证
2. **不要直接修改 `package.json` 添加依赖**，使用 `bun add`
3. **不要使用 `better-sqlite3`**，Bun 不支持
4. **不要手动编辑 `routeTree.gen.ts`**
5. **不要在 `packages/` 下创建 `electron` 目录**

---

## 发布流程

### 版本发布
```bash
# 1. 创建并推送版本标签
git tag v1.0.0
git push origin v1.0.0

# 2. CI 自动执行：
#    - 构建 Windows/macOS/Linux 安装包
#    - 构建并推送 Docker 镜像到 ghcr.io
#    - 部署到服务器
#    - 创建 GitHub Release
```

### 构建产物
| 平台 | 格式 |
|------|------|
| Windows | `.exe` (NSIS 安装程序) |
| macOS | `.dmg`, `.zip` (x64/arm64) |
| Linux | `.AppImage`, `.deb`, `.rpm` (x64/arm64) |
| Docker | `ghcr.io/zerohawkeye/penbridge` |

---

## 语言要求

- 代码注释和提交信息使用中文
- 用户界面文本使用中文
