/**
 * 数据导入导出服务
 * 用于纯本地化存储的数据迁移功能
 */

import { AppDataSource } from "../db";
import { User } from "../entities/User";
import { Article, ArticleStatus } from "../entities/Article";
import { Folder } from "../entities/Folder";
import { AdminUser } from "../entities/AdminUser";
import { AIProvider, AIModel } from "../entities/AIProvider";
import { EmailConfig } from "../entities/EmailConfig";
import { ScheduledTask, TaskStatus, Platform } from "../entities/ScheduledTask";
import type {
  ExportData,
  ExportOptions,
  ExportMetadata,
  ExportedUser,
  ExportedFolder,
  ExportedArticle,
  ExportedAdminUser,
  ExportedAIProvider,
  ExportedAIModel,
  ExportedEmailConfig,
  ExportedScheduledTask,
  ExportedImage,
  ImportOptions,
  ImportResult,
} from "../../shared/types";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import * as fs from "fs";
import * as path from "path";
import JSZip from "jszip";
import { getUploadDir } from "./dataDir";

// 当前数据格式版本
const DATA_FORMAT_VERSION = "1.0.0";
const APP_VERSION = "1.0.0"; // TODO: 从 package.json 读取

/**
 * 加密工具函数
 */
function encrypt(text: string, password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  // 返回格式: salt:iv:encrypted
  return `${salt.toString("hex")}:${iv.toString("hex")}:${encrypted}`;
}

