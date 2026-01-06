/**
 * CodeMirror 实时渲染编辑器
 * 类似 Obsidian 的 Live Preview 模式
 */
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useCallback,
} from "react";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder as placeholderExt,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  indentOnInput,
} from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { getServerBaseUrlSync } from "../../utils/serverConfig";
import { getLivePreviewExtensions } from "./cm-extensions";
import type { BaseEditorProps, EditorRef } from "./types";

export interface LivePreviewEditorProps extends BaseEditorProps {
  /** 是否显示行号 */
  showLineNumbers?: boolean;
}

// 将相对路径转换为完整 URL
function toAbsoluteImageUrl(relativeUrl: string): string {
  if (
    relativeUrl.startsWith("http://") ||
    relativeUrl.startsWith("https://") ||
    relativeUrl.startsWith("data:")
  ) {
    return relativeUrl;
  }
  const apiBaseUrl = getServerBaseUrlSync();
  if (!apiBaseUrl) {
    return relativeUrl;
  }
  return `${apiBaseUrl}${relativeUrl}`;
}

// 上传图片到服务器，返回完整 URL
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
  return toAbsoluteImageUrl(data.url);
}

// 从 DataTransfer 中提取图片文件
function getImageFilesFromDataTransfer(dataTransfer: DataTransfer): File[] {
  const files: File[] = [];
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    if (file.type.startsWith("image/")) {
      files.push(file);
    }
  }
  return files;
}

// 从剪贴板项目中提取图片
function getImageFromClipboardItems(
  items: DataTransferItemList
): File | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

// 编辑器基础主题
const baseEditorTheme = EditorView.theme({
  "&": {
    fontSize: "16px",
    height: "100%",
  },
  ".cm-content": {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    padding: "24px 0",
    minHeight: "calc(100vh - 200px)",
    caretColor: "auto",
  },
  ".cm-line": {
    padding: "0 24px",
    lineHeight: "1.75",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "none",
    color: "hsl(var(--muted-foreground))",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-activeLine": {
    backgroundColor: "hsl(var(--muted) / 0.3)",
  },
  // 选中文字背景
  "& .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "rgba(100, 150, 255, 0.3) !important",
  },
  "&.cm-focused .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "rgba(100, 150, 255, 0.4) !important",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(100, 150, 255, 0.3) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(100, 150, 255, 0.4) !important",
  },
  ".cm-cursor": {
    borderLeftColor: "hsl(var(--primary))",
    borderLeftWidth: "2px",
  },
  ".cm-placeholder": {
    color: "hsl(var(--muted-foreground) / 0.5)",
    fontStyle: "italic",
  },
  ".cm-foldGutter": {
    width: "16px",
  },
});

// 只读主题扩展
const readonlyTheme = EditorView.theme({
  ".cm-content": {
    cursor: "default",
  },
});

// 行号配置 Compartment（用于动态切换）
const lineNumbersCompartment = new Compartment();

