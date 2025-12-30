import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { AdminUser, AdminRole } from "./AdminUser";

@Entity("admin_sessions")
export class AdminSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  token!: string;

  @Column()
  adminId!: number;

  @ManyToOne(() => AdminUser, { onDelete: "CASCADE" })
  @JoinColumn({ name: "adminId" })
  admin!: AdminUser;

  @Column()
  username!: string;

  @Column({ type: "varchar" })
  role!: AdminRole;

  @Column()
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