function decrypt(encryptedText: string, password: string): string {
  const [saltHex, ivHex, encrypted] = encryptedText.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const key = scryptSync(password, salt, 32);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * 日期转换工具
 */
function dateToString(date?: Date | null): string | undefined {
  return date ? date.toISOString() : undefined;
}

function stringToDate(str?: string | null): Date | undefined {
  return str ? new Date(str) : undefined;
}

/**
 * 导出数据服务
 */
export async function exportData(options: ExportOptions): Promise<ExportData> {
  const metadata: ExportMetadata = {
    version: DATA_FORMAT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    encrypted: !!options.encryptionPassword,
    includeSensitiveData: options.includeSensitiveData,
  };

  const result: ExportData = {
    metadata,
    users: [],
    folders: [],
    articles: [],
    adminUsers: [],
    aiProviders: [],
    aiModels: [],
    emailConfigs: [],
    scheduledTasks: [],
  };

  // 导出用户数据
  if (options.includeUsers) {
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find();
    result.users = users.map((user) => {
      const exported: ExportedUser = {
        id: user.id,
        tencentUid: user.tencentUid,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        isLoggedIn: user.isLoggedIn,
        lastLoginAt: dateToString(user.lastLoginAt),
        juejinUserId: user.juejinUserId,
        juejinNickname: user.juejinNickname,
        juejinAvatarUrl: user.juejinAvatarUrl,
        juejinLoggedIn: user.juejinLoggedIn,
        juejinLastLoginAt: dateToString(user.juejinLastLoginAt),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };

      // 敏感数据处理
      if (options.includeSensitiveData) {
        if (user.cookies) {
          exported.cookies = options.encryptionPassword
            ? encrypt(user.cookies, options.encryptionPassword)
            : user.cookies;
        }
        if (user.juejinCookies) {
          exported.juejinCookies = options.encryptionPassword
            ? encrypt(user.juejinCookies, options.encryptionPassword)
            : user.juejinCookies;
        }
      }

      return exported;
    });
  }

  // 导出文件夹数据
  if (options.includeFolders) {
    const folderRepo = AppDataSource.getRepository(Folder);
    const folders = await folderRepo.find();
    result.folders = folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      order: folder.order,
      isExpanded: folder.isExpanded,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    }));
  }

  // 导出文章数据
  if (options.includeArticles) {
    const articleRepo = AppDataSource.getRepository(Article);
    const articles = await articleRepo.find();
    result.articles = articles.map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      summary: article.summary,
      tags: article.tags,
      status: article.status,
      scheduledAt: dateToString(article.scheduledAt),
      publishedAt: dateToString(article.publishedAt),
      tencentDraftId: article.tencentDraftId,
      tencentArticleId: article.tencentArticleId,
      tencentArticleUrl: article.tencentArticleUrl,
      tencentTagIds: article.tencentTagIds,
      sourceType: article.sourceType,
      lastSyncedAt: dateToString(article.lastSyncedAt),
      errorMessage: article.errorMessage,
      juejinDraftId: article.juejinDraftId,
      juejinArticleId: article.juejinArticleId,
      juejinArticleUrl: article.juejinArticleUrl,
      juejinCategoryId: article.juejinCategoryId,
      juejinTagIds: article.juejinTagIds,
      juejinTagNames: article.juejinTagNames,
      juejinBriefContent: article.juejinBriefContent,
      juejinIsOriginal: article.juejinIsOriginal,
      juejinStatus: article.juejinStatus,
      juejinLastSyncedAt: dateToString(article.juejinLastSyncedAt),
      userId: article.userId,
      folderId: article.folderId,
      order: article.order,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    }));
  }

  // 导出管理员用户数据
  if (options.includeAdminUsers) {
    const adminUserRepo = AppDataSource.getRepository(AdminUser);
    const adminUsers = await adminUserRepo.find();
    result.adminUsers = adminUsers.map((admin) => {
      const exported: ExportedAdminUser = {
        id: admin.id,
        username: admin.username,
        role: admin.role as "super_admin" | "admin",
        lastLoginAt: dateToString(admin.lastLoginAt),
        createdAt: admin.createdAt.toISOString(),
        updatedAt: admin.updatedAt.toISOString(),
      };

      // 密码哈希作为敏感数据处理
      if (options.includeSensitiveData) {
        exported.passwordHash = options.encryptionPassword
          ? encrypt(admin.passwordHash, options.encryptionPassword)
          : admin.passwordHash;
      }

      return exported;
    });
  }

  // 导出 AI 供应商配置
  if (options.includeAIConfig) {
    const providerRepo = AppDataSource.getRepository(AIProvider);
    const providers = await providerRepo.find();
    result.aiProviders = providers.map((provider) => {
      const exported: ExportedAIProvider = {
        id: provider.id,
        userId: provider.userId,
        name: provider.name,
        baseUrl: provider.baseUrl,
        enabled: provider.enabled,
        order: provider.order,
        apiType: provider.apiType,
        createdAt: provider.createdAt.toISOString(),
        updatedAt: provider.updatedAt.toISOString(),
      };

      // API Key 作为敏感数据处理
      if (options.includeSensitiveData && provider.apiKey) {
        exported.apiKey = options.encryptionPassword
          ? encrypt(provider.apiKey, options.encryptionPassword)
          : provider.apiKey;
      }

      return exported;
    });

    // 导出 AI 模型配置
    const modelRepo = AppDataSource.getRepository(AIModel);
    const models = await modelRepo.find();
    result.aiModels = models.map((model) => ({
      id: model.id,
      userId: model.userId,
      providerId: model.providerId,
      modelId: model.modelId,
      displayName: model.displayName,
      isDefault: model.isDefault,
      enabled: model.enabled,
      order: model.order,
      contextLength: model.contextLength,
      parameters: model.parameters,
      capabilities: model.capabilities,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
    }));
  }

  // 导出邮件配置
  if (options.includeEmailConfig) {
    const emailConfigRepo = AppDataSource.getRepository(EmailConfig);
    const emailConfigs = await emailConfigRepo.find();
    result.emailConfigs = emailConfigs.map((config) => {
      const exported: ExportedEmailConfig = {
        id: config.id,
        userId: config.userId,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser,
        fromName: config.fromName,
        fromEmail: config.fromEmail,
        notifyEmail: config.notifyEmail,
        notifyOnSuccess: config.notifyOnSuccess,
        notifyOnFailed: config.notifyOnFailed,
        notifyOnCookieExpired: config.notifyOnCookieExpired,
        enabled: config.enabled,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      };

      // SMTP 密码作为敏感数据处理
      if (options.includeSensitiveData && config.smtpPass) {
        exported.smtpPass = options.encryptionPassword
          ? encrypt(config.smtpPass, options.encryptionPassword)
          : config.smtpPass;
      }

      return exported;
    });
  }

  // 导出定时任务
  if (options.includeScheduledTasks) {
    const taskRepo = AppDataSource.getRepository(ScheduledTask);
    const tasks = await taskRepo.find();
    result.scheduledTasks = tasks.map((task) => ({
      id: task.id,
      articleId: task.articleId,
      userId: task.userId,
      platform: task.platform as "tencent" | "juejin" | "csdn",
      config: task.config as Record<string, unknown>,
      scheduledAt: task.scheduledAt.toISOString(),
      status: task.status as "pending" | "running" | "success" | "failed" | "cancelled",
      errorMessage: task.errorMessage,
      executedAt: dateToString(task.executedAt),
      resultUrl: task.resultUrl,
      retryCount: task.retryCount,
      maxRetries: task.maxRetries,
      notified: task.notified,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));
  }

  // 注意: 图片数据不再嵌入 JSON，将由 ZIP 导出函数单独处理

  return result;
}

/**
 * 验证导入数据格式
 */
function validateImportData(data: unknown): data is ExportData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;

  // 检查 metadata
  if (!d.metadata || typeof d.metadata !== "object") return false;
  const metadata = d.metadata as Record<string, unknown>;
  if (typeof metadata.version !== "string") return false;

  // 检查必需的数组字段
  const arrayFields = [
    "users", "folders", "articles", "adminUsers",
    "aiProviders", "aiModels", "emailConfigs", "scheduledTasks"
  ];
  for (const field of arrayFields) {
    if (!Array.isArray(d[field])) return false;
  }

  return true;
}

