import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, nullable: true })
  tencentUid?: string;

  @Column({ nullable: true })
  nickname?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ type: "text", nullable: true })
  cookies?: string; // 存储腾讯云社区的登录 cookies

  @Column({ default: false })
  isLoggedIn!: boolean;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
