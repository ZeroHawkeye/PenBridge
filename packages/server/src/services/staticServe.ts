/**
 * 跨平台静态文件服务中间件
 * 支持 Bun 和 Node.js 运行时
 */
import { Context, Next } from "hono";
import { existsSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";

// MIME 类型映射
const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".zip": "application/zip",
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

interface ServeStaticOptions {
  root: string;
}

/**
 * 创建静态文件服务中间件
 * @param options 配置选项
 * @returns Hono 中间件
 */
export function serveStatic(options: ServeStaticOptions) {
  const { root } = options;

  return async (c: Context, next: Next) => {
    // 获取请求路径
    let path = c.req.path;
    
    // 移除开头的斜杠
    if (path.startsWith("/")) {
      path = path.slice(1);
    }

    // 构建完整的文件路径
    const filePath = join(root, path);

    try {
      // 检查文件是否存在
      if (!existsSync(filePath)) {
        return next();
      }

      // 检查是否是目录
      const stat = statSync(filePath);
      if (stat.isDirectory()) {
        // 尝试返回 index.html
        const indexPath = join(filePath, "index.html");
        if (existsSync(indexPath)) {
          const content = readFileSync(indexPath);
          return c.body(new Uint8Array(content), 200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
          });
        }
        return next();
      }

      // 读取文件内容
      const content = readFileSync(filePath);
      const mimeType = getMimeType(filePath);

      // 设置缓存策略
      const cacheControl = mimeType.startsWith("text/html")
        ? "no-cache"
        : "public, max-age=31536000, immutable";

      return c.body(new Uint8Array(content), 200, {
        "Content-Type": mimeType,
        "Cache-Control": cacheControl,
      });
    } catch (error) {
      // 文件读取错误，继续下一个中间件
      return next();
    }
  };
}
