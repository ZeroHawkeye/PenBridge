import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Cloud,
  Loader2,
  Sparkles,
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

// 同步结果类型
interface SyncResult {
  platform: string;
  success: boolean;
  message: string;
}

function ArticlesPage() {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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

  // 同步腾讯云文章状态（不自动显示通知）
  const syncTencentMutation = trpc.sync.syncArticleStatus.useMutation();

  // 同步掘金文章状态（不自动显示通知）
  const syncJuejinMutation = trpc.juejin.syncArticleStatus.useMutation();

  // 同步所有平台状态，合并结果在一个通知中展示
  const handleSyncAll = async () => {
    setIsSyncing(true);
    const results: SyncResult[] = [];

    // 并行调用两个平台的同步
    const [tencentResult, juejinResult] = await Promise.allSettled([
      syncTencentMutation.mutateAsync(),
      syncJuejinMutation.mutateAsync(),
    ]);

    // 处理腾讯云同步结果
    if (tencentResult.status === "fulfilled") {
      const result = tencentResult.value as any;
      results.push({
        platform: "腾讯云社区",
        success: result.success,
        message: result.message,
      });
    } else {
      results.push({
        platform: "腾讯云社区",
        success: false,
        message: (tencentResult.reason as any)?.message || "同步时发生错误",
      });
    }

    // 处理掘金同步结果
    if (juejinResult.status === "fulfilled") {
      const result = juejinResult.value as any;
      results.push({
        platform: "掘金",
        success: result.success,
        message: result.message,
      });
    } else {
      const errorMessage = (juejinResult.reason as any)?.message || "同步时发生错误";
      // 未登录掘金时不显示错误
      if (!errorMessage.includes("登录")) {
        results.push({
          platform: "掘金",
          success: false,
          message: errorMessage,
        });
      }
    }

    setIsSyncing(false);
    refetch();

    // 合并结果在一个通知中展示
    if (results.length > 0) {
      const allSuccess = results.every((r) => r.success);
      const allFailed = results.every((r) => !r.success);

      notification.open({
        message: allSuccess ? "同步成功" : allFailed ? "同步失败" : "同步完成",
        description: (
          <div className="space-y-2 mt-1">
            {results.map((result, index) => (
              <div key={index} className="flex items-start gap-2">
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium px-1.5 py-0.5 rounded",
                    result.success
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  {result.platform}
                </span>
                <span className="text-sm text-gray-600">{result.message}</span>
              </div>
            ))}
          </div>
        ),
        placement: "bottomRight",
        duration: 4,
        type: allSuccess ? "success" : allFailed ? "error" : "info",
      });
    }
  };

  // 页面加载时自动同步状态
  useEffect(() => {
    const needsTencentSync = data?.articles?.some(
      (a: any) => a.status === "pending" || a.tencentArticleId
    );
    const needsJuejinSync = data?.articles?.some(
      (a: any) => a.juejinStatus === "pending" || a.juejinArticleId
    );
    if ((needsTencentSync || needsJuejinSync) && !isSyncing) {
      handleSyncAll();
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
            onClick={handleSyncAll}
            disabled={isSyncing}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 mr-2",
                isSyncing && "animate-spin"
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
              <TableHead className="min-w-[120px] w-auto">平台</TableHead>
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
                      <div className="flex flex-nowrap gap-1 whitespace-nowrap">
                        {/* 腾讯云平台徽章 */}
                        {(() => {
                          const hasTencentId = article.tencentArticleId || article.tencentDraftId;
                          const isPublished = article.status === "published" && hasTencentId;
                          const isPending = article.status === "pending" && hasTencentId;
                          const isFailed = article.status === "failed" && hasTencentId;

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
                        {/* 掘金平台徽章 */}
                        {(() => {
                          const hasJuejinId = article.juejinArticleId || article.juejinDraftId;
                          const juejinStatus = article.juejinStatus;

                          let badgeClass = "";
                          let tooltipText = "";

                          if (juejinStatus === "published" && hasJuejinId) {
                            badgeClass = "bg-green-100 text-green-700 border border-green-300";
                            tooltipText = "已发布";
                          } else if (juejinStatus === "pending" && hasJuejinId) {
                            badgeClass = "bg-yellow-100 text-yellow-700 border border-yellow-300";
                            tooltipText = "审核中";
                          } else if (juejinStatus === "rejected" && hasJuejinId) {
                            badgeClass = "bg-red-100 text-red-600 border border-red-300";
                            tooltipText = "未通过审核";
                          } else if (juejinStatus === "failed") {
                            badgeClass = "bg-red-100 text-red-600 border border-red-300";
                            tooltipText = "发布失败";
                          } else if (juejinStatus === "draft" && hasJuejinId) {
                            badgeClass = "bg-blue-100 text-blue-700 border border-blue-300";
                            tooltipText = "草稿";
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
                                  <Sparkles className="h-3 w-3" />
                                  掘金
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{tooltipText}</TooltipContent>
                            </Tooltip>
                          );
                        })()}
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