/**
 * 导入数据服务
 */
export async function importData(
  data: ExportData,
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    message: "",
    stats: {
      users: { imported: 0, skipped: 0, failed: 0 },
      folders: { imported: 0, skipped: 0, failed: 0 },
      articles: { imported: 0, skipped: 0, failed: 0 },
      adminUsers: { imported: 0, skipped: 0, failed: 0 },
      aiProviders: { imported: 0, skipped: 0, failed: 0 },
      aiModels: { imported: 0, skipped: 0, failed: 0 },
      emailConfigs: { imported: 0, skipped: 0, failed: 0 },
      scheduledTasks: { imported: 0, skipped: 0, failed: 0 },
      images: { imported: 0, skipped: 0, failed: 0 },
    },
    errors: [],
  };

  const isEncrypted = data.metadata.encrypted;
  const password = options.decryptionPassword;

  // 解密辅助函数
  const tryDecrypt = (value?: string): string | undefined => {
    if (!value) return undefined;
    if (isEncrypted && password) {
      try {
        return decrypt(value, password);
      } catch {
        result.errors.push("解密失败，请检查密码是否正确");
        return undefined;
      }
    }
    return value;
  };

  // ID 映射表（旧 ID -> 新 ID）
  const userIdMap = new Map<number, number>();
  const folderIdMap = new Map<number, number>();
  const articleIdMap = new Map<number, number>();
  const providerIdMap = new Map<number, number>();

  try {
    // 导入用户数据
    if (options.importUsers && data.users.length > 0) {
      const userRepo = AppDataSource.getRepository(User);

      for (const userData of data.users) {
        try {
          let user: User | null = null;

          // 检查是否存在（通过腾讯 UID 或掘金 UID）
          if (userData.tencentUid) {
            user = await userRepo.findOne({ where: { tencentUid: userData.tencentUid } });
          }

          if (!user && userData.juejinUserId) {
            user = await userRepo.findOne({ where: { juejinUserId: userData.juejinUserId } });
          }

          if (user && !options.overwriteExisting) {
            userIdMap.set(userData.id, user.id);
            result.stats.users.skipped++;
            continue;
          }

          const newUser = user || new User();
          newUser.tencentUid = userData.tencentUid;
          newUser.nickname = userData.nickname;
          newUser.avatarUrl = userData.avatarUrl;
          newUser.cookies = tryDecrypt(userData.cookies);
          newUser.isLoggedIn = userData.isLoggedIn;
          newUser.lastLoginAt = stringToDate(userData.lastLoginAt);
          newUser.juejinUserId = userData.juejinUserId;
          newUser.juejinNickname = userData.juejinNickname;
          newUser.juejinAvatarUrl = userData.juejinAvatarUrl;
          newUser.juejinCookies = tryDecrypt(userData.juejinCookies);
          newUser.juejinLoggedIn = userData.juejinLoggedIn;
          newUser.juejinLastLoginAt = stringToDate(userData.juejinLastLoginAt);

          const savedUser = await userRepo.save(newUser);
          userIdMap.set(userData.id, savedUser.id);
          result.stats.users.imported++;
        } catch (e) {
          result.stats.users.failed++;
          result.errors.push(`导入用户失败: ${e instanceof Error ? e.message : "未知错误"}`);
        }
      }
    }

    // 导入文件夹数据（需要按层级顺序导入）
    if (options.importFolders && data.folders.length > 0) {
      const folderRepo = AppDataSource.getRepository(Folder);

      // 按父级关系排序（根文件夹优先）
      const sortedFolders = [...data.folders].sort((a, b) => {
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && !b.parentId) return 1;
        return 0;
      });

      for (const folderData of sortedFolders) {
        try {
          let folder: Folder | null = null;

          // 检查是否存在同名文件夹
          folder = await folderRepo.findOne({ where: { name: folderData.name } });

          if (folder && !options.overwriteExisting) {
            folderIdMap.set(folderData.id, folder.id);
            result.stats.folders.skipped++;
            continue;
          }

          const newFolder = folder || new Folder();
          newFolder.name = folderData.name;
          // 映射父文件夹 ID
          if (folderData.parentId) {
            newFolder.parentId = folderIdMap.get(folderData.parentId) || folderData.parentId;
          }
          newFolder.order = folderData.order;
          newFolder.isExpanded = folderData.isExpanded;

          const savedFolder = await folderRepo.save(newFolder);
          folderIdMap.set(folderData.id, savedFolder.id);
          result.stats.folders.imported++;
        } catch (e) {
          result.stats.folders.failed++;
          result.errors.push(`导入文件夹失败: ${e instanceof Error ? e.message : "未知错误"}`);
        }
      }
    }

    // 导入文章数据
    if (options.importArticles && data.articles.length > 0) {
      const articleRepo = AppDataSource.getRepository(Article);

      for (const articleData of data.articles) {
        try {
          let article: Article | null = null;

          // 检查是否存在（通过标题匹配）
          article = await articleRepo.findOne({ where: { title: articleData.title } });

          if (article && !options.overwriteExisting) {
            articleIdMap.set(articleData.id, article.id);
            result.stats.articles.skipped++;
            continue;
          }

          const newArticle = article || new Article();
          newArticle.title = articleData.title;
          newArticle.content = articleData.content;
          newArticle.summary = articleData.summary;
          newArticle.tags = articleData.tags;
          newArticle.status = articleData.status as ArticleStatus;
          newArticle.scheduledAt = stringToDate(articleData.scheduledAt);
          newArticle.publishedAt = stringToDate(articleData.publishedAt);
          newArticle.tencentDraftId = articleData.tencentDraftId;
          newArticle.tencentArticleId = articleData.tencentArticleId;
          newArticle.tencentArticleUrl = articleData.tencentArticleUrl;
          newArticle.tencentTagIds = articleData.tencentTagIds;
          newArticle.sourceType = articleData.sourceType;
          newArticle.lastSyncedAt = stringToDate(articleData.lastSyncedAt);
          newArticle.errorMessage = articleData.errorMessage;
          newArticle.juejinDraftId = articleData.juejinDraftId;
          newArticle.juejinArticleId = articleData.juejinArticleId;
          newArticle.juejinArticleUrl = articleData.juejinArticleUrl;
          newArticle.juejinCategoryId = articleData.juejinCategoryId;
          newArticle.juejinTagIds = articleData.juejinTagIds;
          newArticle.juejinTagNames = articleData.juejinTagNames;
          newArticle.juejinBriefContent = articleData.juejinBriefContent;
          newArticle.juejinIsOriginal = articleData.juejinIsOriginal;
          newArticle.juejinStatus = articleData.juejinStatus;
          newArticle.juejinLastSyncedAt = stringToDate(articleData.juejinLastSyncedAt);
          // 映射关联 ID
          newArticle.userId = userIdMap.get(articleData.userId) || articleData.userId;
          if (articleData.folderId) {
            newArticle.folderId = folderIdMap.get(articleData.folderId) || articleData.folderId;
          }
          newArticle.order = articleData.order;

          const savedArticle = await articleRepo.save(newArticle);
          articleIdMap.set(articleData.id, savedArticle.id);
          result.stats.articles.imported++;
        } catch (e) {
          result.stats.articles.failed++;
          result.errors.push(`导入文章失败: ${e instanceof Error ? e.message : "未知错误"}`);
        }
      }
    }

    // 导入管理员用户
    if (options.importAdminUsers && data.adminUsers.length > 0) {
      const adminUserRepo = AppDataSource.getRepository(AdminUser);

      for (const adminData of data.adminUsers) {
        try {
          let admin: AdminUser | null = null;

          // 检查是否存在
          admin = await adminUserRepo.findOne({ where: { username: adminData.username } });

          if (admin && !options.overwriteExisting) {
            result.stats.adminUsers.skipped++;
            continue;
          }

          const newAdmin = admin || new AdminUser();
          newAdmin.username = adminData.username;
          if (adminData.passwordHash) {
            newAdmin.passwordHash = tryDecrypt(adminData.passwordHash) || adminData.passwordHash;
          }
          newAdmin.role = adminData.role as "super_admin" | "admin";
          newAdmin.lastLoginAt = stringToDate(adminData.lastLoginAt);

          await adminUserRepo.save(newAdmin);
          result.stats.adminUsers.imported++;
        } catch (e) {
          result.stats.adminUsers.failed++;
          result.errors.push(`导入管理员失败: ${e instanceof Error ? e.message : "未知错误"}`);
        }
      }
    }

    // 导入 AI 配置
    if (options.importAIConfig) {
      // 先导入供应商
      if (data.aiProviders.length > 0) {
        const providerRepo = AppDataSource.getRepository(AIProvider);

        for (const providerData of data.aiProviders) {
          try {
            let provider: AIProvider | null = null;

            // 通过名称查找
            provider = await providerRepo.findOne({ where: { name: providerData.name } });

            if (provider && !options.overwriteExisting) {
              providerIdMap.set(providerData.id, provider.id);
              result.stats.aiProviders.skipped++;
              continue;
            }

            const newProvider = provider || new AIProvider();
            newProvider.userId = userIdMap.get(providerData.userId) || providerData.userId;
            newProvider.name = providerData.name;
            newProvider.baseUrl = providerData.baseUrl;
            if (providerData.apiKey) {
              newProvider.apiKey = tryDecrypt(providerData.apiKey) || "";
            }
            newProvider.enabled = providerData.enabled;
            newProvider.order = providerData.order;
            newProvider.apiType = providerData.apiType;

            const savedProvider = await providerRepo.save(newProvider);
            providerIdMap.set(providerData.id, savedProvider.id);
            result.stats.aiProviders.imported++;
          } catch (e) {
            result.stats.aiProviders.failed++;
            result.errors.push(`导入AI供应商失败: ${e instanceof Error ? e.message : "未知错误"}`);
          }
        }
      }

      // 再导入模型
      if (data.aiModels.length > 0) {
        const modelRepo = AppDataSource.getRepository(AIModel);

        for (const modelData of data.aiModels) {
          try {
            // 映射供应商 ID
            const mappedProviderId = providerIdMap.get(modelData.providerId);
            if (!mappedProviderId && !options.overwriteExisting) {
              result.stats.aiModels.skipped++;
              continue;
            }

            let model: AIModel | null = null;
            model = await modelRepo.findOne({
              where: { modelId: modelData.modelId, providerId: mappedProviderId || modelData.providerId }
            });

            if (model && !options.overwriteExisting) {
              result.stats.aiModels.skipped++;
              continue;
            }

            const newModel = model || new AIModel();
            newModel.userId = userIdMap.get(modelData.userId) || modelData.userId;
            newModel.providerId = mappedProviderId || modelData.providerId;
            newModel.modelId = modelData.modelId;
            newModel.displayName = modelData.displayName;
            newModel.isDefault = modelData.isDefault;
            newModel.enabled = modelData.enabled;
            newModel.order = modelData.order;
            newModel.contextLength = modelData.contextLength;
            newModel.parameters = modelData.parameters;
            newModel.capabilities = modelData.capabilities;

            await modelRepo.save(newModel);
            result.stats.aiModels.imported++;
          } catch (e) {
            result.stats.aiModels.failed++;
            result.errors.push(`导入AI模型失败: ${e instanceof Error ? e.message : "未知错误"}`);
          }
        }
      }
    }

    // 导入邮件配置
    if (options.importEmailConfig && data.emailConfigs.length > 0) {
      const emailConfigRepo = AppDataSource.getRepository(EmailConfig);

      for (const configData of data.emailConfigs) {
        try {
          const mappedUserId = userIdMap.get(configData.userId) || configData.userId;
          let config: EmailConfig | null = null;

          config = await emailConfigRepo.findOne({ where: { userId: mappedUserId } });

          if (config && !options.overwriteExisting) {
            result.stats.emailConfigs.skipped++;
            continue;
          }

          const newConfig = config || new EmailConfig();
          newConfig.userId = mappedUserId;
          newConfig.smtpHost = configData.smtpHost;
          newConfig.smtpPort = configData.smtpPort;
          newConfig.smtpSecure = configData.smtpSecure;
          newConfig.smtpUser = configData.smtpUser;
          if (configData.smtpPass) {
            newConfig.smtpPass = tryDecrypt(configData.smtpPass);
          }
          newConfig.fromName = configData.fromName;
          newConfig.fromEmail = configData.fromEmail;
          newConfig.notifyEmail = configData.notifyEmail;
          newConfig.notifyOnSuccess = configData.notifyOnSuccess;
          newConfig.notifyOnFailed = configData.notifyOnFailed;
          newConfig.notifyOnCookieExpired = configData.notifyOnCookieExpired;
          newConfig.enabled = configData.enabled;

          await emailConfigRepo.save(newConfig);
          result.stats.emailConfigs.imported++;
        } catch (e) {
          result.stats.emailConfigs.failed++;
          result.errors.push(`导入邮件配置失败: ${e instanceof Error ? e.message : "未知错误"}`);
        }
      }
    }

    // 导入定时任务
    if (options.importScheduledTasks && data.scheduledTasks.length > 0) {
      const taskRepo = AppDataSource.getRepository(ScheduledTask);

      for (const taskData of data.scheduledTasks) {
        try {
          const mappedArticleId = articleIdMap.get(taskData.articleId);
          const mappedUserId = userIdMap.get(taskData.userId) || taskData.userId;

          // 如果文章没有导入，跳过相关任务
          if (!mappedArticleId && !options.overwriteExisting) {
            result.stats.scheduledTasks.skipped++;
            continue;
          }

          const newTask = new ScheduledTask();
          newTask.articleId = mappedArticleId || taskData.articleId;
          newTask.userId = mappedUserId;
          newTask.platform = taskData.platform as Platform;
          newTask.config = taskData.config as any;
          newTask.scheduledAt = new Date(taskData.scheduledAt);
          newTask.status = taskData.status as TaskStatus;
          newTask.errorMessage = taskData.errorMessage;
          newTask.executedAt = stringToDate(taskData.executedAt);
          newTask.resultUrl = taskData.resultUrl;
          newTask.retryCount = taskData.retryCount;
          newTask.maxRetries = taskData.maxRetries;
          newTask.notified = taskData.notified;

          await taskRepo.save(newTask);
          result.stats.scheduledTasks.imported++;
        } catch (e) {
          result.stats.scheduledTasks.failed++;
          result.errors.push(`导入定时任务失败: ${e instanceof Error ? e.message : "未知错误"}`);
        }
      }
    }

    // 导入图片数据
    if (options.importImages && data.images && data.images.length > 0) {
      // 确保上传目录存在
      if (!fs.existsSync(getUploadDir())) {
        fs.mkdirSync(getUploadDir(), { recursive: true });
      }

      for (const imageData of data.images) {
        try {
          // 获取映射后的文章 ID
          const mappedArticleId = articleIdMap.get(imageData.articleId) || imageData.articleId;
          
          // 创建文章图片目录
          const articleDir = path.join(getUploadDir(), String(mappedArticleId));
          if (!fs.existsSync(articleDir)) {
            fs.mkdirSync(articleDir, { recursive: true });
          }
          
          const filePath = path.join(articleDir, imageData.fileName);
          
          // 检查文件是否已存在
          if (fs.existsSync(filePath) && !options.overwriteExisting) {
            result.stats.images.skipped++;
            continue;
          }
          
          // 将 Base64 数据解码并写入文件
          const fileBuffer = Buffer.from(imageData.data, "base64");
          fs.writeFileSync(filePath, fileBuffer);
          
          result.stats.images.imported++;
        } catch (e) {
          result.stats.images.failed++;
          result.errors.push(`导入图片失败 (${imageData.fileName}): ${e instanceof Error ? e.message : "未知错误"}`);
        }
      }
    }

    // 生成结果消息
    const totalImported =
      result.stats.users.imported +
      result.stats.folders.imported +
      result.stats.articles.imported +
      result.stats.adminUsers.imported +
      result.stats.aiProviders.imported +
      result.stats.aiModels.imported +
      result.stats.emailConfigs.imported +
      result.stats.scheduledTasks.imported +
      result.stats.images.imported;

    const totalFailed =
      result.stats.users.failed +
      result.stats.folders.failed +
      result.stats.articles.failed +
      result.stats.adminUsers.failed +
      result.stats.aiProviders.failed +
      result.stats.aiModels.failed +
      result.stats.emailConfigs.failed +
      result.stats.scheduledTasks.failed +
      result.stats.images.failed;

    if (totalFailed > 0) {
      result.success = false;
      result.message = `导入完成，成功 ${totalImported} 项，失败 ${totalFailed} 项`;
    } else {
      result.message = `导入成功，共导入 ${totalImported} 项数据`;
    }
  } catch (e) {
    result.success = false;
    result.message = `导入过程中发生错误: ${e instanceof Error ? e.message : "未知错误"}`;
    result.errors.push(result.message);
  }

  return result;
}

