<p align="center">
  <img src="packages/web/public/icon.svg" alt="PenBridge Logo" width="120" height="120">
</p>

<h1 align="center">🖊️ PenBridge</h1>

<p align="center">
  <strong>跨平台文章管理与一键发布工具</strong>
</p>

<p align="center">
  ✨ 写作一次，发布到所有平台 ✨
</p>

<p align="center">
  <a href="https://github.com/ZeroHawkeye/PenBridge">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  </a>
  <a href="https://github.com/ZeroHawkeye/PenBridge">
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  </a>
  <a href="https://github.com/ZeroHawkeye/PenBridge">
    <img src="https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9" alt="Electron">
  </a>
  <a href="https://github.com/ZeroHawkeye/PenBridge">
    <img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun">
  </a>
</p>

<p align="center">
  <a href="https://github.com/ZeroHawkeye/PenBridge/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg" alt="License: CC BY-NC-SA 4.0">
  </a>
  <a href="https://github.com/ZeroHawkeye/PenBridge/stargazers">
    <img src="https://img.shields.io/github/stars/ZeroHawkeye/PenBridge?style=social" alt="GitHub Stars">
  </a>
  <a href="https://github.com/ZeroHawkeye/PenBridge/issues">
    <img src="https://img.shields.io/github/issues/ZeroHawkeye/PenBridge" alt="GitHub Issues">
  </a>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#支持平台">支持平台</a> •
  <a href="#技术架构">技术架构</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#使用说明">使用说明</a> •
  <a href="#开发指南">开发指南</a> •
  <a href="#常见问题">常见问题</a> •
  <a href="#许可证">许可证</a>
</p>

---

## 💡 为什么选择 PenBridge？

作为内容创作者，您是否遇到过以下困扰？

- 📋 写完一篇文章，需要手动复制粘贴到多个平台
- 🔄 不同平台格式不兼容，需要反复调整
- ⏰ 想要定时发布，却只能设置闹钟手动操作
- 📂 文章越来越多，管理越来越混乱

**PenBridge** 正是为解决这些问题而生！一次编写，多平台发布，让您专注于创作本身。

---

## 功能特性

### 📝 所见即所得编辑器

基于 Milkdown 的现代化 Markdown 编辑器，让写作更专注：

- 实时预览，所见即所得
- 图片拖拽/粘贴自动上传
- 代码块语法高亮
- 表格、列表、链接等丰富语法支持
- 文章目录导航，快速定位
- 自动保存，永不丢失

### 🤖 AI 写作助手

集成强大的 AI 助手，让创作更高效：

- **多供应商支持** - 接入 OpenAI、智谱、DeepSeek 等主流 AI 服务
- **智能对话** - 流式响应，实时查看 AI 思考过程
- **工具调用** - AI 可直接读取、修改文章内容
- **差异预览** - 修改前后对比，一键应用或拒绝
- **上下文感知** - 自动获取当前文章信息，提供精准建议

### 🚀 一键多平台发布

告别重复的复制粘贴，一篇文章轻松发布到多个平台：

- **立即发布** - 配置标签和分类后一键提交
- **定时发布** - 设置发布时间，系统自动执行
- **草稿同步** - 先保存为平台草稿，确认后再发布
- **状态追踪** - 实时查看各平台发布状态

### 📁 文件夹式文章管理

像管理文件一样管理你的文章：

- 创建多级文件夹，灵活组织内容
- 拖拽移动文章和文件夹
- 右键快捷操作
- 文章状态一目了然（草稿/已发布/待发布）

### 📄 Word 文档导入

已有的 Word 文档也能轻松迁移：

- 支持 `.docx` 格式导入
- 自动转换为 Markdown
- 保留格式和结构
- 导入后即可编辑发布

### ⏰ 定时发布任务

让内容在最佳时间触达读者：

- 精确到分钟的定时设置
- 任务列表管理
- 执行历史记录
- 邮件通知发布结果

### 🔔 邮件通知

关键事件及时提醒：

- 发布成功/失败通知
- Cookie 失效提醒
- 自定义 SMTP 服务器
- 灵活的通知条件配置

### 👥 多用户管理

团队协作更便捷：

- 管理员账号系统
- 角色权限控制
- 独立登录验证

### 🔌 AI 供应商配置

灵活的 AI 服务接入：

