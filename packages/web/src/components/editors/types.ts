// Vditor 编辑模式定义
// ir: 即时渲染（类似 Typora）
// wysiwyg: 所见即所得
// sv: 分屏预览（左侧源码，右侧预览）
export type VditorMode = "ir" | "wysiwyg" | "sv";

// 编辑器类型（兼容旧版本，实际使用 VditorMode）
export type EditorType = VditorMode;

// 编辑器显示名称
export const EDITOR_LABELS: Record<VditorMode, string> = {
  ir: "即时渲染",
  wysiwyg: "所见即所得",
  sv: "分屏预览",
};

// 编辑器描述
export const EDITOR_DESCRIPTIONS: Record<VditorMode, string> = {
  ir: "即时渲染 Markdown，类似 Typora",
  wysiwyg: "富文本编辑模式，所见即所得",
  sv: "左侧源码，右侧实时预览",
};

// 通用编辑器接口 - 所有编辑器都必须实现这个接口
export interface EditorRef {
  // 直接设置编辑器内容（不重建编辑器，保持滚动位置）
  setContent: (markdown: string) => boolean;
  // 获取当前编辑器内容
  getContent?: () => string;
  // 聚焦编辑器
  focus?: () => void;
  // 滚动到指定行号（1-based）
  scrollToLine?: (line: number) => void;
}

// 编辑器通用 Props
export interface BaseEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readonly?: boolean;
  className?: string;
  articleId?: number;
  enableSpellCheck?: boolean;
}

// 本地存储键
export const EDITOR_PREFERENCE_KEY = "editor-type-preference";

// 获取保存的编辑器偏好
export function getEditorPreference(): VditorMode {
  const saved = localStorage.getItem(EDITOR_PREFERENCE_KEY);
  // 兼容旧值，自动迁移到新的 Vditor 模式
  // 旧版 livepreview/milkdown -> ir（即时渲染）
  // 旧版 codemirror -> sv（分屏预览，左侧源码）
  if (saved === "milkdown" || saved === "livepreview") {
    return "ir";
  }
  if (saved === "codemirror") {
    return "sv";
  }
  // 新的 Vditor 模式
  if (saved === "ir" || saved === "wysiwyg" || saved === "sv") {
    return saved;
  }
  return "ir"; // 默认使用即时渲染模式
}

// 保存编辑器偏好
export function setEditorPreference(mode: VditorMode): void {
  localStorage.setItem(EDITOR_PREFERENCE_KEY, mode);
}
