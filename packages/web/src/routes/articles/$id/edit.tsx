import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { message } from "antd";
import dayjs from "dayjs";
import { Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import PublishMenu from "@/components/PublishMenu";
import ArticleEditorLayout from "@/components/ArticleEditorLayout";
import ImportWordSettings from "@/components/ImportWordSettings";

// 保存状态类型
type SaveStatus = "idle" | "saving" | "saved";

// 防抖延迟时间（毫秒）
const AUTO_SAVE_DELAY = 1000;

function EditArticlePage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const search = useSearch({ from: "/articles/$id/edit" }) as { new?: boolean };
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState<string>("");
  const [tencentTagIds, setTencentTagIds] = useState<number[]>([]);
  const [sourceType, setSourceType] = useState<number>(1);
  const [scheduledAt, setScheduledAt] = useState<any>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const trpcUtils = trpc.useContext();

  // 用于跟踪是否为初始加载（避免初始加载时触发保存）
  const isInitialLoadRef = useRef(true);
  // 防抖定时器
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 保存状态重置定时器
  const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 标题输入框 ref
  const titleInputRef = useRef<HTMLInputElement>(null);

  const { data: article, isLoading } = trpc.article.get.useQuery({
    id: Number(id),
  });

  const updateMutation = trpc.article.update.useMutation({
    onSuccess: () => {
      // 刷新文件树以更新标题
      trpcUtils.folder.tree.invalidate();
      // 更新保存状态为已保存
      setSaveStatus("saved");
      // 清除之前的定时器
      if (savedStatusTimerRef.current) {
        clearTimeout(savedStatusTimerRef.current);
      }
      // 2秒后重置为 idle 状态
      savedStatusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    },
    onError: (error: Error) => {
      message.error(`保存失败: ${error.message}`);
      setSaveStatus("idle");
    },
  });

  // 执行保存的函数
  const doSave = useCallback(
    async (titleToSave: string, contentToSave: string, summaryToSave: string) => {
      // 如果内容为空，使用占位符（后端要求 content 至少 1 个字符）
      const finalContent = contentToSave?.trim() ? contentToSave : " ";
      setSaveStatus("saving");
      try {
        await updateMutation.mutateAsync({
          id: Number(id),
          title: titleToSave,
          content: finalContent,
          summary: summaryToSave || undefined,
          scheduledAt: scheduledAt?.toISOString(),
        });
      } catch {
        // 错误已在 onError 中处理
      }
    },
    [id, scheduledAt, updateMutation]
  );

  // 防抖保存函数
  const debouncedSave = useCallback(
    (titleToSave: string, contentToSave: string, summaryToSave: string) => {
      // 清除之前的定时器
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      // 设置新的定时器
      saveTimerRef.current = setTimeout(() => {
        doSave(titleToSave, contentToSave, summaryToSave);
      }, AUTO_SAVE_DELAY);
    },
    [doSave]
  );

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (savedStatusTimerRef.current) {
        clearTimeout(savedStatusTimerRef.current);
      }
    };
  }, []);

  // 用于跟踪是否已加载过文章数据
  const hasLoadedRef = useRef(false);
  const loadedArticleIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (article) {
      // 只在首次加载或文章 ID 变化时更新编辑器
      const isNewArticle = loadedArticleIdRef.current !== article.id;

      setTitle(article.title || "");
      setSummary(article.summary || "");
      setTencentTagIds(article.tencentTagIds || []);
      setSourceType(article.sourceType || 1);
      setScheduledAt(article.scheduledAt ? dayjs(article.scheduledAt) : null);

      // 只在首次加载该文章时设置内容和重新渲染编辑器
      if (isNewArticle) {
        setContent(article.content || "");
        setEditorKey((prev) => prev + 1);
        loadedArticleIdRef.current = article.id;
      }

      // 标记初始加载完成（延迟一下避免编辑器初始化触发保存）
      if (!hasLoadedRef.current) {
        setTimeout(() => {
          isInitialLoadRef.current = false;
          hasLoadedRef.current = true;
        }, 500);
      }
    }
  }, [article]);

  // 新建文章时聚焦标题并全选
  useEffect(() => {
    if (search?.new && article && titleInputRef.current) {
      // 延迟一下确保 DOM 已渲染
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 100);
    }
  }, [search?.new, article]);

  // 处理标题变化 - 防抖保存
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      // 初始加载时不触发保存
      if (isInitialLoadRef.current) {
        return;
      }
      debouncedSave(newTitle, content, summary);
    },
    [content, summary, debouncedSave]
  );

  // 处理内容变化 - 防抖保存
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      // 初始加载时不触发保存
      if (isInitialLoadRef.current) {
        return;
      }
      debouncedSave(title, newContent, summary);
    },
    [title, summary, debouncedSave]
  );

  // 处理 Word 导入
  const handleWordImport = useCallback(
    (importedTitle: string, importedContent: string) => {
      setTitle(importedTitle);
      setContent(importedContent);
      // 强制重新渲染编辑器
      setEditorKey((prev) => prev + 1);
      // 触发保存
      debouncedSave(importedTitle, importedContent, summary);
    },
    [summary, debouncedSave]
  );

  const onSave = async () => {
    if (!content.trim()) {
      message.error("请输入文章内容");
      return;
    }
    await updateMutation.mutateAsync({
      id: Number(id),
      title,
      content,
      summary: summary || undefined,
      scheduledAt: scheduledAt?.toISOString(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">文章不存在</p>
        <Button variant="outline" onClick={() => navigate({ to: "/articles" })}>
          返回文章列表
        </Button>
      </div>
    );
  }

  const isPublished = article.status === "published";

  return (
    <ArticleEditorLayout
      title={title}
      content={content}
      onTitleChange={handleTitleChange}
      onContentChange={handleContentChange}
      breadcrumbLabel={title || "无标题"}
      isPublished={isPublished}
      titleInputRef={titleInputRef}
      editorKey={editorKey}
      articleId={Number(id)}
      settingsContent={<ImportWordSettings onImport={handleWordImport} />}
      statusIndicator={
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-[70px]">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>保存中...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-500">已保存</span>
            </>
          )}
        </div>
      }
      actionButtons={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={updateMutation.isLoading}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            保存
          </Button>

          {/* 发布菜单 */}
          <PublishMenu
            articleId={Number(id)}
            articleStatus={article.status}
            tencentArticleUrl={article.tencentArticleUrl}
            tencentTagIds={tencentTagIds}
            sourceType={sourceType}
            summary={summary}
            variant="button"
          />
        </>
      }
    />
  );
}

export const Route = createFileRoute("/articles/$id/edit")({
  component: EditArticlePage,
  validateSearch: (search: Record<string, unknown>): { new?: boolean } => {
    return {
      new: search.new === true || search.new === "true",
    };
  },
});
