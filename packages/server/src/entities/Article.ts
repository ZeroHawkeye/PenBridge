import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from "typeorm";
import { User } from "./User";
import { Folder } from "./Folder";

export enum ArticleStatus {
  DRAFT = "draft", // 草稿
  SCHEDULED = "scheduled", // 定时发布
  PENDING = "pending", // 审核中（已提交到腾讯云，等待审核）
  PUBLISHED = "published", // 已发布
  FAILED = "failed", // 发布失败
}

@Entity("articles")
export class Article {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "text", nullable: true })
  summary?: string;

  @Column({ type: "simple-array", nullable: true })
  tags?: string[];

  @Column({
    type: "text",
    default: ArticleStatus.DRAFT,
  })
  status!: ArticleStatus;

  @Column({ nullable: true })
  scheduledAt?: Date;

  @Column({ nullable: true })
  publishedAt?: Date;

  @Column({ nullable: true })
  tencentDraftId?: number; // 腾讯云社区草稿ID

  @Column({ nullable: true })
  tencentArticleId?: string; // 腾讯云社区文章ID

  @Column({ nullable: true })
  tencentArticleUrl?: string;

  @Column({ type: "simple-array", nullable: true })
  tencentTagIds?: number[]; // 腾讯云标签ID列表

  @Column({ default: 1 })
  sourceType!: number; // 来源类型: 1-原创, 2-转载, 3-翻译

  @Column({ nullable: true })
  lastSyncedAt?: Date; // 最后同步到腾讯云的时间

  @Column({ nullable: true })
  errorMessage?: string;

  // 掘金相关字段
  @Column({ nullable: true })
  juejinDraftId?: string; // 掘金草稿ID

  @Column({ nullable: true })
  juejinArticleId?: string; // 掘金文章ID

  @Column({ nullable: true })
  juejinArticleUrl?: string; // 掘金文章链接

  @Column({ nullable: true })
  juejinCategoryId?: string; // 掘金分类ID

  @Column({ type: "simple-array", nullable: true })
  juejinTagIds?: string[]; // 掘金标签ID列表

  @Column({ type: "simple-array", nullable: true })
  juejinTagNames?: string[]; // 掘金标签名称列表（用于显示）

  @Column({ nullable: true })
  juejinBriefContent?: string; // 掘金摘要（最多100字）

  @Column({ default: 1 })
  juejinIsOriginal!: number; // 掘金是否原创: 1-原创, 0-转载

  @Column({ nullable: true })
  juejinStatus?: string; // 掘金文章状态: draft, pending, published, rejected

  @Column({ nullable: true })
  juejinLastSyncedAt?: Date; // 最后同步到掘金的时间

  // CSDN 相关字段
  @Column({ nullable: true })
  csdnArticleId?: string; // CSDN 文章ID

  @Column({ nullable: true })
  csdnArticleUrl?: string; // CSDN 文章链接

  @Column({ type: "simple-array", nullable: true })
  csdnTags?: string[]; // CSDN 标签列表（用于显示）

  @Column({ nullable: true })
  csdnDescription?: string; // CSDN 摘要

  @Column({ nullable: true })
  csdnCoverImage?: string; // CSDN 封面图片

  @Column({ default: "original" })
  csdnType!: string; // CSDN 文章类型: original-原创, repost-转载, translated-翻译

  @Column({ default: "public" })
  csdnReadType!: string; // CSDN 可见范围: public-全部可见, private-仅我可见, fans-粉丝可见, vip-VIP可见

  @Column({ nullable: true })
  csdnStatus?: string; // CSDN 文章状态: draft, published

  @Column({ nullable: true })
  csdnLastSyncedAt?: Date; // 最后同步到 CSDN 的时间

  @ManyToOne(() => User)
  user!: User;

  @Column()
  userId!: number;

  @ManyToOne(() => Folder, { nullable: true })
  folder?: Folder;

  @Column({ nullable: true })
  folderId?: number;

  @Column({ default: 0 })
  order!: number; // 在文件夹内的排序顺序

  // ========== 本地缓存与同步相关字段 ==========

  @Column({ type: "text", nullable: true })
  clientId?: string; // 客户端生成的 UUID，用于离线创建的文章

  @Column({ default: 1 })
  localVersion!: number; // 本地版本号，每次保存递增

  @Column({ nullable: true })
  remoteVersion?: number; // 云端版本号（从平台同步回来）

  @Column({ type: "text", nullable: true })
  contentHash?: string; // 内容哈希，用于快速比对

  @Column({ type: "text", nullable: true })
  remoteContentHash?: string; // 云端内容哈希（用于检测变化）

  @Column({ type: "text", nullable: true })
  lastModifiedBy?: string; // 最后修改的设备 ID

  @Column({ nullable: true })
  serverUpdatedAt?: Date; // 服务器确认的更新时间

  @Column({ default: false })
  hasConflict!: boolean; // 是否存在冲突

  @Column({ type: "text", nullable: true })
  conflictRemoteContent?: string; // 冲突时保存的云端内容

  @Column({ nullable: true })
  conflictDetectedAt?: Date; // 冲突检测时间

  @Column({ type: "text", default: "synced" })
  syncStatus!: string; // 同步状态: synced | pending | syncing | conflict | error

  @Column({ type: "text", nullable: true })
  syncError?: string; // 同步错误信息

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
