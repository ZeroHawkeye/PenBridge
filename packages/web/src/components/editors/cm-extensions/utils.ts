/**
 * CodeMirror 扩展工具函数
 */

import type { ViewUpdate } from "@codemirror/view";

// 与 serverConfig.ts 保持一致的 key
const SERVER_BASE_URL_KEY = "server_base_url";

/**
 * 检查光标是否在指定范围内
 * 当光标在范围内时，不应用装饰（显示原始 Markdown 语法）
 */
export function isCursorInside(
  update: ViewUpdate,
  from: number,
  to: number,
  inclusive = true
): boolean {
  const { state } = update;
  const { selection } = state;
  
  for (const range of selection.ranges) {
    if (inclusive) {
      // 包含边界
      if (range.from <= to && range.to >= from) {
        return true;
      }
    } else {
      // 不包含边界
      if (range.from < to && range.to > from) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 检查光标是否在指定行
 */
export function isCursorOnLine(
  update: ViewUpdate,
  lineFrom: number,
  lineTo: number
): boolean {
  const { state } = update;
  const { selection } = state;
  
  for (const range of selection.ranges) {
    const cursorLine = state.doc.lineAt(range.head);
    if (cursorLine.from >= lineFrom && cursorLine.from <= lineTo) {
      return true;
    }
  }
  
  return false;
}

/**
 * 获取服务器基础 URL（用于图片）
 * 与 serverConfig.ts 中的 getServerBaseUrlSync 保持一致
 */
export function getServerBaseUrl(): string {
  try {
    return localStorage.getItem(SERVER_BASE_URL_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * 将相对路径转换为完整 URL
 * 处理以下情况：
 * 1. data: URL - 直接返回
 * 2. 相对路径 /uploads/... - 添加 baseUrl
 * 3. 绝对 URL http://localhost:3000/uploads/... - 替换为正确的 baseUrl
 */
export function toAbsoluteImageUrl(relativeUrl: string): string {
  // data URL 直接返回
  if (relativeUrl.startsWith("data:")) {
    return relativeUrl;
  }

  const baseUrl = getServerBaseUrl();

  // 处理已经是绝对 URL 的情况（可能是旧的 localhost:3000 URL）
  if (
    relativeUrl.startsWith("http://") ||
    relativeUrl.startsWith("https://")
  ) {
    // 提取路径部分
    try {
      const url = new URL(relativeUrl);
      const pathname = url.pathname;
      
      // 如果是 /uploads/ 或 /api/ 开头的路径，使用当前配置的 baseUrl
      if (pathname.startsWith("/uploads/") || pathname.startsWith("/api/")) {
        if (baseUrl) {
          return `${baseUrl}${pathname}`;
        }
        // 没有配置 baseUrl，返回原 URL（可能无法加载，但至少不会出错）
        return relativeUrl;
      }
      
      // 其他外部 URL 直接返回
      return relativeUrl;
    } catch {
      return relativeUrl;
    }
  }

  // 相对路径，添加 baseUrl
  if (!baseUrl) {
    // 没有配置 baseUrl，返回原路径
    return relativeUrl;
  }
  return `${baseUrl}${relativeUrl}`;
}
