// CodeMirror Markdown 源码编辑器
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExt, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { getServerBaseUrlSync } from "../../utils/serverConfig";
import type { BaseEditorProps, EditorRef } from "./types";

export interface CodeMirrorEditorProps extends BaseEditorProps {}

// 将相对路径转换为完整 URL
function toAbsoluteImageUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://") || relativeUrl.startsWith("data:")) {
    return relativeUrl;
  }
  const apiBaseUrl = getServerBaseUrlSync();
  if (!apiBaseUrl) {
    return relativeUrl;
  }
  return `${apiBaseUrl}${relativeUrl}`;
}

// 上传图片到服务器，返回完整 URL
async function uploadImageToServer(file: File, articleId: number): Promise<string> {
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
  // 返回完整 URL，便于在编辑器中预览
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
function getImageFromClipboardItems(items: DataTransferItemList): File | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

// CodeMirror 主题 - 适配当前项目的暗色/亮色模式
const editorTheme = EditorView.theme({
  "&": {
    fontSize: "15px",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    padding: "16px 0",
    minHeight: "calc(100vh - 200px)",
    caretColor: "auto",
  },
  ".cm-line": {
    padding: "0 16px",
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
    backgroundColor: "hsl(var(--muted) / 0.5)",
  },
  // 选中文字背景 - 使用更明显的颜色
  "& .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "rgba(100, 150, 255, 0.3) !important",
  },
  "&.cm-focused .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "rgba(100, 150, 255, 0.4) !important",
  },
  // 备用选择样式
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
  // Markdown 语法高亮
  ".cm-header": {
    color: "hsl(var(--primary))",
    fontWeight: "bold",
  },
  ".cm-header-1": { fontSize: "1.5em" },
  ".cm-header-2": { fontSize: "1.3em" },
  ".cm-header-3": { fontSize: "1.1em" },
  ".cm-strong": {
    fontWeight: "bold",
  },
  ".cm-emphasis": {
    fontStyle: "italic",
  },
  ".cm-strikethrough": {
    textDecoration: "line-through",
  },
  ".cm-link": {
    color: "hsl(var(--primary))",
    textDecoration: "underline",
  },
  ".cm-url": {
    color: "hsl(var(--muted-foreground))",
  },
  ".cm-code": {
    backgroundColor: "hsl(var(--muted))",
    borderRadius: "3px",
    padding: "1px 4px",
  },
  ".cm-foldGutter": {
    width: "16px",
  },
  // 代码块
  ".cm-monospace": {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
});

// 只读主题扩展
const readonlyTheme = EditorView.theme({
  ".cm-content": {
    cursor: "default",
  },
});

function CodeMirrorEditorInner(
  {
    value,
    onChange,
    placeholder = "开始写作...",
    readonly = false,
    className = "",
    articleId,
  }: CodeMirrorEditorProps,
  ref: React.ForwardedRef<EditorRef>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastValueRef = useRef(value);
  const isInternalUpdate = useRef(false);
  
  // 使用 ref 存储回调函数和 props，避免依赖变化导致编辑器重建
  const onChangeRef = useRef(onChange);
  const articleIdRef = useRef(articleId);
  
  // 更新 ref（不会触发重新渲染）
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
          console.error("[CodeMirrorEditor] setContent 失败:", error);
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

  // 初始化编辑器 - 只在 readonly 和 placeholder 变化时重建
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 清空容器
    container.innerHTML = "";

    // 更新监听器 - 使用 ref 访问最新的 onChange
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
      // 基础功能
      lineNumbers(),
      highlightActiveLineGutter(),
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
        ...defaultKeymap as readonly any[],
        ...historyKeymap as readonly any[],
        ...searchKeymap as readonly any[],
        indentWithTab as any,
      ]),
      
      // 占位符
      placeholderExt(placeholder),
      
      // 主题
      editorTheme,
      
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

    // 图片上传处理函数
    const handleImageUpload = async (file: File) => {
      const currentArticleId = articleIdRef.current;
      if (!currentArticleId) {
        console.warn("[CodeMirrorEditor] 未提供 articleId，无法上传图片");
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
        const newContent = content.replace(placeholderText, `![${file.name}](${url})`);
        
        isInternalUpdate.current = true;
        currentView.dispatch({
          changes: { from: 0, to: currentView.state.doc.length, insert: newContent },
        });
        lastValueRef.current = newContent;
        isInternalUpdate.current = false;
        onChangeRef.current?.(newContent);
      } catch (error) {
        console.error("[CodeMirrorEditor] 图片上传失败:", error);
        
        // 移除占位符
        const content = currentView.state.doc.toString();
        const newContent = content.replace(placeholderText, "");
        
        isInternalUpdate.current = true;
        currentView.dispatch({
          changes: { from: 0, to: currentView.state.doc.length, insert: newContent },
        });
        lastValueRef.current = newContent;
        isInternalUpdate.current = false;
        onChangeRef.current?.(newContent);
      }
    };

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
  }, [readonly, placeholder]); // eslint-disable-line react-hooks/exhaustive-deps

  // 当外部 value 变化时，同步到编辑器
  // 注意：为了避免自动保存时丢失聚焦和选区，只有当内容确实不同时才更新
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    // 只有当外部值与当前编辑器内容不同，且不是我们内部更新导致的变化时，才同步
    // 同时检查编辑器是否有焦点，如果有焦点则不更新（避免打断用户输入）
    if (value !== currentValue && value !== lastValueRef.current) {
      // 如果编辑器有焦点，跳过更新以避免打断用户
      if (view.hasFocus) {
        // 只更新 ref，不更新编辑器内容
        lastValueRef.current = currentValue;
        return;
      }
      
      isInternalUpdate.current = true;
      // 保存当前选区
      const selection = view.state.selection;
      const transaction = view.state.update({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
        // 尝试保持选区（如果新内容长度允许的话）
        selection: selection.main.to <= value.length ? selection : undefined,
      });
      view.dispatch(transaction);
      lastValueRef.current = value;
      isInternalUpdate.current = false;
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`codemirror-editor ${className}`}
    />
  );
}

// 使用 forwardRef 暴露方法
export const CodeMirrorEditor = forwardRef(CodeMirrorEditorInner);

// 使用 memo 包装，避免不必要的重新渲染
export default memo(CodeMirrorEditor);