/**
 * 导出数据并生成 JSON 字符串
 */
export async function exportDataToJson(options: ExportOptions): Promise<string> {
  const data = await exportData(options);
  return JSON.stringify(data, null, 2);
}

/**
 * 从 JSON 字符串导入数据
 */
export async function importDataFromJson(
  jsonString: string,
  options: ImportOptions
): Promise<ImportResult> {
  try {
    const data = JSON.parse(jsonString);

    if (!validateImportData(data)) {
      return {
        success: false,
        message: "无效的数据格式，请检查导入文件",
        stats: {
          users: { imported: 0, skipped: 0, failed: 0 },
          folders: { imported: 0, skipped: 0, failed: 0 },
          articles: { imported: 0, skipped: 0, failed: 0 },
          adminUsers: { imported: 0, skipped: 0, failed: 0 },
          aiProviders: { imported: 0, skipped: 0, failed: 0 },
          aiModels: { imported: 0, skipped: 0, failed: 0 },
          emailConfigs: { imported: 0, skipped: 0, failed: 0 },
          scheduledTasks: { imported: 0, skipped: 0, failed: 0 },
          images: { imported: 0, skipped: 0, failed: 0 },
        },
        errors: ["数据格式验证失败"],
      };
    }

    return await importData(data, options);
  } catch (e) {
    return {
      success: false,
      message: `解析 JSON 失败: ${e instanceof Error ? e.message : "未知错误"}`,
      stats: {
        users: { imported: 0, skipped: 0, failed: 0 },
        folders: { imported: 0, skipped: 0, failed: 0 },
        articles: { imported: 0, skipped: 0, failed: 0 },
        adminUsers: { imported: 0, skipped: 0, failed: 0 },
        aiProviders: { imported: 0, skipped: 0, failed: 0 },
        aiModels: { imported: 0, skipped: 0, failed: 0 },
        emailConfigs: { imported: 0, skipped: 0, failed: 0 },
        scheduledTasks: { imported: 0, skipped: 0, failed: 0 },
        images: { imported: 0, skipped: 0, failed: 0 },
      },
      errors: [`JSON 解析错误: ${e instanceof Error ? e.message : "未知错误"}`],
    };
  }
}

