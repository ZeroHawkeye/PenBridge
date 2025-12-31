/**
 * Diff 预览对话框组件
 * 展示 AI 修改的内容差异，让用户选择接受或拒绝
 * 使用类似 GitHub 的 diff 展示风格
 */

import { useMemo, useState } from "react";
import * as Diff from "diff";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  X, 
  FileText, 
  Type,
  Plus,
  Minus,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingChange } from "./types";

interface DiffPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pendingChange: PendingChange | null;
  onAccept: (change: PendingChange) => void;
  onReject: (change: PendingChange) => void;
}

// Diff 行类型
interface DiffLine {
  type: "added" | "removed" | "unchanged" | "header" | "separator";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

// 生成统一的 diff 视图
function generateUnifiedDiff(oldText: string, newText: string): DiffLine[] {
  const changes = Diff.diffLines(oldText, newText);
  const lines: DiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const change of changes) {
    const changeLines = change.value.split("\n");
    // 移除最后一个空字符串（如果是换行符结尾）
    if (changeLines[changeLines.length - 1] === "") {
      changeLines.pop();
    }

    for (const line of changeLines) {
      if (change.added) {
        lines.push({
          type: "added",
          content: line,
          newLineNum: newLineNum++,
        });
      } else if (change.removed) {
        lines.push({
          type: "removed",
          content: line,
          oldLineNum: oldLineNum++,
        });
      } else {
        lines.push({
          type: "unchanged",
          content: line,
          oldLineNum: oldLineNum++,
          newLineNum: newLineNum++,
        });
      }
    }
  }

  return lines;
}

// 统计变更
function countChanges(lines: DiffLine[]): { added: number; removed: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.type === "added") acc.added++;
      if (line.type === "removed") acc.removed++;
      return acc;
    },
    { added: 0, removed: 0 }
  );
}

// 过滤只显示变化的行及上下文，省略未变化的部分
function filterChangedLines(diffLines: DiffLine[], contextLines: number = 3): DiffLine[] {
  const changedIndices = new Set<number>();
  
  // 找出所有变更行的索引
  diffLines.forEach((line, i) => {
    if (line.type !== "unchanged") {
      changedIndices.add(i);
    }
  });
  
  // 如果没有变更，返回空
  if (changedIndices.size === 0) {
    return [];
  }
  
  // 计算需要显示的行索引
  const visibleIndices = new Set<number>();
  changedIndices.forEach(idx => {
    for (let i = Math.max(0, idx - contextLines); i <= Math.min(diffLines.length - 1, idx + contextLines); i++) {
      visibleIndices.add(i);
    }
  });
  
  // 构建结果，添加分隔符表示省略的内容
  const result: DiffLine[] = [];
  let lastIndex = -1;
  
  const sortedIndices = Array.from(visibleIndices).sort((a, b) => a - b);
  
  // 如果开头有省略的内容
  if (sortedIndices.length > 0 && sortedIndices[0] > 0) {
    result.push({
      type: "separator",
      content: `... 省略前 ${sortedIndices[0]} 行未变更内容 ...`,
    });
  }
  
  for (const i of sortedIndices) {
    // 如果和上一个显示的行不连续，添加分隔符
    if (lastIndex !== -1 && i - lastIndex > 1) {
      const skippedLines = i - lastIndex - 1;
      result.push({
        type: "separator",
        content: `... 省略 ${skippedLines} 行未变更内容 ...`,
      });
    }
    result.push(diffLines[i]);
    lastIndex = i;
  }
  
  // 如果结尾有省略的内容
  if (sortedIndices.length > 0 && sortedIndices[sortedIndices.length - 1] < diffLines.length - 1) {
    const remaining = diffLines.length - 1 - sortedIndices[sortedIndices.length - 1];
    result.push({
      type: "separator",
      content: `... 省略后 ${remaining} 行未变更内容 ...`,
    });
  }
  
  return result;
}

// 操作类型的中文描述
const operationNames: Record<string, string> = {
  update: "更新",
  insert: "插入",
  replace: "替换",
  replace_all: "完全替换",
};

