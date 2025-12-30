import { contextBridge, ipcRenderer } from "electron";

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
});

// TypeScript 类型定义
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
    };
  }
}
