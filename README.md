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
- 图片粘贴自动上传
- 代码块语法高亮
- 表格、列表、链接等丰富语法支持
- 英文拼写检查（可选）
- 自动保存，永不丢失

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

---

## 支持平台

| 平台 | 状态 | 功能 |
|:---:|:---:|:---|
| <img src="https://cloud.tencent.com/favicon.ico" width="20"> **腾讯云开发者社区** | ✅ 已支持 | 立即发布、定时发布、同步草稿、标签选择 |
| <img src="https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/static/favicons/favicon-32x32.png" width="20"> **掘金** | ✅ 已支持 | 立即发布、分类选择、标签搜索 |
| <img src="https://g.csdnimg.cn/static/logo/favicon32.ico" width="20"> **CSDN** | 🚧 开发中 | 敬请期待 |

> 💬 想要支持更多平台？欢迎提交 [Issue](https://github.com/ZeroHawkeye/PenBridge/issues) 告诉我们！

---

## 🏗️ 技术架构

PenBridge 采用现代化的技术栈，确保高性能和良好的开发体验：

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron 桌面应用                           │
├─────────────────────────────────────────────────────────────────┤
│  前端 (React 19)                  │  后端 (Bun + Hono)           │
│  ├─ TanStack Router              │  ├─ tRPC 10                  │
│  ├─ TanStack Query 4             │  ├─ TypeORM                   │
│  ├─ shadcn/ui + Tailwind CSS 4   │  ├─ sql.js (SQLite)          │
│  └─ Milkdown 编辑器               │  └─ Electron (登录窗口)       │
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
| **API 通信** | tRPC 10 |
| **后端运行时** | Bun |
| **Web 框架** | Hono |
| **数据库** | SQLite (sql.js) |
| **ORM** | TypeORM |
| **桌面端** | Electron + Electron Forge |

---

## 🚀 快速开始

### 下载安装

前往 [Releases](https://github.com/ZeroHawkeye/PenBridge/releases) 页面下载适合你系统的版本：

| 系统 | 下载 |
|:---:|:---:|
| Windows | `.exe` 安装程序 |
| macOS | `.dmg` (Intel / Apple Silicon) |
| Linux | `.deb` / `.rpm` / `.AppImage` |

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/ZeroHawkeye/PenBridge.git
cd PenBridge

# 安装依赖
bun install

# 构建项目
bun run build

# 打包 Electron 应用
bun run dist:electron
```

---

## 📖 使用说明

### 1. 首次配置

启动应用后，首先配置后端服务器地址，点击「测试连接」确认可用后保存。

### 2. 登录平台账号

在 **设置 → 发布渠道** 中登录你的平台账号：

- **Electron 客户端**：点击「登录」按钮，在弹出窗口中完成登录（支持微信扫码等）
- **Web 版**：使用 Cookie 方式登录

登录成功后，系统会自动保存登录状态，下次无需重新登录。

### 3. 创建文章

- 点击侧边栏「+」按钮创建新文章
- 或点击「导入 Word」导入已有文档

### 4. 编辑内容

在编辑器中撰写你的文章，支持：

- Markdown 语法
- 图片拖拽/粘贴上传
- 代码块高亮显示
- 内容自动保存

### 5. 发布文章

点击右上角「发布」按钮，选择目标平台：

- **立即发布**：配置标签等信息后直接发布
- **定时发布**：选择发布时间，到点自动发布
- **同步草稿**：先保存到平台草稿箱

---

## 🛠️ 开发指南

### 开发模式

```bash
# 启动后端服务（端口 3000）
bun run dev:server

# 启动前端开发服务器（端口 5173）
bun run dev:web

# 启动 Electron 开发模式
bun run dev:electron
```

### 构建项目

```bash
# 构建全部
bun run build

# 单独构建
bun run build:server   # 构建后端
bun run build:web      # 构建前端
bun run build:electron # 构建 Electron
```

### 添加依赖

```bash
# 后端依赖
bun add <package> --cwd packages/server

# 前端依赖
bun add <package> --cwd packages/web

# 根目录开发依赖
bun add -d <package>
```

---

## 📁 项目结构

```
pen-bridge/
├── electron/           # Electron 桌面应用
├── packages/
│   ├── server/         # 后端服务
│   ├── web/            # 前端应用
│   └── shared/         # 共享类型
└── docs/               # API 文档
```

---

## ⚖️ 许可证

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
