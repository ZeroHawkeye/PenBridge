import { existsSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { join } from "path";
import { getUploadDir } from "./dataDir";

/**
 * 从文章内容中提取所有引用的图片文件名
 * 匹配格式: /uploads/{articleId}/{filename} 或 http://xxx/uploads/{articleId}/{filename}
 */
function extractReferencedImages(content: string, articleId: number): Set<string> {
  const referencedImages = new Set<string>();
  
  // 匹配 markdown 图片语法: ![alt](url)
  // URL 可能是 /uploads/27/xxx.png 或 http://localhost:3000/uploads/27/xxx.png
  const imageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  
  while ((match = imageRegex.exec(content)) !== null) {
    const url = match[1];
    // 提取文件名，支持多种格式
    const uploadPathMatch = url.match(/\/uploads\/(\d+)\/([^/?#]+)/);
    if (uploadPathMatch) {
      const imgArticleId = parseInt(uploadPathMatch[1], 10);
      const filename = uploadPathMatch[2];
      // 只收集属于当前文章的图片
      if (imgArticleId === articleId) {
        referencedImages.add(filename);
      }
    }
  }
  
  return referencedImages;
}

/**
 * 获取文章上传目录中的所有文件
 */
function getUploadedFiles(articleId: number): string[] {
  const articleDir = join(getUploadDir(), String(articleId));
  
  if (!existsSync(articleDir)) {
    return [];
  }
  
  try {
    return readdirSync(articleDir);
  } catch {
    return [];
  }
}

/**
 * 清理文章中未被引用的图片
 * @param articleId 文章 ID
 * @param content 文章内容
 * @returns 清理结果
 */
export async function cleanupUnusedImages(
  articleId: number,
  content: string
): Promise<{ deleted: string[]; kept: string[]; errors: string[] }> {
  const result = {
    deleted: [] as string[],
    kept: [] as string[],
    errors: [] as string[],
  };

  // 获取文章引用的图片
  const referencedImages = extractReferencedImages(content, articleId);
  
  // 获取上传目录中的所有文件
  const uploadedFiles = getUploadedFiles(articleId);
  
  if (uploadedFiles.length === 0) {
    return result;
  }

  const articleDir = join(getUploadDir(), String(articleId));

  for (const filename of uploadedFiles) {
    if (referencedImages.has(filename)) {
      // 文件被引用，保留
      result.kept.push(filename);
    } else {
      // 文件未被引用，删除
      try {
        const filePath = join(articleDir, filename);
        unlinkSync(filePath);
        result.deleted.push(filename);
        console.log(`[ImageCleanup] 删除未引用图片: ${filePath}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`${filename}: ${errorMsg}`);
        console.error(`[ImageCleanup] 删除图片失败: ${filename}`, error);
      }
    }
  }

  // 如果目录为空，删除目录
  try {
    const remainingFiles = readdirSync(articleDir);
    if (remainingFiles.length === 0) {
      rmdirSync(articleDir);
      console.log(`[ImageCleanup] 删除空目录: ${articleDir}`);
    }
  } catch {
    // 忽略目录删除错误
  }

  if (result.deleted.length > 0) {
    console.log(
      `[ImageCleanup] 文章 ${articleId} 清理完成: 删除 ${result.deleted.length} 个, 保留 ${result.kept.length} 个`
    );
  }

  return result;
}

/**
 * 删除文章的所有上传图片（用于文章删除时）
 * @param articleId 文章 ID
 */
export async function deleteAllArticleImages(articleId: number): Promise<void> {
  const articleDir = join(getUploadDir(), String(articleId));
  
  if (!existsSync(articleDir)) {
    return;
  }

  try {
    const files = readdirSync(articleDir);
    for (const file of files) {
      try {
        unlinkSync(join(articleDir, file));
      } catch {
        // 忽略单个文件删除错误
      }
    }
    // 删除目录
    rmdirSync(articleDir);
    console.log(`[ImageCleanup] 删除文章 ${articleId} 的所有图片，共 ${files.length} 个`);
  } catch (error) {
    console.error(`[ImageCleanup] 删除文章 ${articleId} 图片目录失败:`, error);
  }
}
