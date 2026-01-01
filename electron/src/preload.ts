import { contextBridge, ipcRenderer } from "electron";

// 应用模式类型
type AppMode = "local" | "cloud" | null;

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld("electronAPI", {
  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    // 监听窗口最大化状态变化
    onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
      const handler = (_event: any, isMaximized: boolean) => callback(isMaximized);
      ipcRenderer.on("window:maximized-change", handler);
      // 返回取消监听的函数
      return () => ipcRenderer.removeListener("window:maximized-change", handler);
    },
  },

  // 应用模式相关
  appMode: {
    // 获取应用模式配置
    get: () => ipcRenderer.invoke("appMode:get"),

    // 设置应用模式（本地/云端）
    set: (mode: AppMode) => ipcRenderer.invoke("appMode:set", mode),

    // 检查模式是否已配置
    isConfigured: () => ipcRenderer.invoke("appMode:isConfigured"),

    // 获取本地服务器状态
    getLocalServerStatus: () => ipcRenderer.invoke("appMode:getLocalServerStatus"),

    // 手动启动本地服务器
    startLocalServer: () => ipcRenderer.invoke("appMode:startLocalServer"),

    // 手动停止本地服务器
    stopLocalServer: () => ipcRenderer.invoke("appMode:stopLocalServer"),

    // 重置模式配置
    reset: () => ipcRenderer.invoke("appMode:reset"),
  },

  // 腾讯云社区认证相关
  auth: {
    // 获取登录状态
    getStatus: () => ipcRenderer.invoke("auth:status"),

    // 打开登录窗口
    login: () => ipcRenderer.invoke("auth:login"),

    // 登出
    logout: () => ipcRenderer.invoke("auth:logout"),

    // 获取 cookies
    getCookies: () => ipcRenderer.invoke("auth:getCookies"),

    // 同步到服务器
    syncToServer: () => ipcRenderer.invoke("auth:syncToServer"),
  },

  // 掘金认证相关
  juejinAuth: {
    // 获取登录状态
    getStatus: () => ipcRenderer.invoke("juejinAuth:status"),

    // 打开登录窗口
    login: () => ipcRenderer.invoke("juejinAuth:login"),

    // 登出
    logout: () => ipcRenderer.invoke("juejinAuth:logout"),

    // 获取 cookies
    getCookies: () => ipcRenderer.invoke("juejinAuth:getCookies"),

    // 同步到服务器
    syncToServer: () => ipcRenderer.invoke("juejinAuth:syncToServer"),
  },

  // 服务器配置相关
  serverConfig: {
    // 获取服务器配置
    get: () => ipcRenderer.invoke("serverConfig:get"),

    // 设置服务器配置
    set: (config: { baseUrl: string }) => ipcRenderer.invoke("serverConfig:set", config),

    // 检查是否已配置
    isConfigured: () => ipcRenderer.invoke("serverConfig:isConfigured"),

    // 测试服务器连接
    testConnection: (baseUrl: string) => ipcRenderer.invoke("serverConfig:testConnection", baseUrl),
  },

  // 平台信息
  platform: process.platform,

  // Shell 相关
  shell: {
    // 在系统默认浏览器中打开外部链接
    openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
  },

  // 自动更新相关
  updater: {
    // 检查更新
    check: () => ipcRenderer.invoke("updater:check"),
    // 下载更新
    download: () => ipcRenderer.invoke("updater:download"),
    // 安装更新并重启
    install: () => ipcRenderer.invoke("updater:install"),
    // 获取当前状态
    getStatus: () => ipcRenderer.invoke("updater:getStatus"),
    // 获取当前应用版本
    getVersion: () => ipcRenderer.invoke("updater:getVersion"),
    // 监听更新状态变化
    onStatusChange: (callback: (status: any) => void) => {
      const handler = (_event: any, status: any) => callback(status);
      ipcRenderer.on("updater:status", handler);
      return () => ipcRenderer.removeListener("updater:status", handler);
    },
  },
});

// TypeScript 类型定义（AppMode 类型已在文件开头定义）

interface AppModeConfig {
  mode: AppMode;
  isConfigured: boolean;
}

interface LocalServerStatus {
  running: boolean;
  url: string;
  healthy: boolean;
}

declare global {
  interface Window {
    electronAPI: {
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
      };
      appMode: {
        get: () => Promise<AppModeConfig>;
        set: (mode: AppMode) => Promise<{ success: boolean; message?: string; serverUrl?: string }>;
        isConfigured: () => Promise<boolean>;
        getLocalServerStatus: () => Promise<LocalServerStatus>;
        startLocalServer: () => Promise<{ success: boolean; url?: string; error?: string }>;
        stopLocalServer: () => Promise<{ success: boolean }>;
        reset: () => Promise<{ success: boolean }>;
      };
      auth: {
        getStatus: () => Promise<{
          isLoggedIn: boolean;
          user?: { nickname?: string; avatarUrl?: string };
        }>;
        login: () => Promise<{
          success: boolean;
          message: string;
          user?: { nickname?: string; avatarUrl?: string };
        }>;
        logout: () => Promise<{ success: boolean }>;
        getCookies: () => Promise<string | null>;
        syncToServer: () => Promise<{ success: boolean; message?: string }>;
      };
      juejinAuth: {
        getStatus: () => Promise<{
          isLoggedIn: boolean;
          user?: { nickname?: string; avatarUrl?: string; userId?: string };
        }>;
        login: () => Promise<{
          success: boolean;
          message: string;
          user?: { nickname?: string; avatarUrl?: string; userId?: string };
        }>;
        logout: () => Promise<{ success: boolean }>;
        getCookies: () => Promise<string | null>;
        syncToServer: () => Promise<{ success: boolean; message?: string }>;
      };
      serverConfig: {
        get: () => Promise<{ baseUrl: string; isConfigured: boolean }>;
        set: (config: { baseUrl: string }) => Promise<{ success: boolean; message?: string }>;
        isConfigured: () => Promise<boolean>;
        testConnection: (baseUrl: string) => Promise<{ success: boolean; message?: string }>;
      };
      platform: string;
      shell: {
        openExternal: (url: string) => Promise<{ success: boolean; message?: string }>;
      };
      updater: {
        check: () => Promise<UpdateStatus>;
        download: () => Promise<UpdateStatus>;
        install: () => void;
        getStatus: () => Promise<UpdateStatus>;
        getVersion: () => Promise<string>;
        onStatusChange: (callback: (status: UpdateStatus) => void) => () => void;
      };
    };
  }
}

// 更新状态类型
interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  progress: number;
  version: string | null;
  releaseNotes: string | null;
}
