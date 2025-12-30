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
import JuejinTagSelect from "./JuejinTagSelect";

// 掘金固定分类列表
const JUEJIN_CATEGORIES = [
  { category_id: "6809637767543259144", category_name: "前端" },
  { category_id: "6809637769959178254", category_name: "后端" },
  { category_id: "6809635626879549454", category_name: "Android" },
  { category_id: "6809635626661445640", category_name: "iOS" },
  { category_id: "6809637773935378440", category_name: "人工智能" },
  { category_id: "6809637771511070734", category_name: "开发工具" },
  { category_id: "6809637776263217160", category_name: "代码人生" },
  { category_id: "6809637772874219534", category_name: "阅读" },
];

interface TagLabelValue {
  value: string;
  label: string;
}

interface JuejinPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: number;
  // 初始值
  juejinCategoryId?: string;
  juejinTagIds?: string[];
  juejinTagNames?: string[];
  juejinBriefContent?: string;
  juejinIsOriginal?: number;
  onSuccess?: () => void;
}

/**
 * 掘金发布配置弹窗
 */
export function JuejinPublishDialog({
  open,
  onOpenChange,
  articleId,
  juejinCategoryId: initialCategoryId = "",
  juejinTagIds: initialTagIds = [],
  juejinTagNames: initialTagNames = [],
  juejinBriefContent: initialBriefContent = "",
  juejinIsOriginal: initialIsOriginal = 1,
  onSuccess,
}: JuejinPublishDialogProps) {
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [tags, setTags] = useState<TagLabelValue[]>([]);
  const [briefContent, setBriefContent] = useState(initialBriefContent);
  const [isOriginal, setIsOriginal] = useState<number>(initialIsOriginal);

  const trpcUtils = trpc.useContext();

  // 同步初始值
  useEffect(() => {
    if (open) {
      setCategoryId(initialCategoryId);
      // 将 tagIds 和 tagNames 转换为 LabelValue 格式
      const initialTags: TagLabelValue[] = initialTagIds.map((id, index) => ({
        value: id,
        label: initialTagNames[index] || id,
      }));
      setTags(initialTags);
      setBriefContent(initialBriefContent);
      setIsOriginal(initialIsOriginal);
    }
  }, [open, initialCategoryId, initialTagIds, initialTagNames, initialBriefContent, initialIsOriginal]);

  // 保存掘金配置
  const saveConfigMutation = trpc.juejin.saveConfig.useMutation({
    onError: (error: Error) => {
      message.error(`配置保存失败: ${error.message}`);
    },
  });

  // 发布到掘金
  const publishMutation = trpc.juejin.publish.useMutation({
    onSuccess: (result: any) => {
      message.destroy("publish");
      if (result.success) {
        message.success(result.message || "发布成功");
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

  const handleTagChange = (newTags: TagLabelValue[]) => {
    setTags(newTags);
  };

  const handlePublish = async () => {
    // 验证分类
    if (!categoryId) {
      message.error("请选择文章分类");
      return;
    }

    // 验证标签
    if (tags.length === 0) {
      message.error("请至少选择一个标签");
      return;
    }

    if (tags.length > 3) {
      message.error("最多选择3个标签");
      return;
    }

    // 验证摘要
    if (!briefContent.trim()) {
      message.error("请填写文章摘要");
      return;
    }

    if (briefContent.length < 50) {
      message.error("摘要至少需要50个字符");
      return;
    }

    if (briefContent.length > 100) {
      message.error("摘要不能超过100个字符");
      return;
    }

    message.loading({ content: "正在发布文章到掘金...", key: "publish", duration: 0 });

    try {
      // 先保存配置
      await saveConfigMutation.mutateAsync({
        id: articleId,
        categoryId,
        tagIds: tags.map(t => t.value),
        tagNames: tags.map(t => t.label),
        briefContent,
        isOriginal,
      });

      // 发布
      publishMutation.mutate({ id: articleId });
    } catch {
      message.destroy("publish");
      // 错误已在各 mutation 的 onError 中处理
    }
  };

  const isLoading = saveConfigMutation.isLoading || publishMutation.isLoading;

  // 用于 antd Select 的容器引用
  const containerRef = useRef<HTMLDivElement>(null);

  // 摘要字数统计
  const briefContentLength = briefContent.length;
  const isUnderLimit = briefContentLength > 0 && briefContentLength < 50;
  const isOverLimit = briefContentLength > 100;
  const isInvalidLength = isUnderLimit || isOverLimit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]" ref={containerRef}>
        <DialogHeader>
          <DialogTitle>发布到掘金</DialogTitle>
          <DialogDescription>
            配置发布选项，文章将发布至掘金平台
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 分类选择 */}
          <div className="space-y-2">
            <Label>
              文章分类 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={categoryId || undefined}
              onChange={setCategoryId}
              placeholder="请选择文章分类"
              options={JUEJIN_CATEGORIES.map(c => ({
                value: c.category_id,
                label: c.category_name,
              }))}
              className="w-full"
              getPopupContainer={() => containerRef.current || document.body}
            />
            <p className="text-xs text-muted-foreground">
              必须选择一个分类
            </p>
          </div>

          {/* 标签选择 */}
          <div className="space-y-2">
            <Label>
              文章标签 <span className="text-destructive">*</span>
            </Label>
            <JuejinTagSelect
              value={tags}
              onChange={handleTagChange}
              maxCount={3}
              getPopupContainer={() => containerRef.current || document.body}
            />
            <p className="text-xs text-muted-foreground">
              至少选择1个标签，最多3个
            </p>
          </div>

          {/* 是否原创 */}
          <div className="space-y-2">
            <Label>文章类型</Label>
            <Select
              value={isOriginal}
              onChange={setIsOriginal}
              options={[
                { value: 1, label: "原创" },
                { value: 0, label: "转载" },
              ]}
              className="w-full"
              getPopupContainer={() => containerRef.current || document.body}
            />
          </div>

          {/* 摘要 */}
          <div className="space-y-2">
            <Label>
              文章摘要 <span className="text-destructive">*</span>
            </Label>
            <textarea
              placeholder="请输入文章摘要（必填，50-100字）"
              rows={3}
              value={briefContent}
              onChange={(e) => setBriefContent(e.target.value)}
              className={`flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none ${
                isInvalidLength ? "border-destructive" : "border-input"
              }`}
            />
            <p className={`text-xs ${isInvalidLength ? "text-destructive" : "text-muted-foreground"}`}>
              {briefContentLength}/100 字符（至少50字）
              {isUnderLimit && " - 摘要过短"}
              {isOverLimit && " - 摘要过长"}
            </p>
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

export default JuejinPublishDialog;
