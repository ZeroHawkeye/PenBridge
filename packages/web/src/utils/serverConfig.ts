// 服务器配置工具函数

import type { AppMode, AppModeConfig, LocalServerStatus } from "@/types/electron.d";

const SERVER_BASE_URL_KEY = "server_base_url";
const SERVER_CONFIGURED_KEY = "server_configured";
const APP_MODE_KEY = "app_mode"; // local | cloud

// 本地服务器端口（与 electron/src/localServer.ts 保持一致）
const LOCAL_SERVER_PORT = 36925;
const LOCAL_SERVER_URL = `http://127.0.0.1:${LOCAL_SERVER_PORT}`;

/**
 * 检测是否在 Electron 环境中
 */
export function isElectron(): boolean {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
}

/**
 * 获取当前应用模式
 */
export async function getAppMode(): Promise<AppModeConfig> {
  if (isElectron()) {
    return window.electronAPI!.appMode.get();
  }
  // 浏览器环境始终为云端模式（或未配置）
  const mode = localStorage.getItem(APP_MODE_KEY) as AppMode;
  const isConfigured = localStorage.getItem(SERVER_CONFIGURED_KEY) === "true";
  return {
    mode: mode || null,
    isConfigured,
  };
}

/**
 * 同步获取应用模式（用于初始化）
 */
export function getAppModeSync(): AppMode {
  return (localStorage.getItem(APP_MODE_KEY) as AppMode) || null;
}

/**
 * 设置应用模式
 */
export async function setAppMode(mode: AppMode): Promise<{ success: boolean; message?: string; serverUrl?: string }> {
  if (isElectron()) {
    const result = await window.electronAPI!.appMode.set(mode);
    if (result.success && result.serverUrl) {
      // 同步到 localStorage
      localStorage.setItem(SERVER_BASE_URL_KEY, result.serverUrl);
      localStorage.setItem(SERVER_CONFIGURED_KEY, "true");
      localStorage.setItem(APP_MODE_KEY, mode || "");
    }
    return result;
  }
  
  // 浏览器环境只支持云端模式
  if (mode === "local") {
    return { success: false, message: "浏览器环境不支持本地模式" };
  }
  
  localStorage.setItem(APP_MODE_KEY, mode || "");
  return { success: true };
}

/**
 * 检查应用模式是否已配置
 */
export async function isAppModeConfigured(): Promise<boolean> {
  if (isElectron()) {
    return window.electronAPI!.appMode.isConfigured();
  }
  return localStorage.getItem(SERVER_CONFIGURED_KEY) === "true";
}

/**
 * 获取本地服务器状态（仅 Electron 环境）
 */
export async function getLocalServerStatus(): Promise<LocalServerStatus | null> {
  if (!isElectron()) {
    return null;
  }
  return window.electronAPI!.appMode.getLocalServerStatus();
}

/**
 * 重置应用模式配置
 */
export async function resetAppMode(): Promise<{ success: boolean }> {
  if (isElectron()) {
    const result = await window.electronAPI!.appMode.reset();
    if (result.success) {
      localStorage.removeItem(SERVER_BASE_URL_KEY);
      localStorage.removeItem(SERVER_CONFIGURED_KEY);
      localStorage.removeItem(APP_MODE_KEY);
    }
    return result;
  }
  
  localStorage.removeItem(SERVER_BASE_URL_KEY);
  localStorage.removeItem(SERVER_CONFIGURED_KEY);
  localStorage.removeItem(APP_MODE_KEY);
  return { success: true };
}

/**
 * 检测是否在 Docker 部署模式下（前后端同源部署）
 * 通过检测 /health 端点是否在当前域名下可访问来判断
 */
