/**
 * 图片上传服务
 * 负责将文章中的本地图片上传到腾讯云 COS
 */

import * as fs from "fs";
import * as path from "path";
import { TencentApiClient } from "./tencentApi";

// 调试日志开关
const DEBUG = true;

// 并发上传配置
const MAX_CONCURRENT_UPLOADS = 36; // 最大并发数

function log(...args: unknown[]) {
  if (DEBUG) {
    console.log("[ImageUpload]", ...args);
  }
}

/**
 * 限制并发执行的工具函数
 * @param tasks 任务数组（每个任务是返回 Promise 的函数）
 * @param concurrency 最大并发数
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const p = Promise.resolve().then(() => task()).then((result) => {
      results[i] = result;
    });

    executing.push(p as Promise<void>);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // 移除已完成的 Promise
      for (let j = executing.length - 1; j >= 0; j--) {
        // 检查 Promise 是否已完成
        const status = await Promise.race([
          executing[j].then(() => "fulfilled"),
          Promise.resolve("pending"),
        ]);
        if (status === "fulfilled") {
          executing.splice(j, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

// 本地服务器图片 URL 模式
const LOCAL_IMAGE_PATTERN = /!\[([^\]]*)\]\((http:\/\/localhost:\d+\/api\/upload\/[^)]+)\)/g;
// 也匹配相对路径的图片
const RELATIVE_IMAGE_PATTERN = /!\[([^\]]*)\]\((\/api\/upload\/[^)]+)\)/g;
// Base64 编码图片模式
const BASE64_IMAGE_PATTERN = /!\[([^\]]*)\]\((data:image\/([a-zA-Z]+);base64,([^)]+))\)/g;

/**
 * 图片上传结果
 */
export interface ImageUploadResult {
  originalUrl: string;
  newUrl: string;
  success: boolean;
  error?: string;
}

/**
 * 处理文章内容中的图片
 * 将本地图片上传到腾讯云 COS，并替换 URL
 */
