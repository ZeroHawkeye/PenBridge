/**
 * 内联 Diff 预览组件
 * 在聊天面板内展示 AI 修改的内容差异，让用户选择接受或拒绝
 * 使用类似 GitHub 的 diff 展示风格
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  FileText,
  Type,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingChange } from "./types";
import { generateOptimizedDiff, generateChangeSummary } from "./tools/optimizedDiff";

interface InlineDiffPreviewProps {
  pendingChange: PendingChange;
  onAccept: (change: PendingChange) => void;
  onReject: (change: PendingChange) => void;
}

// 移除了旧的 generateUnifiedDiff 和 countChanges 函数
// 现在使用 optimizedDiff.ts 中的优化版本

// 操作类型的中文描述
const operationNames: Record<string, string> = {
  update: "更新",
  insert: "插入",
  replace: "替换",
  replace_all: "完全替换",
};

export function InlineDiffPreview({
  pendingChange,
  onAccept,
  onReject,
}: InlineDiffPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // 检查是否应该跳过 Diff 计算
  const shouldSkipDiff = pendingChange.skipDiff ?? false;

  // 生成变更摘要（轻量级，不计算完整 diff）
  const changeSummary = useMemo(() => {
    return generateChangeSummary(pendingChange.oldValue, pendingChange.newValue);
  }, [pendingChange.oldValue, pendingChange.newValue]);

  // 生成优化的 diff（仅在展开且未跳过时计算）
  const diffResult = useMemo(() => {
    if (shouldSkipDiff || !isExpanded) {
      return null;
    }
    return generateOptimizedDiff(pendingChange.oldValue, pendingChange.newValue, {
      contextLines: 3,
      maxDisplayLines: 500,
      skipIfTooLarge: 5 * 1024 * 1024, // 5 MB
    });
  }, [pendingChange.oldValue, pendingChange.newValue, shouldSkipDiff, isExpanded]);

  // generateOptimizedDiff 已经进行了过滤和优化，直接使用其结果
  const diffLines = diffResult?.lines ?? [];
  const changeStats = diffResult?.stats ?? {
    added: changeSummary.addedLines,
    removed: changeSummary.removedLines,
    unchanged: 0,
    changedLines: changeSummary.addedLines + changeSummary.removedLines,
    totalChangedCharacters: Math.abs(changeSummary.addedChars) + changeSummary.removedChars,
  };

  // 处理接受
  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await onAccept(pendingChange);
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理拒绝
  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(pendingChange);
    } finally {
      setIsProcessing(false);
    }
  };

  const isTitle = pendingChange.type === "title";
  const TypeIcon = isTitle ? Type : FileText;

  return (
    <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
      {/* 头部 */}
      <div 
        className="flex items-center gap-2 px-3 py-2 bg-amber-100/50 dark:bg-amber-900/30 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TypeIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          确认{isTitle ? "标题" : "内容"}修改
        </span>
        <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 dark:text-amber-300">
          {operationNames[pendingChange.operation] || pendingChange.operation}
        </Badge>
        <div className="flex items-center gap-2 ml-auto text-xs">
          <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
            <Plus className="h-3 w-3" />
            {changeStats.added}
          </span>
          <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
            <Minus className="h-3 w-3" />
            {changeStats.removed}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
        </div>
      </div>

      {/* 描述 */}
      <div className="px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800">
        {pendingChange.description}
      </div>

      {/* Diff 预览区域 - 使用原生 overflow 而不是 ScrollArea 避免层叠问题 */}
      {isExpanded && (
        <div className="max-h-[200px] overflow-auto">
          <div className="font-mono text-xs">
            {diffLines.length === 0 ? (
              <div className="flex items-center justify-center h-16 text-muted-foreground">
                没有检测到变更
              </div>
            ) : (
              <table className="w-full border-collapse">
                <tbody>
                  {diffLines.map((line, index) => (
                    line.type === "separator" ? (
                      <tr key={index} className="bg-muted/50">
                        <td colSpan={2} className="px-3 py-1 text-center text-xs text-muted-foreground italic">
                          {line.content}
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={index}
                        className={cn(
                          line.type === "added" && "bg-green-100/70 dark:bg-green-950/40",
                          line.type === "removed" && "bg-red-100/70 dark:bg-red-950/40"
                        )}
                      >
                        {/* 变更标记 */}
                        <td className="w-5 px-1 py-0.5 text-center select-none">
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
        </div>
      )}

      {/* 操作按钮 - 确保 z-index 和 position 正确 */}
      <div className="relative z-10 flex items-center justify-end gap-2 px-3 py-2 bg-amber-100/30 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleReject();
          }}
          disabled={isProcessing}
          className="h-7 text-xs gap-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <X className="h-3 w-3" />
          拒绝
        </Button>
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleAccept();
          }}
          disabled={isProcessing}
          className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
        >
          <Check className="h-3 w-3" />
          接受
        </Button>
      </div>
    </div>
  );
}
