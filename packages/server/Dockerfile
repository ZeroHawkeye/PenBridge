# PenBridge 多平台文章管理与发布工具 - 后端服务 Docker 镜像
# 基于 Bun 运行时
#
# 构建命令（在 packages/server 目录执行）：
#   docker build -t pen-bridge:v1 .
#
# 或使用 docker-compose：
#   docker compose up -d --build

# ===== 构建阶段 =====
FROM oven/bun:1 AS builder

WORKDIR /app

# 复制 package.json 和 lock 文件
COPY package.json bun.lock* ./

# 复制源代码
COPY src ./src
COPY tsconfig.json ./

# 安装依赖
RUN bun install

# 构建应用
RUN bun build src/index.ts --outdir dist --target bun

# ===== 运行阶段 =====
FROM oven/bun:1-slim

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist

# 复制 sql.js 的 wasm 文件（运行时需要）
COPY --from=builder /app/node_modules/sql.js/dist/sql-wasm.wasm ./node_modules/sql.js/dist/sql-wasm.wasm

# 创建数据目录
RUN mkdir -p /app/data/uploads && chmod -R 755 /app/data

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 启动命令
CMD ["bun", "run", "dist/index.js"]
