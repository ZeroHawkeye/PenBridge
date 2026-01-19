import { AppDataSource } from "../db";
import { Article } from "../entities/Article";
import { ArticleVersion, VersionSource } from "../entities/ArticleVersion";

export interface ConflictCheckResult {
  hasConflict: boolean;
  localVersion: number;
  remoteVersion?: number;
  remoteContent?: string;
  remoteTitle?: string;
  remoteUpdatedAt?: Date;
  syncStatus: string;
}

export interface ConflictResolution {
  articleId: number;
  resolution: "local" | "remote";
}

function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

export class SyncConflictDetector {
  private get articleRepo() {
    return AppDataSource.getRepository(Article);
  }

  private get versionRepo() {
    return AppDataSource.getRepository(ArticleVersion);
  }

  async checkConflict(articleId: number): Promise<ConflictCheckResult> {
    const article = await this.articleRepo.findOne({ where: { id: articleId } });
    
    if (!article) {
      throw new Error("文章不存在");
    }

    return {
      hasConflict: article.hasConflict,
      localVersion: article.localVersion,
      remoteVersion: article.remoteVersion,
      remoteContent: article.conflictRemoteContent || undefined,
      remoteTitle: undefined,
      remoteUpdatedAt: article.conflictDetectedAt || undefined,
      syncStatus: article.syncStatus,
    };
  }

  async markConflict(
    articleId: number,
    remoteContent: string,
    remoteTitle: string,
    remoteVersion: number
  ): Promise<void> {
    const article = await this.articleRepo.findOne({ where: { id: articleId } });
    if (!article) {
      throw new Error("文章不存在");
    }

    await this.saveVersion(article, "conflict_remote", remoteContent, remoteTitle);

    await this.articleRepo.update(articleId, {
      hasConflict: true,
      conflictRemoteContent: remoteContent,
      conflictDetectedAt: new Date(),
      remoteVersion,
      remoteContentHash: simpleHash(remoteContent),
      syncStatus: "conflict",
    });
  }

  async resolveConflict(params: ConflictResolution): Promise<Article> {
    const { articleId, resolution } = params;
    
    const article = await this.articleRepo.findOne({ where: { id: articleId } });
    if (!article) {
      throw new Error("文章不存在");
    }

    if (!article.hasConflict) {
      return article;
    }

    if (resolution === "local") {
      await this.articleRepo.update(articleId, {
        hasConflict: false,
        conflictRemoteContent: undefined,
        conflictDetectedAt: undefined,
        syncStatus: "pending",
        localVersion: article.localVersion + 1,
      });
    } else if (resolution === "remote") {
      if (!article.conflictRemoteContent) {
        throw new Error("没有可用的云端内容");
      }

      await this.saveVersion(article, "local", article.content, article.title);

      await this.articleRepo.update(articleId, {
        content: article.conflictRemoteContent,
        contentHash: simpleHash(article.conflictRemoteContent),
        hasConflict: false,
        conflictRemoteContent: undefined,
        conflictDetectedAt: undefined,
        syncStatus: "synced",
        localVersion: article.remoteVersion || article.localVersion + 1,
      });
    }

    return this.articleRepo.findOneOrFail({ where: { id: articleId } });
  }

  async updateSyncStatus(
    articleId: number,
    status: string,
    error?: string
  ): Promise<void> {
    const updateData: Partial<Article> = { syncStatus: status };
    if (error) {
      updateData.syncError = error;
    } else if (status === "synced") {
      updateData.syncError = undefined;
    }
    await this.articleRepo.update(articleId, updateData);
  }

  async incrementVersion(articleId: number, deviceId?: string): Promise<number> {
    const article = await this.articleRepo.findOne({ where: { id: articleId } });
    if (!article) {
      throw new Error("文章不存在");
    }

    const newVersion = article.localVersion + 1;
    await this.articleRepo.update(articleId, {
      localVersion: newVersion,
      lastModifiedBy: deviceId,
      contentHash: simpleHash(article.content),
    });

    return newVersion;
  }

  async updateContentHash(articleId: number, content: string): Promise<void> {
    await this.articleRepo.update(articleId, {
      contentHash: simpleHash(content),
    });
  }

  async saveVersion(
    article: Article,
    source: VersionSource,
    content?: string,
    title?: string
  ): Promise<ArticleVersion> {
    const version = this.versionRepo.create({
      articleId: article.id,
      version: article.localVersion,
      title: title || article.title,
      content: content || article.content,
      contentHash: simpleHash(content || article.content),
      source,
    });

    return this.versionRepo.save(version);
  }

  async getVersionHistory(articleId: number, limit = 10): Promise<ArticleVersion[]> {
    return this.versionRepo.find({
      where: { articleId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async cleanOldVersions(articleId: number, keepCount = 20): Promise<number> {
    const versions = await this.versionRepo.find({
      where: { articleId },
      order: { createdAt: "DESC" },
    });

    if (versions.length <= keepCount) {
      return 0;
    }

    const toDelete = versions.slice(keepCount);
    await this.versionRepo.remove(toDelete);
    return toDelete.length;
  }
}

export const syncConflictDetector = new SyncConflictDetector();
