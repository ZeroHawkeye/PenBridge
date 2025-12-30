import { ReactNode, useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  Settings2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import MilkdownEditor from "@/components/MilkdownEditor";
import { countWords, formatWordCountDetail } from "@/utils/wordCount";

// 编辑器宽度设置
const WIDTH_STORAGE_KEY = "editor-fullwidth-preference";
const STANDARD_WIDTH = "768px";
const FULL_WIDTH = "100%";

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
  
  // 内部 ref，如果外部没有提供
  const internalTitleInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = externalTitleInputRef || internalTitleInputRef;

  // 保存宽度偏好到 localStorage
  useEffect(() => {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(isFullWidth));
  }, [isFullWidth]);

  // 计算字数统计
  const wordCount = useMemo(() => {
    // 统计标题和内容
    const fullText = title + "\n\n" + content;
    return countWords(fullText);
  }, [title, content]);

  // 总字数（中文字符 + 英文单词）
  const totalWords = wordCount.chineseCharacters + wordCount.englishWords;

  return (
    <div className="flex flex-col h-full bg-background">
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

          {/* 设置按钮 - 放在最右侧 */}
          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings2 className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[340px] p-0">
              <div className="flex flex-col h-full">
                {/* 头部 */}
                <div className="px-6 py-5 border-b bg-muted/30">
                  <SheetHeader className="space-y-1">
                    <SheetTitle className="text-lg font-semibold">编辑器设置</SheetTitle>
                    <SheetDescription className="text-sm">
                      自定义您的编辑体验
                    </SheetDescription>
                  </SheetHeader>
                </div>

                {/* 设置内容 */}
                <div className="flex-1 px-6 py-6 overflow-auto">
                  <div className="space-y-6">
                    {/* 显示设置分组 */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        显示
                      </h3>

                      {/* 全宽模式 */}
                      <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                            {isFullWidth ? (
                              <Maximize2 className="h-5 w-5 text-primary" />
                            ) : (
                              <Minimize2 className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <Label htmlFor="fullwidth" className="text-sm font-medium cursor-pointer">
                              全宽模式
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {isFullWidth ? "编辑区域占满屏幕宽度" : "标准宽度 (768px)"}
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="fullwidth"
                          checked={isFullWidth}
                          onCheckedChange={setIsFullWidth}
                        />
                      </div>
                    </div>

                    {/* 额外设置内容 */}
                    {settingsContent}
                  </div>
                </div>

                {/* 底部提示 */}
                <div className="px-6 py-4 border-t bg-muted/20">
                  <p className="text-xs text-muted-foreground text-center">
                    设置会自动保存
                  </p>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* 主编辑区域 - 全屏沉浸式 */}
      <div className="flex-1 overflow-auto">
        <div
          className="mx-auto px-6 py-8 transition-all duration-300"
          style={{ maxWidth: isFullWidth ? FULL_WIDTH : STANDARD_WIDTH }}
        >
          {/* 标题输入 - Notion 风格 */}
          <input
            ref={titleInputRef}
            placeholder="无标题"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full bg-transparent font-normal py-0 px-0 border-0 outline-none placeholder:text-muted-foreground/40"
            style={{ fontSize: '30px', lineHeight: '1.2', fontWeight: '550' }}
          />
          <div className="h-px bg-border/40 mt-3 mb-4" />

          {/* Markdown 编辑器 */}
          <MilkdownEditor
            key={editorKey}
            value={content}
            onChange={onContentChange}
            placeholder="开始写作..."
            className="min-h-[calc(100vh-200px)]"
            articleId={articleId}
          />
        </div>

        {/* 字数统计 - 右下角固定 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="fixed bottom-4 right-4 px-3 py-1.5 bg-muted/80 backdrop-blur-sm rounded-full text-xs text-muted-foreground cursor-default select-none shadow-sm border">
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
    </div>
  );
}

export default ArticleEditorLayout;
