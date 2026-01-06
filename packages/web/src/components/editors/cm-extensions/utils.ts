/**
 * CodeMirror 扩展工具函数
 */

import type { ViewUpdate } from "@codemirror/view";

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
 */
export function getServerBaseUrl(): string {
  // 从 localStorage 或配置中获取
  try {
    const config = localStorage.getItem("server-config");
    if (config) {
      const parsed = JSON.parse(config);
      return parsed.baseUrl || "";
    }
  } catch {
    // 忽略错误
  }
  return "";
}

/**
 * 将相对路径转换为完整 URL
 */
export function toAbsoluteImageUrl(relativeUrl: string): string {
  if (
    relativeUrl.startsWith("http://") ||
    relativeUrl.startsWith("https://") ||
    relativeUrl.startsWith("data:")
  ) {
    return relativeUrl;
  }
  const baseUrl = getServerBaseUrl();
  if (!baseUrl) {
    return relativeUrl;
  }
  return `${baseUrl}${relativeUrl}`;
}