/**
 * 获取图片统计信息（用于预览）
 */
export function getImageStats(): { count: number; totalSize: number } {
  let count = 0;
  let totalSize = 0;

  if (fs.existsSync(getUploadDir())) {
    const articleDirs = fs.readdirSync(getUploadDir());

    for (const articleIdStr of articleDirs) {
      const articleDir = path.join(getUploadDir(), articleIdStr);
      try {
        const stat = fs.statSync(articleDir);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(articleDir);
          for (const fileName of files) {
            const filePath = path.join(articleDir, fileName);
            const fileStat = fs.statSync(filePath);
            if (fileStat.isFile()) {
              count++;
              totalSize += fileStat.size;
            }
          }
        }
      } catch {
        // 忽略访问错误
      }
    }
  }

  return { count, totalSize };
}

/**
 * 导出数据为 ZIP 压缩包
 * ZIP 结构:
 * - data.json          # 数据库数据
 * - uploads/           # 图片文件（保持原始目录结构）
 *   - {articleId}/
 *     - image1.png
 *     - image2.jpg
 */
export async function exportDataToZip(options: ExportOptions): Promise<Buffer> {
  const zip = new JSZip();

  // 1. 导出数据库数据为 JSON
  const data = await exportData(options);
  const jsonContent = JSON.stringify(data, null, 2);
  zip.file("data.json", jsonContent);

  // 2. 如果需要导出图片，将图片文件添加到 ZIP
  if (options.includeImages && options.includeArticles) {
    if (fs.existsSync(getUploadDir())) {
      const articleDirs = fs.readdirSync(getUploadDir());

      for (const articleIdStr of articleDirs) {
        const articleId = parseInt(articleIdStr, 10);
        if (isNaN(articleId)) continue;

        const articleDir = path.join(getUploadDir(), articleIdStr);
        try {
          const stat = fs.statSync(articleDir);
          if (stat.isDirectory()) {
            const files = fs.readdirSync(articleDir);

            for (const fileName of files) {
              try {
                const filePath = path.join(articleDir, fileName);
                const fileStat = fs.statSync(filePath);

                if (fileStat.isFile()) {
                  // 读取文件并添加到 ZIP
                  const fileContent = fs.readFileSync(filePath);
                  zip.file(`uploads/${articleIdStr}/${fileName}`, fileContent);
                }
              } catch (e) {
                console.error(`添加图片到 ZIP 失败: ${fileName}`, e);
              }
            }
          }
        } catch (e) {
          console.error(`读取文章目录失败: ${articleIdStr}`, e);
        }
      }
    }
  }

  // 3. 生成 ZIP Buffer
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return zipBuffer;
}

