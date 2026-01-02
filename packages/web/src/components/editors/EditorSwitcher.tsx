// 编辑器切换器 - 支持多编辑器懒加载切换
import {
  forwardRef,
  lazy,
  Suspense,
  useState,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { Code, FileText, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BaseEditorProps, EditorRef, EditorType } from "./types";
import {
  EDITOR_LABELS,
  EDITOR_DESCRIPTIONS,
  getEditorPreference,
  setEditorPreference,
} from "./types";

// 懒加载编辑器组件
const MilkdownEditorWrapper = lazy(() => import("./MilkdownEditorWrapper"));
const CodeMirrorEditor = lazy(() => import("./CodeMirrorEditor"));

// 编辑器加载中占位组件
function EditorLoading() {
  return (
    <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">加载编辑器中...</span>
      </div>
    </div>
  );
}

// 编辑器图标
const EDITOR_ICONS: Record<EditorType, React.ReactNode> = {
  milkdown: <FileText className="h-4 w-4" />,
  codemirror: <Code className="h-4 w-4" />,
};

export interface EditorSwitcherProps extends BaseEditorProps {
  // 初始编辑器类型（如果不提供则从 localStorage 读取）
  initialEditorType?: EditorType;
  // 编辑器切换回调
  onEditorTypeChange?: (type: EditorType) => void;
  // 是否显示切换按钮
  showSwitcher?: boolean;
  // 编辑器实例 key（用于强制重新渲染）
  editorKey?: number;
}

export interface EditorSwitcherRef extends EditorRef {
  // 获取当前编辑器类型
  getEditorType: () => EditorType;
  // 切换编辑器类型
  switchEditorType: (type: EditorType) => void;
}

function EditorSwitcherInner(
  {
    initialEditorType,
    onEditorTypeChange,
    showSwitcher = true,
    editorKey,
    ...editorProps
  }: EditorSwitcherProps,
  ref: React.ForwardedRef<EditorSwitcherRef>
) {
  // 编辑器类型状态
  const [editorType, setEditorType] = useState<EditorType>(
    () => initialEditorType ?? getEditorPreference()
  );

  // 内部编辑器 ref
  const editorRef = useRef<EditorRef>(null);

  // 处理编辑器切换
  const handleEditorTypeChange = useCallback(
    (type: EditorType) => {
      if (type === editorType) return;

      // 保存当前内容
      const currentContent = editorRef.current?.getContent?.() ?? editorProps.value;

      // 更新状态
      setEditorType(type);
      setEditorPreference(type);
      onEditorTypeChange?.(type);

      // 如果当前内容与 props.value 不同，触发 onChange 以同步
      if (currentContent !== editorProps.value) {
        editorProps.onChange?.(currentContent);
      }
    },
    [editorType, editorProps, onEditorTypeChange]
  );

  // 暴露方法给父组件
  useImperativeHandle(
    ref,
    () => ({
      setContent: (markdown: string): boolean => {
        return editorRef.current?.setContent(markdown) ?? false;
      },
      getContent: (): string => {
        return editorRef.current?.getContent?.() ?? editorProps.value;
      },
      focus: () => {
        editorRef.current?.focus?.();
      },
      getEditorType: () => editorType,
      switchEditorType: handleEditorTypeChange,
    }),
    [editorType, editorProps.value, handleEditorTypeChange]
  );

  // 渲染对应的编辑器
  const renderEditor = () => {
    const key = `${editorType}-${editorKey ?? 0}`;

    switch (editorType) {
      case "codemirror":
        return (
          <CodeMirrorEditor
            key={key}
            ref={editorRef}
            {...editorProps}
          />
        );
      case "milkdown":
      default:
        return (
          <MilkdownEditorWrapper
            key={key}
            ref={editorRef}
            {...editorProps}
          />
        );
    }
  };

  return (
    <div className="editor-switcher relative">
      {/* 编辑器切换按钮 */}
      {showSwitcher && (
        <div className="absolute top-0 right-0 z-10">
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      {EDITOR_ICONS[editorType]}
                      <span className="text-xs hidden sm:inline">
                        {EDITOR_LABELS[editorType]}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  切换编辑器模式
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-56">
              {(Object.keys(EDITOR_LABELS) as EditorType[]).map((type) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => handleEditorTypeChange(type)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <span className="shrink-0">{EDITOR_ICONS[type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{EDITOR_LABELS[type]}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {EDITOR_DESCRIPTIONS[type]}
                    </div>
                  </div>
                  {type === editorType && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* 编辑器内容 */}
      <Suspense fallback={<EditorLoading />}>
        {renderEditor()}
      </Suspense>
    </div>
  );
}

// 使用 forwardRef 暴露方法
export const EditorSwitcher = forwardRef(EditorSwitcherInner);

export default EditorSwitcher;
