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

  // ==================== 腾讯云社区相关字段 ====================
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

  // ==================== 掘金相关字段 ====================
  @Column({ nullable: true })
  juejinUserId?: string; // 掘金用户 ID

  @Column({ nullable: true })
  juejinNickname?: string; // 掘金昵称

  @Column({ nullable: true })
  juejinAvatarUrl?: string; // 掘金头像

  @Column({ type: "text", nullable: true })
  juejinCookies?: string; // 存储掘金的登录 cookies

  @Column({ default: false })
  juejinLoggedIn!: boolean; // 掘金登录状态

  @Column({ nullable: true })
  juejinLastLoginAt?: Date; // 掘金最后登录时间

  // ==================== 通用字段 ====================
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
