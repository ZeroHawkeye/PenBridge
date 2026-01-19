/**
 * AI Provider 适配器
 * 
 * 统一抽象不同 AI SDK 的差异，提供一致的接口
 * 支持 @ai-sdk/openai、@ai-sdk/openai-compatible 和 GitHub Copilot
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import type { AIProvider, AIModel, ModelCapabilities, AISDKType } from "../entities/AIProvider";
import {
  type CopilotAuthInfo,
  getCopilotToken,
  getCopilotApiBaseUrl,
  COPILOT_HEADERS,
} from "./githubCopilotAuth";
import {
  type ClaudeCodeAuthInfo,
  refreshTokenIfNeeded,
  ANTHROPIC_VERSION,
  ANTHROPIC_BETA,
  CLAUDE_CODE_SYSTEM_PREFIX,
} from "./claudeCodeAuth";

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
 * GitHub Copilot Token 更新回调类型
 */
export type CopilotTokenUpdateCallback = (auth: CopilotAuthInfo) => Promise<void>;

/**
 * GitHub Copilot 适配器
 * 使用 @ai-sdk/openai-compatible，通过自定义 fetch 注入认证
 */
export class GitHubCopilotAdapter implements AIProviderAdapterInterface {
  readonly sdkType: AISDKType = "github-copilot";
  
  private readonly provider: ReturnType<typeof createOpenAICompatible>;
  private auth: CopilotAuthInfo;
  private readonly onTokenUpdate?: CopilotTokenUpdateCallback;
  
  constructor(config: {
    auth: CopilotAuthInfo;
    onTokenUpdate?: CopilotTokenUpdateCallback;
  }) {
    this.auth = config.auth;
    this.onTokenUpdate = config.onTokenUpdate;
    
    const baseURL = getCopilotApiBaseUrl(config.auth.enterpriseUrl);
    
    this.provider = createOpenAICompatible({
      name: "github-copilot",
      baseURL,
      apiKey: "", // 通过 fetch 注入认证
      fetch: this.createAuthenticatedFetch() as any,
    });
  }
  
