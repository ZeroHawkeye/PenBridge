import { Hono } from "hono";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { serveStatic } from "hono/bun";
import { appRouter } from "./trpc/router";
import { initDatabase } from "./db";
import { schedulerService } from "./services/scheduler";
import { initializeSuperAdmin, cleanupExpiredSessions } from "./services/adminAuth";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const app = new Hono();

// 上传目录路径
const UPLOAD_DIR = "data/uploads";

// CORS - 允许 Electron 应用（file:// 协议 origin 为 null）和开发服务器
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
      if (!origin || origin === "null" || allowedOrigins.includes(origin)) {
        return origin || "*";
      }
      return null;
    },
    credentials: true,
  })
);

// Health check
app.get("/", (c) => c.json({ status: "ok", message: "Tencent Dev Blog Server" }));

// 静态文件服务 - 提供上传的图片访问
app.use("/uploads/*", serveStatic({ root: "./data" }));

// 图片上传 API - 按文章 ID 创建独立目录
app.post("/api/upload/:articleId", async (c) => {
  try {
    const articleId = c.req.param("articleId");

    // 验证文章 ID
    if (!articleId || !/^\d+$/.test(articleId)) {
      return c.json({ error: "无效的文章 ID" }, 400);
    }

    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return c.json({ error: "没有上传文件" }, 400);
    }

    // 验证文件类型
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "不支持的文件类型，仅支持 JPG、PNG、GIF、WEBP" }, 400);
    }

    // 限制文件大小（10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: "文件大小超过限制（最大 10MB）" }, 400);
    }

    // 按文章 ID 创建目录
    const articleDir = join(UPLOAD_DIR, articleId);
    if (!existsSync(articleDir)) {
      mkdirSync(articleDir, { recursive: true });
    }

    // 生成文件名
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${randomUUID()}.${ext}`;
    const filePath = join(articleDir, fileName);

    // 读取文件内容并保存
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(filePath, buffer);

    // 返回图片 URL
    const imageUrl = `/uploads/${articleId}/${fileName}`;
    return c.json({ url: imageUrl });
  } catch (error) {
    console.error("图片上传失败:", error);
    return c.json({ error: "图片上传失败" }, 500);
  }
});

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

// 初始化
async function main() {
  // 确保 data 目录存在
  if (!existsSync("data")) {
    mkdirSync("data", { recursive: true });
  }

  // 确保上传目录存在
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }

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

  console.log("Server running at http://localhost:3000");
}

main();

export default {
  port: 3000,
  fetch: app.fetch,
};
