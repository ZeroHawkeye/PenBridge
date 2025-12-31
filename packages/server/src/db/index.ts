import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Article } from "../entities/Article";
import { Folder } from "../entities/Folder";
import { ScheduledTask } from "../entities/ScheduledTask";
import { EmailConfig } from "../entities/EmailConfig";
import { AdminUser } from "../entities/AdminUser";
import { AdminSession } from "../entities/AdminSession";
import { AIProvider, AIModel } from "../entities/AIProvider";
import { AIChatSession, AIChatMessage } from "../entities/AIChat";
// @ts-ignore
import initSqlJs from "sql.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const DB_PATH = "data/pen-bridge.db";

// 确保数据目录存在
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export const AppDataSource = new DataSource({
  type: "sqljs",
  database: existsSync(DB_PATH) ? readFileSync(DB_PATH) : undefined,
  synchronize: true, // 自动迁移数据模型
  logging: false,
  entities: [User, Article, Folder, ScheduledTask, EmailConfig, AdminUser, AdminSession, AIProvider, AIModel, AIChatSession, AIChatMessage],
  driver: await initSqlJs(),
  autoSave: true,
  autoSaveCallback: (data: Uint8Array) => {
    writeFileSync(DB_PATH, Buffer.from(data));
  },
});

export async function initDatabase() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log("Database initialized");
  }
  return AppDataSource;
}
