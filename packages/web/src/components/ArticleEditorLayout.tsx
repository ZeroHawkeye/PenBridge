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
} from "lucide-react";
import { Drawer } from "antd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import MilkdownEditor, { type MilkdownEditorRef } from "@/components/MilkdownEditor";
import { TableOfContents, HeadingItem } from "@/components/TableOfContents";
import { countWords, formatWordCountDetail } from "@/utils/wordCount";
import { AIChatPanel } from "@/components/ai-chat/AIChatPanel";

// 编辑器骨架屏组件 - Notion 风格
function EditorSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      {/* 模拟段落块 */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[95%]" />
        <Skeleton className="h-4 w-[88%]" />
      </div>

      {/* 空行 */}
      <div className="h-2" />

      {/* 模拟第二段 */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-[92%]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[75%]" />
      </div>

      {/* 空行 */}
      <div className="h-2" />

      {/* 模拟代码块或引用 */}
      <div className="pl-4 border-l-2 border-muted space-y-2">
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-4 w-[70%]" />
      </div>

      {/* 空行 */}
      <div className="h-2" />

      {/* 模拟第三段 */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[82%]" />
        <Skeleton className="h-4 w-[60%]" />
      </div>

      {/* 加载提示 */}
      <div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
        <div className="h-1 w-1 rounded-full bg-muted-foreground/50 animate-pulse" />
        <div className="h-1 w-1 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:150ms]" />
        <div className="h-1 w-1 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:300ms]" />
        <span className="ml-1">正在加载内容...</span>
      </div>
    </div>
  );
}

// Notion 风格设置项组件
interface SettingItemProps {
  icon: ReactNode;
  label: string;
  description?: string;
  action?: ReactNode;
  onClick?: () => void;
}

function SettingItem({ icon, label, description, action, onClick }: SettingItemProps) {
  const content = (
    <div className="flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-accent/50 transition-colors group -mx-2">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
          {icon}
        </span>
        <span className="text-sm">{label}</span>
      </div>
      {action && <div className="flex items-center">{action}</div>}
      {description && !action && (
        <span className="text-sm text-muted-foreground">{description}</span>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button className="w-full text-left" onClick={onClick}>
        {content}
      </button>
    );
  }

  return content;
}

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

  // 设置弹窗额外内容
  settingsContent?: ReactNode;

  // 可选：标题输入框 ref（用于新建后聚焦）
  titleInputRef?: React.RefObject<HTMLInputElement | null>;

  // 可选：编辑器 key（用于强制重新渲染）
  editorKey?: number;

  // 可选：文章 ID（用于图片上传）
  articleId?: number;
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
}: ArticleEditorLayoutProps) {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // 内部 ref，如果外部没有提供
  const internalTitleInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = externalTitleInputRef || internalTitleInputRef;
  
  // 编辑器容器 ref，用于滚动到标题位置
  const editorContainerRef = useRef<HTMLDivElement>(null);
  
  // 编辑器实例 ref，用于直接更新内容而不重建编辑器
  const milkdownEditorRef = useRef<MilkdownEditorRef>(null);

  // 处理标题点击，滚动到对应位置
  const handleHeadingClick = useCallback((heading: HeadingItem) => {
    const container = editorContainerRef.current;
    if (!container) return;

    // 在编辑器中查找对应的标题元素
    // Milkdown 编辑器会将标题渲染为 h1-h5 元素
    const headingElements = container.querySelectorAll("h1, h2, h3, h4, h5");
    
    // 遍历找到匹配的标题
    for (const el of headingElements) {
      const text = el.textContent?.trim();
      if (text === heading.text) {
        // 滚动到标题位置，留出一些顶部边距
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        
        // 高亮效果
        el.classList.add("toc-highlight");
        setTimeout(() => {
          el.classList.remove("toc-highlight");
        }, 2000);
        break;
      }
    }
  }, []);

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
      
      // Milkdown 编辑器初始化是异步的：
      // 1. 使用 requestAnimationFrame 延迟初始化
      // 2. 然后 crepe.create() 返回 Promise
      // 因此需要监听 DOM 变化，等待编辑器完全渲染后再恢复滚动
      const observer = new MutationObserver((_mutations, obs) => {
        // 检查 Milkdown 编辑器是否已渲染（查找编辑器特有的元素）
        const editor = container.querySelector('.milkdown');
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
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate({ to: "/articles" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center text-sm text-muted-foreground">
            <span>文章</span>
            <ChevronRight className="h-3 w-3 mx-1" />
            <span className="text-foreground truncate max-w-[200px]">
              {breadcrumbLabel}
            </span>
          </div>
          {isPublished && (
            <Badge variant="default" className="ml-2">
              已发布
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 状态指示器（如保存状态） */}
          {statusIndicator}

          {/* 操作按钮区域 */}
          {actionButtons}

          {/* AI 助手按钮 */}
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

          {/* 设置按钮 - 放在最右侧 */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* 设置抽屉 - 放在最外层，使用 antd Drawer 避免 Portal 影响编辑器 */}
      <Drawer
        title="页面设置"
        placement="right"
        width={300}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        className="settings-drawer"
        mask={false}
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
            {settingsContent}

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
        <div className="flex-1 overflow-auto" ref={editorContainerRef}>
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
            <div className="h-px bg-border/40 mt-3 mb-4" />

            {/* Markdown 编辑器 / 骨架屏 */}
            {isContentLoading ? (
              <EditorSkeleton />
            ) : (
              <MilkdownEditor
                ref={milkdownEditorRef}
                key={finalEditorKey}
                value={content}
                onChange={onContentChange}
                placeholder="开始写作..."
                className="min-h-[calc(100vh-200px)]"
                articleId={articleId}
              />
            )}
          </div>

          {/* 字数统计 - 右下角固定 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="fixed bottom-4 px-3 py-1.5 bg-muted/80 backdrop-blur-sm rounded-full text-xs text-muted-foreground cursor-default select-none shadow-sm border transition-all"
                  style={{ right: getRightSidebarWidth() + 20 + "px" }}
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

        {/* 标题目录侧边栏 */}
        {showToc && (
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

        {/* AI 聊天侧边栏 */}
        {isAIPanelOpen && (
          <AIChatPanel
            isOpen={isAIPanelOpen}
            onClose={handleCloseAIPanel}
            articleContext={articleContext}
            toolContext={toolContext}
            width={aiPanelWidth}
            onWidthChange={setAIPanelWidth}
          />
        )}

        {/* 目录折叠状态下的展开按钮 */}
        {!showToc && (
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