/**
 * 从 ZIP 压缩包导入数据
 */
export async function importDataFromZip(
  zipBuffer: Buffer,
  options: ImportOptions
): Promise<ImportResult> {
  const emptyResult: ImportResult = {
    success: false,
    message: "",
    stats: {
      users: { imported: 0, skipped: 0, failed: 0 },
      folders: { imported: 0, skipped: 0, failed: 0 },
      articles: { imported: 0, skipped: 0, failed: 0 },
      adminUsers: { imported: 0, skipped: 0, failed: 0 },
      aiProviders: { imported: 0, skipped: 0, failed: 0 },
      aiModels: { imported: 0, skipped: 0, failed: 0 },
      emailConfigs: { imported: 0, skipped: 0, failed: 0 },
      scheduledTasks: { imported: 0, skipped: 0, failed: 0 },
      images: { imported: 0, skipped: 0, failed: 0 },
    },
    errors: [],
  };

  try {
    // 1. 解压 ZIP
    const zip = await JSZip.loadAsync(zipBuffer);

    // 2. 读取 data.json
    const dataJsonFile = zip.file("data.json");
    if (!dataJsonFile) {
      return {
        ...emptyResult,
        message: "ZIP 文件中未找到 data.json",
        errors: ["ZIP 文件格式无效：缺少 data.json"],
      };
    }

    const jsonContent = await dataJsonFile.async("string");
    let data: ExportData;

    try {
      data = JSON.parse(jsonContent);
    } catch {
      return {
        ...emptyResult,
        message: "data.json 解析失败",
        errors: ["data.json 不是有效的 JSON 格式"],
      };
    }

    if (!validateImportData(data)) {
      return {
        ...emptyResult,
        message: "无效的数据格式，请检查导入文件",
        errors: ["数据格式验证失败"],
      };
    }

    // 3. 导入数据库数据（这会返回 articleIdMap）
    const result = await importData(data, options);

    // 4. 如果需要导入图片，从 ZIP 中提取并保存
    if (options.importImages) {
      // 确保上传目录存在
      if (!fs.existsSync(getUploadDir())) {
        fs.mkdirSync(getUploadDir(), { recursive: true });
      }

      // 从 importData 结果中获取文章 ID 映射
      // 由于 importData 不返回映射，我们需要基于文章标题重新构建映射
      const articleIdMap = new Map<number, number>();
      
      if (options.importArticles && data.articles.length > 0) {
        const articleRepo = AppDataSource.getRepository(Article);
        for (const articleData of data.articles) {
          const article = await articleRepo.findOne({ where: { title: articleData.title } });
          if (article) {
            articleIdMap.set(articleData.id, article.id);
          }
        }
      }

      // 遍历 ZIP 中的 uploads/ 目录
      const uploadFiles = Object.keys(zip.files).filter(
        (name) => name.startsWith("uploads/") && !name.endsWith("/")
      );

      for (const filePath of uploadFiles) {
        try {
          // 解析路径: uploads/{articleId}/{fileName}
          const parts = filePath.split("/");
          if (parts.length !== 3) continue;

          const oldArticleId = parseInt(parts[1], 10);
          const fileName = parts[2];
          if (isNaN(oldArticleId)) continue;

          // 获取映射后的文章 ID
          const newArticleId = articleIdMap.get(oldArticleId) || oldArticleId;

          // 创建目标目录
          const targetDir = path.join(getUploadDir(), String(newArticleId));
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const targetPath = path.join(targetDir, fileName);

          // 检查文件是否已存在
          if (fs.existsSync(targetPath) && !options.overwriteExisting) {
            result.stats.images.skipped++;
            continue;
          }

          // 提取文件内容
          const file = zip.file(filePath);
          if (file) {
            const content = await file.async("nodebuffer");
            fs.writeFileSync(targetPath, content);
            result.stats.images.imported++;
          }
        } catch (e) {
          result.stats.images.failed++;
          result.errors.push(
            `导入图片失败 (${filePath}): ${e instanceof Error ? e.message : "未知错误"}`
          );
        }
      }

      // 更新结果消息
      const totalImported =
        result.stats.users.imported +
        result.stats.folders.imported +
        result.stats.articles.imported +
        result.stats.adminUsers.imported +
        result.stats.aiProviders.imported +
        result.stats.aiModels.imported +
        result.stats.emailConfigs.imported +
        result.stats.scheduledTasks.imported +
        result.stats.images.imported;

      const totalFailed =
        result.stats.users.failed +
        result.stats.folders.failed +
        result.stats.articles.failed +
        result.stats.adminUsers.failed +
        result.stats.aiProviders.failed +
        result.stats.aiModels.failed +
        result.stats.emailConfigs.failed +
        result.stats.scheduledTasks.failed +
        result.stats.images.failed;

      if (totalFailed > 0) {
        result.success = false;
        result.message = `导入完成，成功 ${totalImported} 项，失败 ${totalFailed} 项`;
      } else {
        result.message = `导入成功，共导入 ${totalImported} 项数据`;
      }
    }

    return result;
  } catch (e) {
    return {
      ...emptyResult,
      message: `导入 ZIP 失败: ${e instanceof Error ? e.message : "未知错误"}`,
      errors: [`ZIP 处理错误: ${e instanceof Error ? e.message : "未知错误"}`],
    };
  }
}

