import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Cloud,
  Loader2,
} from "lucide-react";
import { notification } from "antd";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpc } from "@/utils/trpc";
import PublishMenu from "@/components/PublishMenu";

function ArticlesPage() {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<number | null>(null);

  const trpcUtils = trpc.useContext();

  const { data, isLoading, refetch } = trpc.article.list.useQuery({
    page: 1,
    pageSize: 20,
  });

  // 创建文章 mutation - 与文件树行为一致
  const createArticleMutation = trpc.articleExt.createInFolder.useMutation({
    onSuccess: (article: { id: number }) => {
      refetch();
      trpcUtils.folder.tree.invalidate();
      navigate({
        to: "/articles/$id/edit",
        params: { id: String(article.id) },
        search: { new: true },
      });
    },
  });

  // 同步文章状态
  const syncStatusMutation = trpc.sync.syncArticleStatus.useMutation({
    onSuccess: (result: any) => {
      refetch();
      notification.open({
        message: result.success ? "腾讯云社区同步成功" : "腾讯云社区同步失败",
        description: result.message,
        placement: "bottomRight",
        duration: 5,
        type: result.success ? "success" : "error",
      });
    },
    onError: (error: any) => {
      notification.open({
        message: "腾讯云社区同步失败",
        description: error.message || "同步时发生错误",
        placement: "bottomRight",
        duration: 5,
        type: "error",
      });
    },
  });

  // 页面加载时自动同步状态
  useEffect(() => {
    const needsSync = data?.articles?.some(
      (a: any) => a.status === "pending" || a.tencentArticleId
    );
    if (needsSync && !syncStatusMutation.isLoading) {
      syncStatusMutation.mutate();
    }
  }, [data?.articles?.length]);

  const deleteMutation = trpc.article.delete.useMutation({
    onSuccess: () => {
      refetch();
      // 同步刷新文件树
      trpcUtils.folder.tree.invalidate();
      setDeleteDialogOpen(false);
      setArticleToDelete(null);
    },
  });

  const handleDelete = () => {
    if (articleToDelete) {
      deleteMutation.mutate({ id: articleToDelete });
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">文章管理</h1>
          <p className="text-muted-foreground">管理您的所有文章</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncStatusMutation.mutate()}
            disabled={syncStatusMutation.isLoading}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 mr-2",
                syncStatusMutation.isLoading && "animate-spin"
              )}
            />
            同步状态
          </Button>
          <Button
            size="sm"
            onClick={() => createArticleMutation.mutate({ title: "无标题" })}
            disabled={createArticleMutation.isLoading}
          >
            {createArticleMutation.isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            写文章
          </Button>
        </div>
      </div>

      {/* 表格 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead className="w-32">平台</TableHead>
              <TableHead className="w-40">定时发布</TableHead>
              <TableHead className="w-40">创建时间</TableHead>
              <TableHead className="w-40">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : data?.articles?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  暂无文章
                </TableCell>
              </TableRow>
            ) : (
              data?.articles?.map((article: any) => {
                return (
                  <TableRow key={article.id}>
                    <TableCell className="font-medium">
                      {article.title || "无标题"}
                    </TableCell>
                    {/* 平台列 - 显示所有平台，通过颜色区分发布状态 */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const hasTencentId = article.tencentArticleId || article.tencentDraftId;
                          const isPublished = article.status === "published" && hasTencentId;
                          const isPending = article.status === "pending" && hasTencentId;
                          const isFailed = article.status === "failed" && hasTencentId;

                          // 根据状态确定样式和提示
                          let badgeClass = "";
                          let tooltipText = "";

                          if (isPublished) {
                            badgeClass = "bg-green-100 text-green-700 border border-green-300";
                            tooltipText = "已发布";
                          } else if (isPending) {
                            badgeClass = "bg-yellow-100 text-yellow-700 border border-yellow-300";
                            tooltipText = "审核中";
                          } else if (isFailed) {
                            badgeClass = "bg-red-100 text-red-600 border border-red-300";
                            tooltipText = article.errorMessage || "发布失败";
                          } else {
                            badgeClass = "bg-gray-100 text-gray-400";
                            tooltipText = "未发布";
                          }

                          return (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge
                                  variant="secondary"
                                  className={cn("text-xs gap-1", badgeClass)}
                                >
                                  <Cloud className="h-3 w-3" />
                                  腾讯云
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{tooltipText}</TooltipContent>
                            </Tooltip>
                          );
                        })()}
                        {/* 后续可添加更多平台的标签 */}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {article.scheduledAt
                        ? new Date(article.scheduledAt).toLocaleString("zh-CN")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(article.createdAt).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {/* 编辑 */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              to="/articles/$id/edit"
                              params={{ id: String(article.id) }}
                            >
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>编辑文章</TooltipContent>
                        </Tooltip>

                        {/* 发布菜单 */}
                        <PublishMenu
                          articleId={article.id}
                          articleStatus={article.status}
                          tencentArticleUrl={article.tencentArticleUrl}
                          tencentTagIds={article.tencentTagIds}
                          sourceType={article.sourceType}
                          summary={article.summary}
                          variant="icon"
                          onSuccess={() => refetch()}
                        />

                        {/* 删除 */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                setArticleToDelete(article.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>删除文章</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这篇文章吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isLoading}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/articles/")({
  component: ArticlesPage,
});
