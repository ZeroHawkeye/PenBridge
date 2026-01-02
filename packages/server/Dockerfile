# PenBridge 多平台文章管理与发布工具 - 全栈 Docker 镜像
# 基于 Bun 运行时，包含前端和后端
#
# 构建命令（在项目根目录执行）：
#   docker build -t pen-bridge:v1 -f packages/server/Dockerfile .
#
# 或使用 docker-compose：
#   docker compose up -d --build

# ===== 构建阶段 - 前端 =====
FROM oven/bun:1 AS web-builder

# 接收版本号构建参数
ARG VERSION=1.0.0

WORKDIR /app/packages/web

# 复制前端 package.json 和 lock 文件
COPY packages/web/package.json packages/web/bun.lock* ./

# 安装前端依赖
RUN bun install

# 调试：检查 antd 是否安装
RUN ls -la node_modules/antd || echo "antd not found in node_modules"

# 复制前端源代码（排除 node_modules，不要再次复制 package.json）
COPY packages/web/public ./public
COPY packages/web/src ./src
COPY packages/web/components.json packages/web/tsconfig.json packages/web/index.html packages/web/vite.config.ts ./

# 更新 package.json 中的版本号（用于 Vite 构建时注入）
RUN sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" package.json

# 构建前端
RUN bun run build

# ===== 构建阶段 - 后端 =====
FROM oven/bun:1 AS server-builder

WORKDIR /app/packages/server

# 复制后端 package.json 和 lock 文件
COPY packages/server/package.json packages/server/bun.lock* ./

# 复制 shared 包（后端依赖）
COPY packages/shared /app/packages/shared

# 安装后端依赖
RUN bun install

# 复制后端源代码
COPY packages/server/src ./src
COPY packages/server/tsconfig.json ./

# 构建后端
RUN bun build src/index.ts --outdir dist --target bun

# ===== 运行阶段 =====
FROM oven/bun:1-slim

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 从后端构建阶段复制构建产物
COPY --from=server-builder /app/packages/server/dist ./dist

# 从后端构建阶段复制 prompts 目录
COPY --from=server-builder /app/packages/server/src/prompts ./prompts

# 从前端构建阶段复制构建产物到 public 目录
COPY --from=web-builder /app/packages/web/dist ./public

# 复制 sql.js 的 wasm 文件到工作目录（运行时需要，代码会从 process.cwd() 查找）
COPY --from=server-builder /app/packages/server/node_modules/sql.js/dist/sql-wasm.wasm ./sql-wasm.wasm

# 创建数据目录
RUN mkdir -p /app/data/uploads && chmod -R 755 /app/data

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
# Docker 容器需要监听 0.0.0.0 才能从外部访问
ENV PEN_BRIDGE_HOST=0.0.0.0

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 启动命令
CMD ["bun", "run", "dist/index.js"]
