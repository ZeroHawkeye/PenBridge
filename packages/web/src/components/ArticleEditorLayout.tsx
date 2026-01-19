import { ReactNode, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  Settings2,
  Maximize2,
  Type,
  List,
  Hash,
  FileText,
  PanelRightClose,
  PanelRight,
  Bot,
  Search,
  MoreHorizontal,
} from "lucide-react";
import { SyncConflictBanner } from "@/components/SyncConflictBanner";
import { useSyncConflict } from "@/hooks/use-sync-conflict";
import { Drawer } from "antd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EditorSwitcher, EDITOR_ICONS, EDITOR_LABELS, EDITOR_DESCRIPTIONS, type EditorSwitcherRef, type VditorMode } from "@/components/editors";
import { Dropdown, Tooltip as AntTooltip } from "antd";
import { ChevronDown, Check } from "lucide-react";
import { isLineNumbersEnabled } from "@/components/settings/EditorSettings";
import { TableOfContents, HeadingItem } from "@/components/TableOfContents";
import { EditorSearchBox } from "@/components/EditorSearchBox";
import { EditorSkeleton } from "@/components/EditorSkeleton";
import { SettingItem } from "@/components/SettingItem";
import { countWords, formatWordCountDetail } from "@/utils/wordCount";
import { AIChatPanel } from "@/components/ai-chat/AIChatPanel";
import { useIsMobile } from "@/hooks/use-mobile";

// 编辑器宽度设置
const WIDTH_STORAGE_KEY = "editor-fullwidth-preference";
const SMALL_FONT_KEY = "editor-small-font-preference";
const SHOW_TOC_KEY = "editor-show-toc-preference";
const AUTO_HEADING_NUMBER_KEY = "editor-auto-heading-number-preference";
const TOC_WIDTH_KEY = "editor-toc-width-preference";
const STANDARD_WIDTH = "768px";
const FULL_WIDTH = "85%";

// 目录宽度限制
const TOC_MIN_WIDTH = 150;
const TOC_MAX_WIDTH = 400;
const TOC_DEFAULT_WIDTH = 200;

// AI 面板设置
const AI_PANEL_WIDTH_KEY = "editor-ai-panel-width-preference";
const AI_PANEL_OPEN_KEY = "editor-ai-panel-open-preference";
const AI_PANEL_DEFAULT_WIDTH = 400;

export interface ArticleEditorLayoutProps {
  // 文章数据
  title: string;
  content: string;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;

  // 面包屑配置
  breadcrumbLabel: string;

  // 状态相关
  isPublished?: boolean;
  statusIndicator?: ReactNode;

  // 内容加载状态（用于显示骨架屏）
  isContentLoading?: boolean;

  // 操作按钮区域（保存、发布等）
  actionButtons: ReactNode;

  // 设置弹窗额外内容（可以是 ReactNode，或接收 onClose 回调的渲染函数）
  settingsContent?: ReactNode | ((props: { onClose: () => void }) => ReactNode);

  // 可选：标题输入框 ref（用于新建后聚焦）
  titleInputRef?: React.RefObject<HTMLInputElement | null>;

  // 可选：编辑器 key（用于强制重新渲染）
  editorKey?: number;

  // 可选：文章 ID（用于图片上传和冲突检测）
  articleId?: number;

  // 可选：使用云端版本后重新加载内容的回调
  onContentReload?: () => void;
}

