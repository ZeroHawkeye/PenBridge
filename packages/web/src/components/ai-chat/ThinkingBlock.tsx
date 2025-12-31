/**
 * 思维链/推理过程展示组件
 * Cline 风格 - 独立的可折叠思考块
 */

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export function ThinkingBlock({ 
  content, 
  isStreaming = false,
  defaultExpanded = false,
  className 
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // 流式输出时自动展开
  useEffect(() => {
    if (isStreaming && content) {
      setIsExpanded(true);
    }
  }, [isStreaming, content]);
  
  if (!content && !isStreaming) return null;
  
  // 计算行数用于显示
  const lineCount = content ? content.split('\n').length : 0;
  
  return (
    <div className={cn(
      "rounded-md border-l-2 border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
      className
    )}>
      {/* 头部 - 可点击折叠 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
      >
        <span className="shrink-0 text-amber-600 dark:text-amber-400">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
        
        <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
        
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          思考中
        </span>
        
        {isStreaming && (
          <Loader2 className="h-3 w-3 text-amber-500 animate-spin ml-1" />
        )}
        
        {!isExpanded && content && (
          <span className="text-[11px] text-amber-600/70 dark:text-amber-400/70 ml-auto">
            {lineCount} 行
          </span>
        )}
      </button>
      
      {/* 内容区域 */}
      {isExpanded && (
        <div className="px-3 pb-2 pt-0">
          <div className="text-xs text-amber-900/80 dark:text-amber-100/80 whitespace-pre-wrap leading-relaxed font-mono bg-amber-100/30 dark:bg-amber-900/20 rounded p-2 max-h-[300px] overflow-y-auto">
            {content || (isStreaming ? "正在思考..." : "")}
            {isStreaming && (
              <span className="inline-block w-1.5 h-3 bg-amber-500 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
