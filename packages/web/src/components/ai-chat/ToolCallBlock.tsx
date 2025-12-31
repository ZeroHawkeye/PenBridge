/**
 * 工具调用展示组件
 * 显示工具调用的名称、参数、状态和结果
 * 支持显示待确认的变更（Diff预览）
 */

import { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Wrench, 
  CheckCircle, 
  XCircle, 
  Loader2,
  FileText,
  Edit3,
  Database,
  Globe,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineDiffPreview } from "./InlineDiffPreview";
import type { ToolCallRecord, PendingChange } from "./types";

interface ToolCallBlockProps {
  toolCalls: ToolCallRecord[];
  className?: string;
  // 待确认的变更（用于显示 Diff 预览）
  pendingChanges?: PendingChange[];
  onAcceptChange?: (change: PendingChange) => void;
  onRejectChange?: (change: PendingChange) => void;
}

// 工具图标映射
const toolIcons: Record<string, React.ReactNode> = {
  read_article: <FileText className="h-3.5 w-3.5" />,
  read_article_chunk: <FileText className="h-3.5 w-3.5" />,
  update_title: <Edit3 className="h-3.5 w-3.5" />,
  insert_content: <Edit3 className="h-3.5 w-3.5" />,
  replace_content: <Edit3 className="h-3.5 w-3.5" />,
  replace_all_content: <Edit3 className="h-3.5 w-3.5" />,
  query_articles: <Database className="h-3.5 w-3.5" />,
  get_article_by_id: <Database className="h-3.5 w-3.5" />,
  web_search: <Globe className="h-3.5 w-3.5" />,
  fetch_url: <Globe className="h-3.5 w-3.5" />,
};

// 工具名称映射
const toolNames: Record<string, string> = {
  read_article: "读取文章",
  read_article_chunk: "分段读取文章",
  update_title: "更新标题",
  insert_content: "插入内容",
  replace_content: "替换内容",
  replace_all_content: "替换全部内容",
  query_articles: "查询文章",
  get_article_by_id: "获取文章详情",
  web_search: "网页搜索",
  fetch_url: "抓取网页",
};

// 状态图标和颜色
const statusConfig = {
  pending: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  running: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  completed: {
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  failed: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  awaiting_confirmation: {
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "text-amber-500",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
};

interface SingleToolCallProps {
  toolCall: ToolCallRecord;
  pendingChange?: PendingChange;
  onAcceptChange?: (change: PendingChange) => void;
  onRejectChange?: (change: PendingChange) => void;
}

function SingleToolCall({ toolCall, pendingChange, onAcceptChange, onRejectChange }: SingleToolCallProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const status = statusConfig[toolCall.status];
  const icon = toolIcons[toolCall.name] || <Wrench className="h-3.5 w-3.5" />;
  const displayName = toolNames[toolCall.name] || toolCall.name;
  
  // 解析参数
  let parsedArgs: Record<string, any> = {};
  try {
    parsedArgs = JSON.parse(toolCall.arguments || "{}");
  } catch {
    // 忽略解析错误
  }
  
  // 解析结果
  let parsedResult: any = null;
  try {
    if (toolCall.result) {
      parsedResult = JSON.parse(toolCall.result);
    }
  } catch {
    parsedResult = toolCall.result;
  }
  
  return (
    <div className="space-y-2">
      {/* 工具调用信息卡片 */}
      <div className={cn(
        "rounded-md border",
        status.bgColor
      )}>
        {/* 头部 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-md"
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          
          <span className={cn("shrink-0", status.color)}>
            {icon}
          </span>
          
          <span className="text-xs font-medium truncate">
            {displayName}
          </span>
          
          <span className={cn("ml-auto shrink-0", status.color)}>
            {status.icon}
          </span>
          
          {toolCall.executionLocation === "backend" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              服务端
            </span>
          )}
        </button>
        
        {/* 展开内容 */}
        {isExpanded && (
          <div className="px-2.5 pb-2 pt-1 space-y-2 border-t border-black/5 dark:border-white/5">
            {/* 参数 */}
            {Object.keys(parsedArgs).length > 0 && (
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-1">参数</div>
                <pre className="text-xs bg-black/5 dark:bg-white/5 rounded p-2 overflow-x-auto">
                  {JSON.stringify(parsedArgs, null, 2)}
                </pre>
              </div>
            )}
            
            {/* 结果 */}
            {parsedResult && (
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-1">结果</div>
                <pre className="text-xs bg-black/5 dark:bg-white/5 rounded p-2 overflow-x-auto max-h-40">
                  {typeof parsedResult === "string" 
                    ? parsedResult 
                    : JSON.stringify(parsedResult, null, 2)
                  }
                </pre>
              </div>
            )}
            
            {/* 错误 */}
            {toolCall.error && (
              <div>
                <div className="text-[10px] font-medium text-red-500 mb-1">错误</div>
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
                  {toolCall.error}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 待确认的变更 - Diff 预览（独立于工具调用卡片，避免事件冲突） */}
      {pendingChange && onAcceptChange && onRejectChange && (
        <InlineDiffPreview
          pendingChange={pendingChange}
          onAccept={onAcceptChange}
          onReject={onRejectChange}
        />
      )}
    </div>
  );
}

export function ToolCallBlock({ 
  toolCalls, 
  className,
  pendingChanges,
  onAcceptChange,
  onRejectChange,
}: ToolCallBlockProps) {
  if (!toolCalls || toolCalls.length === 0) return null;
  
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Wrench className="h-3 w-3" />
        <span>工具调用 ({toolCalls.length})</span>
      </div>
      {toolCalls.map((toolCall, index) => {
        // 查找对应的待确认变更
        const pendingChange = pendingChanges?.find(pc => pc.toolCallId === toolCall.id);
        return (
          <SingleToolCall 
            key={toolCall.id || index} 
            toolCall={toolCall}
            pendingChange={pendingChange}
            onAcceptChange={onAcceptChange}
            onRejectChange={onRejectChange}
          />
        );
      })}
    </div>
  );
}
