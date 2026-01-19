// AI 配置相关类型定义

export type AISDKType = "openai" | "openai-compatible" | "github-copilot" | "claude-code";

// 供应商类型
export interface Provider {
  id: number;
  name: string;
  baseUrl: string;
  apiKey: string;
  sdkType: AISDKType;
  enabled: boolean;
}

// 模型能力配置（简化后的扁平结构）
export interface ModelCapabilities {
  reasoning: boolean;
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
}

// AI 循环配置（从 capabilities 中分离出来）
export interface AILoopConfig {
  maxLoops: number;
  unlimited: boolean;
}

// 模型参数
export interface ModelParameters {
  temperature: number;
  maxTokens: number;
}

// 模型类型
export interface Model {
  id: number;
  providerId: number;
  modelId: string;
  displayName: string;
  isDefault: boolean;
  enabled: boolean;
  contextLength?: number;
  parameters: ModelParameters;
  capabilities: ModelCapabilities;
  aiLoopConfig: AILoopConfig;
}

// 供应商表单数据
export interface ProviderFormData {
  name: string;
  baseUrl: string;
  apiKey: string;
  sdkType: AISDKType;
}

// 模型表单数据
export interface ModelFormData {
  modelId: string;
  displayName: string;
  isDefault: boolean;
  contextLength?: number;
  parameters: ModelParameters;
  capabilities: ModelCapabilities;
  aiLoopConfig: AILoopConfig;
}

// 测试结果
export interface TestResult {
  success: boolean;
  message: string;
  streamSupported?: boolean;
  hasReasoning?: boolean;
  response?: string | null;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
  duration?: number;
}

// 默认能力配置
export const defaultCapabilities: ModelCapabilities = {
  reasoning: false,
  streaming: true,
  functionCalling: true,
  vision: false,
};

// 默认 AI 循环配置
export const defaultAILoopConfig: AILoopConfig = {
  maxLoops: 20,
  unlimited: false,
};

// 默认模型参数
export const defaultParameters: ModelParameters = {
  temperature: 0.7,
  maxTokens: 4096,
};
