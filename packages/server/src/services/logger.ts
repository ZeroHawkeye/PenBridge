import { existsSync, mkdirSync, appendFileSync, readdirSync, unlinkSync, statSync } from "fs";
import { join } from "path";
import { getLogDir as getLogDirFromConfig } from "./dataDir";

// 日志目录（延迟初始化）
let LOG_DIR = "";

// 日志文件保留天数
const LOG_RETENTION_DAYS = 7;

// 日志级别
type LogLevel = "info" | "warn" | "error" | "debug";

// 当前日志文件日期（用于检测日期变化）
let currentLogDate: string = "";

// 是否已初始化
let isInitialized = false;

// 原始 console 方法
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

/**
 * 获取当前日期字符串 (YYYY-MM-DD)
 */
function getCurrentDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 获取当前日期的日志文件名
 */
function getLogFileName(): string {
  return `${getCurrentDateString()}.log`;
}

/**
 * 获取当前时间戳（用于日志前缀）
 */
function getTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * 格式化日志参数为字符串
 */
function formatArgs(args: any[]): string {
  return args
    .map((arg) => {
      if (arg === null) {
        return "null";
      }
      if (arg === undefined) {
        return "undefined";
      }
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}\n${arg.stack || ""}`;
      }
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
}

/**
 * 确保日志目录存在
 */
function ensureLogDir(): boolean {
  try {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
    return true;
  } catch (error) {
    originalConsole.error("创建日志目录失败:", error);
    return false;
  }
}

/**
 * 检查并处理日期切换
 * 如果日期发生变化，更新当前日期并触发日志清理
 */
function checkDateRotation(): void {
  const today = getCurrentDateString();
  if (currentLogDate !== today) {
    const previousDate = currentLogDate;
    currentLogDate = today;
    
    // 如果不是首次设置日期（服务重启），则输出日期切换日志
    if (previousDate) {
      originalConsole.log(`[Logger] 日期已切换: ${previousDate} -> ${today}`);
    }
    
    // 异步清理过期日志，不阻塞当前日志写入
    setImmediate(() => {
      cleanupOldLogs();
    });
  }
}

/**
 * 写入日志到文件
 * 每次写入时检查日期是否变化，实现运行时日志切割
 */
function writeToFile(level: LogLevel, message: string): void {
  if (!isInitialized) return;
  
  try {
    // 检查日期切换（实现运行时日志切割）
    checkDateRotation();
    
    // 确保日志目录存在（可能被外部删除）
    if (!ensureLogDir()) return;
    
    const logFile = join(LOG_DIR, getLogFileName());
    const timestamp = getTimestamp();
    const levelTag = level.toUpperCase().padEnd(5);
    const logLine = `[${timestamp}] [${levelTag}] ${message}\n`;
    
    // 同步写入确保日志完整性
    appendFileSync(logFile, logLine, { encoding: "utf-8" });
  } catch (error) {
    // 写入失败时使用原始 console 输出错误（避免递归）
    originalConsole.error("日志写入失败:", error);
  }
}

/**
 * 创建代理的 console 方法
 */
function createProxyMethod(
  originalMethod: (...args: any[]) => void,
  level: LogLevel
): (...args: any[]) => void {
  return (...args: any[]) => {
    // 输出到标准输出
    originalMethod(...args);
    
    // 写入到日志文件
    const message = formatArgs(args);
    writeToFile(level, message);
  };
}

/**
 * 清理过期日志文件
 */
function cleanupOldLogs(): void {
  try {
    if (!existsSync(LOG_DIR)) return;
    
    const files = readdirSync(LOG_DIR);
    const now = Date.now();
    const maxAge = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    
    let cleanedCount = 0;
    for (const file of files) {
      if (!file.endsWith(".log")) continue;
      
      const filePath = join(LOG_DIR, file);
      try {
        const stat = statSync(filePath);
        const age = now - stat.mtime.getTime();
        
        if (age > maxAge) {
          unlinkSync(filePath);
          cleanedCount++;
        }
      } catch (error) {
        // 单个文件处理失败不影响其他文件
        originalConsole.error(`清理日志文件 ${file} 失败:`, error);
      }
    }
    
    if (cleanedCount > 0) {
      originalConsole.log(`[Logger] 已清理 ${cleanedCount} 个过期日志文件`);
    }
  } catch (error) {
    originalConsole.error("清理日志文件失败:", error);
  }
}

/**
 * 初始化日志服务
 * - 创建日志目录
 * - 重写 console 方法
 * - 清理过期日志
 * - 设置定时日期检查（备用机制）
 */
export function initLogger(): void {
  // 防止重复初始化
  if (isInitialized) {
    originalConsole.warn("[Logger] 日志服务已经初始化，跳过重复初始化");
    return;
  }
  
  // 初始化日志目录路径（根据环境变量）
  LOG_DIR = getLogDirFromConfig();
  
  // 确保日志目录存在
  if (!ensureLogDir()) {
    originalConsole.error("[Logger] 无法创建日志目录，日志服务初始化失败");
    return;
  }
  
  // 初始化当前日期
  currentLogDate = getCurrentDateString();
  
  // 标记为已初始化
  isInitialized = true;
  
  // 重写 console 方法
  console.log = createProxyMethod(originalConsole.log, "info");
  console.info = createProxyMethod(originalConsole.info, "info");
  console.warn = createProxyMethod(originalConsole.warn, "warn");
  console.error = createProxyMethod(originalConsole.error, "error");
  console.debug = createProxyMethod(originalConsole.debug, "debug");
  
  // 清理过期日志
  cleanupOldLogs();
  
  // 设置定时器，每小时检查一次日期变化（备用机制）
  // 主要的日期切换检测在 writeToFile 中进行
  setInterval(() => {
    checkDateRotation();
  }, 60 * 60 * 1000); // 1小时
  
  // 记录日志服务启动
  console.log(`[Logger] 日志服务已启动`);
  console.log(`[Logger] 日志目录: ${LOG_DIR}`);
  console.log(`[Logger] 当前日志文件: ${getLogFileName()}`);
  console.log(`[Logger] 日志保留天数: ${LOG_RETENTION_DAYS}`);
}

/**
 * 获取日志文件路径
 */
export function getLogFilePath(): string {
  return join(LOG_DIR, getLogFileName());
}

/**
 * 获取日志目录路径
 */
export function getLogDir(): string {
  return LOG_DIR;
}

/**
 * 获取所有日志文件列表
 */
export function getLogFiles(): string[] {
  if (!existsSync(LOG_DIR)) return [];
  
  return readdirSync(LOG_DIR)
    .filter((file) => file.endsWith(".log"))
    .sort()
    .reverse();
}

/**
 * 手动触发日志清理
 */
export function triggerLogCleanup(): void {
  cleanupOldLogs();
}

/**
 * 获取日志服务状态
 */
export function getLoggerStatus(): {
  initialized: boolean;
  currentDate: string;
  logDir: string;
  currentLogFile: string;
  retentionDays: number;
} {
  return {
    initialized: isInitialized,
    currentDate: currentLogDate,
    logDir: LOG_DIR,
    currentLogFile: getLogFileName(),
    retentionDays: LOG_RETENTION_DAYS,
  };
}
