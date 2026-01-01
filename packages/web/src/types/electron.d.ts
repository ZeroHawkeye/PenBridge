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

// 更新状态类型
export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  progress: number;
  version: string | null;
  releaseNotes: string | null;
}

export interface ElectronUpdaterAPI {
  check: () => Promise<UpdateStatus>;
  download: () => Promise<UpdateStatus>;
  install: () => void;
  getStatus: () => Promise<UpdateStatus>;
  getVersion: () => Promise<string>;
  onStatusChange: (callback: (status: UpdateStatus) => void) => () => void;
}

// 应用模式类型
export type AppMode = "local" | "cloud" | null;

// 应用模式配置
export interface AppModeConfig {
  mode: AppMode;
  isConfigured: boolean;
}

// 本地服务器状态
export interface LocalServerStatus {
  running: boolean;
  url: string;
  healthy: boolean;
}

// 应用模式 API
export interface ElectronAppModeAPI {
  get: () => Promise<AppModeConfig>;
  set: (mode: AppMode) => Promise<{ success: boolean; message?: string; serverUrl?: string }>;
  isConfigured: () => Promise<boolean>;
  getLocalServerStatus: () => Promise<LocalServerStatus>;
  startLocalServer: () => Promise<{ success: boolean; url?: string; error?: string }>;
  stopLocalServer: () => Promise<{ success: boolean }>;
  reset: () => Promise<{ success: boolean }>;
}

export interface ElectronAPI {
  window: ElectronWindowAPI;
  auth: ElectronAuthAPI;
  juejinAuth: ElectronJuejinAuthAPI;
  serverConfig: ElectronServerConfigAPI;
  shell: ElectronShellAPI;
  updater: ElectronUpdaterAPI;
  appMode: ElectronAppModeAPI;
  platform: string;
}

// 扩展全局 Window 接口
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
