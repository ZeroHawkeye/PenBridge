/**
 * 图片上传 API 路由
 * 处理文章图片的上传，按文章 ID 创建独立目录
 */
import { Hono } from "hono";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

// 默认上传目录路径
const DEFAULT_UPLOAD_DIR = "data/uploads";

/**
 * 工厂函数：创建带自定义上传目录的路由
 * @param uploadDir 上传目录路径，默认为 "data/uploads"
 */
export function createUploadRouter(uploadDir: string = DEFAULT_UPLOAD_DIR) {
  const router = new Hono();

  /**
   * 图片上传 API
   * POST /api/upload/:articleId
   * 
   * 按文章 ID 创建独立目录，支持 JPG、PNG、GIF、WEBP 格式
   * 限制文件大小最大 10MB
   */
  router.post("/:articleId", async (c) => {
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
      const articleDir = join(uploadDir, articleId);
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

  return router;
}

// 导出默认路由（供 index.ts 使用）
export const uploadRouter = createUploadRouter();

/**
 * 确保上传目录存在
 * @param uploadDir 上传目录路径，默认为 "data/uploads"
 */
export function ensureUploadDir(uploadDir: string = DEFAULT_UPLOAD_DIR) {
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
}
