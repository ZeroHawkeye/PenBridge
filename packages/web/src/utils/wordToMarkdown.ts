import * as mammoth from "mammoth";
// @ts-expect-error - 缺少类型声明
import TurndownService from "@joplin/turndown";
// @ts-expect-error - 缺少类型声明
import * as turndownPluginGfm from "@joplin/turndown-plugin-gfm";

// 默认 Turndown 配置
const defaultTurndownOptions = {
  headingStyle: "atx" as const,
  codeBlockStyle: "fenced" as const,
  bulletListMarker: "-" as const,
};

/**
 * 将 HTML 转换为 GitHub 风格的 Markdown
 */
function htmlToMd(html: string): string {
  if (!html || html.trim() === "") {
    return "";
  }
  const turndownService = new TurndownService(defaultTurndownOptions);
  turndownService.use(turndownPluginGfm.gfm);
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
 * 将 Word 文档 (.docx) 转换为 Markdown
 * @param file - Word 文件
 * @returns 转换后的 Markdown 内容和文件信息
 */
export async function convertWordToMarkdown(
  file: File
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

  // 转换为 Markdown
  const md = htmlToMd(html);

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
