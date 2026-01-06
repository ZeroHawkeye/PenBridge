// 编辑器类型定义
export type EditorType = "livepreview" | "codemirror";

// 编辑器显示名称
export const EDITOR_LABELS: Record<EditorType, string> = {
  livepreview: "实时预览",
  codemirror: "源码模式",
};

// 编辑器描述
export const EDITOR_DESCRIPTIONS: Record<EditorType, string> = {
  livepreview: "实时渲染 Markdown，类似 Obsidian Live Preview",
  codemirror: "直接编辑 Markdown 源码，显示原始语法",
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
export function getEditorPreference(): EditorType {
  const saved = localStorage.getItem(EDITOR_PREFERENCE_KEY);
  // 兼容旧的 milkdown 值，自动迁移到 livepreview
  if (saved === "milkdown" || saved === "livepreview") {
    return "livepreview";
  }
  if (saved === "codemirror") {
    return saved;
  }
  return "livepreview"; // 默认使用实时预览
}

// 保存编辑器偏好
export function setEditorPreference(type: EditorType): void {
  localStorage.setItem(EDITOR_PREFERENCE_KEY, type);
}
