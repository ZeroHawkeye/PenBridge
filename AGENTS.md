# AGENTS.md - 腾讯云开发者社区文章管理工具

本文档为 AI 编程助手提供项目指南，帮助理解项目结构和开发规范。

## 项目概述

这是一个腾讯云开发者社区文章管理工具，支持：
- 自动登录腾讯云开发者社区（首次手动登录，之后自动保存登录状态）
- 文章编辑与管理
- 定时发布功能（开发中）

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + TanStack Router + shadcn/ui + Tailwind CSS 4 + TanStack Query 4 + tRPC 10 |
| 后端 | Bun + Hono + tRPC + TypeORM + sql.js |
| 桌面端 | Electron + Electron Forge |
| 自动化 | Puppeteer（浏览器自动化登录） |
| 数据库 | SQLite（通过 sql.js，存储在 `packages/server/data/`） |

## 项目结构

```
tencent-dev-blog/
├── package.json              # 工作区根配置
├── electron/                 # Electron 桌面应用（独立于 packages）
│   ├── src/
│   │   ├── main.ts           # Electron 主进程入口
│   │   ├── preload.ts        # 预加载脚本
│   │   ├── store.ts          # electron-store 配置
│   │   └── auth/             # 认证相关
│   ├── forge.config.ts       # Electron Forge 打包配置
│   ├── out/                  # 打包输出目录（gitignore）
│   └── web/                  # 前端构建产物复制目录（gitignore）
├── packages/
│   ├── server/               # 后端服务
│   │   ├── src/
│   │   │   ├── index.ts      # Hono 服务器入口
│   │   │   ├── db/index.ts   # TypeORM + sql.js 数据库配置
│   │   │   ├── entities/     # TypeORM 实体（User, Article）
│   │   │   ├── services/     # 业务服务（browser, tencentAuth）
│   │   │   └── trpc/router.ts # tRPC API 路由
│   │   └── data/             # SQLite 数据库文件（gitignore）
│   ├── web/                  # 前端应用
│   │   ├── src/
│   │   │   ├── main.tsx      # 应用入口
│   │   │   ├── components/ui/ # shadcn/ui 组件
│   │   │   ├── lib/utils.ts  # 工具函数（cn 等）
│   │   │   ├── hooks/        # 自定义 hooks
│   │   │   ├── utils/trpc.ts # tRPC 客户端配置
│   │   │   ├── routes/       # TanStack Router 路由组件
│   │   │   └── routeTree.gen.ts # 自动生成的路由树（勿手动编辑）
│   │   ├── components.json   # shadcn/ui 配置
│   │   └── vite.config.ts
│   └── shared/types.ts       # 共享类型定义
```

**注意**: `electron/` 目录位于项目根目录，不在 `packages/` 内。请勿在 `packages/` 下创建 `electron` 目录。

## 构建和运行命令

### 开发模式
```bash
# 启动后端（端口 3000）
bun run dev:server

# 启动前端（端口 5173）
bun run dev:web
```

### 构建
```bash
# 构建全部
bun run build

# 单独构建
bun run build:server   # 输出到 packages/server/dist/
bun run build:web      # 输出到 packages/web/dist/
```

### 添加依赖
```bash
# 必须使用 bun add，不要直接修改 package.json
bun add <package> --cwd packages/server   # 后端依赖
bun add <package> --cwd packages/web      # 前端依赖
bun add -d <package>                       # 根目录开发依赖
```

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
import type { Browser, Page } from "puppeteer";
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
```

### React 组件规范（前端）
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

## 重要注意事项

### 版本兼容性
- **React Query**: 使用 v4.x（`isLoading` 而非 `isPending`）
- **tRPC**: 使用 v10.x（`useContext()` 而非 `useUtils()`）
- **Bun**: 不支持 `better-sqlite3`，使用 `sql.js` 替代

### tRPC 类型处理
前端 tRPC 客户端使用 `any` 类型断言绕过严格类型检查：
```typescript
// packages/web/src/utils/trpc.ts
const _trpc = createTRPCReact<any>();
export const trpc = _trpc as any;
```

### 数据库
- 使用 `synchronize: true` 自动迁移，无需手动创建表
- 数据库文件: `packages/server/data/tencent-dev-blog.db`
- 该目录已在 `.gitignore` 中

### 路由文件
- `routeTree.gen.ts` 由 TanStack Router Vite 插件自动生成
- **不要手动编辑此文件**
- 新增路由只需在 `routes/` 目录创建文件

## 禁止操作

1. **不要运行 `dev` 或 `start` 命令启动服务**，使用 `build` 命令验证
2. **不要直接修改 `package.json` 添加依赖**，使用 `bun add`
3. **不要使用 `better-sqlite3`**，Bun 不支持
4. **不要手动编辑 `routeTree.gen.ts`**

## 语言要求

- 代码注释和提交信息使用中文
- 用户界面文本使用中文
