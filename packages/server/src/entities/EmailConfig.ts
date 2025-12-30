import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from "typeorm";
import { User } from "./User";

/**
 * 邮件通知配置实体
 * 存储用户的 SMTP 配置和通知邮箱
 */
@Entity("email_configs")
export class EmailConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column()
  userId!: number;

  // SMTP 服务器配置
  @Column({ nullable: true })
  smtpHost?: string;  // SMTP 服务器地址，如 smtp.qq.com

  @Column({ nullable: true })
  smtpPort?: number;  // SMTP 端口，如 465（SSL）或 587（TLS）

  @Column({ default: true })
  smtpSecure!: boolean;  // 是否使用 SSL/TLS

  @Column({ nullable: true })
  smtpUser?: string;  // SMTP 用户名（通常是邮箱地址）

  @Column({ nullable: true })
  smtpPass?: string;  // SMTP 密码或授权码

  // 发件人信息
  @Column({ nullable: true })
  fromName?: string;  // 发件人名称

  @Column({ nullable: true })
  fromEmail?: string;  // 发件人邮箱

  // 收件人信息
  @Column({ nullable: true })
  notifyEmail?: string;  // 接收通知的邮箱

  // 通知设置
  @Column({ default: true })
  notifyOnSuccess!: boolean;  // 发布成功时通知

  @Column({ default: true })
  notifyOnFailed!: boolean;  // 发布失败时通知

  @Column({ default: true })
  notifyOnCookieExpired!: boolean;  // Cookie 失效时通知

  // 配置是否启用
  @Column({ default: false })
  enabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