/**
 * 预览 ZIP 文件内容
 */
export async function previewZipData(
  zipBuffer: Buffer,
  decryptionPassword?: string
): Promise<{
  success: boolean;
  message: string;
  metadata?: ExportMetadata;
  counts?: {
    users: number;
    folders: number;
    articles: number;
    adminUsers: number;
    aiProviders: number;
    aiModels: number;
    emailConfigs: number;
    scheduledTasks: number;
    images: number;
  };
}> {
  try {
    const zip = await JSZip.loadAsync(zipBuffer);

    // 读取 data.json
    const dataJsonFile = zip.file("data.json");
    if (!dataJsonFile) {
      return {
        success: false,
        message: "ZIP 文件中未找到 data.json",
      };
    }

    const jsonContent = await dataJsonFile.async("string");
    let data: ExportData;

    try {
      data = JSON.parse(jsonContent);
    } catch {
      return {
        success: false,
        message: "data.json 解析失败",
      };
    }

    if (!validateImportData(data)) {
      return {
        success: false,
        message: "无效的数据格式",
      };
    }

    // 验证加密数据的密码
    if (data.metadata.encrypted && decryptionPassword) {
      try {
        // 尝试解密一个敏感字段来验证密码
        const testUser = data.users.find((u) => u.cookies);
        if (testUser?.cookies) {
          decrypt(testUser.cookies, decryptionPassword);
        }
      } catch {
        return {
          success: false,
          message: "密码错误，无法解密数据",
        };
      }
    }

    // 统计 ZIP 中的图片数量
    const imageFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith("uploads/") && !name.endsWith("/")
    );

    return {
      success: true,
      message: "预览成功",
      metadata: data.metadata,
      counts: {
        users: data.users.length,
        folders: data.folders.length,
        articles: data.articles.length,
        adminUsers: data.adminUsers.length,
        aiProviders: data.aiProviders.length,
        aiModels: data.aiModels.length,
        emailConfigs: data.emailConfigs.length,
        scheduledTasks: data.scheduledTasks.length,
        images: imageFiles.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      message: `预览失败: ${e instanceof Error ? e.message : "未知错误"}`,
    };
  }
}
