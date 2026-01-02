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

// ==================== 导入导出相关类型 ====================

/**
 * 导出数据的版本信息
 */
export interface ExportMetadata {
  version: string; // 数据格式版本
  appVersion: string; // 应用版本
  exportedAt: string; // 导出时间 ISO 格式
  encrypted: boolean; // 是否加密
  includeSensitiveData: boolean; // 是否包含敏感数据
}

/**
 * 导出的用户数据（平台登录信息）
 */
export interface ExportedUser {
  id: number;
  // 腾讯云社区
  tencentUid?: string;
  nickname?: string;
  avatarUrl?: string;
  cookies?: string; // 敏感数据，可选导出
  isLoggedIn: boolean;
  lastLoginAt?: string;
  // 掘金
  juejinUserId?: string;
  juejinNickname?: string;
  juejinAvatarUrl?: string;
  juejinCookies?: string; // 敏感数据，可选导出
  juejinLoggedIn: boolean;
  juejinLastLoginAt?: string;
  // 时间戳
  createdAt: string;
  updatedAt: string;
}

/**
 * 导出的文件夹数据
 */
export interface ExportedFolder {
  id: number;
  name: string;
  parentId?: number;
  order: number;
  isExpanded: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 导出的文章数据
 */
export interface ExportedArticle {
  id: number;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  status: ArticleStatus;
  scheduledAt?: string;
  publishedAt?: string;
  // 腾讯云
  tencentDraftId?: number;
  tencentArticleId?: string;
  tencentArticleUrl?: string;
  tencentTagIds?: number[];
  sourceType: number;
  lastSyncedAt?: string;
  errorMessage?: string;
  // 掘金
  juejinDraftId?: string;
  juejinArticleId?: string;
  juejinArticleUrl?: string;
  juejinCategoryId?: string;
  juejinTagIds?: string[];
  juejinTagNames?: string[];
  juejinBriefContent?: string;
  juejinIsOriginal: number;
  juejinStatus?: string;
  juejinLastSyncedAt?: string;
  // 关联
  userId: number;
  folderId?: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 导出的管理员用户数据
 */
export interface ExportedAdminUser {
  id: number;
  username: string;
  passwordHash?: string; // 敏感数据，可选导出
  role: "super_admin" | "admin";
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== AI 配置相关类型 ====================

/**
 * AI SDK 类型
 * - openai: 使用 @ai-sdk/openai，适用于 OpenAI 官方模型（原生支持 reasoning）
 * - openai-compatible: 使用 @ai-sdk/openai-compatible，适用于兼容 OpenAI API 的第三方服务
 */
export type AISDKType = "openai" | "openai-compatible";

/**
 * 模型能力配置
 */
export interface ModelCapabilities {
  // 是否支持推理/深度思考（如 o1、DeepSeek-R1 等）
  reasoning: boolean;
  // 是否支持流式输出
  streaming: boolean;
  // 是否支持工具调用/函数调用
  functionCalling: boolean;
  // 是否支持视觉理解（多模态）
  vision: boolean;
}

/**
 * AI Loop 配置（Agent 式多步任务）
 */
export interface AILoopConfig {
  // 最大循环次数（防止死循环）
  maxLoops: number;
  // 是否不限制循环次数
  unlimited: boolean;
}

/**
 * 模型参数配置
 */
export interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * 默认模型能力配置
 */
export const defaultCapabilities: ModelCapabilities = {
  reasoning: false,
  streaming: true,
  functionCalling: true,
  vision: false,
};

/**
 * 默认 AI Loop 配置
 */
export const defaultAILoopConfig: AILoopConfig = {
  maxLoops: 20,
  unlimited: false,
};

/**
 * 导出的 AI 供应商配置
 */
export interface ExportedAIProvider {
  id: number;
  userId: number;
  name: string;
  baseUrl: string;
  apiKey?: string; // 敏感数据，可选导出
  enabled: boolean;
  order: number;
  sdkType: AISDKType;
  createdAt: string;
  updatedAt: string;
}

/**
 * 导出的 AI 模型配置
 */
export interface ExportedAIModel {
  id: number;
  userId: number;
  providerId: number;
  modelId: string;
  displayName: string;
  isDefault: boolean;
  enabled: boolean;
  order: number;
  contextLength?: number;
  parameters?: ModelParameters;
  capabilities?: ModelCapabilities;
  aiLoopConfig?: AILoopConfig;
  createdAt: string;
  updatedAt: string;
}

/**
 * 导出的邮件配置
 */
export interface ExportedEmailConfig {
  id: number;
  userId: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPass?: string; // 敏感数据，可选导出
  fromName?: string;
  fromEmail?: string;
  notifyEmail?: string;
  notifyOnSuccess: boolean;
  notifyOnFailed: boolean;
  notifyOnCookieExpired: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 导出的定时任务数据
 */
export interface ExportedScheduledTask {
  id: number;
  articleId: number;
  userId: number;
  platform: "tencent" | "juejin" | "csdn";
  config: Record<string, unknown>;
  scheduledAt: string;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  errorMessage?: string;
  executedAt?: string;
  resultUrl?: string;
  retryCount: number;
  maxRetries: number;
  notified: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 导出的图片数据
 */
export interface ExportedImage {
  articleId: number; // 关联的文章ID
  fileName: string; // 文件名
  mimeType: string; // MIME类型
  data: string; // Base64编码的图片数据
}

/**
 * 完整的导出数据结构
 */
export interface ExportData {
  metadata: ExportMetadata;
  users: ExportedUser[];
  folders: ExportedFolder[];
  articles: ExportedArticle[];
  adminUsers: ExportedAdminUser[];
  aiProviders: ExportedAIProvider[];
  aiModels: ExportedAIModel[];
  emailConfigs: ExportedEmailConfig[];
  scheduledTasks: ExportedScheduledTask[];
  images?: ExportedImage[]; // 图片数据（可选，因为向后兼容）
}

/**
 * 导出选项
 */
export interface ExportOptions {
  includeSensitiveData: boolean; // 是否包含敏感数据（cookies, apiKey, 密码等）
  encryptionPassword?: string; // 加密密码，如果提供则加密敏感数据
  includeArticles: boolean; // 是否包含文章
  includeFolders: boolean; // 是否包含文件夹
  includeUsers: boolean; // 是否包含用户登录信息
  includeAdminUsers: boolean; // 是否包含管理员账户
  includeAIConfig: boolean; // 是否包含 AI 配置
  includeEmailConfig: boolean; // 是否包含邮件配置
  includeScheduledTasks: boolean; // 是否包含定时任务
  includeImages: boolean; // 是否包含文章图片
}

/**
 * 导入选项
 */
export interface ImportOptions {
  decryptionPassword?: string; // 解密密码
  overwriteExisting: boolean; // 是否覆盖已存在的数据
  importArticles: boolean;
  importFolders: boolean;
  importUsers: boolean;
  importAdminUsers: boolean;
  importAIConfig: boolean;
  importEmailConfig: boolean;
  importScheduledTasks: boolean;
  importImages: boolean; // 是否导入图片
}

/**
 * 导入结果
 */
export interface ImportResult {
  success: boolean;
  message: string;
  stats: {
    users: { imported: number; skipped: number; failed: number };
    folders: { imported: number; skipped: number; failed: number };
    articles: { imported: number; skipped: number; failed: number };
    adminUsers: { imported: number; skipped: number; failed: number };
    aiProviders: { imported: number; skipped: number; failed: number };
    aiModels: { imported: number; skipped: number; failed: number };
    emailConfigs: { imported: number; skipped: number; failed: number };
    scheduledTasks: { imported: number; skipped: number; failed: number };
    images: { imported: number; skipped: number; failed: number };
  };
  errors: string[];
}
