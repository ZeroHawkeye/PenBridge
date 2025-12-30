import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

// 管理员角色
export enum AdminRole {
  SUPER_ADMIN = "super_admin", // 超级管理员，可管理其他用户
  ADMIN = "admin", // 普通管理员
}

@Entity("admin_users")
export class AdminUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column()
  passwordHash!: string;

  @Column({
    type: "varchar",
    default: AdminRole.ADMIN,
  })
  role!: AdminRole;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
