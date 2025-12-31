import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  id: string;
  type: "function" | "mcp";
  name: string;
  arguments: string;
  result?: string;
  status: "pending" | "running" | "completed" | "failed";
  executionLocation: "frontend" | "backend";
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * AI 聊天会话实体
 * 存储用户与 AI 的对话会话
 */
@Entity("ai_chat_sessions")
export class AIChatSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  // 关联的文章 ID（可选，用于文章辅助场景）
  @Column({ nullable: true })
  articleId?: number;

  // 会话标题（默认取第一条消息的前 50 个字符）
  @Column({ default: "新对话" })
  title!: string;

  // 使用的模型 ID
  @Column({ nullable: true })
  modelId?: string;

  // 使用的供应商 ID
  @Column({ nullable: true })
  providerId?: number;

  // 会话总 token 消耗
  @Column({ default: 0 })
  totalTokens!: number;

  // 消息数量
  @Column({ default: 0 })
  messageCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * AI 聊天消息实体
 * 存储单条对话消息
 */
@Entity("ai_chat_messages")
export class AIChatMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  // 关联的会话 ID
  @Column()
  sessionId!: number;

  // 消息角色
  @Column()
  role!: "user" | "assistant" | "system" | "tool";

  // 消息内容
  @Column("text")
  content!: string;

  // 思维链内容（AI 思考过程，可折叠展示）
  @Column("text", { nullable: true })
  reasoning?: string;

  // 工具调用记录（JSON 格式）
  @Column("simple-json", { nullable: true })
  toolCalls?: ToolCallRecord[];

  // 工具调用 ID（当 role 为 tool 时使用）
  @Column({ nullable: true })
  toolCallId?: string;

  // Token 使用统计
  @Column("simple-json", { nullable: true })
  usage?: TokenUsage;

  // 消息状态
  @Column({ default: "completed" })
  status!: "pending" | "streaming" | "completed" | "failed";

  // 错误信息（如果消息生成失败）
  @Column("text", { nullable: true })
  error?: string;

  // 消息生成耗时（毫秒）
  @Column({ nullable: true })
  duration?: number;

  @CreateDateColumn()
  createdAt!: Date;
}
