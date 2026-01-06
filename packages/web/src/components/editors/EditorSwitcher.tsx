// 编辑器切换器 - 同时保留两个编辑器实例，通过 CSS 切换可见性
// 使用 CodeMirror 实现两种模式：实时预览（Live Preview）和源码模式
import {
  forwardRef,
  lazy,
  Suspense,
  useState,
  useCallback,
  useImperativeHandle,
  useRef,
  useEffect,
} from "react";
import { Code, Eye, ChevronDown, Check } from "lucide-react";
import { Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { Button } from "@/components/ui/button";
import type { BaseEditorProps, EditorRef, EditorType } from "./types";
import {
  EDITOR_LABELS,
  EDITOR_DESCRIPTIONS,
  getEditorPreference,
  setEditorPreference,
} from "./types";

// 懒加载编辑器组件
const LivePreviewEditor = lazy(() => import("./LivePreviewEditor"));
const CodeMirrorEditor = lazy(() => import("./CodeMirrorEditor"));

// 编辑器加载中占位组件
function EditorLoading() {
  return (
    <div className="min-h-[400px] space-y-4 animate-pulse">
      <div className="h-6 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
      <div className="h-4 bg-muted rounded w-4/5" />
      <div className="h-20 bg-muted rounded w-full mt-4" />
      <div className="h-4 bg-muted rounded w-2/3" />
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-1/2" />
    </div>
  );
}

// 轻量加载占位（用于非活动编辑器的延迟加载）
function EditorLoadingLight() {
  return <div className="min-h-[300px]" />;
}

// 编辑器图标
const EDITOR_ICONS: Record<EditorType, React.ReactNode> = {
  livepreview: <Eye className="h-4 w-4" />,
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
  // 是否显示行号
  showLineNumbers?: boolean;
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
    showLineNumbers = false,
    ...editorProps
  }: EditorSwitcherProps,
  ref: React.ForwardedRef<EditorSwitcherRef>
) {
  // 当前活动的编辑器类型
  const [editorType, setEditorType] = useState<EditorType>(
    () => initialEditorType ?? getEditorPreference()
  );

  // 追踪哪些编辑器已经被初始化过（用于延迟加载非活动编辑器）
  const [initializedEditors, setInitializedEditors] = useState<
    Set<EditorType>
  >(() => new Set([initialEditorType ?? getEditorPreference()]));

  // 空闲时预加载另一个编辑器
  useEffect(() => {
    const preloadOtherEditor = () => {
      if (editorType === "livepreview") {
        import("./CodeMirrorEditor");
      } else {
        import("./LivePreviewEditor");
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      const idleId = requestIdleCallback(preloadOtherEditor, {
        timeout: 3000,
      });
      return () => cancelIdleCallback(idleId);
    } else {
      const timerId = setTimeout(preloadOtherEditor, 2000);
      return () => clearTimeout(timerId);
    }
  }, [editorType]);

  // 两个编辑器的 ref
  const livepreviewRef = useRef<EditorRef>(null);
  const codemirrorRef = useRef<EditorRef>(null);

  // 用于追踪是否正在同步内容
  const isSyncingRef = useRef(false);

  // 获取当前活动编辑器的 ref
  const getActiveEditorRef = useCallback(() => {
    return editorType === "livepreview" ? livepreviewRef : codemirrorRef;
  }, [editorType]);

  // 处理编辑器切换
  const handleEditorTypeChange = useCallback(
    (type: EditorType) => {
      if (type === editorType) return;

      // 获取当前编辑器内容
      const currentRef = getActiveEditorRef();
      const currentContent =
        currentRef.current?.getContent?.() ?? editorProps.value;

      // 保存偏好设置
      setEditorPreference(type);
      onEditorTypeChange?.(type);

      // 如果目标编辑器还未初始化，先标记为需要初始化
      if (!initializedEditors.has(type)) {
        setInitializedEditors((prev) => new Set(prev).add(type));
      }

      // 同步内容到目标编辑器
      const syncContent = (retryCount = 0) => {
        const targetRef =
          type === "livepreview" ? livepreviewRef : codemirrorRef;
        if (targetRef.current) {
          isSyncingRef.current = true;
          const success = targetRef.current.setContent(currentContent);
          isSyncingRef.current = false;

          if (!success && retryCount < 10) {
            setTimeout(() => syncContent(retryCount + 1), 100);
          }
        } else if (retryCount < 10) {
          setTimeout(() => syncContent(retryCount + 1), 100);
        }
      };

      requestAnimationFrame(() => syncContent(0));

      if (currentContent !== editorProps.value) {
        editorProps.onChange?.(currentContent);
      }

      setEditorType(type);
    },
    [
      editorType,
      editorProps,
      onEditorTypeChange,
      getActiveEditorRef,
      initializedEditors,
    ]
  );

  // 当 editorKey 变化时同步内容
  useEffect(() => {
    const activeRef = getActiveEditorRef();
    if (activeRef.current) {
      isSyncingRef.current = true;
      activeRef.current.setContent(editorProps.value);
      isSyncingRef.current = false;
    }
  }, [editorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 暴露方法给父组件
  useImperativeHandle(
    ref,
    () => ({
      setContent: (markdown: string): boolean => {
        const activeRef = getActiveEditorRef();
        return activeRef.current?.setContent(markdown) ?? false;
      },
      getContent: (): string => {
        const activeRef = getActiveEditorRef();
        return activeRef.current?.getContent?.() ?? editorProps.value;
      },
      focus: () => {
        const activeRef = getActiveEditorRef();
        activeRef.current?.focus?.();
      },
      getEditorType: () => editorType,
      switchEditorType: handleEditorTypeChange,
    }),
    [editorType, editorProps.value, handleEditorTypeChange, getActiveEditorRef]
  );

  // 处理内容变化
  const handleLivePreviewChange = useCallback(
    (content: string) => {
      if (editorType === "livepreview" && !isSyncingRef.current) {
        editorProps.onChange?.(content);
      }
    },
    [editorType, editorProps]
  );

  const handleCodemirrorChange = useCallback(
    (content: string) => {
      if (editorType === "codemirror" && !isSyncingRef.current) {
        editorProps.onChange?.(content);
      }
    },
    [editorType, editorProps]
  );

  // 构建 antd Dropdown 菜单项
  const dropdownItems: MenuProps["items"] = (
    Object.keys(EDITOR_LABELS) as EditorType[]
  ).map((type) => ({
    key: type,
    label: (
      <div className="flex items-center gap-3 py-1">
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
      </div>
    ),
    onClick: () => handleEditorTypeChange(type),
  }));

  return (
    <div className="editor-switcher relative">
      {/* 编辑器切换按钮 */}
      {showSwitcher && (
        <div className="absolute top-0 right-0 z-10">
          <Tooltip title="切换编辑器模式" placement="bottom">
            <Dropdown
              menu={{ items: dropdownItems }}
              trigger={["click"]}
              placement="bottomRight"
            >
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
            </Dropdown>
          </Tooltip>
        </div>
      )}

      {/* Live Preview 编辑器 */}
      <div
        style={{ display: editorType === "livepreview" ? "block" : "none" }}
      >
        {initializedEditors.has("livepreview") && (
          <Suspense fallback={<EditorLoading />}>
            <LivePreviewEditor
              key={`livepreview-${editorKey ?? 0}`}
              ref={livepreviewRef}
              {...editorProps}
              onChange={handleLivePreviewChange}
              showLineNumbers={showLineNumbers}
            />
          </Suspense>
        )}
      </div>

      {/* CodeMirror 源码编辑器 */}
      <div
        style={{ display: editorType === "codemirror" ? "block" : "none" }}
      >
        {initializedEditors.has("codemirror") && (
          <Suspense fallback={<EditorLoadingLight />}>
            <CodeMirrorEditor
              key={`codemirror-${editorKey ?? 0}`}
              ref={codemirrorRef}
              {...editorProps}
              onChange={handleCodemirrorChange}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export const EditorSwitcher = forwardRef(EditorSwitcherInner);

export default EditorSwitcher;
