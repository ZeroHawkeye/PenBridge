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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
