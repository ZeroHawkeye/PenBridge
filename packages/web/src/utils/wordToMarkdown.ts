// 延迟加载 mammoth 和 turndown 库（这些库体积较大，仅在实际导入 Word 时才需要）
// 这样可以减少首屏加载时间约 600ms

import { getServerBaseUrlSync } from "./serverConfig";

// 默认 Turndown 配置
const defaultTurndownOptions = {
  headingStyle: "atx" as const,
  codeBlockStyle: "fenced" as const,
  bulletListMarker: "-" as const,
};

// 缓存已加载的模块，避免重复动态导入
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedTurndownService: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedTurndownPluginGfm: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedMammoth: any = null;

/**
 * 动态加载 mammoth 库
 */
async function getMammoth() {
  if (!cachedMammoth) {
    cachedMammoth = await import("mammoth");
  }
  return cachedMammoth;
}

/**
 * 将 HTML 转换为 GitHub 风格的 Markdown
 * 延迟加载 turndown 库
 */
async function htmlToMd(html: string): Promise<string> {
  if (!html || html.trim() === "") {
    return "";
  }
  
  // 动态导入 turndown 库
  if (!cachedTurndownService || !cachedTurndownPluginGfm) {
    const [turndownModule, gfmModule] = await Promise.all([
      // @ts-expect-error - 缺少类型声明
      import("@joplin/turndown"),
      // @ts-expect-error - 缺少类型声明
      import("@joplin/turndown-plugin-gfm"),
    ]);
    cachedTurndownService = turndownModule.default;
    cachedTurndownPluginGfm = gfmModule;
  }
  
  const turndownService = new cachedTurndownService(defaultTurndownOptions);
  turndownService.use(cachedTurndownPluginGfm.gfm);
  return turndownService.turndown(html).trim();
}

/**
 * 自动处理表格头部
 * Turndown 需要 <th> 元素来正确渲染 Markdown 表格头
 */
function autoTableHeaders(html: string): string {
  // 使用正则表达式简单处理表格首行
  // 将表格第一行的 <td> 转换为 <th>
  return html.replace(
    /<table([^>]*)>([\s\S]*?)<\/table>/gi,
    (_match, attrs, content) => {
      // 找到第一个 tr 并将其中的 td 替换为 th
      const firstTrMatch = content.match(/<tr([^>]*)>([\s\S]*?)<\/tr>/i);
      if (firstTrMatch) {
        const firstTr = firstTrMatch[0];
        // 检查是否已经有 th
        if (!/<th/i.test(firstTr)) {
          const newFirstTr = firstTr
            .replace(/<td/gi, "<th")
            .replace(/<\/td>/gi, "</th>");
          content = content.replace(firstTr, newFirstTr);
        }
      }
      return `<table${attrs}>${content}</table>`;
    }
  );
}

/**
 * 清理 HTML 中图片的 alt 属性
 * Word 自动生成的图片描述可能包含换行符，这会破坏 Markdown 图片语法
 */
