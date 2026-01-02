import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * AI SDK 类型
 * - openai: 使用 @ai-sdk/openai，适用于 OpenAI 官方模型（原生支持 reasoning）
 * - openai-compatible: 使用 @ai-sdk/openai-compatible，适用于兼容 OpenAI API 的第三方服务
 */
export type AISDKType = "openai" | "openai-compatible";

/**
 * AI 供应商实体
 * 存储 AI 供应商的基础配置（如 OpenAI、智谱、DeepSeek 等）
 */
@Entity("ai_providers")
export class AIProvider {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  // 供应商名称（用户自定义，如"OpenAI"、"智谱 AI"）
  @Column()
  name!: string;

  // API 基础地址（如 https://api.openai.com/v1）
  @Column()
  baseUrl!: string;

  // API 密钥（加密存储）
  @Column()
  apiKey!: string;

  // 是否启用
  @Column({ default: true })
  enabled!: boolean;

  // 排序顺序
  @Column({ default: 0 })
  order!: number;

  /**
   * SDK 类型
   * - openai: OpenAI 官方 SDK，原生支持 reasoning/thinking 等高级功能
   * - openai-compatible: OpenAI 兼容 SDK，适用于智谱、DeepSeek、通义千问等
   */
  @Column({ type: "text", default: "openai-compatible" })
  sdkType!: AISDKType;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * 模型能力配置
 */
export interface ModelCapabilities {
  // 是否支持推理/深度思考（如 o1、DeepSeek-R1 等）
  reasoning: boolean;
  // 是否支持流式输出
  streaming: boolean;
  // 是否支持工具调用/函数调用
  functionCalling: boolean;
  // 是否支持视觉理解（多模态）
  vision: boolean;
}

/**
 * AI Loop 配置（Agent 式多步任务）
 */
export interface AILoopConfig {
  // 最大循环次数（防止死循环）
  maxLoops: number;
  // 是否不限制循环次数（危险：可能导致无限循环和高额 API 费用）
  unlimited: boolean;
}

/**
 * 模型参数配置
 */
export interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * AI 模型实体
 * 存储具体的模型配置，关联到供应商
 */
@Entity("ai_models")
export class AIModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  // 关联的供应商 ID
  @Column()
  providerId!: number;

  // 模型标识（如 gpt-4o、glm-4-plus 等）
  @Column()
  modelId!: string;

  // 模型显示名称（用户自定义，如"GPT-4o 最新版"）
  @Column()
  displayName!: string;

  // 是否为默认模型
  @Column({ default: false })
  isDefault!: boolean;

  // 是否启用
  @Column({ default: true })
  enabled!: boolean;

  // 排序顺序
  @Column({ default: 0 })
  order!: number;

  // 上下文最大长度（tokens）- 用于展示使用进度
  @Column({ type: "integer", nullable: true })
  contextLength?: number;

  // 模型参数配置
  @Column({ type: "simple-json", nullable: true })
  parameters?: ModelParameters;

  // 模型能力配置
  @Column({ type: "simple-json", nullable: true })
  capabilities?: ModelCapabilities;

  // AI Loop 配置
  @Column({ type: "simple-json", nullable: true })
  aiLoopConfig?: AILoopConfig;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * 默认模型能力配置
 */
export const defaultCapabilities: ModelCapabilities = {
  reasoning: false,
  streaming: true,
  functionCalling: true,
  vision: false,
};

/**
 * 默认 AI Loop 配置
 */
export const defaultAILoopConfig: AILoopConfig = {
  maxLoops: 20,
  unlimited: false,
};
