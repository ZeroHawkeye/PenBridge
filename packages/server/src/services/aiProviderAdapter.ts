/**
 * AI Provider 适配器
 * 
 * 统一抽象不同 AI SDK 的差异，提供一致的接口
 * 支持 @ai-sdk/openai 和 @ai-sdk/openai-compatible 两种 SDK
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { AIProvider, AIModel, ModelCapabilities, AISDKType } from "../entities/AIProvider";

/**
 * 推理努力程度 (仅 OpenAI SDK 支持)
 */
export type ReasoningEffort = "low" | "medium" | "high";

/**
 * 深度思考配置
 */
export interface ThinkingConfig {
  enabled: boolean;
  reasoningEffort?: ReasoningEffort;
}

/**
 * streamText 的 Provider 特定选项
 */
export interface ProviderStreamOptions {
  /** 是否启用推理模式 (仅 OpenAI SDK 原生支持) */
  reasoning?: {
    enabled: boolean;
    effort?: ReasoningEffort;
  };
  /** 温度参数 */
  temperature?: number;
  /** 最大输出 tokens */
  maxOutputTokens?: number;
}

/**
 * Provider 适配器接口
 */
export interface AIProviderAdapterInterface {
  /** Provider 类型 */
  readonly sdkType: AISDKType;
  
  /** 创建 AI 模型实例 */
  createModel(modelId: string): LanguageModel;
  
  /** 是否支持原生推理 (reasoning) */
  supportsNativeReasoning(): boolean;
  
  /** 是否支持视觉 */
  supportsVision(capabilities?: ModelCapabilities): boolean;
  
  /** 是否支持函数调用 */
  supportsFunctionCalling(capabilities?: ModelCapabilities): boolean;
  
  /** 获取 streamText 的 provider 特定选项 */
  getProviderOptions(options: ProviderStreamOptions): Record<string, any>;
}

/**
 * OpenAI SDK 适配器
 * 使用 @ai-sdk/openai，原生支持 reasoning (o1/o3 系列模型)
 */
export class OpenAIAdapter implements AIProviderAdapterInterface {
  readonly sdkType: AISDKType = "openai";
  
  private readonly provider: ReturnType<typeof createOpenAI>;
  
  constructor(
    private readonly config: {
      apiKey: string;
      baseURL: string;
      name?: string;
    }
  ) {
    this.provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }
  
  createModel(modelId: string): LanguageModel {
    return this.provider(modelId);
  }
  
  /**
   * OpenAI SDK 原生支持 reasoning (o1/o3 模型)
   */
  supportsNativeReasoning(): boolean {
    return true;
  }
  
  supportsVision(capabilities?: ModelCapabilities): boolean {
    return capabilities?.vision ?? false;
  }
  
  supportsFunctionCalling(capabilities?: ModelCapabilities): boolean {
    return capabilities?.functionCalling ?? true;
  }
  
  /**
   * OpenAI 特定的 provider 选项
   */
  getProviderOptions(options: ProviderStreamOptions): Record<string, any> {
    const providerOptions: Record<string, any> = {};
    
    // 推理模式配置
    if (options.reasoning?.enabled) {
      providerOptions.openai = {
        reasoningEffort: options.reasoning.effort || "medium",
      };
    }
    
    return Object.keys(providerOptions).length > 0 
      ? { providerOptions } 
      : {};
  }
}

/**
 * OpenAI Compatible SDK 适配器
 * 使用 @ai-sdk/openai-compatible，适用于智谱、DeepSeek、通义千问等
 */
export class OpenAICompatibleAdapter implements AIProviderAdapterInterface {
  readonly sdkType: AISDKType = "openai-compatible";
  
  private readonly provider: ReturnType<typeof createOpenAICompatible>;
  
  constructor(
    private readonly config: {
      apiKey: string;
      baseURL: string;
      name: string;
    }
  ) {
    this.provider = createOpenAICompatible({
      name: config.name,
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }
  
  createModel(modelId: string): LanguageModel {
    return this.provider(modelId);
  }
  
  /**
   * OpenAI Compatible SDK 不原生支持 reasoning 配置
   * 注: DeepSeek-R1 等模型会自动返回 reasoning tokens，无需配置
   */
  supportsNativeReasoning(): boolean {
    return false;
  }
  
  supportsVision(capabilities?: ModelCapabilities): boolean {
    return capabilities?.vision ?? false;
  }
  
  supportsFunctionCalling(capabilities?: ModelCapabilities): boolean {
    return capabilities?.functionCalling ?? true;
  }
  
  /**
   * OpenAI Compatible 不支持额外的 provider 选项
   */
  getProviderOptions(_options: ProviderStreamOptions): Record<string, any> {
    // openai-compatible 不支持 reasoning 等特定选项
    return {};
  }
}

/**
 * 创建 Provider 适配器的工厂函数
 */
export function createProviderAdapter(provider: AIProvider): AIProviderAdapterInterface {
  const config = {
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
    name: provider.name,
  };
  
  switch (provider.sdkType) {
    case "openai":
      return new OpenAIAdapter(config);
    case "openai-compatible":
    default:
      return new OpenAICompatibleAdapter(config);
  }
}

/**
 * 根据 Provider 和 Model 配置创建 AI 模型实例
 */
export function createAIModelInstance(
  provider: AIProvider,
  model: AIModel
): {
  model: LanguageModel;
  adapter: AIProviderAdapterInterface;
} {
  const adapter = createProviderAdapter(provider);
  const modelInstance = adapter.createModel(model.modelId);
  
  return {
    model: modelInstance,
    adapter,
  };
}

/**
 * 构建 streamText 选项
 */
export function buildStreamTextOptions(
  adapter: AIProviderAdapterInterface,
  model: AIModel,
  options: {
    thinkingConfig?: ThinkingConfig;
    temperature?: number;
    maxOutputTokens?: number;
  }
): Record<string, any> {
  const capabilities = model.capabilities;
  const streamOptions: Record<string, any> = {};
  
  // 基础参数
  if (options.temperature !== undefined) {
    streamOptions.temperature = options.temperature;
  }
  if (options.maxOutputTokens !== undefined) {
    streamOptions.maxOutputTokens = options.maxOutputTokens;
  }
  
  // 推理模式 (仅在 adapter 支持且 model 配置启用时)
  if (
    options.thinkingConfig?.enabled &&
    capabilities?.reasoning &&
    adapter.supportsNativeReasoning()
  ) {
    const providerOptions = adapter.getProviderOptions({
      reasoning: {
        enabled: true,
        effort: options.thinkingConfig.reasoningEffort,
      },
    });
    Object.assign(streamOptions, providerOptions);
  }
  
  return streamOptions;
}
