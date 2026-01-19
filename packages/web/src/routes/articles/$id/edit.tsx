import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { message, Modal } from "antd";
import dayjs from "dayjs";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import PublishMenu from "@/components/PublishMenu";
import ArticleEditorLayout from "@/components/ArticleEditorLayout";
import ImportWordSettings from "@/components/ImportWordSettings";
import { ArticleEditSkeleton } from "@/components/ArticleEditSkeleton";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { useSyncConflict } from "@/hooks/use-sync-conflict";
import { replaceBase64ImagesInMarkdown, convertToAbsoluteUrls, convertToRelativeUrls } from "@/utils/markdownImageUtils";
import { simpleHash } from "@/utils/contentHash";
import { syncManager } from "@/lib/syncManager";

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
  const [saveError, setSaveError] = useState<string | undefined>();
  const { hasConflict, syncStatus: conflictSyncStatus } = useSyncConflict(Number(id));
  // 掘金相关状态
  const [juejinCategoryId, setJuejinCategoryId] = useState<string>("");
  const [juejinTagIds, setJuejinTagIds] = useState<string[]>([]);
  const [juejinTagNames, setJuejinTagNames] = useState<string[]>([]);
  const [juejinBriefContent, setJuejinBriefContent] = useState<string>("");
  const [juejinIsOriginal, setJuejinIsOriginal] = useState<number>(1);
  const [juejinStatus, setJuejinStatus] = useState<string>("");
  const [juejinArticleUrl, setJuejinArticleUrl] = useState<string>("");
  // CSDN 相关状态
  const [csdnTags, setCsdnTags] = useState<string[]>([]);
  const [csdnDescription, setCsdnDescription] = useState<string>("");
  const [csdnType, setCsdnType] = useState<string>("original");
  const [csdnReadType, setCsdnReadType] = useState<string>("public");
  const [csdnStatus, setCsdnStatus] = useState<string>("");
  const [csdnArticleUrl, setCsdnArticleUrl] = useState<string>("");
  const trpcUtils = trpc.useContext();

  // 用于跟踪是否为初始加载（避免初始加载时触发保存）
  const isInitialLoadRef = useRef(true);
  // 防抖定时器
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 保存状态重置定时器
  const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 标题输入框 ref
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  // 使用 ref 存储最新值，避免回调函数依赖变化导致不必要的重渲染
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const summaryRef = useRef(summary);
  
  // 同步更新 ref
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { summaryRef.current = summary; }, [summary]);

  const { data: articleMeta, isLoading } = trpc.article.getMeta.useQuery(
    { id: Number(id) },
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: articleContent, isLoading: isContentLoading } = trpc.article.getContent.useQuery(
    { id: Number(id) },
    { staleTime: 5 * 60 * 1000 }
  );

  // 合并元数据和内容，兼容原有逻辑
  const article = articleMeta ? {
    ...articleMeta,
    content: articleContent?.content ?? "",
  } : null;

  const updateMutation = trpc.article.update.useMutation({
    onSuccess: () => {
      trpcUtils.folder.tree.invalidate();
      trpcUtils.article.getMeta.invalidate({ id: Number(id) });
      trpcUtils.article.getContent.invalidate({ id: Number(id) });
      setSaveStatus("saved");
      setSaveError(undefined);
      if (savedStatusTimerRef.current) {
        clearTimeout(savedStatusTimerRef.current);
      }
      savedStatusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    },
    onError: (error: Error) => {
      message.error(`保存失败: ${error.message}`);
      setSaveStatus("idle");
      setSaveError(error.message);
    },
  });

  const doSave = useCallback(
    async (titleToSave: string, contentToSave: string, summaryToSave: string) => {
      const finalTitle = titleToSave?.trim() || "无标题";
      let finalContent = contentToSave?.trim() ? contentToSave : " ";
      
      if (finalContent.includes("data:image/")) {
        try {
          finalContent = await replaceBase64ImagesInMarkdown(finalContent, Number(id));
        } catch (error) {
          console.error("替换 base64 图片失败:", error);
        }
      }
      
      finalContent = convertToRelativeUrls(finalContent);

      setSaveStatus("saving");
      try {
        await updateMutation.mutateAsync({
          id: Number(id),
          title: finalTitle,
          content: finalContent,
          summary: summaryToSave || undefined,
          scheduledAt: scheduledAt?.toISOString(),
          clientId: syncManager.getDeviceId() + "-" + Date.now(),
          contentHash: simpleHash(finalContent),
          lastModifiedBy: syncManager.getDeviceId(),
        });
      } catch {
        // 错误已在 onError 中处理
      }
    },
    [id, scheduledAt, updateMutation]
  );

  const manualSave = useCallback(async () => {
    if (hasConflict) {
      Modal.confirm({
        title: "检测到版本冲突",
        content: "云端有新版本，继续保存将覆盖云端内容。建议先解决冲突再保存。",
        okText: "仍然保存",
        cancelText: "取消",
        onOk: async () => {
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          await doSave(title, content, summary);
          if (!updateMutation.isError) {
            message.success("保存成功");
          }
        },
      });
      return;
    }
    
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await doSave(title, content, summary);
    if (!updateMutation.isError) {
      message.success("保存成功");
    }
  }, [doSave, title, content, summary, updateMutation.isError, hasConflict]);

  // Ctrl+S 快捷键保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault(); // 阻止浏览器默认保存行为
        // 初始加载时不触发保存
        if (isInitialLoadRef.current) {
          return;
        }
        manualSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [manualSave]);

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
  const contentLoadedRef = useRef(false);
  // 用于跟踪是否已聚焦过标题（新建文章时）
  const hasFocusedTitleRef = useRef(false);
  // 用于跟踪上一次加载的文章 ID，只在 ID 变化时才重建编辑器
  const prevArticleIdRef = useRef<number | null>(null);

  // 当路由参数 id 变化时，重置相关状态
  useEffect(() => {
    const numericId = Number(id);
    // 如果文章 ID 变化了，重置加载状态
    if (prevArticleIdRef.current !== null && prevArticleIdRef.current !== numericId) {
      isInitialLoadRef.current = true; // 重新标记为初始加载，避免触发自动保存
      contentLoadedRef.current = false;
      hasFocusedTitleRef.current = false;
    }
  }, [id]);

  // 元数据加载完成后立即更新（不包含 content）
  useEffect(() => {
    if (articleMeta) {
      // 只在首次加载或文章 ID 变化时更新
      const isNewArticle = loadedArticleIdRef.current !== articleMeta.id;

      setTitle(articleMeta.title || "");
      setSummary(articleMeta.summary || "");
      setTencentTagIds(articleMeta.tencentTagIds || []);
      setSourceType(articleMeta.sourceType || 1);
      setScheduledAt(articleMeta.scheduledAt ? dayjs(articleMeta.scheduledAt) : null);
      // 掘金相关
      setJuejinCategoryId((articleMeta as any).juejinCategoryId || "");
      setJuejinTagIds((articleMeta as any).juejinTagIds || []);
      setJuejinTagNames((articleMeta as any).juejinTagNames || []);
      setJuejinBriefContent((articleMeta as any).juejinBriefContent || "");
      setJuejinIsOriginal((articleMeta as any).juejinIsOriginal ?? 1);
      setJuejinStatus((articleMeta as any).juejinStatus || "");
      setJuejinArticleUrl((articleMeta as any).juejinArticleUrl || "");
      // CSDN 相关
      setCsdnTags((articleMeta as any).csdnTags || []);
      setCsdnDescription((articleMeta as any).csdnDescription || "");
      setCsdnType((articleMeta as any).csdnType || "original");
      setCsdnReadType((articleMeta as any).csdnReadType || "public");
      setCsdnStatus((articleMeta as any).csdnStatus || "");
      setCsdnArticleUrl((articleMeta as any).csdnArticleUrl || "");

      if (isNewArticle) {
        loadedArticleIdRef.current = articleMeta.id;
        contentLoadedRef.current = false; // 重置内容加载标记
      }
    }
  }, [articleMeta]);

  // 内容加载完成后更新编辑器
  useEffect(() => {
    if (articleContent && articleMeta && !contentLoadedRef.current) {
      // 将相对路径转换为完整 URL，以便编辑器正确显示图片
      const contentWithAbsoluteUrls = convertToAbsoluteUrls(articleContent.content || "");
      setContent(contentWithAbsoluteUrls);
      
      // 只在文章 ID 变化时才重建编辑器（递增 editorKey）
      // 这样可以避免同一篇文章重复加载时不必要的编辑器重建
      const currentArticleId = articleMeta.id;
      if (prevArticleIdRef.current !== currentArticleId) {
        setEditorKey((prev) => prev + 1);
        prevArticleIdRef.current = currentArticleId;
      }
      
      contentLoadedRef.current = true;

      // 标记初始加载完成（延迟一下避免编辑器初始化触发保存）
      if (!hasLoadedRef.current) {
        setTimeout(() => {
          isInitialLoadRef.current = false;
          hasLoadedRef.current = true;
        }, 500);
      }
    }
  }, [articleContent, articleMeta]);

  // 新建文章时聚焦标题并全选（只在首次加载时执行一次）
  useEffect(() => {
    if (search?.new && article && titleInputRef.current && !hasFocusedTitleRef.current) {
      hasFocusedTitleRef.current = true;
      // 延迟一下确保 DOM 已渲染
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 100);
    }
  }, [search?.new, article]);

  // 处理标题变化 - 防抖保存（使用 ref 避免依赖变化）
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      // 初始加载时不触发保存
      if (isInitialLoadRef.current) {
        return;
      }
      debouncedSave(newTitle, contentRef.current, summaryRef.current);
    },
    [debouncedSave]
  );

  // 处理内容变化 - 防抖保存（使用 ref 避免依赖变化）
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      // 初始加载时不触发保存
      if (isInitialLoadRef.current) {
        return;
      }
      debouncedSave(titleRef.current, newContent, summaryRef.current);
    },
    [debouncedSave]
  );

  // 处理 Word 导入
  const handleWordImport = useCallback(
    async (importedTitle: string, importedContent: string) => {
      setTitle(importedTitle);
      setContent(importedContent);
      // 强制重新渲染编辑器
      setEditorKey((prev) => prev + 1);
      
      // 取消正在进行的防抖保存，避免与手动保存冲突
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      
      // 立即保存导入的内容（不使用防抖，确保内容持久化）
      await doSave(importedTitle, importedContent, summaryRef.current);
    },
    [doSave]
  );

  const onSave = async () => {
    await manualSave();
  };

  const handleContentReload = useCallback(() => {
    trpcUtils.article.getContent.invalidate({ id: Number(id) });
    trpcUtils.article.getMeta.invalidate({ id: Number(id) });
    contentLoadedRef.current = false;
  }, [id, trpcUtils]);

  if (isLoading) {
    return <ArticleEditSkeleton />;
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
      isContentLoading={isContentLoading}
      titleInputRef={titleInputRef}
      editorKey={editorKey}
      articleId={Number(id)}
      onContentReload={handleContentReload}
      settingsContent={({ onClose }) => (
        <ImportWordSettings
          onImport={handleWordImport}
          onClose={onClose}
          articleId={Number(id)}
        />
      )}
      statusIndicator={
        <SyncStatusIndicator 
          syncStatus={
            hasConflict ? "conflict" :
            saveStatus === "saving" ? "syncing" :
            saveError ? "error" :
            saveStatus === "saved" ? "synced" :
            conflictSyncStatus === "pending" ? "pending" :
            "synced"
          }
          errorMessage={saveError}
        />
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
            articleTitle={title}
            articleContent={content}
            tencentArticleUrl={article.tencentArticleUrl}
            tencentTagIds={tencentTagIds}
            sourceType={sourceType}
            summary={summary}
            // 掘金相关
            juejinArticleUrl={juejinArticleUrl}
            juejinCategoryId={juejinCategoryId}
            juejinTagIds={juejinTagIds}
            juejinTagNames={juejinTagNames}
            juejinBriefContent={juejinBriefContent}
            juejinIsOriginal={juejinIsOriginal}
            juejinStatus={juejinStatus}
            // CSDN 相关
            csdnArticleUrl={csdnArticleUrl}
            csdnTags={csdnTags}
            csdnDescription={csdnDescription}
            csdnType={csdnType}
            csdnReadType={csdnReadType}
            csdnStatus={csdnStatus}
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
