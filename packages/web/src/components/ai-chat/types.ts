/**
 * AI 聊天相关类型定义
 */

// 工具执行位置
export type ToolExecutionLocation = "frontend" | "backend";

// 工具定义（统一的工具信息，用于权限配置、UI展示等）
export interface ToolDefinition {
  // 工具名称（唯一标识）
  name: string;
  // 显示名称
  displayName: string;
  // 工具描述
  description: string;
  // 工具类型：read（只读）、write（修改）
  type: "read" | "write";
  // 执行位置：前端或后端
  executionLocation: ToolExecutionLocation;
  // 默认是否需要审核
  defaultRequiresApproval: boolean;
}

// 统一的工具注册表 - 所有工具都在这里定义
// 添加新工具时只需在此处添加，其他地方会自动同步
export const TOOL_REGISTRY: ToolDefinition[] = [
  // ========== 前端工具 ==========
  {
    name: "read_article",
    displayName: "读取文章",
    description: "读取当前文章的内容",
    type: "read",
    executionLocation: "frontend",
    defaultRequiresApproval: false, // 只读工具不需要审核
  },
  {
    name: "update_title",
    displayName: "更新标题",
    description: "修改文章标题",
    type: "write",
    executionLocation: "frontend",
    defaultRequiresApproval: true,
  },
  {
    name: "insert_content",
    displayName: "插入内容",
    description: "在指定位置插入新内容",
    type: "write",
    executionLocation: "frontend",
    defaultRequiresApproval: true,
  },
  {
    name: "replace_content",
    displayName: "替换内容",
    description: "查找并替换部分内容",
    type: "write",
    executionLocation: "frontend",
    defaultRequiresApproval: true,
  },
  // ========== 后端工具 ==========
  {
    name: "query_articles",
    displayName: "查询文章",
    description: "搜索已有的文章列表",
    type: "read",
    executionLocation: "backend",
    defaultRequiresApproval: true,
  },
  {
    name: "get_article_by_id",
    displayName: "获取文章详情",
    description: "获取指定文章的详细信息",
    type: "read",
    executionLocation: "backend",
    defaultRequiresApproval: true,
  },
  {
    name: "view_image",
    displayName: "查看图片",
    description: "使用视觉模型分析图片内容",
    type: "read",
    executionLocation: "backend",
    defaultRequiresApproval: true,
  },
];

// 工具注册表的便捷访问方法
export const ToolRegistry = {
  // 获取所有工具
  getAll: () => TOOL_REGISTRY,
  
  // 根据名称获取工具定义
  getByName: (name: string) => TOOL_REGISTRY.find(t => t.name === name),
  
  // 获取前端工具列表
  getFrontendTools: () => TOOL_REGISTRY.filter(t => t.executionLocation === "frontend"),
  
  // 获取后端工具列表
  getBackendTools: () => TOOL_REGISTRY.filter(t => t.executionLocation === "backend"),
  
  // 获取所有前端工具名称
  getFrontendToolNames: () => TOOL_REGISTRY.filter(t => t.executionLocation === "frontend").map(t => t.name),
  
  // 获取所有后端工具名称
  getBackendToolNames: () => TOOL_REGISTRY.filter(t => t.executionLocation === "backend").map(t => t.name),
  
  // 判断是否为前端工具
  isFrontendTool: (name: string) => {
    const tool = TOOL_REGISTRY.find(t => t.name === name);
    return tool?.executionLocation === "frontend";
  },
  
  // 判断是否为修改类工具
  isWriteTool: (name: string) => {
    const tool = TOOL_REGISTRY.find(t => t.name === name);
    return tool?.type === "write";
  },
  
  // 获取只读工具
  getReadTools: () => TOOL_REGISTRY.filter(t => t.type === "read"),
  
  // 获取修改工具
  getWriteTools: () => TOOL_REGISTRY.filter(t => t.type === "write"),
};

// 工具权限配置（兼容旧类型）
export interface ToolPermission {
  toolName: string;
  displayName: string;
  description: string;
  requiresApproval: boolean;
  type: "read" | "write";
}

// 工具权限设置
export interface ToolPermissionSettings {
  // YOLO 模式：开启后所有工具都不需要审核
  yoloMode: boolean;
  // 各工具的权限配置
  permissions: Record<string, boolean>; // toolName -> requiresApproval
}

// 从工具注册表生成默认工具列表（兼容旧代码）
export const DEFAULT_TOOLS: ToolPermission[] = TOOL_REGISTRY.map(tool => ({
  toolName: tool.name,
  displayName: tool.displayName,
  description: tool.description,
  requiresApproval: tool.defaultRequiresApproval,
  type: tool.type,
}));

// 默认权限设置
export const DEFAULT_PERMISSION_SETTINGS: ToolPermissionSettings = {
  yoloMode: false,
  permissions: TOOL_REGISTRY.reduce((acc, tool) => {
    acc[tool.name] = tool.defaultRequiresApproval;
    return acc;
  }, {} as Record<string, boolean>),
};

// 待确认的变更
export interface PendingChange {
  id: string;
  toolCallId: string;
  type: "title" | "content";
  operation: "update" | "insert" | "replace";
  oldValue: string;
  newValue: string;
  description: string;
  // 对于 replace 操作，记录搜索和替换的内容
  searchText?: string;
  replaceText?: string;
  position?: "start" | "end";
  // 性能优化：对于大文件跳过 Diff 计算
  skipDiff?: boolean;
  // 只读审批：标识这是一个只读工具的审批，确认时不会修改文章内容
  isReadOnly?: boolean;
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
  // 简化后的能力配置
  capabilities?: {
    reasoning: boolean;
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
  };
  // AI 循环配置（从 capabilities 中分离）
  aiLoopConfig?: {
    maxLoops: number;
    unlimited: boolean;
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

// 深度思考配置（用于 AI Chat 面板动态选择）
export interface ThinkingSettings {
  enabled: boolean;
  // 推理努力程度（仅 OpenAI 格式时使用）
  reasoningEffort: "low" | "medium" | "high";
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
  
  // 深度思考设置（动态控制）
  thinkingSettings: ThinkingSettings;
  setThinkingSettings: (settings: ThinkingSettings) => void;
  
  // 操作
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  clearMessages: () => Promise<void>;
  createNewSession: () => Promise<void>;
  
  // 当前循环状态
  currentLoopCount: number;
  maxLoopCount: number;
  unlimitedLoop: boolean;
  
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
