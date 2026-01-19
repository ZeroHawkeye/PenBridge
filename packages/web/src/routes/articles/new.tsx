import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { message } from "antd";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import ArticleEditorLayout from "@/components/ArticleEditorLayout";
import ImportWordSettings from "@/components/ImportWordSettings";
import { convertToRelativeUrls } from "@/utils/markdownImageUtils";
import { simpleHash } from "@/utils/contentHash";
import { syncManager } from "@/lib/syncManager";

function NewArticlePage() {
  const navigate = useNavigate();
  const trpcUtils = trpc.useContext();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<string>("");
  const [editorKey, setEditorKey] = useState(0);
  const [currentArticleId, setCurrentArticleId] = useState<number | undefined>(undefined);

  const createMutation = trpc.article.create.useMutation({
    onSuccess: (article: { id: number }) => {
      message.success("文章创建成功");
      // 刷新文件树以显示新文章
      trpcUtils.folder.tree.invalidate();
      // 跳转到编辑页面，用户可以在那里使用完整的发布功能
      navigate({
        to: "/articles/$id/edit",
        params: { id: String(article.id) },
        search: { new: true },
      });
    },
    onError: (error: Error) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  const updateMutation = trpc.article.update.useMutation({
    onSuccess: () => {
      // 更新成功后刷新文件树
      trpcUtils.folder.tree.invalidate();
    },
    onError: (error: Error) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  const onSave = () => {
    if (!title.trim()) {
      message.error("请输入文章标题");
      return;
    }
    if (!content.trim()) {
      message.error("请输入文章内容");
      return;
    }
    const finalContent = convertToRelativeUrls(content);
    const clientId = syncManager.getDeviceId() + "-" + Date.now();
    createMutation.mutate({
      title,
      content: finalContent,
      clientId,
      contentHash: simpleHash(finalContent),
      lastModifiedBy: syncManager.getDeviceId(),
    });
  };

  // 创建临时文章以获取 articleId（用于 Word 导入时上传图片）
  const handleCreateArticleForImport = async (tempTitle: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      createMutation.mutate(
        { title: tempTitle, content: "" },
        {
          onSuccess: (article: { id: number }) => {
            setCurrentArticleId(article.id);
            resolve(article.id);
          },
          onError: (error: Error) => {
            reject(error);
          },
        }
      );
    });
  };

  // 处理 Word 导入
  const handleWordImport = async (importedTitle: string, importedContent: string) => {
    setTitle(importedTitle);
    setContent(importedContent);
    // 强制编辑器重新渲染以加载新内容
    setEditorKey((prev) => prev + 1);
    
    // 如果已经创建了临时文章，更新其内容
    if (currentArticleId) {
      const finalContent = convertToRelativeUrls(importedContent);
      updateMutation.mutate({
        id: currentArticleId,
        title: importedTitle,
        content: finalContent,
      });
    }
  };

  return (
    <ArticleEditorLayout
      title={title}
      content={content}
      onTitleChange={setTitle}
      onContentChange={setContent}
      breadcrumbLabel="新建"
      editorKey={editorKey}
      articleId={currentArticleId}
      settingsContent={({ onClose }) => (
        <ImportWordSettings
          onImport={handleWordImport}
          onClose={onClose}
          articleId={currentArticleId}
          onCreateArticle={handleCreateArticleForImport}
        />
      )}
      actionButtons={
        <Button
          size="sm"
          onClick={onSave}
          disabled={createMutation.isLoading}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          保存
        </Button>
      }
    />
  );
}

export const Route = createFileRoute("/articles/new")({
  component: NewArticlePage,
});
