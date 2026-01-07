// 编辑器切换器 - 基于 Vditor，支持三种编辑模式切换
// 使用单个 Vditor 实例，通过重新初始化切换模式
import {
  forwardRef,
  useState,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { Code, Eye, Columns, ChevronDown, Check } from "lucide-react";
import { Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { Button } from "@/components/ui/button";
import type { BaseEditorProps, EditorRef, VditorMode } from "./types";
import {
  EDITOR_LABELS,
  EDITOR_DESCRIPTIONS,
  getEditorPreference,
  setEditorPreference,
} from "./types";
import { VditorEditor } from "./VditorEditor";

// 编辑器图标
const EDITOR_ICONS: Record<VditorMode, React.ReactNode> = {
  ir: <Eye className="h-4 w-4" />,
  wysiwyg: <Code className="h-4 w-4" />,
  sv: <Columns className="h-4 w-4" />,
};

export interface EditorSwitcherProps extends BaseEditorProps {
  // 初始编辑器类型（如果不提供则从 localStorage 读取）
  initialEditorType?: VditorMode;
  // 编辑器切换回调
  onEditorTypeChange?: (type: VditorMode) => void;
  // 是否显示切换按钮
  showSwitcher?: boolean;
  // 编辑器实例 key（用于强制重新渲染）
  editorKey?: number;
  // 是否显示行号（Vditor 暂不支持，保留接口兼容）
  showLineNumbers?: boolean;
}

export interface EditorSwitcherRef extends EditorRef {
  // 获取当前编辑器类型
  getEditorType: () => VditorMode;
  // 切换编辑器类型
  switchEditorType: (type: VditorMode) => void;
  // 滚动到指定行号（1-based）
  scrollToLine: (line: number) => void;
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
  // 当前活动的编辑器模式
  const [editorMode, setEditorMode] = useState<VditorMode>(
    () => initialEditorType ?? getEditorPreference()
  );

  // 编辑器 ref
  const editorRef = useRef<EditorRef>(null);

  // 用于追踪内容，在模式切换时保持
  const contentRef = useRef<string>(editorProps.value);

  // 强制刷新 key（用于模式切换时重新初始化编辑器）
  const [refreshKey, setRefreshKey] = useState(0);

  // 处理编辑器模式切换
  const handleEditorModeChange = useCallback(
    (mode: VditorMode) => {
      if (mode === editorMode) return;

      // 获取当前编辑器内容
      const currentContent = editorRef.current?.getContent?.() ?? contentRef.current;
      contentRef.current = currentContent;

      // 保存偏好设置
      setEditorPreference(mode);
      onEditorTypeChange?.(mode);

      // 更新模式并刷新编辑器
      setEditorMode(mode);
      setRefreshKey((prev) => prev + 1);

      // 如果内容有变化，通知父组件
      if (currentContent !== editorProps.value) {
        editorProps.onChange?.(currentContent);
      }
    },
    [editorMode, editorProps, onEditorTypeChange]
  );

  // 处理内容变化
  const handleContentChange = useCallback(
    (content: string) => {
      contentRef.current = content;
      editorProps.onChange?.(content);
    },
    [editorProps]
  );

  // 暴露方法给父组件
  useImperativeHandle(
    ref,
    () => ({
      setContent: (markdown: string): boolean => {
        contentRef.current = markdown;
        return editorRef.current?.setContent(markdown) ?? false;
      },
      getContent: (): string => {
        return editorRef.current?.getContent?.() ?? contentRef.current;
      },
      focus: () => {
        editorRef.current?.focus?.();
      },
      scrollToLine: (line: number) => {
        editorRef.current?.scrollToLine?.(line);
      },
      getEditorType: () => editorMode,
      switchEditorType: handleEditorModeChange,
    }),
    [editorMode, handleEditorModeChange]
  );

  // 构建 antd Dropdown 菜单项
  const dropdownItems: MenuProps["items"] = (
    Object.keys(EDITOR_LABELS) as VditorMode[]
  ).map((mode) => ({
    key: mode,
    label: (
      <div className="flex items-center gap-3 py-1">
        <span className="shrink-0">{EDITOR_ICONS[mode]}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium">{EDITOR_LABELS[mode]}</div>
          <div className="text-xs text-muted-foreground truncate">
            {EDITOR_DESCRIPTIONS[mode]}
          </div>
        </div>
        {mode === editorMode && (
          <Check className="h-4 w-4 shrink-0 text-primary" />
        )}
      </div>
    ),
    onClick: () => handleEditorModeChange(mode),
  }));

  // 计算最终的 editor key
  const finalEditorKey = (editorKey ?? 0) + refreshKey;

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
                {EDITOR_ICONS[editorMode]}
                <span className="text-xs hidden sm:inline">
                  {EDITOR_LABELS[editorMode]}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </Dropdown>
          </Tooltip>
        </div>
      )}

      {/* Vditor 编辑器 */}
      <VditorEditor
        key={`vditor-${finalEditorKey}`}
        ref={editorRef}
        value={contentRef.current || editorProps.value}
        onChange={handleContentChange}
        placeholder={editorProps.placeholder}
        readonly={editorProps.readonly}
        className={editorProps.className}
        articleId={editorProps.articleId}
        mode={editorMode}
        onModeChange={handleEditorModeChange}
      />
    </div>
  );
}

export const EditorSwitcher = forwardRef(EditorSwitcherInner);

export default EditorSwitcher;
