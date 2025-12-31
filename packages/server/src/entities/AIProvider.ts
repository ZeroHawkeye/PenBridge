import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * AI 供应商实体
 * 存储 AI 供应商的基础配置（如 OpenAI、Claude、Gemini 等）
 */
@Entity("ai_providers")
export class AIProvider {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  // 供应商名称（用户自定义，如"OpenAI"、"我的 Claude"）
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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
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

  // 模型标识（如 gpt-4o、claude-3-opus 等）
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

  // 模型参数配置（JSON 格式，存储 temperature、max_tokens 等）
  @Column({ type: "simple-json", nullable: true })
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };

  // 模型能力配置
  // 定义该模型支持哪些功能，以及如何配置
  @Column({ type: "simple-json", nullable: true })
  capabilities?: {
    // 深度思考/推理模式
    thinking?: {
      // 该模型是否支持深度思考功能
      supported: boolean;
      // 是否启用深度思考（用户可手动开关）
      enabled: boolean;
      // API 格式类型（用于确定请求格式）
      // - standard: 标准格式，使用 thinking.type = "enabled" | "disabled"
      //   适用于：智谱 GLM、DeepSeek 等兼容 API
      // - openai: OpenAI 专用格式，使用 reasoning.effort = "low" | "medium" | "high"
      //   适用于：OpenAI o1/o3/gpt-5 等推理模型
      apiFormat?: "standard" | "openai";
      // OpenAI 推理努力程度 (仅 openai 格式使用)
      reasoningEffort?: "low" | "medium" | "high";
      // OpenAI 推理摘要类型 (仅 openai 格式使用)
      // - auto: 自动生成摘要
      // - detailed: 详细摘要
      // - concise: 简洁摘要
      // - disabled: 不生成摘要
      // 注意：OpenAI 不返回原始思维链，只能通过摘要了解推理过程
      reasoningSummary?: "auto" | "detailed" | "concise" | "disabled";
    };
    // 流式输出
    streaming?: {
      supported: boolean;
      enabled: boolean;
    };
    // 函数调用/工具使用
    functionCalling?: {
      supported: boolean;
    };
    // 视觉理解（多模态）
    vision?: {
      supported: boolean;
    };
    // AI Loop 配置（Agent 式多步任务）
    aiLoop?: {
      // 最大循环次数（防止死循环）
      maxLoopCount: number;
    };
  };

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
