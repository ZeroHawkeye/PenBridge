/**
 * 掘金文章同步服务
 * 负责文章的同步和发布功能
 */

import { AppDataSource } from "../db";
import { Article } from "../entities/Article";
import { User } from "../entities/User";
import { createJuejinApiClient, type TagInfo } from "./juejinApi";

export interface JuejinSyncResult {
  success: boolean;
  message: string;
  draftId?: string;
  articleId?: string;
  articleUrl?: string;
}

class JuejinSyncService {
  /**
   * 获取掘金 API 客户端
   */
  private async getApiClient(userId: number = 1) {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user || !user.juejinCookies) {
      throw new Error("未登录掘金，请先在客户端登录");
    }

    return createJuejinApiClient(user.juejinCookies);
  }

  /**
   * 检查登录状态
   */
  async checkLoginStatus(userId: number = 1): Promise<boolean> {
    try {
      const client = await this.getApiClient(userId);
      return await client.checkLoginStatus();
    } catch {
      return false;
    }
  }

  /**
   * 搜索标签
   */
  async searchTags(keyword: string, userId: number = 1): Promise<TagInfo[]> {
    const client = await this.getApiClient(userId);
    return client.searchTags(keyword);
  }

  /**
   * 设置文章的掘金配置（分类、标签、摘要等）
   */
  async setArticleConfig(
    articleId: number,
    config: {
      categoryId?: string;
      tagIds?: string[];
      tagNames?: string[];
      briefContent?: string;
      isOriginal?: number;
    }
  ): Promise<{ success: boolean }> {
    const articleRepo = AppDataSource.getRepository(Article);
    const article = await articleRepo.findOne({ where: { id: articleId } });

    if (!article) {
      throw new Error("文章不存在");
    }

    if (config.categoryId !== undefined) {
      article.juejinCategoryId = config.categoryId;
    }
    if (config.tagIds !== undefined) {
      article.juejinTagIds = config.tagIds;
    }
    if (config.tagNames !== undefined) {
      article.juejinTagNames = config.tagNames;
    }
    if (config.briefContent !== undefined) {
      article.juejinBriefContent = config.briefContent;
    }
    if (config.isOriginal !== undefined) {
      article.juejinIsOriginal = config.isOriginal;
    }

    await articleRepo.save(article);
    return { success: true };
  }

  /**
   * 同步文章到掘金草稿箱
   */
  async syncToDraft(articleId: number, userId: number = 1): Promise<JuejinSyncResult> {
    const articleRepo = AppDataSource.getRepository(Article);
    const article = await articleRepo.findOne({ where: { id: articleId } });

    if (!article) {
      return { success: false, message: "文章不存在" };
    }

    try {
      const client = await this.getApiClient(userId);

      // 创建草稿
      const draft = await client.createDraft(article.title);
      console.log("[JuejinSync] 创建草稿成功:", draft.id);

      // 更新草稿内容
      await client.updateDraft({
        id: draft.id,
        title: article.title,
        markContent: article.content,
        briefContent: article.juejinBriefContent || article.summary || "",
        categoryId: article.juejinCategoryId || "6809637767543259144", // 默认前端
        tagIds: article.juejinTagIds || [],
        isOriginal: article.juejinIsOriginal,
      });

      // 保存草稿 ID
      article.juejinDraftId = draft.id;
      article.juejinLastSyncedAt = new Date();
      article.juejinStatus = "draft";
      await articleRepo.save(article);

      return {
        success: true,
        message: "草稿同步成功",
        draftId: draft.id,
      };
    } catch (error) {
      console.error("[JuejinSync] 同步草稿失败:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "同步失败",
      };
    }
  }

  /**
   * 发布文章到掘金
   */
  async publishArticle(
    articleId: number,
    config: {
      categoryId: string;
      tagIds: string[];
      tagNames?: string[];
      briefContent: string;
      isOriginal?: number;
    },
    userId: number = 1
  ): Promise<JuejinSyncResult> {
    const articleRepo = AppDataSource.getRepository(Article);
    const article = await articleRepo.findOne({ where: { id: articleId } });

    if (!article) {
      return { success: false, message: "文章不存在" };
    }

    // 验证必填字段
    if (!config.categoryId) {
      return { success: false, message: "请选择文章分类" };
    }
    if (!config.tagIds || config.tagIds.length === 0) {
      return { success: false, message: "请至少选择一个标签" };
    }
    if (config.tagIds.length > 3) {
      return { success: false, message: "最多只能选择3个标签" };
    }
    if (!config.briefContent || config.briefContent.trim().length === 0) {
      return { success: false, message: "请填写文章摘要" };
    }
    if (config.briefContent.length > 100) {
      return { success: false, message: "摘要不能超过100字" };
    }

    try {
      const client = await this.getApiClient(userId);

      // 一键发布
      const result = await client.publishArticleOneClick({
        title: article.title,
        markContent: article.content,
        briefContent: config.briefContent,
        categoryId: config.categoryId,
        tagIds: config.tagIds,
        isOriginal: config.isOriginal ?? 1,
      });

      console.log("[JuejinSync] 发布成功:", result);

      // 更新文章状态
      article.juejinArticleId = result.article_id;
      article.juejinDraftId = result.draft_id;
      article.juejinArticleUrl = `https://juejin.cn/post/${result.article_id}`;
      article.juejinCategoryId = config.categoryId;
      article.juejinTagIds = config.tagIds;
      article.juejinTagNames = config.tagNames;
      article.juejinBriefContent = config.briefContent;
      article.juejinIsOriginal = config.isOriginal ?? 1;
      article.juejinStatus = "pending"; // 审核中
      article.juejinLastSyncedAt = new Date();
      await articleRepo.save(article);

      return {
        success: true,
        message: "发布成功，文章正在审核中",
        articleId: result.article_id,
        articleUrl: article.juejinArticleUrl,
      };
    } catch (error) {
      console.error("[JuejinSync] 发布失败:", error);
      
      // 更新错误状态
      article.juejinStatus = "failed";
      article.errorMessage = error instanceof Error ? error.message : "发布失败";
      await articleRepo.save(article);

      return {
        success: false,
        message: error instanceof Error ? error.message : "发布失败",
      };
    }
  }

  /**
   * 获取用户的掘金文章列表
   */
  async fetchUserArticles(
    params: {
      auditStatus?: number | null;
      keyword?: string;
      pageNo?: number;
      pageSize?: number;
    },
    userId: number = 1
  ) {
    const client = await this.getApiClient(userId);
    return client.fetchUserArticles(params);
  }
}

// 导出单例
export const juejinSyncService = new JuejinSyncService();
