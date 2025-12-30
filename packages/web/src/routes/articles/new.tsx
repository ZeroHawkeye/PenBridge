import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { message } from "antd";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import ArticleEditorLayout from "@/components/ArticleEditorLayout";
import ImportWordSettings from "@/components/ImportWordSettings";

function NewArticlePage() {
  const navigate = useNavigate();
  const trpcUtils = trpc.useContext();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<string>("");
  const [editorKey, setEditorKey] = useState(0);

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

  const onSave = () => {
    if (!title.trim()) {
      message.error("请输入文章标题");
      return;
    }
    if (!content.trim()) {
      message.error("请输入文章内容");
      return;
    }
    createMutation.mutate({
      title,
      content,
    });
  };

  // 处理 Word 导入
  const handleWordImport = (importedTitle: string, importedContent: string) => {
    setTitle(importedTitle);
    setContent(importedContent);
    // 强制编辑器重新渲染以加载新内容
    setEditorKey((prev) => prev + 1);
  };

  return (
    <ArticleEditorLayout
      title={title}
      content={content}
      onTitleChange={setTitle}
      onContentChange={setContent}
      breadcrumbLabel="新建"
      editorKey={editorKey}
      settingsContent={<ImportWordSettings onImport={handleWordImport} />}
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
