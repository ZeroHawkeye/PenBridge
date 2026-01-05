<p align="center">
  <img src="packages/web/public/icon.svg" alt="PenBridge Logo" width="120" height="120">
</p>

<h1 align="center">PenBridge</h1>

<p align="center">
  <strong>跨平台文章管理与一键发布工具</strong>
</p>

<p align="center">
  <a href="https://github.com/zerx-lab/PenBridge">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  </a>
  <a href="https://github.com/zerx-lab/PenBridge">
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  </a>
  <a href="https://github.com/zerx-lab/PenBridge">
    <img src="https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9" alt="Electron">
  </a>
  <a href="https://github.com/zerx-lab/PenBridge">
    <img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun">
  </a>
</p>

<p align="center">
  <a href="https://github.com/zerx-lab/PenBridge/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg" alt="License">
  </a>
  <a href="https://github.com/zerx-lab/PenBridge/stargazers">
    <img src="https://img.shields.io/github/stars/zerx-lab/PenBridge?style=social" alt="Stars">
  </a>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#支持平台">支持平台</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#使用说明">使用说明</a> •
  <a href="#开发指南">开发指南</a>
</p>

---

## 功能特性

### 编辑器
- 基于 Milkdown 的所见即所得 Markdown 编辑器
- 图片拖拽/粘贴自动上传
- 代码高亮、表格、目录导航
- 自动保存、拼写检查
- Word 文档 (.docx) 导入

### AI 写作助手
- **多模型支持** - OpenAI、智谱、DeepSeek 等兼容 OpenAI API 的服务
- **流式对话** - 实时显示 AI 思考过程
- **工具调用** - AI 可直接读取、插入、替换文章内容
- **差异预览** - 修改前后对比，一键应用或拒绝
- **深度思考** - 支持 o1/o3 等推理模型，可调节推理程度
- **YOLO 模式** - 跳过工具调用审核，快速执行

### 多平台发布
- **立即发布** - 一键发布到多个平台
- **定时发布** - 设置发布时间，自动执行
- **草稿同步** - 先保存平台草稿，确认后发布
- **自动重试** - 发布失败自动重试，最多 3 次
- **状态追踪** - 查看各平台发布状态

### 系统功能
| 功能 | 说明 |
|:---|:---|
| 文件夹管理 | 多级文件夹、拖拽排序、右键菜单 |
| 定时任务 | 任务列表、执行历史、每日登录状态探测 |
| 邮件通知 | 发布成功/失败、Cookie 过期提醒 |
| 数据备份 | JSON/ZIP 导出导入，敏感数据加密 |
| 图片清理 | 自动清理未引用的图片 |
| 多用户 | 管理员账号、角色权限 |

---

## 支持平台

| 平台 | 状态 | 功能 |
|:---:|:---:|:---|
| <img src="https://cloud.tencent.com/favicon.ico" width="20"> 腾讯云开发者社区 | ✅ | 发布、定时、草稿、标签 |
| <img src="https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/static/favicons/favicon-32x32.png" width="20"> 掘金 | ✅ | 发布、分类、标签、图片上传 |
| <img src="https://g.csdnimg.cn/static/logo/favicon32.ico" width="20"> CSDN | 🚧 | 开发中 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 桌面应用                          │
├─────────────────────────────────────────────────────────────┤
│  前端 (React 19)              │  后端 (Bun + Hono)            │
│  ├─ TanStack Router/Query    │  ├─ tRPC 10                   │
│  ├─ shadcn/ui + Tailwind 4   │  ├─ TypeORM + sql.js          │
│  ├─ Milkdown 编辑器           │  ├─ 定时任务调度器              │
│  └─ AI Chat (流式+工具调用)   │  └─ 多平台 API 客户端          │
└─────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 下载配置文件
curl -O https://raw.githubusercontent.com/zerx-lab/PenBridge/main/packages/server/docker-compose.prod.yml

# 启动服务
docker compose -f docker-compose.prod.yml up -d

# 访问 http://localhost:3000
```

**数据备份：**
```bash
docker run --rm -v pen-bridge-data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz -C /data .
```

### 方式二：Electron 客户端

1. 部署后端服务（Docker 或源码方式）
2. 下载 [Electron 客户端](https://github.com/zerx-lab/PenBridge/releases)
3. 配置后端地址（如 `http://localhost:3000`）

> Electron 优势：支持弹窗登录，无需手动复制 Cookie

### 方式三：源码开发

```bash
git clone https://github.com/zerx-lab/PenBridge.git
cd PenBridge
bun install

# 分别启动
bun run dev:server  # 后端 :3000
bun run dev:web     # 前端 :5173

# 或启动 Electron
bun run dev:electron
```

---

## 使用说明

### 平台登录

**Electron 客户端：** 点击「登录」按钮，在弹窗中完成登录（支持扫码、账密等）

**Web 版：** 使用浏览器开发者工具获取 Cookie，粘贴到输入框保存

### 发布文章

1. 编辑器顶部点击「发布」
2. 选择目标平台，配置分类/标签
3. 选择发布方式：立即发布 / 定时发布 / 同步草稿

### AI 助手配置

1. 设置 → AI 配置 → 添加供应商
2. 填写 API Key 和端点地址
3. 选择模型，测试连接

---

## 开发指南

### 环境要求
- Node.js 18+
- Bun 1.x（推荐）
- Docker 20+（可选）

### 常用命令

```bash
# 构建
bun run build           # 全部
bun run build:server    # 后端
bun run build:web       # 前端
bun run dist:electron   # 打包 Electron

# 添加依赖
bun add <pkg> --cwd packages/server  # 后端
bun add <pkg> --cwd packages/web     # 前端
```

### 项目结构

```
PenBridge/
├── electron/              # Electron 桌面应用
│   ├── src/main.ts        # 主进程
│   ├── src/auth/          # 平台认证
│   └── forge.config.ts    # 打包配置
├── packages/
│   ├── server/            # 后端服务
│   │   ├── src/entities/  # 数据库实体
│   │   ├── src/services/  # 业务服务
│   │   └── src/trpc/      # API 路由
│   ├── web/               # 前端应用
│   │   ├── src/components/# React 组件
│   │   └── src/routes/    # 页面路由
│   └── shared/            # 共享类型
└── docs/                  # API 文档
```

---

## 常见问题

<details>
<summary><b>Docker 部署后无法访问</b></summary>

1. 检查容器状态：`docker ps | grep pen-bridge`
2. 查看日志：`docker compose logs -f`
3. 确认端口 3000 未被占用
</details>

<details>
<summary><b>macOS 提示"应用已损坏"</b></summary>

```bash
sudo xattr -rd com.apple.quarantine /Applications/PenBridge.app
```
</details>

<details>
<summary><b>Cookie 登录频繁失效</b></summary>

建议使用 Electron 客户端的弹窗登录方式，更稳定。
</details>

<details>
<summary><b>AI 助手无法使用</b></summary>

1. 确认已配置 AI 供应商和 API Key
2. 测试 API 端点是否可访问
3. 检查账户余额
</details>

---

## 许可证

[CC BY-NC-SA 4.0](LICENSE) - 可自由使用和修改，禁止商业用途，需署名并使用相同许可证。

---

## 贡献

欢迎提交 [Issue](https://github.com/zerx-lab/PenBridge/issues) 和 Pull Request！

<p align="center">
  如果有帮助，欢迎 Star 支持
</p>

<p align="center">
  Made with ❤️ by <a href="https://github.com/ZeroHawkeye">ZeroHawkeye</a>
</p>
