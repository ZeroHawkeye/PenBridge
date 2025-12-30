// 共享类型定义

export enum ArticleStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  PUBLISHED = "published",
  FAILED = "failed",
}

export interface User {
  id: number;
  nickname?: string;
  avatarUrl?: string;
}

export interface Article {
  id: number;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  status: ArticleStatus;
  scheduledAt?: Date | string;
  publishedAt?: Date | string;
  tencentDraftId?: number;
  tencentArticleId?: string;
  tencentArticleUrl?: string;
  tencentTagIds?: number[];
  sourceType?: number; // 1-原创, 2-转载, 3-翻译
  lastSyncedAt?: Date | string;
  errorMessage?: string;
  userId: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// 同步结果
export interface SyncResult {
  success: boolean;
  message: string;
  draftId?: number;
  articleId?: number;
  articleUrl?: string;
}

// 标签信息
export interface TagInfo {
  tagId: number;
  tagName: string;
  synonym: string[];
}

export interface LoginResult {
  success: boolean;
  message: string;
  user?: User;
}

export interface AuthStatus {
  isLoggedIn: boolean;
  user?: User;
}

export interface ArticleListResponse {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Electron API 类型定义
export interface ElectronWindowAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
}

export interface ElectronAuthAPI {
  getStatus: () => Promise<AuthStatus>;
  login: () => Promise<LoginResult>;
  logout: () => Promise<{ success: boolean }>;
  getCookies: () => Promise<string | null>;
  syncToServer: () => Promise<{ success: boolean; message?: string }>;
}

export interface ElectronAPI {
  window: ElectronWindowAPI;
  auth: ElectronAuthAPI;
  platform: string;
}

// 扩展 Window 接口
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
