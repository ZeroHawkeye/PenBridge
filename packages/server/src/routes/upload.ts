/**
 * 图片上传 API 路由
 * 处理文章图片的上传，按文章 ID 创建独立目录
 */
import { Hono } from "hono";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { getUploadDir } from "../services/dataDir";

/**
 * 工厂函数：创建带自定义上传目录的路由
 * @param uploadDir 上传目录路径，如果不指定则使用动态数据目录
 */
export function createUploadRouter(uploadDir?: string) {
  const router = new Hono();

  // 获取上传目录（延迟获取以支持动态环境变量）
  const getUploadPath = () => uploadDir || getUploadDir();

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
      const currentUploadDir = getUploadPath();
      const articleDir = join(currentUploadDir, articleId);
      if (!existsSync(articleDir)) {
        mkdirSync(articleDir, { recursive: true });
      }

      // 生成文件名
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${randomUUID()}.${ext}`;
      const filePath = join(articleDir, fileName);

      // 读取文件内容并保存
      const arrayBuffer = await file.arrayBuffer();
      writeFileSync(filePath, new Uint8Array(arrayBuffer));

      // 返回图片 URL
      const imageUrl = `/uploads/${articleId}/${fileName}`;
      return c.json({ url: imageUrl });
    } catch (error) {
      console.error("图片上传失败:", error);
      return c.json({ error: "图片上传失败" }, 500);
    }
  });

  /**
   * 批量上传图片并替换 Markdown 中的 base64 图片
   * POST /api/upload/batch/:articleId
   * 
   * 接收包含 base64 图片的 Markdown，批量上传图片后返回替换后的 Markdown
   * Request body: { markdown: string }
   * Response: { markdown: string, uploadedCount: number, totalCount: number }
   */
  router.post("/batch/:articleId", async (c) => {
    try {
      const articleId = c.req.param("articleId");

      // 验证文章 ID
      if (!articleId || !/^\d+$/.test(articleId)) {
        return c.json({ error: "无效的文章 ID" }, 400);
      }

      const body = await c.req.json();
      const { markdown } = body;

      if (!markdown || typeof markdown !== "string") {
        return c.json({ error: "缺少 markdown 参数" }, 400);
      }

      // 提取所有 base64 图片
      const base64ImageRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
      const matches: { fullMatch: string; alt: string; base64: string }[] = [];
      let match;
      while ((match = base64ImageRegex.exec(markdown)) !== null) {
        matches.push({
          fullMatch: match[0],
          alt: match[1],
          base64: match[2],
        });
      }

      if (matches.length === 0) {
        return c.json({ 
          markdown, 
          uploadedCount: 0, 
          totalCount: 0,
          message: "没有找到需要上传的图片"
        });
      }

      console.log(`[批量上传] 发现 ${matches.length} 张 base64 图片需要上传`);

      // 创建文章上传目录
      const currentUploadDir = getUploadPath();
      const articleDir = join(currentUploadDir, articleId);
      if (!existsSync(articleDir)) {
        mkdirSync(articleDir, { recursive: true });
      }

      let result = markdown;
      let uploadedCount = 0;

      // 批量上传所有图片
      for (const { fullMatch, alt, base64 } of matches) {
        try {
          // 提取 MIME 类型和数据
          const base64Matches = base64.match(/^data:([^;]+);base64,(.+)$/);
          if (!base64Matches) {
            console.error(`[批量上传] 无效的 base64 数据: ${base64.substring(0, 50)}...`);
            continue;
          }

          const mimeType = base64Matches[1];
          const data = base64Matches[2];

          // 验证文件类型
          const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
          if (!allowedTypes.includes(mimeType)) {
            console.error(`[批量上传] 不支持的图片类型: ${mimeType}`);
            continue;
          }

          // 解码 base64
          const buffer = Buffer.from(data, "base64");
          const uint8Array = new Uint8Array(buffer);

          // 限制文件大小（10MB）
          const maxSize = 10 * 1024 * 1024;
          if (uint8Array.length > maxSize) {
            console.error(`[批量上传] 文件大小超过限制: ${uint8Array.length} bytes`);
            continue;
          }

          // 生成文件名
          const ext = mimeType.split("/")[1] || "png";
          const fileName = `${randomUUID()}.${ext}`;
          const filePath = join(articleDir, fileName);

          // 保存文件
          writeFileSync(filePath, uint8Array);

          // 替换为相对路径
          const imageUrl = `/uploads/${articleId}/${fileName}`;
          const newImageMarkdown = `![${alt}](${imageUrl})`;
          result = result.replace(fullMatch, newImageMarkdown);
          uploadedCount++;

          console.log(`[批量上传] 图片已保存: ${imageUrl}`);
        } catch (error) {
          console.error(`[批量上传] 上传图片失败:`, error);
          // 继续处理下一张图片
        }
      }

      console.log(`[批量上传] 成功上传 ${uploadedCount}/${matches.length} 张图片`);

      return c.json({
        markdown: result,
        uploadedCount,
        totalCount: matches.length,
        message: `成功上传 ${uploadedCount}/${matches.length} 张图片`
      });
    } catch (error) {
      console.error("[批量上传] 批量上传失败:", error);
      return c.json({ error: "批量上传失败" }, 500);
    }
  });

  return router;
}

// 导出默认路由（供 index.ts 使用）
export const uploadRouter = createUploadRouter();

/**
 * 确保上传目录存在
 * @param uploadDir 上传目录路径，如果不指定则使用动态数据目录
 */
export function ensureUploadDir(uploadDir?: string) {
  const dir = uploadDir || getUploadDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
