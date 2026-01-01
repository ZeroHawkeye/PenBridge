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
import { dirname, join } from "path";

/**
 * 获取 sql.js WASM 文件路径
 * 
 * 在打包后的环境中，WASM 文件位于可执行文件同目录
 * 在开发环境中，使用 node_modules 中的文件
 */
function getWasmPath(): string | undefined {
  // 检查是否是 Bun 编译的独立可执行文件
  // Bun 编译后 process.execPath 指向可执行文件本身
  const execDir = dirname(process.execPath);
  const bundledWasmPath = join(execDir, "sql-wasm.wasm");
  
  if (existsSync(bundledWasmPath)) {
    console.log(`[DB] Using bundled WASM: ${bundledWasmPath}`);
    return bundledWasmPath;
  }
  
  // 开发环境：让 sql.js 自动定位 WASM 文件
  console.log("[DB] Using default WASM location (development mode)");
  return undefined;
}

// 默认数据库路径，可通过 setDatabasePath 修改
let DB_PATH = "data/pen-bridge.db";

// 延迟初始化的 DataSource
let _appDataSource: DataSource | null = null;

/**
 * 设置数据库文件路径（必须在 initDatabase 之前调用）
 */
export function setDatabasePath(path: string) {
  if (_appDataSource?.isInitialized) {
    console.warn("警告: 数据库已初始化，设置路径可能无效");
  }
  DB_PATH = path;
  // 确保数据目录存在
  const dataDir = dirname(DB_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * 获取当前数据库路径
 */
export function getDatabasePath(): string {
  return DB_PATH;
}

// 防抖保存：避免频繁写入磁盘
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingData: Uint8Array | null = null;
const SAVE_DEBOUNCE_MS = 100; // 100ms 防抖

const createDebouncedSave = () => (data: Uint8Array) => {
  pendingData = data;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    if (pendingData) {
      writeFileSync(DB_PATH, Buffer.from(pendingData));
      pendingData = null;
    }
    saveTimeout = null;
  }, SAVE_DEBOUNCE_MS);
};

/**
 * 创建 DataSource（延迟创建，使用当前的 DB_PATH）
 */
async function createDataSource(): Promise<DataSource> {
  // 确保数据目录存在
  const dataDir = dirname(DB_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // 获取 WASM 文件路径（打包环境 vs 开发环境）
  const wasmPath = getWasmPath();
  const initOptions: any = {};
  
  if (wasmPath) {
    // 打包环境：指定 WASM 文件路径
    initOptions.locateFile = () => wasmPath;
  }
  
  const driver = await initSqlJs(initOptions);
  
  return new DataSource({
    type: "sqljs",
    database: existsSync(DB_PATH) ? readFileSync(DB_PATH) : undefined,
    synchronize: true, // 自动迁移数据模型
    logging: false,
    entities: [User, Article, Folder, ScheduledTask, EmailConfig, AdminUser, AdminSession, AIProvider, AIModel, AIChatSession, AIChatMessage],
    driver,
    autoSave: true,
    autoSaveCallback: createDebouncedSave(),
  });
}

/**
 * 获取 AppDataSource（确保已初始化）
 */
export function getAppDataSource(): DataSource {
  if (!_appDataSource) {
    throw new Error("数据库未初始化，请先调用 initDatabase()");
  }
  return _appDataSource;
}

// 为了兼容现有代码，提供一个 getter
// 注意：直接访问时如果未初始化会抛出错误
export const AppDataSource = new Proxy({} as DataSource, {
  get(_, prop) {
    if (!_appDataSource) {
      throw new Error("数据库未初始化，请先调用 initDatabase()");
    }
    return (_appDataSource as any)[prop];
  },
});

/**
 * 初始化数据库
 */
export async function initDatabase(): Promise<DataSource> {
  if (_appDataSource?.isInitialized) {
    return _appDataSource;
  }
  
  // 创建新的 DataSource
  _appDataSource = await createDataSource();
  
  if (!_appDataSource.isInitialized) {
    await _appDataSource.initialize();
    console.log(`Database initialized at ${DB_PATH}`);
  }
  
  return _appDataSource;
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (_appDataSource?.isInitialized) {
    await _appDataSource.destroy();
    _appDataSource = null;
    console.log("Database connection closed");
  }
}
