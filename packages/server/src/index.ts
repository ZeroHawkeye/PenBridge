import { Hono } from "hono";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { serveStatic } from "hono/bun";
import { appRouter } from "./trpc/router";
import { initDatabase, setDatabasePath } from "./db";
import { schedulerService } from "./services/scheduler";
import { initializeSuperAdmin, cleanupExpiredSessions } from "./services/adminAuth";
import { initLogger } from "./services/logger";
import { getDataDir, getUploadDir, getDatabasePath } from "./services/dataDir";
import { mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

// 初始化日志服务（必须在最开始调用，以便捕获所有日志）
initLogger();

// 导入拆分后的路由
import { uploadRouter } from "./routes/upload";
import { aiChatRouter } from "./routes/aiChat";
import { aiChatStreamRouter } from "./routes/aiChatStream";
import { aiToolExecuteRouter } from "./routes/aiToolExecute";
import { aiWarmupRouter } from "./routes/aiWarmup";

// 服务器配置常量
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "localhost";

// 从环境变量读取端口和主机配置
const serverPort = process.env.PEN_BRIDGE_PORT ? parseInt(process.env.PEN_BRIDGE_PORT, 10) : DEFAULT_PORT;
const serverHost = process.env.PEN_BRIDGE_HOST || DEFAULT_HOST;

// 前端静态文件目录（Docker 部署时使用）
const PUBLIC_DIR = "public";

const app = new Hono();

// CORS - 允许 Electron 应用、开发服务器和生产部署
app.use(
  "/*",
  cors({
    origin: (origin) => {
      // 允许的来源列表
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
      ];

      // file:// 协议的 origin 为 null，Electron 打包后需要允许
      if (!origin || origin === "null") {
        return origin || "*";
      }

      // 允许配置的来源
      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      // 允许同一 IP 的不同端口访问（生产环境部署）
      try {
        const url = new URL(origin);
        // 允许任何 http/https 来源（生产环境可能有不同端口）
        if (url.protocol === "http:" || url.protocol === "https:") {
          return origin;
        }
      } catch {
        // URL 解析失败，拒绝
      }

      return null;
    },
    credentials: true,
  })
);

// Health check - 仅在没有前端静态文件时显示 JSON
// 如果有前端，健康检查通过返回 200 的 HTML 页面也可以
app.get("/health", (c) => c.json({ status: "ok", message: "PenBridge Server" }));

// API 根路径
app.get("/api", (c) => c.json({ status: "ok", message: "PenBridge API" }));

// 静态文件服务 - 提供上传的图片访问
// 使用动态数据目录路径
app.use("/uploads/*", serveStatic({ root: getDataDir() }));

// 挂载拆分后的路由
app.route("/api/upload", uploadRouter);
app.route("/api/ai/chat", aiChatRouter);
app.route("/api/ai/chat/stream", aiChatStreamRouter);
app.route("/api/ai/tool/execute", aiToolExecuteRouter);
app.route("/api/ai/warmup", aiWarmupRouter);

// tRPC - 带上下文（从请求头获取 token）
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: ({ req }) => {
      // 从 Authorization header 获取 token
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined;
      return { token };
    },
  })
);

// 前端静态文件服务（生产环境 Docker 部署时使用）
// 检查 public 目录是否存在，如果存在则提供前端静态文件服务
if (existsSync(PUBLIC_DIR)) {
  // 静态资源文件（js, css, 图片等）
  app.use("/*", serveStatic({ root: PUBLIC_DIR }));

  // SPA 回退：所有未匹配的路由返回 index.html
  // 注意：API 路径不应该被 SPA 回退处理
  app.get("*", async (c) => {
    const path = c.req.path;

    // 排除 API 路径和静态资源路径，这些路径应该由前面定义的路由处理
    // 如果请求到达这里说明路由未匹配，返回 404
    if (path === "/health" ||
        path === "/api" ||
        path.startsWith("/api/") ||
        path.startsWith("/trpc/") ||
        path.startsWith("/uploads/") ||
        path.startsWith("/vditor/") ||
        path.startsWith("/dict/") ||
        path.startsWith("/assets/")) {
      return c.json({ error: "Not found" }, 404);
    }

    const indexPath = join(PUBLIC_DIR, "index.html");
    if (existsSync(indexPath)) {
      const html = readFileSync(indexPath, "utf-8");
      return c.html(html);
    }
    return c.json({ error: "Not found" }, 404);
  });
}

// 初始化
async function main() {
  const dataDir = getDataDir();
  const uploadDir = getUploadDir();
  
  // 确保数据目录存在
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // 确保上传目录存在
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  // 设置数据库路径（使用动态数据目录）
  setDatabasePath(getDatabasePath());

  // 初始化数据库
  await initDatabase();

  // 初始化超级管理员账户
  await initializeSuperAdmin();

  // 清理过期的 session
  const cleanedCount = await cleanupExpiredSessions();
  if (cleanedCount > 0) {
    console.log(`已清理 ${cleanedCount} 个过期的登录会话`);
  }

  // 启动定时任务调度器
  schedulerService.start();

  console.log(`Server running at http://${serverHost}:${serverPort}`);
}

main();

// 优雅关闭处理：接收到终止信号时清理资源
const gracefulShutdown = async (signal: string) => {
  console.log(`\n[Server] 收到 ${signal} 信号，正在优雅关闭...`);

  try {
    // 1. 停止定时任务调度器
    console.log("[Server] 停止定时任务调度器...");
    schedulerService.stop();

    // 2. 关闭数据库连接
    console.log("[Server] 关闭数据库连接...");
    const { closeDatabase } = await import("./db");
    await closeDatabase();

    console.log("[Server] 清理完成，退出进程");
    process.exit(0);
  } catch (error) {
    console.error("[Server] 清理过程中出错:", error);
    process.exit(1);
  }
};

// 监听终止信号
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Windows 下的 SIGHUP 信号（Electron 关闭时可能发送）
if (process.platform !== "win32") {
  process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));
}

export default {
  port: serverPort,
  hostname: serverHost,
  fetch: app.fetch,
  // 增加空闲超时时间，支持长时间的 AI 对话请求（默认 10s -> 120s）
  idleTimeout: 120,
};