export function DiffPreviewDialog({
  isOpen,
  onClose,
  pendingChange,
  onAccept,
  onReject,
}: DiffPreviewDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // 生成所有 diff 行
  const allDiffLines = useMemo(() => {
    if (!pendingChange) return [];
    return generateUnifiedDiff(pendingChange.oldValue, pendingChange.newValue);
  }, [pendingChange]);

  // 过滤只显示变化的部分
  const diffLines = useMemo(() => {
    return filterChangedLines(allDiffLines, 3);
  }, [allDiffLines]);

  // 统计变更数量（基于所有行）
  const changeStats = useMemo(() => {
    return countChanges(allDiffLines);
  }, [allDiffLines]);

  // 处理接受
  const handleAccept = async () => {
    if (!pendingChange) return;
    setIsProcessing(true);
    try {
      await onAccept(pendingChange);
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理拒绝
  const handleReject = async () => {
    if (!pendingChange) return;
    setIsProcessing(true);
    try {
      await onReject(pendingChange);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!pendingChange) return null;

  const isTitle = pendingChange.type === "title";
  const TypeIcon = isTitle ? Type : FileText;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-primary" />
            <span>确认{isTitle ? "标题" : "内容"}修改</span>
            <Badge variant="outline" className="ml-2">
              {operationNames[pendingChange.operation] || pendingChange.operation}
            </Badge>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4">
            <span>{pendingChange.description}</span>
            <div className="flex items-center gap-3 ml-auto">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Plus className="h-3.5 w-3.5" />
                {changeStats.added} 行新增
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <Minus className="h-3.5 w-3.5" />
                {changeStats.removed} 行删除
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Diff 预览区域 */}
        <div className="flex-1 min-h-0 border rounded-md bg-muted/30 overflow-hidden">
          <ScrollArea className="h-full max-h-[50vh]">
            <div className="font-mono text-sm">
              {diffLines.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  没有检测到变更
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {diffLines.map((line, index) => (
                      line.type === "separator" ? (
                        <tr key={index} className="bg-muted/50">
                          <td colSpan={4} className="px-4 py-1.5 text-center text-xs text-muted-foreground italic border-y border-border/30">
                            {line.content}
                          </td>
                        </tr>
                      ) : (
                        <tr
                          key={index}
                          className={cn(
                            "hover:bg-muted/50",
                            line.type === "added" && "bg-green-50 dark:bg-green-950/30",
                            line.type === "removed" && "bg-red-50 dark:bg-red-950/30"
                          )}
                        >
                          {/* 旧行号 */}
                          <td className="w-12 px-2 py-0.5 text-right text-xs text-muted-foreground select-none border-r border-border/50 bg-muted/30">
                            {line.type !== "added" ? line.oldLineNum : ""}
                          </td>
                          {/* 新行号 */}
                          <td className="w-12 px-2 py-0.5 text-right text-xs text-muted-foreground select-none border-r border-border/50 bg-muted/30">
                            {line.type !== "removed" ? line.newLineNum : ""}
                          </td>
                          {/* 变更标记 */}
                          <td className="w-6 px-1 py-0.5 text-center select-none">
                            {line.type === "added" && (
                              <span className="text-green-600 dark:text-green-400 font-bold">+</span>
                            )}
                            {line.type === "removed" && (
                              <span className="text-red-600 dark:text-red-400 font-bold">-</span>
                            )}
                          </td>
                          {/* 内容 */}
                          <td
                            className={cn(
                              "px-2 py-0.5 whitespace-pre-wrap break-all",
                              line.type === "added" && "text-green-800 dark:text-green-200",
                              line.type === "removed" && "text-red-800 dark:text-red-200 line-through opacity-75"
                            )}
                          >
                            {line.content || " "}
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 提示信息 */}
        <div className="text-xs text-muted-foreground flex items-center gap-2 py-2">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>接受后将直接应用到编辑器中，拒绝则保持原内容不变</span>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isProcessing}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            拒绝修改
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isProcessing}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4" />
            接受修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
