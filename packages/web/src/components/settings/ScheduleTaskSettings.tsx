import { Calendar, CheckCircle, Clock, Loader2, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/utils/trpc";
import { message } from "antd";

// 定时任务管理组件
export function ScheduleTaskSettings() {
  const { data: pendingTasks, isLoading: pendingLoading } = trpc.schedule.listPending.useQuery();
  const { data: historyData, isLoading: historyLoading } = trpc.schedule.listHistory.useQuery({ page: 1, pageSize: 20 });
  const utils = trpc.useContext();

  const cancelMutation = trpc.schedule.cancel.useMutation({
    onSuccess: () => {
      message.success("任务已取消");
      utils.schedule.listPending.invalidate();
      utils.schedule.listHistory.invalidate();
    },
    onError: (error: Error) => {
      message.error(`取消失败: ${error.message}`);
    },
  });

  const clearHistoryMutation = trpc.schedule.clearHistory.useMutation({
    onSuccess: (data: any) => {
      message.success(`已清空 ${data.deletedCount} 条历史记录`);
      utils.schedule.listHistory.invalidate();
    },
    onError: (error: Error) => {
      message.error(`清空失败: ${error.message}`);
    },
  });

  const formatTime = (time: string | Date) => {
    const date = new Date(time);
    return date.toLocaleString("zh-CN");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />待执行</Badge>;
      case "running":
        return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" />执行中</Badge>;
      case "success":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />成功</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />失败</Badge>;
      case "cancelled":
        return <Badge variant="outline">已取消</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "tencent":
        return "腾讯云社区";
      case "juejin":
        return "掘金";
      case "csdn":
        return "CSDN";
      default:
        return platform;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">定时任务</h2>
        <p className="text-sm text-muted-foreground">
          管理和查看定时发布任务
        </p>
      </div>

      {/* 待执行任务 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            待执行任务
            {pendingTasks && pendingTasks.length > 0 && (
              <Badge variant="secondary">{pendingTasks.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            即将自动执行的定时发布任务
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pendingTasks && pendingTasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文章</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>计划时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTasks.map((task: any) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {task.article?.title || `文章 #${task.articleId}`}
                    </TableCell>
                    <TableCell>{getPlatformName(task.platform)}</TableCell>
                    <TableCell>{formatTime(task.scheduledAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelMutation.mutate({ taskId: task.id })}
                        disabled={cancelMutation.isLoading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">
              暂无待执行的定时任务
            </div>
          )}
        </CardContent>
      </Card>

      {/* 历史记录 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                历史记录
              </CardTitle>
              <CardDescription>
                已执行的定时任务记录
              </CardDescription>
            </div>
            {historyData && historyData.tasks.filter((t: any) => t.status !== "pending").length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearHistoryMutation.mutate()}
                disabled={clearHistoryMutation.isLoading}
                className="text-destructive hover:text-destructive"
              >
                {clearHistoryMutation.isLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                清空记录
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : historyData && historyData.tasks.filter((t: any) => t.status !== "pending").length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文章</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>执行时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyData.tasks
                  .filter((task: any) => task.status !== "pending")
                  .map((task: any) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {task.article?.title || `文章 #${task.articleId}`}
                      </TableCell>
                      <TableCell>{getPlatformName(task.platform)}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>
                        {task.executedAt ? formatTime(task.executedAt) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">
              暂无历史记录
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
