import { useState, useEffect, useRef } from "react";
import { message, Select } from "antd";
import { Loader2 } from "lucide-react";
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

interface TencentPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: number;
  // 初始值
  tencentTagIds?: number[];
  sourceType?: number;
  summary?: string;
  onSuccess?: () => void;
}

/**
 * 腾讯云社区发布配置弹窗
 */
export function TencentPublishDialog({
  open,
  onOpenChange,
  articleId,
  tencentTagIds: initialTagIds = [],
  sourceType: initialSourceType = 1,
  summary: initialSummary = "",
  onSuccess,
}: TencentPublishDialogProps) {
  const [tagIds, setTagIds] = useState<number[]>(initialTagIds);
  const [sourceType, setSourceType] = useState<number>(initialSourceType);
  const [summary, setSummary] = useState(initialSummary);

  const trpcUtils = trpc.useContext();

  // 同步初始值
  useEffect(() => {
    if (open) {
      setTagIds(initialTagIds);
      setSourceType(initialSourceType);
      setSummary(initialSummary);
    }
  }, [open, initialTagIds, initialSourceType, initialSummary]);

  // 设置标签
  const setTagsMutation = trpc.sync.setTags.useMutation({
    onError: (error: Error) => {
      message.error(`标签保存失败: ${error.message}`);
    },
  });

  // 设置来源类型
  const setSourceTypeMutation = trpc.sync.setSourceType.useMutation({
    onError: (error: Error) => {
      message.error(`来源类型保存失败: ${error.message}`);
    },
  });

  // 更新文章（保存摘要）
  const updateMutation = trpc.article.update.useMutation({
    onError: (error: Error) => {
      message.error(`保存失败: ${error.message}`);
    },
  });

  // 发布
  const publishMutation = trpc.sync.publishViaApi.useMutation({
    onSuccess: (result: any) => {
      message.destroy("publish");
      if (result.success) {
        message.success(result.message || "发布成功，文章已提交审核");
        if (result.articleUrl) {
          message.info(`文章地址: ${result.articleUrl}`);
        }
        onOpenChange(false);
        trpcUtils.article.list.invalidate();
        trpcUtils.article.get.invalidate({ id: articleId });
        onSuccess?.();
      } else {
        message.error(result.message || "发布失败");
      }
    },
    onError: (error: Error) => {
      message.destroy("publish");
      message.error(`发布失败: ${error.message}`);
    },
  });

  const handleTagChange = (newTagIds: number[]) => {
    setTagIds(newTagIds);
  };

  const handlePublish = async () => {
    // 验证标签
    if (tagIds.length === 0) {
      message.error("请至少选择一个标签");
      return;
    }

    message.loading({ content: "正在发布文章...", key: "publish", duration: 0 });

    try {
      // 先保存标签和来源类型
      await setTagsMutation.mutateAsync({ id: articleId, tagIds });
      await setSourceTypeMutation.mutateAsync({ id: articleId, sourceType });

      // 如果有摘要变更，保存摘要
      if (summary !== initialSummary) {
        await updateMutation.mutateAsync({
          id: articleId,
          summary: summary || undefined,
        });
      }

      // 发布
      publishMutation.mutate({ id: articleId });
    } catch {
      message.destroy("publish");
      // 错误已在各 mutation 的 onError 中处理
    }
  };

  const isLoading =
    setTagsMutation.isLoading ||
    setSourceTypeMutation.isLoading ||
    updateMutation.isLoading ||
    publishMutation.isLoading;

  // 用于 antd Select 的容器引用
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" ref={containerRef}>
        <DialogHeader>
          <DialogTitle>发布到腾讯云社区</DialogTitle>
          <DialogDescription>
            配置发布选项，文章将提交至腾讯云开发者社区审核
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button onClick={handlePublish} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            确认发布
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TencentPublishDialog;
