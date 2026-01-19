import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Article } from "../entities/Article";
import { ArticleVersion } from "../entities/ArticleVersion";
import { Folder } from "../entities/Folder";
import { ScheduledTask } from "../entities/ScheduledTask";
import { EmailConfig } from "../entities/EmailConfig";
import { AdminUser } from "../entities/AdminUser";
import { AdminSession } from "../entities/AdminSession";
import { AIProvider, AIModel } from "../entities/AIProvider";
import { AIChatSession, AIChatMessage } from "../entities/AIChat";
import { CopilotAuth } from "../entities/CopilotAuth";
// @ts-ignore
import initSqlJs from "sql.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

/**
 * 获取 sql.js WASM 文件路径
 * 
 * 优先级：
 * 1. 可执行文件同目录（Electron 打包环境 - Bun 编译的二进制文件）
 * 2. 工作目录（Docker 生产环境）
 * 3. node_modules（开发环境）
 * 
 * 注意：必须始终返回有效路径，不能返回 undefined
 * 因为 Bun 打包后 sql.js 内部的 __dirname 会指向错误的路径
 */
function getWasmPath(): string {
  // 获取当前脚本/可执行文件所在目录
  // Bun 编译后，process.argv[0] 就是可执行文件路径
  const execPath = process.argv[0];
  const execDir = dirname(execPath);
  
  // 1. 检查可执行文件同目录（Electron 打包环境 - Bun 编译的二进制文件所在目录）
  const bundledWasmPath = join(execDir, "sql-wasm.wasm");
  if (existsSync(bundledWasmPath)) {
    console.log(`[DB] Using bundled WASM: ${bundledWasmPath}`);
    return bundledWasmPath;
  }
  
  // 2. 也检查 process.execPath 目录（某些情况下可能不同）
  const execPathDir = dirname(process.execPath);
  const execPathWasmPath = join(execPathDir, "sql-wasm.wasm");
  if (existsSync(execPathWasmPath)) {
    console.log(`[DB] Using WASM from execPath dir: ${execPathWasmPath}`);
    return execPathWasmPath;
  }
  
  // 3. Docker 生产环境：WASM 文件位于工作目录（/app/sql-wasm.wasm）
  const cwdWasmPath = join(process.cwd(), "sql-wasm.wasm");
  if (existsSync(cwdWasmPath)) {
    console.log(`[DB] Using WASM from working directory: ${cwdWasmPath}`);
    return cwdWasmPath;
  }
  
  // 4. 开发环境：使用 node_modules 中的 WASM 文件
  // 从当前工作目录向上查找 node_modules
  const nodeModulesWasmPath = join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm");
  if (existsSync(nodeModulesWasmPath)) {
    console.log(`[DB] Using WASM from node_modules: ${nodeModulesWasmPath}`);
    return nodeModulesWasmPath;
  }
  
  // 5. 尝试 packages/server/node_modules（monorepo 开发环境）
  const serverNodeModulesWasmPath = join(process.cwd(), "packages/server/node_modules/sql.js/dist/sql-wasm.wasm");
  if (existsSync(serverNodeModulesWasmPath)) {
    console.log(`[DB] Using WASM from server node_modules: ${serverNodeModulesWasmPath}`);
    return serverNodeModulesWasmPath;
  }
  
  // 如果都找不到，抛出错误
  throw new Error(
    `Cannot find sql-wasm.wasm file. Searched locations:\n` +
    `  - ${bundledWasmPath} (exec arg0 dir)\n` +
    `  - ${execPathWasmPath} (execPath dir)\n` +
    `  - ${cwdWasmPath} (cwd)\n` +
    `  - ${nodeModulesWasmPath} (node_modules)\n` +
    `  - ${serverNodeModulesWasmPath} (server node_modules)\n` +
    `Please ensure sql-wasm.wasm is available in one of these locations.`
  );
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
      writeFileSync(DB_PATH, new Uint8Array(pendingData));
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

  // 获取 WASM 文件路径（始终明确指定，避免 Bun 打包后路径错误）
  const wasmPath = getWasmPath();
  const initOptions: any = {
    locateFile: () => wasmPath,
  };
  
  const driver = await initSqlJs(initOptions);
  
  const dbFile = existsSync(DB_PATH) ? readFileSync(DB_PATH) : undefined;
  return new DataSource({
    type: "sqljs",
    database: dbFile ? new Uint8Array(dbFile) : undefined,
    synchronize: true,
    logging: false,
    entities: [User, Article, ArticleVersion, Folder, ScheduledTask, EmailConfig, AdminUser, AdminSession, AIProvider, AIModel, AIChatSession, AIChatMessage, CopilotAuth],
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
