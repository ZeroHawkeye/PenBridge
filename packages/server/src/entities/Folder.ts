import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";

@Entity("folders")
export class Folder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  parentId?: number;

  @ManyToOne(() => Folder, (folder) => folder.children, { nullable: true })
  parent?: Folder;

  @OneToMany(() => Folder, (folder) => folder.parent)
  children!: Folder[];

  @Column({ default: 0 })
  order!: number; // 排序顺序

  @Column({ default: false })
  isExpanded!: boolean; // 是否展开（持久化用户展开状态）

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
