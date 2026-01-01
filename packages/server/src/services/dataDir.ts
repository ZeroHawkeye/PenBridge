/**
 * 数据目录配置模块
 * 
 * 提供统一的数据目录路径获取方法
 * 优先使用环境变量 PEN_BRIDGE_DATA_DIR（Electron 本地模式注入）
 * 否则使用相对路径 "data"（开发环境和 Docker 部署）
 */
import { join } from "path";

/**
 * 获取数据根目录路径
 */
export function getDataDir(): string {
  return process.env.PEN_BRIDGE_DATA_DIR || "data";
}

/**
 * 获取上传目录路径
 */
export function getUploadDir(): string {
  return join(getDataDir(), "uploads");
}

/**
 * 获取日志目录路径
 */
export function getLogDir(): string {
  return join(getDataDir(), "logs");
}

/**
 * 获取数据库文件路径
 */
export function getDatabasePath(): string {
  return join(getDataDir(), "pen-bridge.db");
}