function cleanImageAlt(html: string): string {
  return html.replace(
    /<img([^>]*)alt=(["'])([\s\S]*?)\2([^>]*)>/gi,
    (_match, before, quote, alt, after) => {
      // 清理 alt 文本：移除换行符，压缩多余空格
      const cleanAlt = alt
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return `<img${before}alt=${quote}${cleanAlt}${quote}${after}>`;
    }
  );
}

/**
 * 清理 Markdown 中的特殊字符
 */
function cleanMarkdown(md: string): string {
  return md
    // 移除非断行空格
    .replace(/\u00A0/g, " ")
    .replace(/\u2007/g, " ")
    .replace(/\u202F/g, " ")
    .replace(/\u2060/g, "")
    .replace(/\uFEFF/g, "")
    // 转换智能引号为 ASCII
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .trim();
}

export interface ConvertResult {
  markdown: string;
  fileName: string;
  title: string;
}

/**
 * 将 base64 图片上传到服务器
 * @param base64Data - base64 数据（格式：data:image/png;base64,xxxxx）
 * @param articleId - 文章 ID
 * @returns 完整的图片 URL（如 http://localhost:36925/uploads/27/xxx.png）
 */
async function uploadBase64Image(base64Data: string, articleId: number): Promise<string> {
  const apiBaseUrl = getServerBaseUrlSync();
  if (!apiBaseUrl) {
    throw new Error("服务器未配置");
  }

  // 提取 MIME 类型和数据
  const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
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
  const file = new File([bytes], `word-image-${Date.now()}.${ext}`, { type: mimeType });

  // 上传到服务器
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

  const result = await response.json();
  // 返回完整 URL（拼接服务器地址）
  // result.url 是相对路径（如 /uploads/27/xxx.png）
  return `${apiBaseUrl}${result.url}`;
}

/**
 * 将 Word 文档 (.docx) 转换为 Markdown
 * @param file - Word 文件
 * @param articleId - 文章 ID（可选，用于图片上传。如果不提供，图片将保持 base64 格式）
 * @returns 转换后的 Markdown 内容和文件信息
 */
export async function convertWordToMarkdown(
  file: File,
  articleId?: number
): Promise<ConvertResult> {
  // 验证文件类型
  const fileName = file.name;
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "doc") {
    throw new Error(
      "不支持 .doc 格式，请将文档另存为 .docx 格式后重试。"
    );
  }

  if (ext !== "docx") {
    throw new Error("请选择 Word 文档 (.docx) 文件。");
  }

  // 读取文件为 ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  console.log("文件大小:", arrayBuffer.byteLength, "bytes");
  
  // 动态加载 mammoth 库（延迟加载，仅在实际使用时才加载）
  const mammoth = await getMammoth();
  console.log("mammoth 模块:", mammoth);

  // 使用 mammoth 将 Word 转换为 HTML
  // mammoth 在浏览器中需要传入 arrayBuffer 属性
  const mammothResult = await mammoth.convertToHtml({ arrayBuffer });

  console.log("Mammoth 转换结果:", mammothResult);
  console.log("HTML 内容长度:", mammothResult.value?.length || 0);

  // 检查转换结果
  if (!mammothResult.value) {
    console.warn("Mammoth 转换警告:", mammothResult.messages);
    throw new Error("Word 文档内容为空或无法解析");
  }

  // 处理表格头和图片 alt 属性
  let html = autoTableHeaders(mammothResult.value);
  html = cleanImageAlt(html);
  console.log("处理后 HTML:", html.substring(0, 500));

  // 转换为 Markdown（异步）
  let md = await htmlToMd(html);

  // 如果提供了 articleId，将 base64 图片上传到服务器
  if (articleId !== undefined) {
    console.log("开始处理 Word 中的图片...");
    md = await processBase64ImagesInMarkdown(md, articleId);
    console.log("图片处理完成");
  }

  // 清理 Markdown
  const cleanedMd = cleanMarkdown(md);

  // 从文件名提取标题（去除扩展名）
  const title = fileName.replace(/\.(docx?|DOCX?)$/, "");

  return {
    markdown: cleanedMd,
    fileName,
    title,
  };
}

/**
 * 处理 Markdown 中的 base64 图片，上传到服务器并替换为完整 URL
 * @param markdown - 包含 base64 图片的 Markdown 内容
 * @param articleId - 文章 ID
 * @returns 处理后的 Markdown（base64 替换为完整 URL，用于编辑器显示）
 */
async function processBase64ImagesInMarkdown(
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

  console.log(`发现 ${matches.length} 张 base64 图片需要上传`);

  let result = markdown;
  let uploadedCount = 0;
  
  for (const { fullMatch, alt, base64 } of matches) {
    try {
      // 上传图片到服务器，获取完整 URL
      const fullUrl = await uploadBase64Image(base64, articleId);
      console.log(`图片上传成功: ${fullUrl}`);
      
      // 替换为完整 URL（用于编辑器显示，保存时会自动转换为相对路径）
      const newImageMarkdown = `![${alt}](${fullUrl})`;
      result = result.replace(fullMatch, newImageMarkdown);
      uploadedCount++;
    } catch (error) {
      console.error("上传图片失败:", error);
      // 上传失败时保持 base64 格式
    }
  }

  console.log(`成功上传 ${uploadedCount}/${matches.length} 张图片`);
  return result;
}
