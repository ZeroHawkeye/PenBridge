// Electron API 类型定义

export interface ElectronWindowAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
}

export interface ElectronAuthAPI {
  getStatus: () => Promise<{
    isLoggedIn: boolean;
    user?: { nickname?: string; avatarUrl?: string };
  }>;
  login: () => Promise<{
    success: boolean;
    message?: string;
    user?: { nickname?: string; avatarUrl?: string };
  }>;
  logout: () => Promise<{ success: boolean }>;
  getCookies: () => Promise<string | null>;
  syncToServer: () => Promise<{ success: boolean; message?: string }>;
}

export interface ElectronJuejinAuthAPI {
  getStatus: () => Promise<{
    isLoggedIn: boolean;
    user?: { nickname?: string; avatarUrl?: string; userId?: string };
  }>;
  login: () => Promise<{
    success: boolean;
    message?: string;
    user?: { nickname?: string; avatarUrl?: string; userId?: string };
  }>;
  logout: () => Promise<{ success: boolean }>;
  getCookies: () => Promise<string | null>;
  syncToServer: () => Promise<{ success: boolean; message?: string }>;
}

export interface ServerConfig {
  baseUrl: string;
  isConfigured: boolean;
}

export interface ElectronServerConfigAPI {
  get: () => Promise<ServerConfig>;
  set: (config: { baseUrl: string }) => Promise<{ success: boolean; message?: string }>;
  isConfigured: () => Promise<boolean>;
  testConnection: (baseUrl: string) => Promise<{ success: boolean; message?: string }>;
}

export interface ElectronShellAPI {
  openExternal: (url: string) => Promise<{ success: boolean; message?: string }>;
}

export interface ElectronAPI {
  window: ElectronWindowAPI;
  auth: ElectronAuthAPI;
  juejinAuth: ElectronJuejinAuthAPI;
  serverConfig: ElectronServerConfigAPI;
  shell: ElectronShellAPI;
  platform: string;
}

// 扩展全局 Window 接口
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
