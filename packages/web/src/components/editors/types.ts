// 编辑器类型定义
export type EditorType = "milkdown" | "codemirror";

// 编辑器显示名称
export const EDITOR_LABELS: Record<EditorType, string> = {
  milkdown: "所见即所得",
  codemirror: "源码模式",
};

// 编辑器描述
export const EDITOR_DESCRIPTIONS: Record<EditorType, string> = {
  milkdown: "实时渲染 Markdown，类似 Typora",
  codemirror: "直接编辑 Markdown 源码，支持语法高亮",
};

// 通用编辑器接口 - 所有编辑器都必须实现这个接口
export interface EditorRef {
  // 直接设置编辑器内容（不重建编辑器，保持滚动位置）
  setContent: (markdown: string) => boolean;
  // 获取当前编辑器内容
  getContent?: () => string;
  // 聚焦编辑器
  focus?: () => void;
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
  if (saved === "milkdown" || saved === "codemirror") {
    return saved;
  }
  return "milkdown"; // 默认使用 Milkdown
}

// 保存编辑器偏好
export function setEditorPreference(type: EditorType): void {
  localStorage.setItem(EDITOR_PREFERENCE_KEY, type);
}
