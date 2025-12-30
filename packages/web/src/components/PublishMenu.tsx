import { useState } from "react";
import { message } from "antd";
import {
  CloudUpload,
  Cloud,
  ChevronDown,
  ExternalLink,
  Clock,
  CalendarClock,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpc } from "@/utils/trpc";
import TencentPublishDialog from "./TencentPublishDialog";
import SchedulePublishDialog from "./SchedulePublishDialog";

interface PublishMenuProps {
  articleId: number;
  articleStatus: string;
  tencentArticleUrl?: string;
  tencentTagIds?: number[];
  sourceType?: number;
  summary?: string;
  scheduledAt?: string;  // 定时发布时间
  onSuccess?: () => void;
  /** 显示模式：button 显示完整按钮，icon 只显示图标 */
  variant?: "button" | "icon";
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 发布菜单组件
 * 支持多平台发布，当前仅实现腾讯云社区
 */
export function PublishMenu({
  articleId,
  articleStatus,
  tencentArticleUrl,
  tencentTagIds = [],
  sourceType = 1,
  summary = "",
  scheduledAt,
  onSuccess,
  variant = "button",
  disabled = false,
}: PublishMenuProps) {
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  // 获取文章的定时任务
  const { data: existingTask } = trpc.schedule.getByArticle.useQuery(
    { articleId },
    { enabled: articleStatus === "scheduled" }
  );

  const trpcUtils = trpc.useContext();

  // 同步草稿
  const saveDraftMutation = trpc.sync.syncToDraft.useMutation({
    onSuccess: (result: any) => {
      message.destroy("sync-draft");
      if (result.success) {
        message.success(result.message || "草稿已同步到腾讯云");
        trpcUtils.article.list.invalidate();
        trpcUtils.article.get.invalidate({ id: articleId });
        onSuccess?.();
      } else {
        message.error(result.message || "同步失败");
      }
    },
    onError: (error: Error) => {
      message.destroy("sync-draft");
      message.error(`同步失败: ${error.message}`);
    },
  });

  const handleSyncDraft = () => {
    message.loading({ content: "正在同步草稿...", key: "sync-draft", duration: 0 });
    saveDraftMutation.mutate({ id: articleId });
  };

  const handleViewArticle = () => {
    if (tencentArticleUrl) {
      window.open(tencentArticleUrl, "_blank");
    }
  };

  // 判断是否已发布到腾讯云
  const isPublished = articleStatus === "published";
  const isPending = articleStatus === "pending";
  const isScheduled = articleStatus === "scheduled";
  const canPublish =
    articleStatus === "draft" ||
    articleStatus === "failed";

  // 格式化定时发布时间
  const formatScheduledTime = (time: string) => {
    const date = new Date(time);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  // 渲染触发器按钮
  const TriggerButton = (
    <Button
      variant={variant === "icon" ? "ghost" : "default"}
      size={variant === "icon" ? "icon" : "sm"}
      className={variant === "icon" ? "h-8 w-8" : "gap-1.5"}
      disabled={disabled}
    >
      <CloudUpload className="h-4 w-4" />
      {variant !== "icon" && (
        <>
          发布
          <ChevronDown className="h-3 w-3" />
        </>
      )}
    </Button>
  );

  return (
    <>
      <DropdownMenu>
        {variant === "icon" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                {TriggerButton}
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>发布文章</TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenuTrigger asChild>{TriggerButton}</DropdownMenuTrigger>
        )}
        <DropdownMenuContent align="end" className="w-48">
          {/* 腾讯云社区 */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                腾讯云社区
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-40">
              {canPublish && (
                <DropdownMenuItem onClick={() => setPublishDialogOpen(true)}>
                  <CloudUpload className="h-4 w-4 mr-2" />
                  立即发布
                </DropdownMenuItem>
              )}

              {canPublish && (
                <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
                  <CalendarClock className="h-4 w-4 mr-2" />
                  定时发布
                </DropdownMenuItem>
              )}

              {isScheduled && (
                <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  编辑定时 {scheduledAt && `(${formatScheduledTime(scheduledAt)})`}
                </DropdownMenuItem>
              )}

              {(canPublish || isScheduled) && (
                <DropdownMenuItem
                  onClick={handleSyncDraft}
                  disabled={saveDraftMutation.isLoading}
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  同步草稿
                </DropdownMenuItem>
              )}

              {isPending && (
                <DropdownMenuItem disabled>
                  <Clock className="h-4 w-4 mr-2" />
                  审核中...
                </DropdownMenuItem>
              )}

              {(isPublished || isPending) && tencentArticleUrl && (
                <DropdownMenuItem onClick={handleViewArticle}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  查看文章
                </DropdownMenuItem>
              )}

              {isPublished && !tencentArticleUrl && (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground">已发布</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {/* 其他平台 - 敬请期待 */}
          <DropdownMenuItem disabled className="text-muted-foreground">
            掘金（敬请期待）
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-muted-foreground">
            CSDN（敬请期待）
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 腾讯云发布配置弹窗 */}
      <TencentPublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        articleId={articleId}
        tencentTagIds={tencentTagIds}
        sourceType={sourceType}
        summary={summary}
        onSuccess={onSuccess}
      />

      {/* 定时发布配置弹窗 */}
      <SchedulePublishDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        articleId={articleId}
        tencentTagIds={tencentTagIds}
        sourceType={sourceType}
        summary={summary}
        existingTask={existingTask ? {
          id: existingTask.id,
          scheduledAt: existingTask.scheduledAt as unknown as string,
          config: existingTask.config as any,
        } : null}
        onSuccess={onSuccess}
      />
    </>
  );
}

export default PublishMenu;
