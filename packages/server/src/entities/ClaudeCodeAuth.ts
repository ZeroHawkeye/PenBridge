import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Claude Code 认证实体
 * 存储 OAuth 认证信息（订阅登录）或 API Key（直接登录）
 */
@Entity("claude_code_auth")
export class ClaudeCodeAuth {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  /**
   * 认证类型
   * - oauth: 使用 Claude Max/Pro 订阅 OAuth 登录
   * - api_key: 使用 Anthropic API Key 直接登录
   */
  @Column({ default: "oauth" })
  authType!: "oauth" | "api_key";

  /**
   * OAuth refresh_token（长期有效，用于刷新 access_token）
   * 仅 authType === "oauth" 时使用
   */
  @Column({ nullable: true })
  refreshToken?: string;

  /**
   * OAuth access_token（短期有效，约 1 小时）
   * 或 API Key（authType === "api_key" 时使用）
   */
  @Column()
  accessToken!: string;

  /**
   * access_token 过期时间戳（毫秒）
   * authType === "api_key" 时为 0（永不过期）
   */
  @Column({ type: "integer", default: 0 })
  expiresAt!: number;

  /**
   * PKCE code_verifier（OAuth 流程中使用，授权完成后清空）
   */
  @Column({ nullable: true })
  codeVerifier?: string;

  /**
   * 订阅类型（仅 OAuth）
   * - max: Claude Max 订阅
   * - pro: Claude Pro 订阅
   */
  @Column({ nullable: true })
  subscriptionType?: "max" | "pro";

  /**
   * 用户邮箱（可选，用于显示）
   */
  @Column({ nullable: true })
  email?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
