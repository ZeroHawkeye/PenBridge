// 服务器配置工具函数

const SERVER_BASE_URL_KEY = "server_base_url";
const SERVER_CONFIGURED_KEY = "server_configured";

/**
 * 检测是否在 Electron 环境中
 */
export function isElectron(): boolean {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
}

/**
 * 获取服务器基础 URL
 * Electron 环境从 electron-store 获取，浏览器环境从 localStorage 获取
 * 如果未配置，返回空字符串
 */
export async function getServerBaseUrl(): Promise<string> {
  if (isElectron()) {
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
    }
    return result;
  }

  // 浏览器环境
  localStorage.setItem(SERVER_BASE_URL_KEY, baseUrl);
  localStorage.setItem(SERVER_CONFIGURED_KEY, "true");
  return { success: true };
}

/**
 * 检查服务器是否已配置
 */
export async function isServerConfigured(): Promise<boolean> {
  if (isElectron()) {
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

    // 使用根路径的健康检查端点
    const response = await fetch(`${url}/`, {
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
 * 初始化服务器配置（Electron 环境下同步配置到 localStorage）
 */
export async function initServerConfig(): Promise<void> {
  if (isElectron()) {
    const config = await window.electronAPI!.serverConfig.get();
    if (config.isConfigured && config.baseUrl) {
      localStorage.setItem(SERVER_BASE_URL_KEY, config.baseUrl);
      localStorage.setItem(SERVER_CONFIGURED_KEY, "true");
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