- 支持自定义 API 端点
- 多模型配置管理
- 深度思考模式（支持 OpenAI o1/o3 等推理模型）
- 连接预热和延迟测试

---

## 支持平台

| 平台 | 状态 | 功能 |
|:---:|:---:|:---|
| <img src="https://cloud.tencent.com/favicon.ico" width="20"> **腾讯云开发者社区** | ✅ 已支持 | 立即发布、定时发布、同步草稿、标签选择 |
| <img src="https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/static/favicons/favicon-32x32.png" width="20"> **掘金** | ✅ 已支持 | 立即发布、分类选择、标签搜索 |
| <img src="https://g.csdnimg.cn/static/logo/favicon32.ico" width="20"> **CSDN** | 🚧 开发中 | 敬请期待 |

> 💬 想要支持更多平台？欢迎提交 [Issue](https://github.com/ZeroHawkeye/PenBridge/issues) 告诉我们！

---

## 技术架构 🏗️

PenBridge 采用现代化的技术栈，确保高性能和良好的开发体验：

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron 桌面应用                           │
├─────────────────────────────────────────────────────────────────┤
│  前端 (React 19)                  │  后端 (Bun + Hono)           │
│  ├─ TanStack Router              │  ├─ tRPC 10                  │
│  ├─ TanStack Query 4             │  ├─ TypeORM                   │
│  ├─ shadcn/ui + Tailwind CSS 4   │  ├─ sql.js (SQLite)          │
│  ├─ Milkdown 编辑器               │  ├─ AI Tool Calling          │
│  └─ AI Chat (流式对话)            │  └─ Electron (登录窗口)       │
└─────────────────────────────────────────────────────────────────┘
```

| 模块 | 技术栈 |
|:---|:---|
| **前端框架** | React 19 + TypeScript |
| **路由管理** | TanStack Router |
| **状态管理** | TanStack Query 4 |
| **UI 组件** | shadcn/ui + Ant Design |
| **样式方案** | Tailwind CSS 4 |
| **编辑器** | Milkdown (基于 ProseMirror) |
| **AI 集成** | OpenAI API 兼容 + Tool Calling |
| **API 通信** | tRPC 10 |
| **后端运行时** | Bun |
| **Web 框架** | Hono |
| **数据库** | SQLite (sql.js) |
| **ORM** | TypeORM |
| **桌面端** | Electron + Electron Forge |

---

## 快速开始 🚀

### 架构说明

PenBridge 采用前后端分离架构：
- **后端服务（Server）**：基于 Bun + Hono，提供 API 和业务逻辑，**必须部署**
- **前端客户端**：
  - **Web 版**：通过浏览器访问
  - **Electron 版**：桌面应用，提供更好的平台登录体验（弹窗登录）

> ⚠️ **重要**：无论使用哪种前端（Web 或 Electron），都需要先部署后端服务。

### 部署方案对比

根据你的使用场景，选择合适的部署方案：

| 方案 | 后端部署 | 前端访问 | 适用场景 | 难度 |
|:---:|:---:|:---:|:---|:---:|
| **Docker 一键部署** | ✅ Docker | 🌐 浏览器 | 快速体验、生产环境、多人使用 | ⭐ |
| **Electron + Docker** | ✅ Docker | 💻 Electron | 个人使用、更好的登录体验 | ⭐⭐ |
| **Electron + 源码后端** | 🔧 源码运行 | 💻 Electron | 开发调试、自定义功能 | ⭐⭐⭐ |
| **完全源码部署** | 🔧 源码运行 | 🌐 浏览器 | 深度定制、二次开发 | ⭐⭐⭐⭐ |

> 💡 **推荐方案**：
> - **新手用户**：Docker 一键部署（最简单）
> - **个人桌面使用**：Electron + Docker 后端
> - **开发者**：源码部署

---

### 方式一：Docker Compose 一键部署（推荐）

**适用场景**：快速体验、生产环境部署、通过浏览器访问

Docker Compose 会自动部署前后端服务，通过浏览器访问即可使用。

#### 1. 使用预构建镜像部署（推荐）

```bash
# 下载生产环境配置文件
curl -O https://raw.githubusercontent.com/ZeroHawkeye/PenBridge/main/packages/server/docker-compose.prod.yml

# 启动服务（默认使用最新版本）
docker compose -f docker-compose.prod.yml up -d

# 或指定具体版本（推荐）
VERSION=1.0.0 docker compose -f docker-compose.prod.yml up -d

# 查看运行状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f
```

#### 2. 本地构建部署

如果你需要基于源码自定义构建：

```bash
# 克隆仓库
git clone https://github.com/ZeroHawkeye/PenBridge.git
cd PenBridge

# 使用 docker-compose 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f
```

#### 3. 访问应用

部署完成后，在浏览器中访问：

- **本地访问**: http://localhost:3000
- **局域网访问**: http://你的IP地址:3000

#### 4. 数据持久化

Docker 部署会自动创建数据卷 `pen-bridge-data`，包含：
- SQLite 数据库文件
- 上传的图片和附件

```bash
# 查看数据卷
docker volume ls | grep pen-bridge

# 备份数据卷
docker run --rm -v pen-bridge-data:/data -v $(pwd):/backup alpine tar czf /backup/penbridge-backup.tar.gz -C /data .

# 恢复数据卷
docker run --rm -v pen-bridge-data:/data -v $(pwd):/backup alpine tar xzf /backup/penbridge-backup.tar.gz -C /data
```

#### 5. 常用命令

```bash
# 停止服务
docker compose down

# 停止并删除数据
docker compose down -v

# 更新到最新版本
docker compose pull
docker compose up -d

# 重启服务
docker compose restart

# 查看容器资源使用
docker stats pen-bridge
```

---

### 方式二：Electron 客户端 + 后端服务

**适用场景**：需要桌面应用体验、更便捷的平台登录方式

Electron 客户端是桌面前端应用，提供了比 Web 版更好的平台登录体验（支持弹窗登录，无需手动复制 Cookie），但仍需要连接到后端服务。

#### 步骤 1: 部署后端服务

选择以下任一方式部署后端：

**方案 A：使用 Docker 部署后端（推荐）**

```bash
# 下载配置文件
curl -O https://raw.githubusercontent.com/ZeroHawkeye/PenBridge/main/packages/server/docker-compose.prod.yml

# 启动后端服务
docker compose -f docker-compose.prod.yml up -d

# 后端将运行在 http://localhost:3000
```

**方案 B：从源码运行后端**

```bash
# 克隆仓库
git clone https://github.com/ZeroHawkeye/PenBridge.git
cd PenBridge

# 安装依赖
bun install

# 启动后端服务
bun run dev:server

# 后端将运行在 http://localhost:3000
```

#### 步骤 2: 下载并安装 Electron 客户端

前往 [Releases](https://github.com/ZeroHawkeye/PenBridge/releases) 页面下载适合你系统的版本：

| 系统 | 下载 |
|:---:|:---:|
| Windows | `.exe` 安装程序 |
| macOS | `.dmg` (Intel / Apple Silicon) |
| Linux | `.deb` / `.rpm` / `.AppImage` |

#### 步骤 3: 配置后端服务地址

1. 启动 Electron 应用
2. 首次启动会提示配置后端服务器地址
3. 输入后端地址（例如：`http://localhost:3000` 或 `http://你的服务器IP:3000`）
4. 点击「测试连接」验证
5. 保存配置

> ✨ **Electron 客户端优势**：
> - 桌面应用体验
> - 支持弹窗登录（无需手动复制 Cookie）
> - 自动保存登录状态
> - 本地存储配置和数据

---

### 方式三：从源码构建开发版

**适用场景**：开发者、需要自定义功能

```bash
# 克隆仓库
git clone https://github.com/ZeroHawkeye/PenBridge.git
cd PenBridge

# 安装依赖
bun install

# 开发模式（同时启动前后端）
bun run dev:electron

# 或分别启动
bun run dev:server    # 启动后端 (http://localhost:3000)
bun run dev:web       # 启动前端 (http://localhost:5173)

# 构建并打包 Electron 应用
bun run dist:electron
```

---

## 使用说明 📖

### 一、首次配置

根据你选择的部署方式，进行相应的配置：

#### 使用 Docker 部署（Web 版）

如果使用 Docker Compose 一键部署，前后端在同一域名下，**无需手动配置**：

1. 在浏览器中打开 `http://localhost:3000`
2. 应用会自动检测并配置服务器地址
3. 直接开始使用

#### 使用 Electron 客户端

Electron 客户端需要连接到后端服务，首次启动需要配置：

1. **确保后端服务已运行**（通过 Docker 或源码方式）
2. **启动 Electron 应用**
3. **配置后端地址**：
   - 首次启动会提示配置后端服务器地址
   - 输入后端地址（例如：`http://localhost:3000` 或服务器 IP）
   - 点击「测试连接」验证
   - 保存配置
4. **开始使用**

> 💡 **提示**:
> - 后续可在 **设置 → 服务器配置** 中修改服务器地址
> - 如果后端服务重启或更换地址，需要重新配置

---

### 二、平台账号登录

在使用发布功能前，需要先登录目标平台账号。

#### 1. 进入发布渠道设置

点击左侧菜单 **设置** → **发布渠道**

#### 2. 选择平台登录

##### Electron 客户端登录（推荐）

1. 点击对应平台的「登录」按钮
2. 在弹出的浏览器窗口中完成登录
3. 支持多种登录方式：
   - 账号密码登录
   - 微信扫码登录
   - 其他第三方登录
4. 登录成功后窗口自动关闭，状态显示为「已登录」

##### Web 版 Cookie 登录

1. 点击「Cookie 登录」标签
2. 在浏览器中手动登录目标平台
3. 使用浏览器开发者工具获取 Cookie:
   - 按 `F12` 打开开发者工具
   - 切换到「Network」标签
   - 刷新页面
   - 找到请求，查看请求头中的 Cookie
4. 将 Cookie 粘贴到输入框中
5. 点击「保存」

> ⚠️ **注意**: Cookie 有效期有限，失效后需重新登录。建议使用 Electron 客户端的窗口登录方式。

#### 3. 验证登录状态

登录成功后，状态会显示为「已登录」，并显示账号信息（如有）。

---

### 三、文章管理

#### 创建文章

- 点击侧边栏「+」按钮创建新文章
- 或点击「导入 Word」导入已有 `.docx` 文档

#### 组织文章

- 创建多级文件夹，分类管理文章
- 拖拽文章或文件夹，调整位置
- 右键菜单快捷操作（重命名、删除等）

#### 编辑内容

在编辑器中撰写文章，支持：

- **Markdown 语法**: 标题、列表、代码块、表格等
- **图片上传**: 拖拽或粘贴图片自动上传
- **代码高亮**: 多种编程语言语法高亮
- **自动保存**: 内容实时保存，不用担心丢失
- **目录导航**: 自动生成文章大纲，快速定位

---

### 四、AI 写作助手

#### 配置 AI 服务

1. 进入 **设置 → AI 配置**
2. 添加 AI 供应商（支持 OpenAI、智谱、DeepSeek 等）
3. 填写 API Key 和端点地址
4. 选择模型（如 GPT-4、GLM-4 等）
5. 测试连接并保存

#### 使用 AI 助手

点击编辑器右侧的 AI 助手面板：

1. **智能对话**: 与 AI 讨论写作思路
2. **内容优化**: 让 AI 帮你润色、扩写、总结
3. **差异预览**: 查看 AI 的修改建议，一键应用或拒绝
4. **工具调用**: AI 可以直接读取和修改文章内容
5. **深度思考**: 支持 OpenAI o1/o3 等推理模型，查看 AI 思考过程

---

### 五、发布文章

#### 发布流程

1. **点击发布**: 编辑器顶部点击「发布」按钮
2. **选择平台**: 勾选要发布的目标平台
3. **配置信息**:
   - 选择分类（如有）
   - 添加标签
   - 设置封面（可选）
4. **选择方式**:
   - **立即发布**: 直接发布到平台
   - **定时发布**: 选择发布时间，系统自动执行
   - **同步草稿**: 保存到平台草稿箱，稍后手动发布
5. **确认发布**: 点击「确认」开始发布

#### 查看发布状态

- 在文章列表中查看发布状态标识
- 在 **设置 → 定时任务** 中查看定时发布任务
- 邮件通知发布结果（需配置邮件服务）

---

### 六、邮件通知配置

在 **设置 → 邮件通知** 中配置 SMTP 服务：

1. **填写 SMTP 信息**:
   - SMTP 服务器地址（如 `smtp.gmail.com`）
   - 端口号（通常是 465 或 587）
   - 发件邮箱
   - 授权密码（不是登录密码，是应用专用密码）
2. **测试连接**: 发送测试邮件验证配置
3. **配置通知条件**:
   - 发布成功通知
   - 发布失败通知
   - Cookie 失效提醒

---

### 七、多用户管理（可选）

如果需要团队协作，可以在 **设置 → 用户管理** 中：

1. 创建管理员账号
2. 设置角色权限
3. 管理用户访问权限

> 📌 **提示**: 仅超级管理员可见用户管理功能

---

## 开发指南 🛠️

### 环境要求

- **Node.js**: 18.x 或更高版本
- **Bun**: 1.x 或更高版本（推荐）或 npm/pnpm
- **Docker**: 20.x 或更高版本（如需 Docker 部署）
- **系统**: Windows / macOS / Linux

### 克隆项目

```bash
git clone https://github.com/ZeroHawkeye/PenBridge.git
cd PenBridge
```

### 安装依赖

```bash
# 使用 Bun（推荐）
bun install

# 或使用 npm
npm install

# 或使用 pnpm
pnpm install
```

### 开发模式

```bash
# 方式一：分别启动前后端（推荐用于开发调试）
# 1. 启动后端服务（端口 3000）
bun run dev:server

# 2. 新开一个终端，启动前端开发服务器（端口 5173）
bun run dev:web

# 方式二：启动 Electron 开发模式（集成前后端）
bun run dev:electron

# 方式三：同时启动前后端（使用 concurrently）
bun run dev
```

在浏览器中访问：
- **前端**: http://localhost:5173
- **后端 API**: http://localhost:3000/health

### 构建项目

```bash
# 构建全部
bun run build

# 单独构建
bun run build:server   # 构建后端
bun run build:web      # 构建前端
bun run build:electron # 构建 Electron

# 打包 Electron 应用
bun run dist:electron
```

### 添加依赖

```bash
# 后端依赖
bun add <package> --cwd packages/server

# 前端依赖
bun add <package> --cwd packages/web

# Electron 依赖
bun add <package> --cwd electron

# 根目录开发依赖
bun add -d <package>
```

### 代码规范

项目使用 ESLint 和 TypeScript 进行代码检查：

```bash
# 运行 lint 检查
bun run lint

# 自动修复 lint 问题
bun run lint:fix

# 类型检查
bun run type-check
```

### 测试

```bash
# 运行测试
bun test

# 运行测试并生成覆盖率报告
bun test --coverage
```

### Docker 开发

```bash
# 构建 Docker 镜像
docker build -t penbridge:dev -f packages/server/Dockerfile .

# 运行容器
docker run -p 3000:3000 -v penbridge-data:/app/data penbridge:dev

# 使用 docker-compose
docker compose up -d
```

### 项目结构

```
PenBridge/
├── electron/                    # Electron 桌面应用
│   ├── src/
│   │   ├── main.ts             # 主进程入口
│   │   ├── preload.ts          # 预加载脚本
│   │   ├── store.ts            # 数据存储
│   │   └── auth/               # 平台认证模块
│   ├── assets/                 # 应用资源
│   └── forge.config.ts         # Electron Forge 配置
├── packages/
│   ├── server/                 # 后端服务
│   │   ├── src/
│   │   │   ├── index.ts        # 服务入口
│   │   │   ├── db/             # 数据库配置和实体
│   │   │   ├── routes/         # tRPC 路由
│   │   │   ├── services/       # 业务逻辑
│   │   │   ├── publishers/     # 平台发布模块
│   │   │   └── utils/          # 工具函数
│   │   ├── Dockerfile          # Docker 镜像配置
│   │   └── docker-compose.prod.yml  # 生产环境部署配置
│   ├── web/                    # 前端应用
│   │   ├── src/
│   │   │   ├── routes/         # 路由页面
│   │   │   ├── components/     # React 组件
│   │   │   ├── utils/          # 工具函数
│   │   │   ├── hooks/          # 自定义 Hooks
│   │   │   └── App.tsx         # 应用入口
│   │   └── public/             # 静态资源
│   └── shared/                 # 共享类型和常量
├── docs/                       # 文档
├── docker-compose.yml          # Docker Compose 配置
└── README.md                   # 项目文档
```

### 添加新的发布平台

如需支持新的内容平台，可以按以下步骤开发：

1. **创建发布器类**：
   ```bash
   # 在 packages/server/src/publishers/ 目录下创建新平台文件
   touch packages/server/src/publishers/newPlatformPublisher.ts
   ```

2. **实现发布接口**：
   - 实现 `publish()` 方法（立即发布）
   - 实现 `saveDraft()` 方法（保存草稿）
   - 实现 `schedulePublish()` 方法（定时发布）

3. **添加平台配置**：
   - 在前端添加平台设置页面
   - 实现登录认证逻辑
   - 添加平台特定的配置项（分类、标签等）

4. **注册路由**：
   - 在 `packages/server/src/routes/` 中添加 tRPC 路由
   - 在前端 `packages/web/src/routes/settings.tsx` 中添加平台入口

参考现有的腾讯云和掘金实现：
- `packages/server/src/publishers/tencentPublisher.ts`
- `packages/server/src/publishers/juejinPublisher.ts`

---

## 常见问题 ❓

### 部署相关

**Q: Docker 部署后无法访问？**

A: 检查以下几点：
1. 确认容器正在运行：`docker ps | grep pen-bridge`
2. 检查端口映射：确保 3000 端口没有被占用
3. 查看容器日志：`docker compose logs -f`
4. 检查防火墙规则：确保 3000 端口开放

**Q: 如何更改默认端口？**

A: 修改 `docker-compose.yml` 中的端口映射：
```yaml
ports:
  - "8080:3000"  # 将左侧改为你想要的端口
```

**Q: 数据如何备份和迁移？**

A: 使用 Docker 数据卷备份命令：
```bash
# 备份
docker run --rm -v pen-bridge-data:/data -v $(pwd):/backup alpine tar czf /backup/penbridge-backup.tar.gz -C /data .

# 恢复
docker run --rm -v pen-bridge-data:/data -v $(pwd):/backup alpine tar xzf /backup/penbridge-backup.tar.gz -C /data
```

### 客户端相关

**Q: Electron 客户端和 Web 版有什么区别？**

A:
- **Electron 客户端**: 桌面应用，支持弹窗登录（更方便），需要先部署后端服务
- **Web 版**: 通过浏览器访问，适合服务器部署和多人使用，同样需要后端服务
- **共同点**: 两者都需要连接到后端服务才能使用

**Q: Electron 客户端需要部署后端吗？**

A:
是的，Electron 客户端也需要连接到后端服务。可以：
1. 在本地部署后端（Docker 或源码方式）
2. 连接到远程服务器上的后端
3. Electron 的优势在于提供更好的平台登录体验（弹窗登录）

**Q: Web 版如何连接后端服务？**

A:
1. 如果使用 Docker 一键部署，前后端在同一域名下，会自动检测配置
2. 如果分离部署，首次访问会提示配置服务器地址
3. 可以在 **设置 → 服务器配置** 中修改

**Q: Cookie 登录频繁失效怎么办？**

A:
1. 建议使用 Electron 客户端的窗口登录方式，更稳定
2. Web 版 Cookie 有效期由平台决定，失效后需重新获取
3. 部分平台支持长期 Token，可在平台设置中申请

**Q: macOS 安装时提示"应用已损坏，无法打开"怎么办？**

A: 这是因为应用未经过 Apple 签名，被 macOS 的 Gatekeeper 安全机制拦截。解决方法：

**方法一：使用终端命令（推荐）**

打开终端（Terminal），执行以下命令：

```bash
# 移除应用的隔离属性
sudo xattr -rd com.apple.quarantine /Applications/PenBridge.app
```

输入系统密码后回车，然后重新打开应用即可。

**方法二：通过系统设置允许**

1. 双击应用，会提示无法打开
2. 打开 **系统设置 → 隐私与安全性**
3. 在页面底部找到关于 PenBridge 的提示
4. 点击 **仍要打开** 按钮
5. 在弹出的确认框中点击 **打开**

**方法三：临时禁用 Gatekeeper（不推荐）**

```bash
# 禁用 Gatekeeper（安装后建议重新启用）
sudo spctl --master-disable

# 安装完成后重新启用
sudo spctl --master-enable
```

> ⚠️ **注意**：方法三会降低系统安全性，仅在方法一和二无效时使用，使用后请及时重新启用。

### 发布相关

**Q: 发布失败怎么办？**

A:
1. 检查平台登录状态是否有效
2. 查看错误提示信息
3. 确认文章格式符合平台要求
4. 检查网络连接是否正常

**Q: 能否同时发布到多个平台？**

A: 可以，在发布对话框中勾选多个平台即可同时发布。

**Q: 定时发布任务没有执行？**

A:
1. 确保应用保持运行（Electron 或 Docker 服务）
2. 检查系统时间是否正确
3. 在 **设置 → 定时任务** 中查看任务状态

### AI 助手相关

**Q: AI 助手无法使用？**

A:
1. 确认已在 **设置 → AI 配置** 中添加 AI 供应商
2. 检查 API Key 是否正确
3. 测试 API 端点是否可访问
4. 查看账户余额是否充足

**Q: 支持哪些 AI 模型？**

A: 支持所有兼容 OpenAI API 格式的模型：
- OpenAI: GPT-4, GPT-4 Turbo, GPT-3.5, o1, o3
- 智谱 AI: GLM-4, GLM-4-Plus
- DeepSeek: DeepSeek-V3
- 其他兼容 OpenAI 格式的服务

### 性能优化

**Q: 如何提升应用性能？**

A:
1. Docker 部署时分配足够的内存（建议 2GB+）
2. 定期清理不用的图片和文章
3. 关闭不需要的 AI 功能
4. 使用 SSD 存储提升数据库性能

**Q: 图片上传很慢？**

A:
1. 上传前可以先压缩图片
2. 检查网络带宽
3. 如果是 Docker 部署，考虑使用外部对象存储服务

---

## 📁 项目结构详解

```
PenBridge/
├── electron/                    # Electron 桌面应用
│   ├── src/
│   │   ├── main.ts             # 主进程入口
│   │   ├── preload.ts          # 预加载脚本
│   │   ├── store.ts            # 数据存储
│   │   └── auth/               # 平台认证模块
│   ├── assets/                 # 应用资源（图标等）
│   └── forge.config.ts         # Electron Forge 配置
├── packages/
│   ├── server/                 # 后端服务
│   │   ├── src/
│   │   │   ├── index.ts        # 服务入口
│   │   │   ├── db/             # 数据库配置和实体
│   │   │   ├── routes/         # tRPC 路由
│   │   │   ├── services/       # 业务逻辑
│   │   │   ├── publishers/     # 平台发布模块
│   │   │   └── utils/          # 工具函数
│   │   ├── Dockerfile          # Docker 镜像配置
│   │   └── docker-compose.prod.yml  # 生产环境部署配置
│   ├── web/                    # 前端应用
│   │   ├── src/
│   │   │   ├── routes/         # 路由页面
│   │   │   ├── components/     # React 组件
│   │   │   │   ├── ui/         # shadcn/ui 基础组件
│   │   │   │   ├── editor/     # Milkdown 编辑器
│   │   │   │   └── ai-chat/    # AI 聊天组件
│   │   │   ├── utils/          # 工具函数
│   │   │   ├── hooks/          # 自定义 Hooks
│   │   │   └── App.tsx         # 应用入口
│   │   ├── public/             # 静态资源
│   │   └── vite.config.ts      # Vite 配置
│   └── shared/                 # 共享类型和常量
├── docs/                       # API 文档
├── .github/                    # GitHub 配置
│   └── workflows/              # CI/CD 工作流
├── docker-compose.yml          # Docker Compose 配置
├── package.json                # 项目配置
└── README.md                   # 项目文档
```

---

## 许可证 ⚖️

本项目采用 [CC BY-NC-SA 4.0](LICENSE) 许可证。

这意味着您可以：
- ✅ 自由地共享和修改本项目
- ✅ 在非商业项目中使用

但您必须：
- 📝 注明原作者并提供许可证链接
- 🚫 不得用于商业目的
- 🔄 修改后的作品需采用相同的许可证

详细条款请参阅 [LICENSE](LICENSE) 文件。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

- 🐛 [报告 Bug](https://github.com/ZeroHawkeye/PenBridge/issues/new?labels=bug)
- 💡 [功能建议](https://github.com/ZeroHawkeye/PenBridge/issues/new?labels=enhancement)
- 📖 [文档改进](https://github.com/ZeroHawkeye/PenBridge/issues/new?labels=documentation)

---

<p align="center">
  如果这个项目对你有帮助，欢迎 ⭐ Star 支持！
</p>

<p align="center">
  Made with ❤️ by <a href="https://github.com/ZeroHawkeye">ZeroHawkeye</a>
</p>