  /**
   * 创建带认证的 fetch 函数
   * 自动处理 token 刷新和请求头注入
   */
  private createAuthenticatedFetch() {
    const self = this;
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // 检查并刷新 token（提前 5 分钟刷新）
      const now = Date.now();
      const bufferMs = 5 * 60 * 1000;
      
      if (this.auth.expiresAt - now < bufferMs) {
        try {
          const newToken = await getCopilotToken(
            this.auth.refreshToken,
            this.auth.enterpriseUrl
          );
          this.auth = {
            ...this.auth,
            accessToken: newToken.token,
            expiresAt: newToken.expiresAt,
          };
          
          // 通知外部保存新的 token
          if (this.onTokenUpdate) {
            await this.onTokenUpdate(this.auth);
          }
        } catch (error) {
          console.error("[GitHubCopilotAdapter] Token 刷新失败:", error);
          // 继续使用旧 token，可能会失败
        }
      }
      
      // 构建请求头
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${this.auth.accessToken}`);
      
      // 注入 Copilot 特定请求头
      Object.entries(COPILOT_HEADERS).forEach(([key, value]) => {
        headers.set(key, value);
      });
      
      // 添加额外的 Copilot 请求头
      headers.set("Openai-Intent", "conversation-edits");
      headers.set("X-Initiator", "agent");
      
      // 检查请求体是否包含图片（视觉请求需要特殊头）
      if (init?.body) {
        try {
          const bodyStr = typeof init.body === "string" ? init.body : "";
          // 检查是否包含图片数据（多种格式匹配）
          const hasImage = bodyStr.includes('"type":"image"') || 
                          bodyStr.includes('"type":"file"') && bodyStr.includes('"mediaType":"image') ||
                          bodyStr.includes('"image_url"') || 
                          bodyStr.includes('data:image/') ||
                          bodyStr.includes('"type": "image"') ||
                          bodyStr.includes('"type": "file"') && bodyStr.includes('"mediaType": "image');
          if (hasImage) {
            headers.set("Copilot-Vision-Request", "true");
            console.log("[GitHubCopilotAdapter] 检测到图片，添加 Copilot-Vision-Request 头");
          }
        } catch {
          // 忽略解析错误
        }
      }
      
      return fetch(input, { ...init, headers });
    };
  }
  
  createModel(modelId: string): LanguageModel {
    return this.provider(modelId);
  }
  
  /**
   * GitHub Copilot 不支持原生 reasoning 配置
   * 经测试验证：Copilot API 忽略 reasoningEffort 和 anthropic.thinking 参数
   * 深度思考由 Copilot 后端自动控制，用户无法干预
   */
  supportsNativeReasoning(): boolean {
    return false;
  }
  
  supportsVision(capabilities?: ModelCapabilities): boolean {
    // 默认支持视觉（GPT-4o 等支持）
    return capabilities?.vision ?? true;
  }
  
  supportsFunctionCalling(capabilities?: ModelCapabilities): boolean {
    return capabilities?.functionCalling ?? true;
  }
  
  getProviderOptions(_options: ProviderStreamOptions): Record<string, any> {
    return {};
  }
  
  /**
   * 获取当前认证信息
   */
  getAuth(): CopilotAuthInfo {
    return this.auth;
  }
}

export interface GitHubCopilotAdapterOptions {
  auth: CopilotAuthInfo;
  onTokenUpdate?: CopilotTokenUpdateCallback;
}

export type ClaudeCodeTokenUpdateCallback = (auth: ClaudeCodeAuthInfo) => Promise<void>;

export interface ClaudeCodeAdapterOptions {
  auth: ClaudeCodeAuthInfo;
  onTokenUpdate?: ClaudeCodeTokenUpdateCallback;
}

export class ClaudeCodeAdapter implements AIProviderAdapterInterface {
  readonly sdkType: AISDKType = "claude-code";
  
  private readonly provider: ReturnType<typeof createAnthropic>;
  private auth: ClaudeCodeAuthInfo;
  private readonly onTokenUpdate?: ClaudeCodeTokenUpdateCallback;
  
  constructor(config: ClaudeCodeAdapterOptions) {
    this.auth = config.auth;
    this.onTokenUpdate = config.onTokenUpdate;
    
    const fullBeta = this.auth.authType === "oauth" 
      ? "oauth-2025-04-20,interleaved-thinking-2025-05-14,claude-code-20250219"
      : ANTHROPIC_BETA;
    
    this.provider = createAnthropic({
      apiKey: this.auth.authType === "api_key" ? this.auth.accessToken : "",
      headers: {
        "anthropic-beta": fullBeta,
      },
      fetch: this.createAuthenticatedFetch() as any,
    });
  }
  
  private createAuthenticatedFetch() {
    const TOOL_PREFIX = "mcp_";
    
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // OAuth 模式下刷新 token
      if (this.auth.authType === "oauth") {
        try {
          const refreshedAuth = await refreshTokenIfNeeded(this.auth);
          if (refreshedAuth.accessToken !== this.auth.accessToken) {
            this.auth = refreshedAuth;
            if (this.onTokenUpdate) {
              await this.onTokenUpdate(this.auth);
            }
          }
        } catch (error) {
          console.error("[ClaudeCodeAdapter] Token 刷新失败:", error);
        }
      }
      
      const headers = new Headers(init?.headers);
      headers.set("anthropic-version", ANTHROPIC_VERSION);
      
      if (this.auth.authType === "oauth") {
        headers.delete("x-api-key");
        headers.set("Authorization", `Bearer ${this.auth.accessToken}`);
        headers.set("user-agent", "claude-cli/2.1.2 (external, cli)");
        
        const incomingBeta = headers.get("anthropic-beta") || "";
        const incomingBetasList = incomingBeta.split(",").map(b => b.trim()).filter(Boolean);
        const includeClaudeCode = incomingBetasList.includes("claude-code-20250219");
        const mergedBetas = [
          "oauth-2025-04-20",
          "interleaved-thinking-2025-05-14",
          ...(includeClaudeCode ? ["claude-code-20250219"] : []),
        ].join(",");
        headers.set("anthropic-beta", mergedBetas);
      } else {
        headers.set("anthropic-beta", ANTHROPIC_BETA);
      }
      
      let requestInput = input;
      let body = init?.body;
      
      if (this.auth.authType === "oauth") {
        // URL 添加 ?beta=true
        try {
          let requestUrl: URL | null = null;
          if (typeof input === "string" || input instanceof URL) {
            requestUrl = new URL(input.toString());
          } else if (input instanceof Request) {
            requestUrl = new URL(input.url);
          }
          
          if (requestUrl && requestUrl.pathname === "/v1/messages" && !requestUrl.searchParams.has("beta")) {
            requestUrl.searchParams.set("beta", "true");
            requestInput = input instanceof Request
              ? new Request(requestUrl.toString(), input)
              : requestUrl;
          }
        } catch (error) {
          console.debug("[ClaudeCodeAdapter] URL 解析失败:", error);
        }
        
        // 处理请求体
        if (body && typeof body === "string") {
          try {
            const parsed = JSON.parse(body);
            
            // 关键：system prompt 必须拆分为多个块，第一个块固定为 Claude Code 身份标识
            const CLAUDE_CODE_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";
            
            if (parsed.system && Array.isArray(parsed.system)) {
              const customSystemBlocks = parsed.system.map((item: any) => {
                if (item.type === "text" && item.text) {
                  let text = item.text;
                  // 移除已有的 Claude Code 身份前缀（避免重复）
                  if (text.startsWith(CLAUDE_CODE_IDENTITY)) {
                    text = text.substring(CLAUDE_CODE_IDENTITY.length).trim();
                  }
                  return text ? { ...item, text } : null;
                }
                return item;
              }).filter(Boolean);
              
              parsed.system = [
                { type: "text", text: CLAUDE_CODE_IDENTITY },
                ...customSystemBlocks
              ];
            } else {
              parsed.system = [{ type: "text", text: CLAUDE_CODE_IDENTITY }];
            }
            
            // tool 名称添加 mcp_ 前缀
            if (parsed.tools && Array.isArray(parsed.tools)) {
              parsed.tools = parsed.tools.map((tool: any) => ({
                ...tool,
                name: tool.name ? `${TOOL_PREFIX}${tool.name}` : tool.name,
              }));
            }
            
            // messages 中的 tool_use 也需要添加前缀
            if (parsed.messages && Array.isArray(parsed.messages)) {
              parsed.messages = parsed.messages.map((msg: any) => {
                if (msg.content && Array.isArray(msg.content)) {
                  msg.content = msg.content.map((block: any) => {
                    if (block.type === "tool_use" && block.name) {
                      return { ...block, name: `${TOOL_PREFIX}${block.name}` };
                    }
                    return block;
                  });
                }
                return msg;
              });
            }
            
            body = JSON.stringify(parsed);
          } catch (error) {
            console.debug("[ClaudeCodeAdapter] 请求体解析失败:", error);
          }
        }
      }
      
      const response = await fetch(requestInput, { ...init, body, headers });
      
      if (this.auth.authType === "oauth" && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        
        const stream = new ReadableStream({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              
              let text = decoder.decode(value, { stream: true });
              text = text.replace(/"name"\s*:\s*"mcp_([^"]+)"/g, '"name": "$1"');
              controller.enqueue(encoder.encode(text));
            } catch (error) {
              console.error("[ClaudeCodeAdapter] 流读取错误:", error);
              controller.error(error);
            }
          },
        });
        
        return new Response(stream, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
      
      return response;
    };
  }
  
  createModel(modelId: string): LanguageModel {
    return this.provider(modelId);
  }
  
  supportsNativeReasoning(): boolean {
    return true;
  }
  
  supportsVision(capabilities?: ModelCapabilities): boolean {
    return capabilities?.vision ?? true;
  }
  
  supportsFunctionCalling(capabilities?: ModelCapabilities): boolean {
    return capabilities?.functionCalling ?? true;
  }
  
  getProviderOptions(options: ProviderStreamOptions): Record<string, any> {
    const providerOptions: Record<string, any> = {};
    
    if (options.reasoning?.enabled) {
      providerOptions.anthropic = {
        thinking: {
          type: "enabled",
          budget_tokens: options.reasoning.effort === "high" ? 20000 : 
                        options.reasoning.effort === "low" ? 5000 : 10000,
        },
      };
    }
    
    return Object.keys(providerOptions).length > 0 
      ? { providerOptions } 
      : {};
  }
  
  getAuth(): ClaudeCodeAuthInfo {
    return this.auth;
  }
  
  getSystemPromptPrefix(): string {
    return CLAUDE_CODE_SYSTEM_PREFIX;
  }
}

export function createProviderAdapter(
  provider: AIProvider,
  copilotOptions?: GitHubCopilotAdapterOptions,
  claudeCodeOptions?: ClaudeCodeAdapterOptions
): AIProviderAdapterInterface {
  const config = {
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
    name: provider.name,
  };
  
  switch (provider.sdkType) {
    case "openai":
      return new OpenAIAdapter(config);
    case "github-copilot":
      if (!copilotOptions) {
        throw new Error("GitHub Copilot 适配器需要认证信息");
      }
      return new GitHubCopilotAdapter(copilotOptions);
    case "claude-code":
      if (!claudeCodeOptions) {
        throw new Error("Claude Code 适配器需要认证信息");
      }
      return new ClaudeCodeAdapter(claudeCodeOptions);
    case "openai-compatible":
    default:
      return new OpenAICompatibleAdapter(config);
  }
}

export function createAIModelInstance(
  provider: AIProvider,
  model: AIModel,
  copilotOptions?: GitHubCopilotAdapterOptions,
  claudeCodeOptions?: ClaudeCodeAdapterOptions
): {
  model: LanguageModel;
  adapter: AIProviderAdapterInterface;
} {
  const adapter = createProviderAdapter(provider, copilotOptions, claudeCodeOptions);
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
