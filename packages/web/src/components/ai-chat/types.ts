/**
 * AI 聊天相关类型定义
 */

// 待确认的变更
export interface PendingChange {
  id: string;
  toolCallId: string;
  type: "title" | "content";
  operation: "update" | "insert" | "replace" | "replace_all";
  oldValue: string;
  newValue: string;
  description: string;
  // 对于 replace 操作，记录搜索和替换的内容
  searchText?: string;
  replaceText?: string;
  position?: "start" | "end";
  // 性能优化：对于大文件跳过 Diff 计算
  skipDiff?: boolean;
}

// 工具调用记录
export interface ToolCallRecord {
  id: string;
  type: "function" | "mcp";
  name: string;
  arguments: string;
  result?: string;
  status: "pending" | "running" | "completed" | "failed" | "awaiting_confirmation";
  executionLocation?: "frontend" | "backend";
  error?: string;
  startedAt?: string;
  completedAt?: string;
  // 待确认的变更
  pendingChange?: PendingChange;
  // 流式传输状态：参数正在生成中
  isStreamingArguments?: boolean;
  // 当前参数长度（用于显示进度）
  argumentsLength?: number;
}

// Token 使用统计
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 聊天消息
export interface ChatMessage {
  id: number | string;  // 临时消息用字符串 ID
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  reasoning?: string;
  isReasoning?: boolean;  // 是否正在思考中（流式传输时使用）
  toolCalls?: ToolCallRecord[];
  toolCallId?: string;
  usage?: TokenUsage;
  status: "pending" | "streaming" | "completed" | "failed";
  error?: string;
  duration?: number;
  createdAt: Date | string;
}

// 聊天会话
export interface ChatSession {
  id: number;
  userId: number;
  articleId?: number;
  title: string;
  modelId?: string;
  providerId?: number;
  totalTokens: number;
  messageCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// 文章上下文（传递给 AI）
export interface ArticleContext {
  articleId: number;
  title: string;
  content: string;
  contentLength: number;
}

// 前端工具执行上下文
export interface FrontendToolContext {
  title: string;
  content: string;
  articleId?: number;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  // 可选：通知编辑器需要刷新（用于外部修改内容后同步到编辑器）- 会重建编辑器
  onEditorRefresh?: () => void;
  // 直接设置编辑器内容（不重建编辑器，保持滚动位置）
  setEditorContent?: (markdown: string) => boolean;
}

// AI 模型信息
export interface AIModelInfo {
  id: number;
  modelId: string;
  displayName: string;
  providerId: number;
  providerName: string;
  // 上下文最大长度（tokens）- 用于展示使用进度
  contextLength?: number;
  capabilities?: {
    thinking?: { supported: boolean; enabled: boolean };
    streaming?: { supported: boolean; enabled: boolean };
    functionCalling?: { supported: boolean };
    aiLoop?: { maxLoopCount: number };
  };
}

// SSE 事件类型
export type SSEEventType = 
  | "reasoning_start"
  | "reasoning"
  | "reasoning_end"
  | "content"
  | "tool_calls"
  | "done"
  | "error";

// SSE 事件数据
export interface SSEEventData {
  type: SSEEventType;
  content?: string;
  message?: string;
  toolCalls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
    executionLocation: "frontend" | "backend";
  }>;
  error?: string;
  usage?: TokenUsage;
  duration?: number;
  hasReasoning?: boolean;
  hasToolCalls?: boolean;
}

// useAIChat Hook 返回值
export interface UseAIChatReturn {
  // 状态
  session: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // AI 模型
  selectedModel: AIModelInfo | null;
  availableModels: AIModelInfo[];
  setSelectedModel: (model: AIModelInfo | null) => void;
  
  // 操作
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  clearMessages: () => Promise<void>;
  createNewSession: () => Promise<void>;
  
  // 当前循环状态
  currentLoopCount: number;
  maxLoopCount: number;
  
  // 待确认变更
  pendingChanges: PendingChange[];
  currentPendingChange: PendingChange | null;
  acceptPendingChange: (change: PendingChange) => void;
  rejectPendingChange: (change: PendingChange) => void;
}

// AI 面板 Props
export interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  articleContext?: ArticleContext;
  toolContext: FrontendToolContext;
  width: number;
  onWidthChange: (width: number) => void;
}