export async function processArticleImages(
  content: string,
  client: TencentApiClient,
  uploadDir: string
): Promise<{ content: string; results: ImageUploadResult[] }> {
  const results: ImageUploadResult[] = [];
  let processedContent = content;

  // 收集所有本地图片 URL
  const localImages: Array<{ fullMatch: string; alt: string; url: string }> = [];

  // 匹配完整 URL
  let match;
  const pattern1 = new RegExp(LOCAL_IMAGE_PATTERN.source, "g");
  while ((match = pattern1.exec(content)) !== null) {
    localImages.push({
      fullMatch: match[0],
      alt: match[1],
      url: match[2],
    });
  }

  // 匹配相对路径
  const pattern2 = new RegExp(RELATIVE_IMAGE_PATTERN.source, "g");
  while ((match = pattern2.exec(content)) !== null) {
    localImages.push({
      fullMatch: match[0],
      alt: match[1],
      url: match[2],
    });
  }

  // 收集所有 base64 图片
  const base64Images: Array<{
    fullMatch: string;
    alt: string;
    extension: string;
    data: string;
  }> = [];

  const pattern3 = new RegExp(BASE64_IMAGE_PATTERN.source, "g");
  while ((match = pattern3.exec(content)) !== null) {
    base64Images.push({
      fullMatch: match[0],
      alt: match[1],
      extension: match[3], // 图片格式，如 png, jpeg
      data: match[4], // base64 数据
    });
  }

  if (localImages.length === 0 && base64Images.length === 0) {
    log("文章中没有本地图片或 base64 图片需要上传");
    return { content, results };
  }

  log(`找到 ${localImages.length} 张本地图片，${base64Images.length} 张 base64 图片需要上传`);

  // 统一的上传任务结果类型
  interface UploadTaskResult {
    fullMatch: string;
    result: ImageUploadResult;
    newMarkdown?: string;
  }

  // 构建本地图片上传任务
  const localImageTasks = localImages.map((image) => async (): Promise<UploadTaskResult> => {
    try {
      log(`处理图片: ${image.url}`);

      // 解析本地文件路径
      const localFilePath = resolveLocalFilePath(image.url, uploadDir);
      log(`本地文件路径: ${localFilePath}`);

      if (!localFilePath || !fs.existsSync(localFilePath)) {
        log(`图片文件不存在: ${localFilePath}`);
        return {
          fullMatch: image.fullMatch,
          result: {
            originalUrl: image.url,
            newUrl: image.url,
            success: false,
            error: "图片文件不存在",
          },
        };
      }

      // 读取图片文件
      const imageBuffer = fs.readFileSync(localFilePath);
      const extension = path.extname(localFilePath).slice(1) || "png";

      log(`图片大小: ${imageBuffer.length} bytes, 扩展名: ${extension}`);

      // 上传到腾讯云 COS
      const newUrl = await client.uploadImage(imageBuffer, extension);
      log(`上传成功, 新 URL: ${newUrl.substring(0, 100)}...`);

      // 返回替换信息
      const newMarkdown = `![${image.alt}](${newUrl})`;

      return {
        fullMatch: image.fullMatch,
        result: {
          originalUrl: image.url,
          newUrl,
          success: true,
        },
        newMarkdown,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "未知错误";
      log(`图片上传失败: ${image.url}, 错误: ${errorMsg}`);
      return {
        fullMatch: image.fullMatch,
        result: {
          originalUrl: image.url,
          newUrl: image.url,
          success: false,
          error: errorMsg,
        },
      };
    }
  });

  // 构建 base64 图片上传任务
  const base64ImageTasks = base64Images.map((image) => async (): Promise<UploadTaskResult> => {
    try {
      log(`处理 base64 图片: ${image.extension}, 数据长度: ${image.data.length}`);

      // 将 base64 数据转换为 Buffer
      const imageBuffer = Buffer.from(image.data, "base64");
      const extension = image.extension || "png";

      log(`图片大小: ${imageBuffer.length} bytes, 扩展名: ${extension}`);

      // 上传到腾讯云 COS
      const newUrl = await client.uploadImage(imageBuffer, extension);
      log(`上传成功, 新 URL: ${newUrl.substring(0, 100)}...`);

      // 返回替换信息
      const newMarkdown = `![${image.alt}](${newUrl})`;

      return {
        fullMatch: image.fullMatch,
        result: {
          originalUrl: `data:image/${image.extension};base64,...`,
          newUrl,
          success: true,
        },
        newMarkdown,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "未知错误";
      log(`base64 图片上传失败, 错误: ${errorMsg}`);
      return {
        fullMatch: image.fullMatch,
        result: {
          originalUrl: `data:image/${image.extension};base64,...`,
          newUrl: "",
          success: false,
          error: errorMsg,
        },
      };
    }
  });

  // 合并所有任务并发执行
  const allTasks = [...localImageTasks, ...base64ImageTasks];
  log(`开始并发上传 ${allTasks.length} 张图片，最大并发数: ${MAX_CONCURRENT_UPLOADS}`);

  const uploadResults = await runWithConcurrency(allTasks, MAX_CONCURRENT_UPLOADS);

  // 处理上传结果，按顺序替换内容
  for (const uploadResult of uploadResults) {
    results.push(uploadResult.result);

    // 只有成功的才替换内容
    if (uploadResult.result.success && uploadResult.newMarkdown) {
      processedContent = processedContent.replace(
        uploadResult.fullMatch,
        uploadResult.newMarkdown
      );
    }
  }

  const successCount = results.filter((r) => r.success).length;
  log(`图片处理完成: ${successCount}/${results.length} 成功`);

  return { content: processedContent, results };
}

/**
 * 解析本地文件路径
 * 从 URL 中提取实际的本地文件路径
 */
function resolveLocalFilePath(url: string, uploadDir: string): string | null {
  try {
    // URL 格式: http://localhost:3000/api/upload/{articleId}/{filename}
    // 或 /api/upload/{articleId}/{filename}

    let urlPath: string;

    if (url.startsWith("http://") || url.startsWith("https://")) {
      const urlObj = new URL(url);
      urlPath = urlObj.pathname;
    } else {
      urlPath = url;
    }

    // 解析路径: /api/upload/{articleId}/{filename}
    const match = urlPath.match(/\/api\/upload\/(\d+)\/(.+)/);
    if (!match) {
      log(`无法解析 URL 路径: ${urlPath}`);
      return null;
    }

    const articleId = match[1];
    const filename = decodeURIComponent(match[2]);

    // 构建本地文件路径
    const localPath = path.join(uploadDir, articleId, filename);
    log(`解析后的本地路径: ${localPath}`);

    return localPath;
  } catch (error) {
    log(`解析 URL 失败: ${url}`, error);
    return null;
  }
}

/**
 * 检查内容中是否包含本地图片或 base64 图片
 */
export function hasLocalImages(content: string): boolean {
  const pattern1 = new RegExp(LOCAL_IMAGE_PATTERN.source);
  const pattern2 = new RegExp(RELATIVE_IMAGE_PATTERN.source);
  const pattern3 = new RegExp(BASE64_IMAGE_PATTERN.source);
  return pattern1.test(content) || pattern2.test(content) || pattern3.test(content);
}

/**
 * 获取内容中的本地图片数量（包括 base64 图片）
 */
export function countLocalImages(content: string): number {
  let count = 0;

  const pattern1 = new RegExp(LOCAL_IMAGE_PATTERN.source, "g");
  while (pattern1.exec(content) !== null) {
    count++;
  }

  const pattern2 = new RegExp(RELATIVE_IMAGE_PATTERN.source, "g");
  while (pattern2.exec(content) !== null) {
    count++;
  }

  const pattern3 = new RegExp(BASE64_IMAGE_PATTERN.source, "g");
  while (pattern3.exec(content) !== null) {
    count++;
  }

  return count;
}
