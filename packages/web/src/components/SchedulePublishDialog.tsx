import { useState, useEffect, useRef } from "react";
import { message, Select, DatePicker, TimePicker } from "antd";
import { Loader2, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/utils/trpc";
import TencentTagSelect from "./TencentTagSelect";
import dayjs from "dayjs";

interface SchedulePublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: number;
  // 初始值
  tencentTagIds?: number[];
  sourceType?: number;
  summary?: string;
  // 已有的定时任务信息
  existingTask?: {
    id: number;
    scheduledAt: string;
    config: {
      tagIds: number[];
      tagNames?: string[];
      sourceType: 1 | 2 | 3;
      summary?: string;
    };
  } | null;
  onSuccess?: () => void;
}

/**
 * 定时发布配置弹窗
 */
export function SchedulePublishDialog({
  open,
  onOpenChange,
  articleId,
  tencentTagIds: initialTagIds = [],
  sourceType: initialSourceType = 1,
  summary: initialSummary = "",
  existingTask,
  onSuccess,
}: SchedulePublishDialogProps) {
  const [tagIds, setTagIds] = useState<number[]>(initialTagIds);
  const [sourceType, setSourceType] = useState<number>(initialSourceType);
  const [summary, setSummary] = useState(initialSummary);
  const [scheduledDate, setScheduledDate] = useState<dayjs.Dayjs | null>(null);
  const [scheduledTime, setScheduledTime] = useState<dayjs.Dayjs | null>(null);

  const trpcUtils = trpc.useContext();

  // 同步初始值
  useEffect(() => {
    if (open) {
      if (existingTask) {
        // 编辑模式：使用已有任务的配置
        setTagIds(existingTask.config.tagIds);
        setSourceType(existingTask.config.sourceType);
        setSummary(existingTask.config.summary || "");
        const taskTime = dayjs(existingTask.scheduledAt);
        setScheduledDate(taskTime);
        setScheduledTime(taskTime);
      } else {
        // 新建模式：使用文章的配置
        setTagIds(initialTagIds);
        setSourceType(initialSourceType);
        setSummary(initialSummary);
        // 默认设置为1小时后
        const defaultTime = dayjs().add(1, "hour");
        setScheduledDate(defaultTime);
        setScheduledTime(defaultTime);
      }
    }
  }, [open, existingTask, initialTagIds, initialSourceType, initialSummary]);

  // 创建定时任务
  const createTaskMutation = trpc.schedule.create.useMutation({
    onSuccess: () => {
      message.success("定时发布任务创建成功");
      onOpenChange(false);
      trpcUtils.article.list.invalidate();
      trpcUtils.article.get.invalidate({ id: articleId });
      trpcUtils.schedule.listPending.invalidate();
      onSuccess?.();
    },
    onError: (error: Error) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  // 更新定时任务
  const updateTaskMutation = trpc.schedule.update.useMutation({
    onSuccess: () => {
      message.success("定时发布任务已更新");
      onOpenChange(false);
      trpcUtils.article.list.invalidate();
      trpcUtils.article.get.invalidate({ id: articleId });
      trpcUtils.schedule.listPending.invalidate();
      onSuccess?.();
    },
    onError: (error: Error) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  // 取消定时任务
  const cancelTaskMutation = trpc.schedule.cancel.useMutation({
    onSuccess: () => {
      message.success("定时发布任务已取消");
      onOpenChange(false);
      trpcUtils.article.list.invalidate();
      trpcUtils.article.get.invalidate({ id: articleId });
      trpcUtils.schedule.listPending.invalidate();
      onSuccess?.();
    },
    onError: (error: Error) => {
      message.error(`取消失败: ${error.message}`);
    },
  });

  const handleTagChange = (newTagIds: number[]) => {
    setTagIds(newTagIds);
  };

  const handleSubmit = async () => {
    // 验证标签
    if (tagIds.length === 0) {
      message.error("请至少选择一个标签");
      return;
    }

    // 验证时间
    if (!scheduledDate || !scheduledTime) {
      message.error("请选择发布时间");
      return;
    }

    // 合并日期和时间
    const scheduledAt = scheduledDate
      .hour(scheduledTime.hour())
      .minute(scheduledTime.minute())
      .second(0);

    if (scheduledAt.isBefore(dayjs())) {
      message.error("发布时间必须在当前时间之后");
      return;
    }

    const config = {
      tagIds,
      sourceType: sourceType as 1 | 2 | 3,
      summary: summary || undefined,
    };

    if (existingTask) {
      // 更新模式
      updateTaskMutation.mutate({
        taskId: existingTask.id,
        scheduledAt: scheduledAt.toISOString(),
        config,
      });
    } else {
      // 创建模式
      createTaskMutation.mutate({
        articleId,
        scheduledAt: scheduledAt.toISOString(),
        config,
      });
    }
  };

  const handleCancel = () => {
    if (existingTask) {
      cancelTaskMutation.mutate({ taskId: existingTask.id });
    }
  };

  const isLoading =
    createTaskMutation.isLoading ||
    updateTaskMutation.isLoading ||
    cancelTaskMutation.isLoading;

  // 用于 antd 组件的容器引用
  const containerRef = useRef<HTMLDivElement>(null);

  // 禁用过去的日期
  const disabledDate = (current: dayjs.Dayjs) => {
    return current && current < dayjs().startOf("day");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" ref={containerRef}>
        <DialogHeader>
          <DialogTitle>
            {existingTask ? "编辑定时发布" : "定时发布到腾讯云社区"}
          </DialogTitle>
          <DialogDescription>
            设置发布时间和配置，系统将在指定时间自动发布文章
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 发布时间 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              发布时间 <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <DatePicker
                value={scheduledDate}
                onChange={setScheduledDate}
                disabledDate={disabledDate}
                placeholder="选择日期"
                className="flex-1"
                getPopupContainer={() => containerRef.current || document.body}
              />
              <TimePicker
                value={scheduledTime}
                onChange={setScheduledTime}
                format="HH:mm"
                placeholder="选择时间"
                className="flex-1"
                getPopupContainer={() => containerRef.current || document.body}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              系统将在设定时间自动发布文章到腾讯云社区
            </p>
          </div>

          {/* 标签选择 */}
          <div className="space-y-2">
            <Label>
              腾讯云标签 <span className="text-destructive">*</span>
            </Label>
            <TencentTagSelect
              value={tagIds}
              onChange={handleTagChange}
              getPopupContainer={() => containerRef.current || document.body}
            />
            <p className="text-xs text-muted-foreground">
              发布时至少需要选择 1 个标签
            </p>
          </div>

          {/* 来源类型 */}
          <div className="space-y-2">
            <Label>文章来源</Label>
            <Select
              value={sourceType}
              onChange={setSourceType}
              options={[
                { value: 1, label: "原创" },
                { value: 2, label: "转载" },
                { value: 3, label: "翻译" },
              ]}
              className="w-full"
              getPopupContainer={() => containerRef.current || document.body}
            />
          </div>

          {/* 摘要 */}
          <div className="space-y-2">
            <Label>摘要（可选）</Label>
            <textarea
              placeholder="请输入文章摘要"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {existingTask && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isLoading}
              className="sm:mr-auto"
            >
              {cancelTaskMutation.isLoading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              取消定时
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            关闭
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {(createTaskMutation.isLoading || updateTaskMutation.isLoading) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            <Clock className="h-4 w-4 mr-2" />
            {existingTask ? "更新定时" : "确认定时"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SchedulePublishDialog;
