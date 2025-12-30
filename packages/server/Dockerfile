# 腾讯云开发者社区文章管理工具 - 后端服务 Docker 镜像
# 基于 Bun 运行时
#
# 构建命令（在项目根目录执行）：
#   docker build -t tencent-dev-blog-server -f packages/server/Dockerfile .
#
# 或使用 docker-compose：
#   docker-compose up -d

# ===== 构建阶段 =====
FROM oven/bun:1 AS builder

WORKDIR /app

# 复制整个项目（monorepo 结构需要完整的目录）
COPY package.json bun.lock ./
COPY packages/server ./packages/server
COPY packages/shared ./packages/shared

# 安装所有依赖
RUN bun install

# 构建应用
RUN cd packages/server && bun build src/index.ts --outdir dist --target bun

# ===== 运行阶段 =====
FROM oven/bun:1-slim

WORKDIR /app

# 安装运行时依赖（Puppeteer 需要的系统依赖）
# 注意：如果不需要 Puppeteer 浏览器自动化功能，可以移除这些依赖以减小镜像体积
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制 node_modules 和构建产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/

# 创建数据目录
RUN mkdir -p /app/packages/server/data/uploads

# 设置数据目录权限
RUN chmod -R 755 /app/packages/server/data

# 切换工作目录
WORKDIR /app/packages/server

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
