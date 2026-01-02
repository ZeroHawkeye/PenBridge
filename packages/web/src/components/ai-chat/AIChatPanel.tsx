/**
 * AI 聊天主面板组件
 * 作为侧边栏展开，类似目录树
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Send,
  Loader2,
  Bot,
  Trash2,
  StopCircle,
  PanelRightClose,
  AlertCircle,
  Brain,
  Settings2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select as AntdSelect } from "antd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAIChat } from "./hooks/useAIChat";
import { useToolPermissions } from "./hooks/useToolPermissions";
import { ToolPermissionDialog } from "./ToolPermissionDialog";
import { AILoadingIndicator } from "./AILoadingIndicator";
import { MessageItem } from "./MessageItem";
import type { AIChatPanelProps } from "./types";

// 最小宽度（最大宽度不限制，可自由拖拽）
const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 380;

export function AIChatPanel({
  isOpen,
  onClose,
  articleContext,
  toolContext,
  width: externalWidth,
  onWidthChange,
  isMobile = false,
}: AIChatPanelProps & { isMobile?: boolean }) {
  // 状态
  const [inputValue, setInputValue] = useState("");
  const [internalWidth, setInternalWidth] = useState(externalWidth || DEFAULT_WIDTH);
  const width = externalWidth ?? internalWidth;
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  
  // Refs
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isResizing = useRef(false);
  
  // 智能滚动状态：追踪用户是否在底部附近
  const shouldAutoScrollRef = useRef(true);
  
  // 工具权限配置 Hook
  const toolPermissions = useToolPermissions();
  
  // AI 聊天 Hook
  const {
    session,
    messages,
    isLoading,
    isStreaming,
    error,
    selectedModel,
    availableModels,
    setSelectedModel,
    // 深度思考设置
    thinkingSettings,
    setThinkingSettings,
    sendMessage,
    stopGeneration,
    clearMessages,
    currentLoopCount,
    maxLoopCount,
    // 待确认变更
    pendingChanges,
    currentPendingChange,
    acceptPendingChange,
    rejectPendingChange,
  } = useAIChat({
    articleId: articleContext?.articleId,
    toolContext,
    // 传入权限检查函数
    requiresApproval: toolPermissions.requiresApproval,
  });
  
  // 判断当前模型是否支持工具调用
  const supportsToolCalling = selectedModel?.capabilities?.functionCalling ?? false;
  
  // 计算当前会话的 token 总使用量
  // 优先从 messages 中累计（实时），如果为 0 则使用 session.totalTokens（历史数据）
  const sessionTokens = useMemo(() => {
    const fromMessages = messages.reduce((sum, m) => sum + (m.usage?.totalTokens || 0), 0);
    // 如果从消息中计算的值为 0，使用会话中存储的历史值
    return fromMessages > 0 ? fromMessages : (session?.totalTokens || 0);
  }, [messages, session?.totalTokens]);
  
  // 判断用户是否在底部（允许 50px 的误差）
  const isNearBottom = useCallback(() => {
    const container = scrollAreaRef.current;
    if (!container) return true;
    const threshold = 50;
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  }, []);
  
  // 滚动到底部的函数
  const scrollToBottom = useCallback(() => {
    const container = scrollAreaRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);
  
  // 处理用户手动滚动事件
  const handleScroll = useCallback(() => {
    // 根据当前滚动位置更新是否应该自动滚动的状态
    shouldAutoScrollRef.current = isNearBottom();
  }, [isNearBottom]);
  
  // 获取消息内容的快照用于检测变化（包括流式输出的内容）
  const lastMessage = messages[messages.length - 1];
  const messagesSnapshot = messages.length > 0 ? {
    length: messages.length,
    lastContent: lastMessage?.content?.length || 0,
    lastReasoning: lastMessage?.reasoning?.length || 0,
    lastToolCalls: lastMessage?.toolCalls?.length || 0,
    lastStatus: lastMessage?.status,
  } : null;
  
  // 内容更新时的自动滚动逻辑
  useEffect(() => {
    // 如果用户在底部附近（shouldAutoScrollRef 为 true），则自动滚动
    if (shouldAutoScrollRef.current) {
      // 使用 requestAnimationFrame 确保在 DOM 更新后滚动
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messagesSnapshot?.length, messagesSnapshot?.lastContent, messagesSnapshot?.lastReasoning, messagesSnapshot?.lastToolCalls, messagesSnapshot?.lastStatus, scrollToBottom]);
  
  // 发送新消息时，强制滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      // 当用户发送新消息时，强制启用自动滚动并滚动到底部
      if (lastMsg?.role === "user" && lastMsg?.status === "completed") {
        shouldAutoScrollRef.current = true;
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      }
    }
  }, [messages.length, scrollToBottom]);
  
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
      // 最大宽度为窗口宽度的 80%，确保不会完全覆盖编辑器
      const maxWidth = Math.floor(window.innerWidth * 0.8);
      const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + deltaX));
      
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
  
  // 模型选择 - 使用 ref 存储最新的 availableModels 以避免依赖变化导致的重新渲染
  const availableModelsRef = useRef(availableModels);
  availableModelsRef.current = availableModels;
  
  const handleModelChange = useCallback((modelId: string) => {
    const model = availableModelsRef.current.find(m => `${m.providerId}_${m.modelId}` === modelId);
    if (model) {
      setSelectedModel(model);
    }
  }, [setSelectedModel]);
  
  if (!isOpen) return null;
  
  return (
    <>
    <div
      ref={panelRef}
      className={cn(
        "bg-background flex flex-col relative overflow-hidden",
        isMobile ? "h-full w-full" : "border-l shrink-0"
      )}
      style={isMobile ? undefined : { width: `${width}px` }}
    >
      {/* 拖拽调整宽度的手柄 - 仅桌面端显示 */}
      {!isMobile && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
          onMouseDown={handleMouseDown}
        />
      )}
      
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
          {/* 工具权限配置按钮 - 仅当模型支持工具调用时显示 */}
          {supportsToolCalling && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-6 w-6",
                      toolPermissions.isYoloMode && "text-amber-500"
                    )}
                    onClick={() => setPermissionDialogOpen(true)}
                  >
                    {toolPermissions.isYoloMode ? (
                      <Zap className="h-3.5 w-3.5" />
                    ) : (
                      <Settings2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {toolPermissions.isYoloMode ? "YOLO 模式已开启" : "工具权限配置"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
        
        {/* Token 使用量展示 - 仅在有实际使用量时显示 */}
        {sessionTokens > 0 && (
          <div className="px-4 py-2 border-b shrink-0 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>会话 Tokens</span>
              <span>
                {sessionTokens.toLocaleString()}
                {selectedModel?.contextLength && (
                  <span className="text-muted-foreground/70">
                    {" / "}{selectedModel.contextLength.toLocaleString()}
                  </span>
                )}
              </span>
            </div>
            {/* 进度条 - 仅在配置了上下文长度时显示 */}
            {selectedModel?.contextLength && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    sessionTokens / selectedModel.contextLength > 0.9 
                      ? "bg-red-500" 
                      : sessionTokens / selectedModel.contextLength > 0.7 
                        ? "bg-yellow-500" 
                        : "bg-purple-500"
                  )}
                  style={{ 
                    width: `${Math.min(100, (sessionTokens / selectedModel.contextLength) * 100)}%` 
                  }}
                />
              </div>
            )}
          </div>
        )}
        
        {/* 消息列表 */}
        <div className="flex-1 min-h-0 relative">
          <div ref={scrollAreaRef} className="absolute inset-0 overflow-y-auto" onScroll={handleScroll}>
            <div className="px-4 py-4">
            {messages.length === 0 && !isLoading ? (
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
                    currentPendingChange={currentPendingChange}
                    onAcceptChange={acceptPendingChange}
                    onRejectChange={rejectPendingChange}
                  />
                ))}
                {/* AI 正在等待响应的 Loading 状态 */}
                {isLoading && !isStreaming && pendingChanges.length === 0 && (() => {
                  // 检查最后一条消息的状态来决定显示什么提示
                  const lastMessage = messages[messages.length - 1];
                  const hasRunningTools = lastMessage?.toolCalls?.some(
                    tc => tc.status === "running" || tc.status === "pending"
                  );
                  const hasAwaitingTools = lastMessage?.toolCalls?.some(
                    tc => tc.status === "awaiting_confirmation"
                  );
                  const hasCompletedTools = lastMessage?.toolCalls?.some(
                    tc => tc.status === "completed"
                  );
                  
                  // 如果有正在执行的工具，不显示底部 loading（工具块内已经有提示）
                  if (hasRunningTools) {
                    return null;
                  }
                  
                  // 如果有等待确认的工具，不显示底部 loading（等待用户操作）
                  if (hasAwaitingTools) {
                    return null;
                  }
                  
                  // 如果工具已完成，说明 AI 正在继续回复
                  const loadingMessage = hasCompletedTools 
                    ? "AI 正在继续回复..." 
                    : "AI 正在思考...";
                  return <AILoadingIndicator message={loadingMessage} />;
                })()}
                <div ref={messagesEndRef} />
              </>
            )}
            </div>
          </div>
        </div>
        
        {/* 错误提示 */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        {/* 待确认变更提示 - 当有多个待确认变更时显示进度 */}
        {pendingChanges.length > 0 && currentPendingChange && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800 shrink-0">
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>
                正在审核第 {pendingChanges.findIndex(c => c.id === currentPendingChange.id) + 1} / {pendingChanges.length} 个修改
              </span>
            </div>
          </div>
        )}
        
        {/* 输入区域 - 参考 Claude 风格 */}
        <div className="border-t shrink-0">
          {/* 输入框 */}
          <div className="px-3 pt-3">
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
                    : "输入消息..."
              }
              disabled={!selectedModel || isLoading}
              className="resize-none min-h-[60px] max-h-[150px] border-0 shadow-none focus-visible:ring-0 px-0"
              rows={2}
            />
          </div>
          
          {/* 底部工具栏 */}
          <div className="flex items-center justify-between px-3 py-2">
            {/* 左侧：深度思考开关 */}
            <div className="flex items-center gap-2">
              {selectedModel?.capabilities?.reasoning && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={thinkingSettings.enabled ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-7 gap-1.5 text-xs",
                          thinkingSettings.enabled && "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        )}
                        onClick={() => setThinkingSettings({ ...thinkingSettings, enabled: !thinkingSettings.enabled })}
                        disabled={isLoading || isStreaming}
                      >
                        <Brain className="h-3.5 w-3.5" />
                        <span>深度思考</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {thinkingSettings.enabled ? "关闭深度思考" : "开启深度思考"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* 推理努力程度选择器 - 仅在启用深度思考时显示 */}
              {selectedModel?.capabilities?.reasoning && 
               thinkingSettings.enabled && (
                <AntdSelect
                  value={thinkingSettings.reasoningEffort}
                  onChange={(value) => setThinkingSettings({ ...thinkingSettings, reasoningEffort: value })}
                  disabled={isLoading || isStreaming}
                  size="small"
                  variant="borderless"
                  className="w-16 ai-chat-select"
                  popupClassName="ai-chat-select-popup"
                  getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
                  options={[
                    { value: "low", label: "低" },
                    { value: "medium", label: "中" },
                    { value: "high", label: "高" },
                  ]}
                />
              )}
            </div>
            
            {/* 右侧：模型选择 + 发送按钮 */}
            <div className="flex items-center gap-2">
              {/* 模型选择器 */}
              <AntdSelect
                value={selectedModel ? `${selectedModel.providerId}_${selectedModel.modelId}` : undefined}
                onChange={handleModelChange}
                placeholder="选择模型"
                size="small"
                variant="borderless"
                className="min-w-24 ai-chat-select"
                popupClassName="ai-chat-select-popup"
                popupMatchSelectWidth={false}
                getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
                options={availableModels.map(model => ({
                  value: `${model.providerId}_${model.modelId}`,
                  label: model.displayName,
                }))}
              />
              
              {/* 发送/停止按钮 */}
              {isStreaming ? (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 rounded-full bg-red-500 hover:bg-red-600 text-white"
                  onClick={stopGeneration}
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 rounded-full bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading || !selectedModel}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 工具权限配置对话框 */}
      <ToolPermissionDialog
        open={permissionDialogOpen}
        onOpenChange={setPermissionDialogOpen}
        permissions={toolPermissions}
      />
    </>
  );
}
