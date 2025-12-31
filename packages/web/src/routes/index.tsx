import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  FileText,
  Clock,
  CheckCircle,
  PenLine,
  AlertCircle,
  Calendar,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  FileEdit,
  Send,
  XCircle,
  Loader2,
  CloudUpload,
  Coffee,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";
import { notification } from "antd";

// 格式化相对时间
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return target.toLocaleDateString("zh-CN");
}

// 格式化定时时间
function formatScheduleTime(date: Date | string): string {
  const target = new Date(date);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) return "已过期";
  if (diffMins < 60) return `${diffMins}分钟后`;
  if (diffHours < 24) return `${diffHours}小时后`;
  if (diffDays < 7) return `${diffDays}天后`;
  return target.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 状态徽章组件
function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    draft: { label: "草稿", variant: "secondary" },
    scheduled: { label: "待发布", variant: "outline" },
    published: { label: "已发布", variant: "default" },
    pending: { label: "审核中", variant: "outline" },
    failed: { label: "失败", variant: "destructive" },
  };

  const { label, variant } = config[status] || { label: status, variant: "secondary" };

  return <Badge variant={variant} className="text-xs h-5">{label}</Badge>;
}

// 最近文章列表项
function RecentArticleItem({
  article,
}: {
  article: {
    id: number;
    title: string;
    status: string;
    updatedAt: string;
    tencentArticleUrl?: string;
  };
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate({
      to: "/articles/$id/edit",
      params: { id: String(article.id) },
    });
  };

  const handleExternalLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (article.tencentArticleUrl) {
      // 优先使用 Electron API 在系统默认浏览器中打开
      if (window.electronAPI?.shell?.openExternal) {
        window.electronAPI.shell.openExternal(article.tencentArticleUrl);
      } else {
        // 回退到 window.open（Web 环境）
        window.open(article.tencentArticleUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FileEdit className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm truncate group-hover:text-primary transition-colors">
            {article.title || "无标题"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {formatRelativeTime(article.updatedAt)}
        </span>
        <StatusBadge status={article.status} />
        {article.tencentArticleUrl && (
          <button
            onClick={handleExternalLinkClick}
            className="text-muted-foreground hover:text-primary"
            title="在腾讯云查看"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// 定时任务列表项
function ScheduledTaskItem({
  task,
}: {
  task: {
    id: number;
    scheduledAt: string;
    status: string;
    article?: { id: number; title: string };
  };
}) {
  const statusConfig: Record<
    string,
    { icon: React.ElementType; color: string; label: string }
  > = {
    pending: { icon: Clock, color: "text-blue-500", label: "等待" },
    running: { icon: Loader2, color: "text-orange-500", label: "执行中" },
    completed: { icon: CheckCircle, color: "text-green-500", label: "完成" },
    failed: { icon: XCircle, color: "text-red-500", label: "失败" },
    cancelled: { icon: XCircle, color: "text-muted-foreground", label: "取消" },
  };

  const { icon: StatusIcon, color } = statusConfig[task.status] || statusConfig.pending;

  return (
    <Link
      to="/articles/$id/edit"
      params={{ id: String(task.article?.id || 0) }}
      className="block"
    >
      <div className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 transition-colors cursor-pointer group">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
          <p className="text-sm truncate group-hover:text-primary transition-colors">
            {task.article?.title || "未知文章"}
          </p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatScheduleTime(task.scheduledAt)}
        </span>
      </div>
    </Link>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const trpcUtils = trpc.useContext();

  // 创建文章 mutation - 与文件树行为一致
  const createArticleMutation = trpc.articleExt.createInFolder.useMutation({
    onSuccess: (article: { id: number }) => {
      trpcUtils.folder.tree.invalidate();
      navigate({
        to: "/articles/$id/edit",
        params: { id: String(article.id) },
        search: { new: true },
      });
    },
  });

  // 处理写文章按钮点击
  const handleCreateArticle = () => {
    createArticleMutation.mutate({ title: "无标题" });
  };

  // 认证状态
  const { data: authStatus, isLoading: authLoading } = trpc.auth.status.useQuery();

  // 本地文章统计
  const { data: draftArticles, isLoading: draftLoading } = trpc.article.list.useQuery({
    status: "draft" as any,
    pageSize: 100,
  });
  const { data: scheduledArticles, isLoading: scheduledLoading } =
    trpc.article.list.useQuery({
      status: "scheduled" as any,
      pageSize: 100,
    });
  const { data: publishedArticles, isLoading: publishedLoading } =
    trpc.article.list.useQuery({
      status: "published" as any,
      pageSize: 100,
    });

  // 最近编辑的文章
  const { data: recentArticles, isLoading: recentLoading } = trpc.article.list.useQuery({
    page: 1,
    pageSize: 6,
  });

  // 定时任务
  const { data: pendingTasks, isLoading: tasksLoading } =
    trpc.schedule.listPending.useQuery();

  // 腾讯云社区状态（使用上面的 authStatus）
  const tencentAuthStatus = authStatus;
  const {
    data: tencentStatusCount,
    isLoading: tencentStatusLoading,
  } = trpc.sync.fetchArticleStatusCount.useQuery(undefined, {
    enabled: tencentAuthStatus?.isLoggedIn === true,
    staleTime: 5 * 60 * 1000,
  });

  // 腾讯云同步状态 mutation
  const tencentSyncMutation = trpc.sync.syncArticleStatus.useMutation({
    onSuccess: (result: any) => {
      notification.open({
        message: result.success ? "腾讯云同步成功" : "腾讯云同步失败",
        description: result.message,
        placement: "bottomRight",
        duration: 3,
        type: result.success ? "success" : "error",
      });
    },
    onError: (error: any) => {
      notification.open({
        message: "腾讯云同步失败",
        description: error.message || "同步时发生错误",
        placement: "bottomRight",
        duration: 3,
        type: "error",
      });
    },
  });

  // 掘金社区状态
  const { data: juejinAuthStatus, isLoading: juejinAuthLoading } = trpc.juejinAuth.status.useQuery();
  const {
    data: juejinStatusCount,
    isLoading: juejinStatusLoading,
  } = trpc.juejin.fetchArticleStatusCount.useQuery(undefined, {
    enabled: juejinAuthStatus?.isLoggedIn === true,
    staleTime: 5 * 60 * 1000,
  });

  // 掘金同步状态 mutation
  const juejinSyncMutation = trpc.juejin.syncArticleStatus.useMutation({
    onSuccess: (result: any) => {
      notification.open({
        message: result.success ? "掘金同步成功" : "掘金同步失败",
        description: result.message,
        placement: "bottomRight",
        duration: 3,
        type: result.success ? "success" : "error",
      });
    },
    onError: (error: any) => {
      notification.open({
        message: "掘金同步失败",
        description: error.message || "同步时发生错误",
        placement: "bottomRight",
        duration: 3,
        type: "error",
      });
    },
  });



  return (
    <div className="p-4 space-y-3 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">仪表盘</h1>
          <p className="text-sm text-muted-foreground">多平台文章管理与发布</p>
        </div>
        <Button
          size="sm"
          onClick={handleCreateArticle}
          disabled={createArticleMutation.isLoading}
        >
          {createArticleMutation.isLoading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <PenLine className="h-4 w-4 mr-1.5" />
          )}
          写文章
        </Button>
      </div>

      {/* 未登录警告 - 当任一平台未登录时显示 */}
      {!authLoading && (!tencentAuthStatus?.isLoggedIn || !juejinAuthStatus?.isLoggedIn) && (
        <Card className="py-0 gap-0 border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <CardContent className="flex items-center gap-3 py-2.5 px-4">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200 flex-1">
              {!tencentAuthStatus?.isLoggedIn && !juejinAuthStatus?.isLoggedIn
                ? "未登录发布平台账号，部分功能不可用"
                : !tencentAuthStatus?.isLoggedIn
                  ? "腾讯云社区未登录"
                  : "掘金社区未登录"}
            </p>
            <Link to="/settings">
              <Button size="sm" variant="outline" className="h-7 text-xs">
                去登录
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* 统计卡片 - 每个卡片独立加载 */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="py-0 gap-0 group hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">草稿箱</span>
              <div className="h-6 w-6 rounded-md bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <FileText className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </div>
            {draftLoading ? (
              <Skeleton className="h-8 w-10 mt-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 tracking-tight">{draftArticles?.total || 0}</p>
            )}
          </CardContent>
        </Card>
        <Card className="py-0 gap-0 group hover:border-orange-200 dark:hover:border-orange-800 transition-colors">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">待发布</span>
              <div className="h-6 w-6 rounded-md bg-orange-50 dark:bg-orange-950 flex items-center justify-center">
                <Clock className="h-3.5 w-3.5 text-orange-500" />
              </div>
            </div>
            {scheduledLoading ? (
              <Skeleton className="h-8 w-10 mt-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 tracking-tight">{scheduledArticles?.total || 0}</p>
            )}
          </CardContent>
        </Card>
        <Card className="py-0 gap-0 group hover:border-green-200 dark:hover:border-green-800 transition-colors">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">已发布</span>
              <div className="h-6 w-6 rounded-md bg-green-50 dark:bg-green-950 flex items-center justify-center">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              </div>
            </div>
            {publishedLoading ? (
              <Skeleton className="h-8 w-10 mt-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 tracking-tight">{publishedArticles?.total || 0}</p>
            )}
          </CardContent>
        </Card>
        <Card className="py-0 gap-0 group hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">定时任务</span>
              <div className="h-6 w-6 rounded-md bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
                <Calendar className="h-3.5 w-3.5 text-purple-500" />
              </div>
            </div>
            {tasksLoading ? (
              <Skeleton className="h-8 w-10 mt-1" />
            ) : (
              <p className="text-2xl font-bold mt-1 tracking-tight">{pendingTasks?.length || 0}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 发布平台状态 */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {/* 腾讯云开发者社区状态 */}
        <Card className="py-0 gap-0">
          <CardHeader className="py-3 px-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <CloudUpload className="h-3.5 w-3.5" />
                腾讯云社区
                {authLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => tencentSyncMutation.mutate()}
                disabled={tencentSyncMutation.isLoading || authLoading || !tencentAuthStatus?.isLoggedIn}
              >
                {tencentSyncMutation.isLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                同步
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {authLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            ) : !tencentAuthStatus?.isLoggedIn ? (
              <div className="text-center py-2 text-muted-foreground">
                <p className="text-xs">请先登录腾讯云账号</p>
              </div>
            ) : tencentStatusLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            ) : tencentStatusCount ? (
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center py-2 px-1 rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-100 dark:border-green-900">
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{tencentStatusCount.pass || 0}</p>
                  <p className="text-[10px] text-green-600/70 dark:text-green-400/70">已发布</p>
                </div>
                <div className="text-center py-2 px-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900">
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{tencentStatusCount.pending || 0}</p>
                  <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">审核中</p>
                </div>
                <div className="text-center py-2 px-1 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{tencentStatusCount.reject || 0}</p>
                  <p className="text-[10px] text-red-600/70 dark:text-red-400/70">未通过</p>
                </div>
                <div className="text-center py-2 px-1 rounded-lg bg-orange-50 dark:bg-orange-950/50 border border-orange-100 dark:border-orange-900">
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{tencentStatusCount.draft || 0}</p>
                  <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70">草稿</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-muted-foreground">
                <AlertTriangle className="h-4 w-4 mx-auto mb-1 opacity-50" />
                <p className="text-xs">无法获取状态</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 掘金社区状态 */}
        <Card className="py-0 gap-0">
          <CardHeader className="py-3 px-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Coffee className="h-3.5 w-3.5" />
                掘金社区
                {juejinAuthLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => juejinSyncMutation.mutate()}
                disabled={juejinSyncMutation.isLoading || juejinAuthLoading || !juejinAuthStatus?.isLoggedIn}
              >
                {juejinSyncMutation.isLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                同步
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {juejinAuthLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            ) : !juejinAuthStatus?.isLoggedIn ? (
              <div className="text-center py-2 text-muted-foreground">
                <p className="text-xs">请先登录掘金账号</p>
              </div>
            ) : juejinStatusLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            ) : juejinStatusCount ? (
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center py-2 px-1 rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-100 dark:border-green-900">
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{juejinStatusCount.published || 0}</p>
                  <p className="text-[10px] text-green-600/70 dark:text-green-400/70">已发布</p>
                </div>
                <div className="text-center py-2 px-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900">
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{juejinStatusCount.pending || 0}</p>
                  <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">审核中</p>
                </div>
                <div className="text-center py-2 px-1 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{juejinStatusCount.rejected || 0}</p>
                  <p className="text-[10px] text-red-600/70 dark:text-red-400/70">未通过</p>
                </div>
                <div className="text-center py-2 px-1 rounded-lg bg-orange-50 dark:bg-orange-950/50 border border-orange-100 dark:border-orange-900">
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{juejinStatusCount.draft || 0}</p>
                  <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70">草稿</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-muted-foreground">
                <AlertTriangle className="h-4 w-4 mx-auto mb-1 opacity-50" />
                <p className="text-xs">无法获取状态</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 快捷操作 */}
        <Card className="py-0 gap-0">
          <CardHeader className="py-3 px-4 pb-2">
            <CardTitle className="text-sm font-medium">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-11 flex flex-col gap-0.5 p-1 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                onClick={handleCreateArticle}
                disabled={createArticleMutation.isLoading}
              >
                {createArticleMutation.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PenLine className="h-4 w-4" />
                )}
                <span className="text-[10px]">写文章</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-11 flex flex-col gap-0.5 p-1 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                onClick={() => navigate({ to: "/articles" })}
              >
                <FileText className="h-4 w-4" />
                <span className="text-[10px]">文章</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-11 flex flex-col gap-0.5 p-1 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                onClick={() => navigate({ to: "/settings" })}
              >
                <Send className="h-4 w-4" />
                <span className="text-[10px]">设置</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-11 flex flex-col gap-0.5 p-1 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                onClick={() => {
                  // 同时触发两个平台的同步
                  if (tencentAuthStatus?.isLoggedIn) tencentSyncMutation.mutate();
                  if (juejinAuthStatus?.isLoggedIn) juejinSyncMutation.mutate();
                }}
                disabled={
                  (tencentSyncMutation.isLoading || juejinSyncMutation.isLoading) ||
                  (!tencentAuthStatus?.isLoggedIn && !juejinAuthStatus?.isLoggedIn)
                }
              >
                {tencentSyncMutation.isLoading || juejinSyncMutation.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="text-[10px]">全部同步</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 最近文章 + 定时任务 */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* 最近编辑的文章 */}
        <Card className="py-0 gap-0">
          <CardHeader className="py-3 px-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">最近编辑</CardTitle>
              <Link to="/articles">
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                  全部
                  <ArrowRight className="h-3 w-3 ml-0.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-2 pt-0">
            {recentLoading ? (
              <div className="space-y-1.5 px-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-7" />
                ))}
              </div>
            ) : recentArticles?.articles && recentArticles.articles.length > 0 ? (
              <ScrollArea className="h-[160px]">
                <div className="space-y-0.5">
                  {recentArticles.articles.map((article: any) => (
                    <RecentArticleItem key={article.id} article={article} />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <FileText className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
                <p className="text-xs">暂无文章</p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-5 text-xs p-0 mt-1.5"
                  onClick={handleCreateArticle}
                  disabled={createArticleMutation.isLoading}
                >
                  创建第一篇
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 定时发布任务 */}
        <Card className="py-0 gap-0">
          <CardHeader className="py-3 px-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">定时发布</CardTitle>
<Link to="/settings" search={{ tab: "schedule" }}>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                  管理
                  <ArrowRight className="h-3 w-3 ml-0.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-2 pt-0">
            {tasksLoading ? (
              <div className="space-y-1.5 px-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-7" />
                ))}
              </div>
            ) : pendingTasks && pendingTasks.length > 0 ? (
              <ScrollArea className="h-[160px]">
                <div className="space-y-0.5">
                  {pendingTasks.map((task: any) => (
                    <ScheduledTaskItem key={task.id} task={task} />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Calendar className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
                <p className="text-xs">暂无定时任务</p>
                <p className="text-[10px] mt-0.5 opacity-70">在编辑页设置</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