function LivePreviewEditorInner(
  {
    value,
    onChange,
    placeholder = "开始写作...",
    readonly = false,
    className = "",
    articleId,
    showLineNumbers = false,
  }: LivePreviewEditorProps,
  ref: React.ForwardedRef<EditorRef>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastValueRef = useRef(value);
  const isInternalUpdate = useRef(false);

  // 使用 ref 存储回调函数和 props
  const onChangeRef = useRef(onChange);
  const articleIdRef = useRef(articleId);

  onChangeRef.current = onChange;
  articleIdRef.current = articleId;

  // 暴露方法给父组件
  useImperativeHandle(
    ref,
    () => ({
      setContent: (markdown: string): boolean => {
        const view = viewRef.current;
        if (!view) {
          return false;
        }

        try {
          isInternalUpdate.current = true;
          const transaction = view.state.update({
            changes: {
              from: 0,
              to: view.state.doc.length,
              insert: markdown,
            },
          });
          view.dispatch(transaction);
          lastValueRef.current = markdown;
          isInternalUpdate.current = false;
          return true;
        } catch (error) {
          console.error("[LivePreviewEditor] setContent 失败:", error);
          isInternalUpdate.current = false;
          return false;
        }
      },
      getContent: (): string => {
        const view = viewRef.current;
        return view ? view.state.doc.toString() : value;
      },
      focus: () => {
        viewRef.current?.focus();
      },
    }),
    [value]
  );

  // 图片上传处理
  const handleImageUpload = useCallback(async (file: File) => {
    const currentArticleId = articleIdRef.current;
    if (!currentArticleId) {
      console.warn("[LivePreviewEditor] 未提供 articleId，无法上传图片");
      return;
    }

    const currentView = viewRef.current;
    if (!currentView) return;

    // 在光标位置插入占位符
    const { from } = currentView.state.selection.main;
    const placeholderText = `![上传中...](uploading-${Date.now()})`;

    currentView.dispatch({
      changes: { from, to: from, insert: placeholderText },
      selection: { anchor: from + placeholderText.length },
    });

    try {
      const url = await uploadImageToServer(file, currentArticleId);

      // 替换占位符为实际图片链接
      const content = currentView.state.doc.toString();
      const newContent = content.replace(
        placeholderText,
        `![${file.name}](${url})`
      );

      isInternalUpdate.current = true;
      currentView.dispatch({
        changes: {
          from: 0,
          to: currentView.state.doc.length,
          insert: newContent,
        },
      });
      lastValueRef.current = newContent;
      isInternalUpdate.current = false;
      onChangeRef.current?.(newContent);
    } catch (error) {
      console.error("[LivePreviewEditor] 图片上传失败:", error);

      // 移除占位符
      const content = currentView.state.doc.toString();
      const newContent = content.replace(placeholderText, "");

      isInternalUpdate.current = true;
      currentView.dispatch({
        changes: {
          from: 0,
          to: currentView.state.doc.length,
          insert: newContent,
        },
      });
      lastValueRef.current = newContent;
      isInternalUpdate.current = false;
      onChangeRef.current?.(newContent);
    }
  }, []);

  // 初始化编辑器
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    // 更新监听器
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isInternalUpdate.current) {
        const newValue = update.state.doc.toString();
        if (newValue !== lastValueRef.current) {
          lastValueRef.current = newValue;
          onChangeRef.current?.(newValue);
        }
      }
    });

    const extensions = [
      // 行号配置（通过 Compartment 支持动态切换）
      lineNumbersCompartment.of(
        showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
      ),

      // 基础功能
      highlightActiveLine(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      highlightSelectionMatches(),
      history(),
      foldGutter(),

      // Markdown 语言支持
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),

      // 语法高亮
      syntaxHighlighting(defaultHighlightStyle),

      // 键盘快捷键
      keymap.of([
        ...(defaultKeymap as readonly any[]),
        ...(historyKeymap as readonly any[]),
        ...(searchKeymap as readonly any[]),
        indentWithTab as any,
      ]),

      // 占位符
      placeholderExt(placeholder),

      // 基础主题
      baseEditorTheme,

      // 实时渲染扩展
      ...getLivePreviewExtensions(),

      // 更新监听
      updateListener,

      // 自动换行
      EditorView.lineWrapping,
    ];

    // 只读模式
    if (readonly) {
      extensions.push(EditorState.readOnly.of(true));
      extensions.push(readonlyTheme);
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: container,
    });

    viewRef.current = view;
    lastValueRef.current = value;

    // 粘贴事件处理
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const imageFile = getImageFromClipboardItems(items);
      if (imageFile) {
        event.preventDefault();
        handleImageUpload(imageFile);
      }
    };

    // 拖拽事件处理
    const handleDrop = (event: DragEvent) => {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) return;

      const imageFiles = getImageFilesFromDataTransfer(dataTransfer);
      if (imageFiles.length > 0) {
        event.preventDefault();
        imageFiles.forEach(handleImageUpload);
      }
    };

    // 阻止默认拖拽行为
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    // 绑定事件
    const contentDOM = view.contentDOM;
    contentDOM.addEventListener("paste", handlePaste as EventListener);
    contentDOM.addEventListener("drop", handleDrop as EventListener);
    contentDOM.addEventListener("dragover", handleDragOver as EventListener);

    return () => {
      contentDOM.removeEventListener("paste", handlePaste as EventListener);
      contentDOM.removeEventListener("drop", handleDrop as EventListener);
      contentDOM.removeEventListener("dragover", handleDragOver as EventListener);
      view.destroy();
      viewRef.current = null;
    };
  }, [readonly, placeholder, handleImageUpload]); // eslint-disable-line react-hooks/exhaustive-deps

  // 动态切换行号显示
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: lineNumbersCompartment.reconfigure(
        showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
      ),
    });
  }, [showLineNumbers]);

  // 当外部 value 变化时，同步到编辑器
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (value !== currentValue && value !== lastValueRef.current) {
      // 如果编辑器有焦点，跳过更新以避免打断用户
      if (view.hasFocus) {
        lastValueRef.current = currentValue;
        return;
      }

      isInternalUpdate.current = true;
      const selection = view.state.selection;
      const transaction = view.state.update({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
        selection:
          selection.main.to <= value.length ? selection : undefined,
      });
      view.dispatch(transaction);
      lastValueRef.current = value;
      isInternalUpdate.current = false;
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`live-preview-editor ${className}`}
    />
  );
}

export const LivePreviewEditor = forwardRef(LivePreviewEditorInner);

export default memo(LivePreviewEditor);
