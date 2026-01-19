import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from "typeorm";
import { Article } from "./Article";

export type VersionSource = "local" | "tencent" | "juejin" | "csdn" | "conflict_remote";

@Entity("article_versions")
@Index(["articleId", "version"])
export class ArticleVersion {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Article, { onDelete: "CASCADE" })
  article!: Article;

  @Column()
  articleId!: number;

  @Column()
  version!: number;

  @Column({ type: "text" })
  title!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "text", nullable: true })
  contentHash?: string;

  @Column({ type: "text" })
  source!: VersionSource;

  @Column({ type: "text", nullable: true })
  deviceId?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