export function ArticleEditorLayout({
  title,
  content,
  onTitleChange,
  onContentChange,
  breadcrumbLabel,
  isPublished = false,
  statusIndicator,
  isContentLoading = false,
  actionButtons,
  settingsContent,
  titleInputRef: externalTitleInputRef,
  editorKey,
  articleId,
  onContentReload,
}: ArticleEditorLayoutProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const {
    hasConflict,
    remoteUpdatedAt,
    isResolving,
    dismissConflict,
    useLocalVersion,
    useRemoteVersion,
  } = useSyncConflict(articleId);

  const handleUseRemoteVersion = useCallback(async () => {
    const success = await useRemoteVersion();
    if (success && onContentReload) {
      onContentReload();
    }
  }, [useRemoteVersion, onContentReload]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [mobileAIOpen, setMobileAIOpen] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(() => {
    const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
    return saved === "true";
  });
  const [isSmallFont, setIsSmallFont] = useState(() => {
    const saved = localStorage.getItem(SMALL_FONT_KEY);
    return saved === "true";
  });
  const [showToc, setShowToc] = useState(() => {
    const saved = localStorage.getItem(SHOW_TOC_KEY);
    return saved === "true";
  });
  const [autoHeadingNumber, setAutoHeadingNumber] = useState(() => {
    const saved = localStorage.getItem(AUTO_HEADING_NUMBER_KEY);
    return saved === "true";
  });
  
  // 目录侧边栏宽度
  const [tocWidth, setTocWidth] = useState(() => {
    const saved = localStorage.getItem(TOC_WIDTH_KEY);
    const width = saved ? parseInt(saved, 10) : TOC_DEFAULT_WIDTH;
    return Math.max(TOC_MIN_WIDTH, Math.min(TOC_MAX_WIDTH, width));
  });
  
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  
  // AI 聊天面板状态
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(() => {
    const saved = localStorage.getItem(AI_PANEL_OPEN_KEY);
    return saved === "true";
  });
  const [aiPanelWidth, setAIPanelWidth] = useState(() => {
    const saved = localStorage.getItem(AI_PANEL_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : AI_PANEL_DEFAULT_WIDTH;
  });
  
  // 搜索框状态
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [initialSearchText, setInitialSearchText] = useState("");
  
  // 行号显示状态（从设置中读取）
  const [showLineNumbers] = useState(() => isLineNumbersEnabled());
  
  // 编辑器模式状态（从偏好设置初始化）
  const [editorMode, setEditorMode] = useState<VditorMode>(() => {
    const saved = localStorage.getItem("editor-type-preference");
    if (saved === "ir" || saved === "wysiwyg" || saved === "sv") {
      return saved;
    }
    return "ir";
  });
  
  // 处理编辑器模式切换
  const handleEditorModeChange = useCallback((mode: VditorMode) => {
    setEditorMode(mode);
    // 通过 ref 调用 EditorSwitcher 的切换方法
    milkdownEditorRef.current?.switchEditorType(mode);
  }, []);

  // 内部 ref，如果外部没有提供
  const internalTitleInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = externalTitleInputRef || internalTitleInputRef;
  
  // 编辑器容器 ref，用于滚动到标题位置
  const editorContainerRef = useRef<HTMLDivElement>(null);
  
  // 编辑器实例 ref，用于直接更新内容而不重建编辑器
  const milkdownEditorRef = useRef<EditorSwitcherRef>(null);

  // 处理标题点击，滚动到对应位置
  const handleHeadingClick = useCallback((heading: HeadingItem) => {
    // 从 content 中解析所有标题，找到目标标题的行号（1-based）
    const lines = content.split("\n");
    let targetLineNumber = -1;
    const idCountMap = new Map<string, number>();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,5})\s+(.+)$/);
      if (match) {
        const text = match[2].trim();
        const baseId = text
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
          .replace(/^-|-$/g, "");
        
        const count = idCountMap.get(baseId) || 0;
        idCountMap.set(baseId, count + 1);
        const id = count > 0 ? `${baseId}-${count}` : baseId;
        
        // 通过 id 精确匹配
        if (id === heading.id) {
          targetLineNumber = i + 1; // 转换为 1-based 行号
          break;
        }
      }
    }

    if (targetLineNumber === -1) return;

    // 使用编辑器的 scrollToLine 方法滚动到目标行
    const editor = milkdownEditorRef.current;
    if (editor?.scrollToLine) {
      editor.scrollToLine(targetLineNumber);
      // Vditor 编辑器的 scrollToLine 内部已经处理了高亮效果
    }
  }, [content]);

  // 保存偏好到 localStorage
  useEffect(() => {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(isFullWidth));
  }, [isFullWidth]);

  useEffect(() => {
    localStorage.setItem(SMALL_FONT_KEY, String(isSmallFont));
  }, [isSmallFont]);

  useEffect(() => {
    localStorage.setItem(SHOW_TOC_KEY, String(showToc));
  }, [showToc]);

  useEffect(() => {
    localStorage.setItem(AUTO_HEADING_NUMBER_KEY, String(autoHeadingNumber));
  }, [autoHeadingNumber]);

  useEffect(() => {
    localStorage.setItem(TOC_WIDTH_KEY, String(tocWidth));
  }, [tocWidth]);
  
  // 保存 AI 面板状态
  useEffect(() => {
    localStorage.setItem(AI_PANEL_OPEN_KEY, String(isAIPanelOpen));
  }, [isAIPanelOpen]);
  
  useEffect(() => {
    localStorage.setItem(AI_PANEL_WIDTH_KEY, String(aiPanelWidth));
  }, [aiPanelWidth]);
  
  // Ctrl+F 搜索快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F 或 Cmd+F 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        // 获取当前选中的文本
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() || "";
        setInitialSearchText(selectedText);
        setIsSearchOpen(true);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  
  // 关闭搜索框
  const handleSearchClose = useCallback(() => {
    setIsSearchOpen(false);
    setInitialSearchText(""); // 清空初始搜索文本
  }, []);
  
  // 编辑器刷新回调（用于 AI 修改内容后强制刷新编辑器）
  const [refreshKey, setRefreshKey] = useState(0);
  // 保存滚动位置，用于刷新编辑器后恢复
  const savedScrollTopRef = useRef<number | null>(null);
  
  const handleEditorRefresh = useCallback(() => {
    // 刷新前保存滚动位置
    const container = editorContainerRef.current;
    if (container) {
      savedScrollTopRef.current = container.scrollTop;
    }
    setRefreshKey(prev => prev + 1);
  }, []);
  
  // 当 refreshKey 变化后恢复滚动位置
  useEffect(() => {
    if (savedScrollTopRef.current !== null) {
      const container = editorContainerRef.current;
      if (!container) return;
      
      const scrollTop = savedScrollTopRef.current;
      savedScrollTopRef.current = null;
      
      // Vditor 编辑器初始化是异步的
      // 因此需要监听 DOM 变化，等待编辑器完全渲染后再恢复滚动
      const observer = new MutationObserver((_mutations, obs) => {
        // 检查 Vditor 编辑器是否已渲染（查找编辑器特有的元素）
        const editor = container.querySelector('.vditor');
        if (editor) {
          obs.disconnect();
          requestAnimationFrame(() => {
            container.scrollTop = scrollTop;
          });
        }
      });
      
      observer.observe(container, { childList: true, subtree: true });
      
      // 超时保护：500ms 后仍未检测到编辑器，强制恢复滚动
      const timeout = setTimeout(() => {
        observer.disconnect();
        container.scrollTop = scrollTop;
      }, 500);
      
      return () => {
        observer.disconnect();
        clearTimeout(timeout);
      };
    }
  }, [refreshKey]);
  
  // 合并外部 editorKey 和内部 refreshKey
  const finalEditorKey = (editorKey ?? 0) + refreshKey;
  
  // 直接设置编辑器内容的方法（不重建编辑器，保持滚动位置）
  const setEditorContent = useCallback((markdown: string): boolean => {
    const editor = milkdownEditorRef.current;
    if (editor) {
      const success = editor.setContent(markdown);
      if (success) {
        // 同步状态到父组件
        onContentChange(markdown);
        return true;
      }
    }
    // 如果 setContent 失败，回退到重建编辑器的方式
    onContentChange(markdown);
    handleEditorRefresh();
    return false;
  }, [onContentChange, handleEditorRefresh]);
  
  // AI 工具上下文
  const toolContext = useMemo(() => ({
    title,
    content,
    articleId,
    onTitleChange,
    onContentChange,
    onEditorRefresh: handleEditorRefresh,
    setEditorContent,  // 新增：直接设置编辑器内容
  }), [title, content, articleId, onTitleChange, onContentChange, handleEditorRefresh, setEditorContent]);

  // AI 面板文章上下文 - 避免每次渲染创建新对象
  const articleContext = useMemo(() => 
    articleId ? {
      articleId,
      title,
      content,
      contentLength: content.length,
    } : undefined
  , [articleId, title, content]);

  // AI 面板关闭回调 - 避免每次渲染创建新函数
  const handleCloseAIPanel = useCallback(() => {
    setIsAIPanelOpen(false);
  }, []);

  // 拖拽调整目录宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 计算新宽度：从窗口右边缘到鼠标位置的距离
      const newWidth = window.innerWidth - e.clientX;
      setTocWidth(Math.max(TOC_MIN_WIDTH, Math.min(TOC_MAX_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // 计算字数统计
  const wordCount = useMemo(() => {
    // 统计标题和内容
    const fullText = title + "\n\n" + content;
    return countWords(fullText);
  }, [title, content]);

  // 总字数（中文字符 + 英文单词）
  const totalWords = wordCount.chineseCharacters + wordCount.englishWords;

  // 计算右侧边栏总宽度（用于字数统计定位）
  const getRightSidebarWidth = useCallback(() => {
    let width = 0;
    if (showToc) width += tocWidth;
    if (isAIPanelOpen) width += aiPanelWidth;
    return width;
  }, [showToc, tocWidth, isAIPanelOpen, aiPanelWidth]);

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* 顶部工具栏 - 简洁风格 */}
      <div className="flex items-center justify-between px-2 md:px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="flex items-center gap-1 md:gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate({ to: "/articles" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center text-sm text-muted-foreground min-w-0">
            <span className="hidden md:inline">文章</span>
            <ChevronRight className="h-3 w-3 mx-1 hidden md:inline" />
            <span className="text-foreground truncate max-w-[100px] md:max-w-[200px]">
              {breadcrumbLabel}
            </span>
          </div>
          {isPublished && !isMobile && (
            <Badge variant="default" className="ml-1 md:ml-2 shrink-0">
              已发布
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          {/* 状态指示器（如保存状态） */}
          <span className="hidden md:inline-flex">{statusIndicator}</span>

          {/* 操作按钮区域 */}
          {actionButtons}

          {/* 移动端：更多操作菜单 */}
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsSearchOpen(!isSearchOpen)}>
                  <Search className="h-4 w-4 mr-2" />
                  搜索
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMobileTocOpen(true)}>
                  <List className="h-4 w-4 mr-2" />
                  目录
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMobileAIOpen(true)}>
                  <Bot className="h-4 w-4 mr-2" />
                  AI 助手
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  设置
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {/* 桌面端：搜索按钮 */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isSearchOpen ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsSearchOpen(!isSearchOpen)}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    搜索 (Ctrl+F)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* 桌面端：AI 助手按钮 */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isAIPanelOpen ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
                    >
                      <Bot className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isAIPanelOpen ? "关闭 AI 助手" : "打开 AI 助手"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* 桌面端：设置按钮 */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 冲突警告条 */}
      {hasConflict && (
        <SyncConflictBanner
          remoteUpdatedAt={remoteUpdatedAt}
          isResolving={isResolving}
          onUseLocal={useLocalVersion}
          onUseRemote={handleUseRemoteVersion}
          onDismiss={dismissConflict}
        />
      )}
      
      {/* 设置抽屉 - 放在最外层，使用 antd Drawer 避免 Portal 影响编辑器 */}
      <Drawer
        title="页面设置"
        placement="right"
        width={300}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        className="settings-drawer"
        mask={true}
        maskClosable={true}
        maskStyle={{ backgroundColor: 'transparent' }}
        styles={{
          header: { padding: '12px 16px', borderBottom: '1px solid var(--border)' },
          body: { padding: 0 },
        }}
        getContainer={false}
      >
        <ScrollArea className="h-full">
          <div className="px-4 py-3 space-y-1">
            {/* 自适应宽度 */}
            <SettingItem
              icon={<Maximize2 className="h-4 w-4" />}
              label="自适应宽度"
              action={
                <Switch
                  checked={isFullWidth}
                  onCheckedChange={setIsFullWidth}
                  className="scale-90"
                />
              }
            />

            {/* 小字体 */}
            <SettingItem
              icon={<Type className="h-4 w-4" />}
              label="小字体"
              action={
                <Switch
                  checked={isSmallFont}
                  onCheckedChange={setIsSmallFont}
                  className="scale-90"
                />
              }
            />

            {/* 标题目录 */}
            <SettingItem
              icon={<List className="h-4 w-4" />}
              label="标题目录"
              action={
                <Switch
                  checked={showToc}
                  onCheckedChange={setShowToc}
                  className="scale-90"
                />
              }
            />

            {/* 标题自动编号 */}
            <SettingItem
              icon={<Hash className="h-4 w-4" />}
              label="标题自动编号"
              action={
                <Switch
                  checked={autoHeadingNumber}
                  onCheckedChange={setAutoHeadingNumber}
                  className="scale-90"
                />
              }
            />

            {/* 分隔线 */}
            <div className="my-2 border-t" />

            {/* 额外设置内容（如导入 Word） */}
            {typeof settingsContent === 'function' 
              ? settingsContent({ onClose: () => setSettingsOpen(false) })
              : settingsContent}

            {/* 分隔线 */}
            <div className="my-2 border-t" />

            {/* 统计信息区域 */}
            <div className="py-2">
              <div className="flex items-center gap-3 mb-2 px-2 -mx-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">统计信息</span>
              </div>
              <div className="ml-7 space-y-1.5 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>总字数:</span>
                  <span className="text-foreground">{totalWords}</span>
                </div>
                <div className="flex justify-between">
                  <span>段落数:</span>
                  <span className="text-foreground">{wordCount.paragraphs}</span>
                </div>
                <div className="flex justify-between">
                  <span>行数:</span>
                  <span className="text-foreground">{wordCount.lines}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </Drawer>

      {/* 主编辑区域 - 全屏沉浸式 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 编辑区域 */}
        <div className="flex-1 overflow-auto relative" ref={editorContainerRef}>
          {/* 搜索框 - 定位在编辑区域右上角 */}
          <EditorSearchBox
            isOpen={isSearchOpen}
            onClose={handleSearchClose}
            containerRef={editorContainerRef}
            initialSearchText={initialSearchText}
          />
          <div
            className={`mx-auto px-6 py-8 transition-all duration-300 ${isSmallFont ? 'text-sm' : ''}`}
            style={{ maxWidth: isFullWidth ? FULL_WIDTH : STANDARD_WIDTH }}
          >
            {/* 标题输入 - Notion 风格 */}
            <input
              ref={titleInputRef}
              placeholder="无标题"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className={`w-full bg-transparent font-normal py-0 px-0 border-0 outline-none placeholder:text-muted-foreground/40 ${isSmallFont ? 'text-2xl' : ''}`}
              style={{ 
                fontSize: isSmallFont ? undefined : '30px', 
                lineHeight: '1.2', 
                fontWeight: '550' 
              }}
            />
            {/* 分隔线 + 编辑器模式切换按钮 */}
            <div className="flex items-center justify-between mt-3 mb-4">
              <div className="flex-1 h-px bg-border/40" />
              {/* 编辑器模式切换按钮 */}
              <AntTooltip title="切换编辑器模式" placement="bottom">
                <Dropdown
                  menu={{
                    items: (Object.keys(EDITOR_LABELS) as VditorMode[]).map((mode) => ({
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
                    })),
                  }}
                  trigger={["click"]}
                  placement="bottomRight"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-muted-foreground hover:text-foreground shrink-0 ml-3"
                  >
                    {EDITOR_ICONS[editorMode]}
                    <span className="text-xs">
                      {EDITOR_LABELS[editorMode]}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </Dropdown>
              </AntTooltip>
            </div>

            {/* Markdown 编辑器 / 骨架屏 */}
            {isContentLoading ? (
              <EditorSkeleton />
            ) : (
              <EditorSwitcher
                ref={milkdownEditorRef}
                editorKey={finalEditorKey}
                value={content}
                onChange={onContentChange}
                placeholder="开始写作..."
                className="min-h-[calc(100vh-200px)]"
                articleId={articleId}
                showSwitcher={false}
                showLineNumbers={showLineNumbers}
                initialEditorType={editorMode}
                onEditorTypeChange={setEditorMode}
              />
            )}
          </div>

          {/* 字数统计 - 右下角固定 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="fixed bottom-4 px-3 py-1.5 bg-muted/80 backdrop-blur-sm rounded-full text-xs text-muted-foreground cursor-default select-none shadow-sm border transition-all"
                  style={{ right: isMobile ? 16 : getRightSidebarWidth() + 20 + "px" }}
                >
                  {totalWords} 字
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="space-y-1">
                  <div>{formatWordCountDetail(wordCount)}</div>
                  <div className="text-muted-foreground">
                    {wordCount.paragraphs} 段 | {wordCount.lines} 行
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 移动端：目录抽屉 */}
        {isMobile && (
          <Sheet open={mobileTocOpen} onOpenChange={setMobileTocOpen}>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  目录
                </SheetTitle>
              </SheetHeader>
              <TableOfContents
                content={content}
                className="flex-1 overflow-hidden"
                onHeadingClick={(heading) => {
                  handleHeadingClick(heading);
                  setMobileTocOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>
        )}

        {/* 移动端：AI 助手抽屉 */}
        {isMobile && (
          <Sheet open={mobileAIOpen} onOpenChange={setMobileAIOpen}>
            <SheetContent side="right" className="w-full sm:w-96 p-0 h-full flex flex-col">
              <AIChatPanel
                isOpen={mobileAIOpen}
                onClose={() => setMobileAIOpen(false)}
                articleContext={articleContext}
                toolContext={toolContext}
                width={375}
                onWidthChange={() => {}}
                isMobile={true}
              />
            </SheetContent>
          </Sheet>
        )}

        {/* 桌面端：标题目录侧边栏 */}
        {!isMobile && showToc && (
          <div 
            className="border-l bg-muted/20 shrink-0 flex flex-col relative overflow-hidden"
            style={{ width: `${tocWidth}px` }}
          >
            {/* 拖拽调整宽度的手柄 */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10 ${isDragging ? 'bg-primary/30' : ''}`}
              onMouseDown={handleMouseDown}
            />
            {/* 目录标题 */}
            <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground min-w-0">
                <List className="h-4 w-4 shrink-0" />
                <span className="truncate">目录</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setShowToc(false)}
                    >
                      <PanelRightClose className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    关闭目录
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {/* 目录内容 */}
            <TableOfContents
              content={content}
              className="flex-1 overflow-hidden"
              onHeadingClick={handleHeadingClick}
            />
          </div>
        )}

        {/* 桌面端：AI 聊天侧边栏 */}
        {!isMobile && isAIPanelOpen && (
          <AIChatPanel
            isOpen={isAIPanelOpen}
            onClose={handleCloseAIPanel}
            articleContext={articleContext}
            toolContext={toolContext}
            width={aiPanelWidth}
            onWidthChange={setAIPanelWidth}
          />
        )}

        {/* 桌面端：目录折叠状态下的展开按钮 */}
        {!isMobile && !showToc && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="fixed top-1/3 h-8 w-8 bg-muted/80 backdrop-blur-sm shadow-sm border"
                  style={{ right: isAIPanelOpen ? aiPanelWidth + 16 : 16 }}
                  onClick={() => setShowToc(true)}
                >
                  <PanelRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                显示目录
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

export default ArticleEditorLayout;
