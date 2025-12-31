/**
 * AI 聊天主面板组件
 * 作为侧边栏展开，类似目录树
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { 
  Send, 
  Loader2, 
  Bot, 
  Trash2,
  StopCircle,
  PanelRightClose,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAIChat } from "./hooks/useAIChat";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import type { AIChatPanelProps, ChatMessage, PendingChange } from "./types";

// 最小和最大宽度
const MIN_WIDTH = 320;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 380;

// 单条消息组件 - Cline 风格
interface MessageItemProps {
  message: ChatMessage;
  pendingChanges?: PendingChange[];
  onAcceptChange?: (change: PendingChange) => void;
  onRejectChange?: (change: PendingChange) => void;
}

function MessageItem({ message, pendingChanges, onAcceptChange, onRejectChange }: MessageItemProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isFailed = message.status === "failed";
  
  // 用户消息 - 简洁的气泡样式
  if (isUser) {
    return (
      <div className="flex justify-end py-2">
        <div className="max-w-[85%] bg-blue-500 text-white px-3 py-2 rounded-lg text-sm">
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }
  
  // AI 消息 - Cline 风格，分块展示
  // 显示顺序：思考过程 → 回答内容 → 工具调用
  // 这符合 AI 的实际输出流程：先思考，然后说明要做什么，最后执行工具
  
  const hasContent = message.content && message.content.trim().length > 0;
  const hasReasoning = message.reasoning || message.isReasoning;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  
  return (
    <div className="py-2 space-y-2">
      {/* 思考过程块 - 最先显示 */}
      {hasReasoning && (
        <ThinkingBlock 
          content={message.reasoning || ""} 
          isStreaming={message.isReasoning === true}
        />
      )}
      
      {/* 回答内容块 - 在思考之后显示 */}
      {(hasContent || (isStreaming && !hasReasoning && !hasToolCalls)) && (
        <div className={cn(
          "rounded-md border-l-2 border-purple-400 dark:border-purple-500 bg-muted/50",
          isFailed && "border-red-400 dark:border-red-500"
        )}>
          {/* 回答头部 */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50">
            <Bot className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
            <span className="text-xs font-medium text-muted-foreground">
              回答
            </span>
            {isStreaming && !hasReasoning && !hasToolCalls && (
              <Loader2 className="h-3 w-3 text-purple-500 animate-spin ml-1" />
            )}
            {message.status === "completed" && message.usage && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {message.usage.totalTokens} tokens
                {message.duration && ` · ${(message.duration / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
          
          {/* 回答内容 */}
          <div className="px-3 py-2">
            <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
              {isStreaming && !hasReasoning && !hasToolCalls && (
                <span className="inline-block w-1.5 h-4 bg-purple-500 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 工具调用块 - 在回答之后显示，包含 Diff 预览 */}
      {hasToolCalls && (
        <ToolCallBlock 
          toolCalls={message.toolCalls!}
          pendingChanges={pendingChanges}
          onAcceptChange={onAcceptChange}
          onRejectChange={onRejectChange}
        />
      )}
      
      {/* 错误信息 */}
      {isFailed && message.error && (
        <div className="rounded-md border-l-2 border-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2">
          <div className="text-xs text-red-600 dark:text-red-400">
            {message.error}
          </div>
        </div>
      )}
    </div>
  );
}

export function AIChatPanel({
  isOpen,
  onClose,
  articleContext,
  toolContext,
  width: externalWidth,
  onWidthChange,
}: AIChatPanelProps) {
  // 状态
  const [inputValue, setInputValue] = useState("");
  const [internalWidth, setInternalWidth] = useState(externalWidth || DEFAULT_WIDTH);
  const width = externalWidth ?? internalWidth;
  
  // Refs
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isResizing = useRef(false);
  
  // AI 聊天 Hook
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    selectedModel,
    availableModels,
    setSelectedModel,
    sendMessage,
    stopGeneration,
    clearMessages,
    currentLoopCount,
    maxLoopCount,
    // 待确认变更
    pendingChanges,
    acceptPendingChange,
    rejectPendingChange,
  } = useAIChat({
    articleId: articleContext?.articleId,
    toolContext,
  });
  
  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  // 拖拽调整宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    
    const startX = e.clientX;
    const startWidth = width;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      
      const deltaX = startX - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + deltaX));
      
      if (onWidthChange) {
        onWidthChange(newWidth);
      } else {
        setInternalWidth(newWidth);
      }
    };
    
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [width, onWidthChange]);
  
  // 发送消息
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return;
    
    const message = inputValue.trim();
    setInputValue("");
    await sendMessage(message);
  }, [inputValue, isLoading, isStreaming, sendMessage]);
  
  // 键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);
  
  // 模型选择
  const handleModelChange = useCallback((modelId: string) => {
    const model = availableModels.find(m => `${m.providerId}_${m.modelId}` === modelId);
    if (model) {
      setSelectedModel(model);
    }
  }, [availableModels, setSelectedModel]);
  
  if (!isOpen) return null;
  
  return (
    <>
    <div
      ref={panelRef}
      className="border-l bg-background shrink-0 flex flex-col relative overflow-hidden"
      style={{ width: `${width}px` }}
    >
      {/* 拖拽调整宽度的手柄 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
        onMouseDown={handleMouseDown}
      />
      
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground min-w-0">
          <Bot className="h-4 w-4 shrink-0 text-purple-500" />
          <span className="truncate">AI 助手</span>
          {currentLoopCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ({currentLoopCount}/{maxLoopCount})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={clearMessages}
                  disabled={isLoading || isStreaming}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">清空对话</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onClose}
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">关闭 AI 助手</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
        
        {/* 模型选择 */}
        <div className="px-4 py-2 border-b shrink-0">
          <Select
            value={selectedModel ? `${selectedModel.providerId}_${selectedModel.modelId}` : ""}
            onValueChange={handleModelChange}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map(model => (
                <SelectItem 
                  key={`${model.providerId}_${model.modelId}`}
                  value={`${model.providerId}_${model.modelId}`}
                  className="text-xs"
                >
                  <span>{model.displayName}</span>
                  <span className="text-muted-foreground ml-2">
                    ({model.providerName})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* 消息列表 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-4 py-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">开始与 AI 对话</p>
                <p className="text-xs mt-1">
                  {articleContext 
                    ? "我可以帮助你改进这篇文章" 
                    : "我可以回答问题或帮助你完成任务"
                  }
                </p>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <MessageItem 
                    key={message.id || index} 
                    message={message}
                    pendingChanges={pendingChanges}
                    onAcceptChange={acceptPendingChange}
                    onRejectChange={rejectPendingChange}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
            </div>
          </ScrollArea>
        </div>
        
        {/* 错误提示 */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        {/* 待确认变更提示 - 当有多个待确认变更时显示计数 */}
        {pendingChanges.length > 1 && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800 shrink-0">
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>还有 {pendingChanges.length - 1} 个修改等待确认</span>
            </div>
          </div>
        )}
        
        {/* 输入区域 */}
        <div className="px-4 py-3 border-t shrink-0">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !selectedModel 
                  ? "请先选择 AI 模型..." 
                  : isStreaming 
                    ? "AI 正在回复..." 
                    : "输入消息... (Enter 发送, Shift+Enter 换行)"
              }
              disabled={!selectedModel || isLoading}
              className="resize-none pr-12 min-h-[80px] max-h-[200px]"
              rows={3}
            />
            <div className="absolute right-2 bottom-2 flex gap-1">
              {isStreaming ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                  onClick={stopGeneration}
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading || !selectedModel}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
