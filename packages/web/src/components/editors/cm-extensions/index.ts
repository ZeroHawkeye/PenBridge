/**
 * CodeMirror 实时渲染扩展索引
 * 导出所有 Markdown 实时预览扩展
 */

export { headingExtension } from "./heading";
export { emphasisExtension } from "./emphasis";
export { linkExtension } from "./link";
export { imageExtension } from "./image";
export { blockquoteExtension } from "./blockquote";
export { listExtension } from "./list";
export { codeblockExtension } from "./codeblock";
export { alignmentExtension } from "./alignment";
export { horizontalRuleExtension } from "./horizontalRule";

// 工具函数
export {
  isCursorInside,
  isCursorOnLine,
  getServerBaseUrl,
  toAbsoluteImageUrl,
} from "./utils";

import type { Extension } from "@codemirror/state";
import { headingExtension } from "./heading";
import { emphasisExtension } from "./emphasis";
import { linkExtension } from "./link";
import { imageExtension } from "./image";
import { blockquoteExtension } from "./blockquote";
import { listExtension } from "./list";
import { codeblockExtension } from "./codeblock";
import { alignmentExtension } from "./alignment";
import { horizontalRuleExtension } from "./horizontalRule";

/**
 * 获取所有实时渲染扩展
 */
export function getLivePreviewExtensions(): Extension[] {
  return [
    headingExtension(),
    emphasisExtension(),
    linkExtension(),
    imageExtension(),
    blockquoteExtension(),
    listExtension(),
    codeblockExtension(),
    alignmentExtension(),
    horizontalRuleExtension(),
  ];
}