async function detectDockerDeployment(): Promise<boolean> {
  try {
    const currentOrigin = window.location.origin;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${currentOrigin}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return data.status === "ok";
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 获取服务器基础 URL
 * Electron 环境从 electron-store 获取，浏览器环境从 localStorage 获取
 * 如果未配置，返回空字符串
 */
export async function getServerBaseUrl(): Promise<string> {
  if (isElectron()) {
    // 先检查应用模式
    const modeConfig = await window.electronAPI!.appMode.get();
    if (modeConfig.isConfigured && modeConfig.mode === "local") {
      return LOCAL_SERVER_URL;
    }
    
    const config = await window.electronAPI!.serverConfig.get();
    return config.baseUrl || "";
  }
  // 浏览器环境使用 localStorage
  return localStorage.getItem(SERVER_BASE_URL_KEY) || "";
}

/**
 * 同步获取服务器基础 URL（用于初始化 tRPC）
 * 注意：这个只能获取浏览器 localStorage 中的值
 * Electron 环境需要等待异步初始化完成
 * 如果未配置，返回空字符串
 */
export function getServerBaseUrlSync(): string {
  return localStorage.getItem(SERVER_BASE_URL_KEY) || "";
}

/**
 * 设置服务器基础 URL
 */
export async function setServerBaseUrl(url: string): Promise<{ success: boolean; message?: string }> {
  // 规范化 URL，去除末尾斜杠
  let baseUrl = url.trim();
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  if (isElectron()) {
    const result = await window.electronAPI!.serverConfig.set({ baseUrl });
    if (result.success) {
      // 同时保存到 localStorage，供 tRPC 同步使用
      localStorage.setItem(SERVER_BASE_URL_KEY, baseUrl);
      localStorage.setItem(SERVER_CONFIGURED_KEY, "true");
      localStorage.setItem(APP_MODE_KEY, "cloud");
    }
    return result;
  }

  // 浏览器环境
  localStorage.setItem(SERVER_BASE_URL_KEY, baseUrl);
  localStorage.setItem(SERVER_CONFIGURED_KEY, "true");
  localStorage.setItem(APP_MODE_KEY, "cloud");
  return { success: true };
}

/**
 * 检查服务器是否已配置
 */
export async function isServerConfigured(): Promise<boolean> {
  if (isElectron()) {
    // 先检查应用模式
    const modeConfigured = await window.electronAPI!.appMode.isConfigured();
    if (modeConfigured) {
      return true;
    }
    return window.electronAPI!.serverConfig.isConfigured();
  }
  // 浏览器环境
  return localStorage.getItem(SERVER_CONFIGURED_KEY) === "true";
}

/**
 * 同步检查服务器是否已配置（用于路由守卫）
 */
export function isServerConfiguredSync(): boolean {
  return localStorage.getItem(SERVER_CONFIGURED_KEY) === "true";
}

/**
 * 测试服务器连接
 */
export async function testServerConnection(baseUrl: string): Promise<{ success: boolean; message?: string }> {
  // 规范化 URL
  let url = baseUrl.trim();
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }

  // 浏览器和 Electron 环境都使用相同的逻辑
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // 使用 /health 健康检查端点
    const response = await fetch(`${url}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === "ok") {
        return { success: true, message: "连接成功" };
      }
    }
    return { success: false, message: `服务器返回状态码: ${response.status}` };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { success: false, message: "连接超时，请检查地址是否正确" };
      }
      return { success: false, message: `连接失败: ${error.message}` };
    }
    return { success: false, message: "连接失败" };
  }
}

/**
 * 初始化服务器配置
 * - Electron 环境下同步配置到 localStorage
 * - 浏览器环境下检测是否为 Docker 部署（前后端同源），自动配置
 */
export async function initServerConfig(): Promise<void> {
  if (isElectron()) {
    // 首先检查应用模式
    const modeConfig = await window.electronAPI!.appMode.get();
    
    if (modeConfig.isConfigured) {
      if (modeConfig.mode === "local") {
        // 本地模式，使用本地服务器地址
        localStorage.setItem(SERVER_BASE_URL_KEY, LOCAL_SERVER_URL);
        localStorage.setItem(SERVER_CONFIGURED_KEY, "true");
        localStorage.setItem(APP_MODE_KEY, "local");
      } else if (modeConfig.mode === "cloud") {
        // 云端模式，从 serverConfig 获取
        const config = await window.electronAPI!.serverConfig.get();
        if (config.isConfigured && config.baseUrl) {
          localStorage.setItem(SERVER_BASE_URL_KEY, config.baseUrl);
          localStorage.setItem(SERVER_CONFIGURED_KEY, "true");
          localStorage.setItem(APP_MODE_KEY, "cloud");
        }
      }
      return;
    }
    
    // 兼容旧版本：如果没有 appMode 配置但有 serverConfig，视为云端模式
    const config = await window.electronAPI!.serverConfig.get();
    if (config.isConfigured && config.baseUrl) {
      localStorage.setItem(SERVER_BASE_URL_KEY, config.baseUrl);
      localStorage.setItem(SERVER_CONFIGURED_KEY, "true");
      localStorage.setItem(APP_MODE_KEY, "cloud");
    }
    return;
  }
  
  // 浏览器环境：如果未配置，尝试检测 Docker 部署模式
  const configured = localStorage.getItem(SERVER_CONFIGURED_KEY) === "true";
  if (!configured) {
    const isDocker = await detectDockerDeployment();
    if (isDocker) {
      // Docker 部署模式，自动使用当前域名
      const currentOrigin = window.location.origin;
      localStorage.setItem(SERVER_BASE_URL_KEY, currentOrigin);
      localStorage.setItem(SERVER_CONFIGURED_KEY, "true");
      localStorage.setItem(APP_MODE_KEY, "cloud");
      console.log("检测到 Docker 部署模式，自动配置服务器地址:", currentOrigin);
    }
  }
}

/**
 * 获取完整的 tRPC URL
 */
export function getTrpcUrl(): string {
  const baseUrl = getServerBaseUrlSync();
  return `${baseUrl}/trpc`;
}

/**
 * 获取 API 基础 URL（同步版本，用于 fetch 请求）
 */
export function getApiBaseUrl(): string {
  return getServerBaseUrlSync();
}

/**
 * 获取本地服务器 URL
 */
export function getLocalServerUrl(): string {
  return LOCAL_SERVER_URL;
}
