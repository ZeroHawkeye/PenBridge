/**
 * Markdown 图片处理工具函数
 * 用于处理 markdown 中的图片 URL 转换
 */

import { getServerBaseUrlSync } from "./serverConfig";

// 将相对路径转换为完整 URL（用于编辑器显示）
function toAbsoluteImageUrl(relativeUrl: string): string {
  // 如果已经是完整 URL 或 base64，直接返回
  if (
    relativeUrl.startsWith("http://") ||
    relativeUrl.startsWith("https://") ||
    relativeUrl.startsWith("data:")
  ) {
    return relativeUrl;
  }
  // 如果是相对路径，拼接服务器地址
  const apiBaseUrl = getServerBaseUrlSync();
  if (!apiBaseUrl) {
    return relativeUrl;
  }
  return `${apiBaseUrl}${relativeUrl}`;
}

// 将完整 URL 转换为相对路径（用于保存）
function toRelativeImageUrl(absoluteUrl: string): string {
  // 如果是 base64，直接返回
  if (absoluteUrl.startsWith("data:")) {
    return absoluteUrl;
  }
  // 如果已经是相对路径，直接返回
  if (absoluteUrl.startsWith("/uploads/")) {
    return absoluteUrl;
  }
  // 提取相对路径部分
  const uploadsIndex = absoluteUrl.indexOf("/uploads/");
  if (uploadsIndex !== -1) {
    return absoluteUrl.slice(uploadsIndex);
  }
  // 其他情况直接返回
  return absoluteUrl;
}

/**
 * 将 markdown 内容中的相对图片路径转换为完整 URL（用于编辑器显示）
 */
export function convertToAbsoluteUrls(markdown: string): string {
  // 匹配 markdown 图片: ![alt](/uploads/...)
  return markdown.replace(
    /!\[([^\]]*)\]\((\/uploads\/[^)]+)\)/g,
    (_match, alt, url) => `![${alt}](${toAbsoluteImageUrl(url)})`
  );
}

/**
 * 将 markdown 内容中的完整图片 URL 转换为相对路径（用于保存）
 */
export function convertToRelativeUrls(markdown: string): string {
  // 匹配 markdown 图片中包含 /uploads/ 的完整 URL
  return markdown.replace(
    /!\[([^\]]*)\]\(([^)]*\/uploads\/[^)]+)\)/g,
    (_match, alt, url) => `![${alt}](${toRelativeImageUrl(url)})`
  );
}

// 将 base64 转换为 File 对象
function base64ToFile(base64: string, filename: string): File {
  // 提取 MIME 类型和数据
  const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("无效的 base64 数据");
  }

  const mimeType = matches[1];
  const data = matches[2];

  // 解码 base64
  const binaryString = atob(data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 创建 File 对象
  const ext = mimeType.split("/")[1] || "png";
  return new File([bytes], `${filename}.${ext}`, { type: mimeType });
}

// 上传图片到服务器，返回相对路径
async function uploadImageToServer(
  file: File,
  articleId: number
): Promise<string> {
  const apiBaseUrl = getServerBaseUrlSync();
  if (!apiBaseUrl) {
    throw new Error("服务器未配置");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${apiBaseUrl}/api/upload/${articleId}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "图片上传失败");
  }

  const data = await response.json();
  return data.url;
}

// 缓存已上传的 base64 图片
const uploadedBase64Cache = new Map<string, string>();

// 生成 base64 内容的简单 hash（用于缓存键）
function hashBase64(base64: string): string {
  const dataStart = base64.indexOf(",") + 1;
  const dataPart = base64.slice(dataStart, dataStart + 200);
  return `${dataPart.length}_${base64.length}_${dataPart.slice(0, 50)}`;
}

/**
 * 将 markdown 内容中的 base64 图片替换为服务器 URL（用于保存前处理）
 */
export async function replaceBase64ImagesInMarkdown(
  markdown: string,
  articleId: number
): Promise<string> {
  // 匹配 markdown 中的 base64 图片: ![alt](data:image/...)
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
    return markdown;
  }

  console.log(`[markdownImageUtils] 发现 ${matches.length} 个 base64 图片需要替换`);

  let result = markdown;
  for (const { fullMatch, alt, base64 } of matches) {
    // 检查缓存
    const cacheKey = hashBase64(base64);
    let uploadedUrl = uploadedBase64Cache.get(cacheKey);

    if (!uploadedUrl) {
      try {
        const file = base64ToFile(base64, `inline-${Date.now()}`);
        uploadedUrl = await uploadImageToServer(file, articleId);
        uploadedBase64Cache.set(cacheKey, uploadedUrl);
      } catch (error) {
        console.error("替换 base64 图片失败:", error);
        continue;
      }
    }

    // 替换为服务器 URL
    const newImageMarkdown = `![${alt}](${uploadedUrl})`;
    result = result.replace(fullMatch, newImageMarkdown);
  }

  return result;
}
