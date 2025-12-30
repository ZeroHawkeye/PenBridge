/**
 * 文章同步服务
 * 负责本地文章与腾讯云开发者社区的同步
 */

import * as path from "path";
import { AppDataSource } from "../db";
import { Article, ArticleStatus } from "../entities/Article";
import { User } from "../entities/User";
import {
  TencentApiClient,
  createTencentApiClient,
  TagInfo,
  CreatorArticleInfo,
  ArticleStatusCount,
} from "./tencentApi";
import { processArticleImages, hasLocalImages } from "./imageUpload";

// 图片上传目录（与 index.ts 保持一致）
const UPLOAD_DIR = path.resolve("data/uploads");

// 同步结果
export interface SyncResult {
  success: boolean;
  message: string;
  draftId?: number;
  articleId?: number;
  articleUrl?: string;
}

// 文章匹配结果
export interface ArticleMatchResult {
  localArticleId: number;
  localTitle: string;
  tencentArticleId?: number;
  tencentTitle?: string;
  matched: boolean;
  matchType?: "id" | "title" | "content"; // 匹配方式
  tencentStatus?: number; // 腾讯云状态: 1-已发布, 2-审核中, 3-未通过
  tencentStatusText?: string;
  rejectReason?: string; // 审核失败原因
  rejectTime?: string; // 审核时间
}

// 同步状态结果
export interface SyncStatusResult {
  success: boolean;
  message: string;
  matchResults: ArticleMatchResult[];
  statusCount?: ArticleStatusCount;
}

/**
 * 文章同步服务类
 */
export class ArticleSyncService {
  private articleRepo = AppDataSource.getRepository(Article);
  private userRepo = AppDataSource.getRepository(User);

  /**
   * 获取用户的 API 客户端
   */
  private async getApiClient(userId?: number): Promise<TencentApiClient> {
    const userRepository = this.userRepo;
    let user: User | null;

    if (userId) {
      user = await userRepository.findOne({ where: { id: userId } });
    } else {
      // 获取第一个已登录的用户
      user = await userRepository.findOne({ where: { isLoggedIn: true } });
    }

    if (!user) {
      throw new Error("未找到用户");
    }

    if (!user.isLoggedIn || !user.cookies) {
      throw new Error("用户未登录，请先登录腾讯云开发者社区");
    }

    return createTencentApiClient(user.cookies);
  }

  /**
   * 同步文章到腾讯云草稿箱
   * 如果文章没有草稿ID，创建新草稿；否则更新现有草稿
   */
  async syncToDraft(articleId: number, userId?: number): Promise<SyncResult> {
    try {
      const article = await this.articleRepo.findOne({
        where: { id: articleId },
      });

      if (!article) {
        return { success: false, message: "文章不存在" };
      }

      const client = await this.getApiClient(userId);

      // 处理文章中的本地图片和 base64 图片，上传到腾讯云 COS
      let contentToSync = article.content;
      if (hasLocalImages(article.content)) {
        console.log("[ArticleSync] 检测到本地图片或 base64 图片，开始上传到腾讯云...");
        try {
          const { content: processedContent, results } = await processArticleImages(
            article.content,
            client,
            UPLOAD_DIR
          );
          contentToSync = processedContent;

          const successCount = results.filter((r) => r.success).length;
          const failCount = results.filter((r) => !r.success).length;
          console.log(`[ArticleSync] 图片处理完成: ${successCount} 成功, ${failCount} 失败`);

          if (failCount > 0) {
            const failedImages = results
              .filter((r) => !r.success)
              .map((r) => r.error)
              .join("; ");
            console.log(`[ArticleSync] 失败图片: ${failedImages}`);
          }

          // 注意：不更新本地文章内容，保持本地文章使用原始图片URL
          // 只有发送到腾讯云的内容使用处理后的URL（contentToSync）
        } catch (imageError) {
          const errorMsg = imageError instanceof Error ? imageError.message : "未知错误";
          console.error(`[ArticleSync] 图片处理失败: ${errorMsg}`);
          return { success: false, message: `图片上传失败: ${errorMsg}` };
        }
      }

      let draftId: number;
      let isNewDraft = false;

      if (article.tencentDraftId) {
        // 尝试更新现有草稿
        try {
          const result = await client.updateDraft({
            draftId: article.tencentDraftId,
            articleId: article.tencentArticleId
              ? parseInt(article.tencentArticleId)
              : 0,
            title: article.title,
            content: contentToSync,
            tagIds: article.tencentTagIds || [],
            sourceType: article.sourceType,
          });
          draftId = result.draftId;
        } catch (updateError) {
          // 如果草稿不存在，创建新草稿
          const errorMsg = updateError instanceof Error ? updateError.message : "";
          if (errorMsg.includes("草稿不存在") || errorMsg.includes("10002")) {
            console.log("[ArticleSync] 草稿不存在，创建新草稿");
            const result = await client.createDraft({
              title: article.title,
              content: contentToSync,
              tagIds: article.tencentTagIds || [],
              sourceType: article.sourceType,
            });
            draftId = result.draftId;
            isNewDraft = true;
          } else {
            throw updateError;
          }
        }
      } else {
        // 创建新草稿
        const result = await client.createDraft({
          title: article.title,
          content: contentToSync,
          tagIds: article.tencentTagIds || [],
          sourceType: article.sourceType,
        });
        draftId = result.draftId;
        isNewDraft = true;
      }

      // 更新本地文章记录
      article.tencentDraftId = draftId;
      article.lastSyncedAt = new Date();
      await this.articleRepo.save(article);

      return {
        success: true,
        message: isNewDraft ? "草稿创建成功" : "草稿更新成功",
        draftId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      return { success: false, message };
    }
  }

  /**
   * 发布文章到腾讯云开发者社区
   */
  async publishArticle(
    articleId: number,
    userId?: number
  ): Promise<SyncResult> {
    try {
      const article = await this.articleRepo.findOne({
        where: { id: articleId },
      });

      if (!article) {
        return { success: false, message: "文章不存在" };
      }

      // 检查内容长度
      if (article.content.length < 140) {
        return { success: false, message: "文章内容不能少于140字" };
      }

      // 检查标签
      if (!article.tencentTagIds || article.tencentTagIds.length === 0) {
        return { success: false, message: "请至少选择一个标签" };
      }

      const client = await this.getApiClient(userId);

      // 处理文章中的本地图片，上传到腾讯云 COS
      let contentToPublish = article.content;
      if (hasLocalImages(article.content)) {
        console.log("[ArticleSync] 检测到本地图片，开始上传到腾讯云...");
        try {
          const { content: processedContent, results } = await processArticleImages(
            article.content,
            client,
            UPLOAD_DIR
          );
          contentToPublish = processedContent;

          const successCount = results.filter((r) => r.success).length;
          const failCount = results.filter((r) => !r.success).length;
          console.log(`[ArticleSync] 图片处理完成: ${successCount} 成功, ${failCount} 失败`);

          if (failCount > 0) {
            const failedImages = results
              .filter((r) => !r.success)
              .map((r) => r.error)
              .join("; ");
            console.log(`[ArticleSync] 失败图片: ${failedImages}`);
          }
        } catch (imageError) {
          const errorMsg = imageError instanceof Error ? imageError.message : "未知错误";
          console.error(`[ArticleSync] 图片处理失败: ${errorMsg}`);
          return { success: false, message: `图片上传失败: ${errorMsg}` };
        }
      }

      let publishResult;
      let isUpdate = false;

      // 判断是新发布还是更新已发布的文章
      if (article.tencentArticleId) {
        // 已有腾讯云文章ID，尝试调用编辑接口更新文章
        isUpdate = true;
        console.log(`[ArticleSync] 尝试更新已发布文章: ${article.tencentArticleId}`);
        try {
          publishResult = await client.editArticle({
            articleId: parseInt(article.tencentArticleId),
            draftId: article.tencentDraftId,
            title: article.title,
            content: contentToPublish,
            sourceType: article.sourceType || 1,
            tagIds: article.tencentTagIds,
          });
        } catch (editError) {
          // 如果编辑失败（文章不存在等），清除旧的ID，重新发布
          const errorMsg = editError instanceof Error ? editError.message : "";
          console.log(`[ArticleSync] 更新失败: ${errorMsg}，将重新发布`);
          
          // 清除旧的腾讯云文章ID
          article.tencentArticleId = undefined;
          article.tencentArticleUrl = undefined;
          article.tencentDraftId = undefined;
          isUpdate = false;
          
          // 继续执行新发布流程
        }
      }
      
      // 新发布文章（或更新失败后重新发布）
      if (!publishResult) {
        // 如果没有草稿ID，先创建草稿
        if (!article.tencentDraftId) {
          const syncResult = await this.syncToDraft(articleId, userId);
          if (!syncResult.success) {
            return syncResult;
          }
          // 重新获取文章以获取最新的 draftId
          const updatedArticle = await this.articleRepo.findOne({
            where: { id: articleId },
          });
          if (!updatedArticle?.tencentDraftId) {
            return { success: false, message: "创建草稿失败" };
          }
          article.tencentDraftId = updatedArticle.tencentDraftId;
        }

        console.log(`[ArticleSync] 新发布文章，草稿ID: ${article.tencentDraftId}`);
        publishResult = await client.publishArticle({
          draftId: article.tencentDraftId,
          title: article.title,
          content: contentToPublish,
          sourceType: article.sourceType || 1,
          tagIds: article.tencentTagIds,
        });

        // 新发布成功后记录腾讯云文章ID
        article.tencentArticleId = publishResult.articleId.toString();
        article.tencentArticleUrl = `https://cloud.tencent.com/developer/article/${publishResult.articleId}`;
      }

      // 更新本地文章状态
      // 注意：API 返回的 status 不可靠，统一设置为"审核中"
      // 后续通过 syncArticleStatus 同步真实状态
      if (publishResult.status === 2) {
        article.status = ArticleStatus.FAILED;
        article.errorMessage = "文章审核未通过";
      } else {
        article.status = ArticleStatus.PENDING;
        article.errorMessage = undefined;
      }
      article.publishedAt = new Date();
      article.lastSyncedAt = new Date();
      await this.articleRepo.save(article);

      return {
        success: publishResult.status !== 2,
        message: publishResult.status === 2 
          ? "文章审核未通过" 
          : isUpdate 
            ? "文章已更新，等待审核"
            : "文章已提交，等待审核",
        articleId: publishResult.articleId,
        articleUrl: article.tencentArticleUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "发布失败";

      // 更新文章状态为失败
      const article = await this.articleRepo.findOne({
        where: { id: articleId },
      });
      if (article) {
        article.status = ArticleStatus.FAILED;
        article.errorMessage = message;
        await this.articleRepo.save(article);
      }

      return { success: false, message };
    }
  }

  /**
   * 删除腾讯云草稿
   */
  async deleteDraft(articleId: number, userId?: number): Promise<SyncResult> {
    try {
      const article = await this.articleRepo.findOne({
        where: { id: articleId },
      });

      if (!article) {
        return { success: false, message: "文章不存在" };
      }

      if (!article.tencentDraftId) {
        return { success: false, message: "文章没有对应的腾讯云草稿" };
      }

      const client = await this.getApiClient(userId);
      await client.deleteDraft(article.tencentDraftId);

      // 清除本地草稿ID
      article.tencentDraftId = undefined;
      article.lastSyncedAt = new Date();
      await this.articleRepo.save(article);

      return { success: true, message: "草稿删除成功" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      return { success: false, message };
    }
  }

  /**
   * 搜索标签
   */
  async searchTags(keyword: string, userId?: number): Promise<TagInfo[]> {
    const client = await this.getApiClient(userId);
    return client.searchTags(keyword);
  }

  /**
   * 设置文章的标签
   */
  async setArticleTags(
    articleId: number,
    tagIds: number[]
  ): Promise<SyncResult> {
    try {
      const article = await this.articleRepo.findOne({
        where: { id: articleId },
      });

      if (!article) {
        return { success: false, message: "文章不存在" };
      }

      article.tencentTagIds = tagIds;
      await this.articleRepo.save(article);

      return { success: true, message: "标签设置成功" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "设置失败";
      return { success: false, message };
    }
  }

  /**
   * 设置文章来源类型
   */
  async setSourceType(
    articleId: number,
    sourceType: number
  ): Promise<SyncResult> {
    try {
      const article = await this.articleRepo.findOne({
        where: { id: articleId },
      });

      if (!article) {
        return { success: false, message: "文章不存在" };
      }

      if (sourceType < 1 || sourceType > 3) {
        return {
          success: false,
          message: "无效的来源类型，1-原创, 2-转载, 3-翻译",
        };
      }

      article.sourceType = sourceType;
      await this.articleRepo.save(article);

      return { success: true, message: "来源类型设置成功" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "设置失败";
      return { success: false, message };
    }
  }

  /**
   * 获取腾讯云草稿列表
   */
  async fetchTencentDrafts(userId?: number) {
    const client = await this.getApiClient(userId);
    return client.fetchDrafts();
  }

  /**
   * 获取腾讯云文章列表
   */
  async fetchTencentArticles(
    params: { pageNumber?: number; pageSize?: number; status?: number },
    userId?: number
  ) {
    const client = await this.getApiClient(userId);
    return client.fetchArticles(params);
  }

  /**
   * 检查登录状态
   * 只检查本地数据库中的登录状态，不调用远程 API
   * 这样可以避免因网络问题或临时失效导致误判登录失效
   * 只有用户主动 logout 才会清除登录状态
   */
  async checkLoginStatus(userId?: number): Promise<boolean> {
    try {
      const userRepository = this.userRepo;
      let user: User | null;

      if (userId) {
        user = await userRepository.findOne({ where: { id: userId } });
      } else {
        user = await userRepository.findOne({ where: { isLoggedIn: true } });
      }

      // 只检查本地状态：有 cookies 且标记为已登录
      return !!(user && user.isLoggedIn && user.cookies);
    } catch {
      return false;
    }
  }

  /**
   * 验证远程登录状态（通过 API 调用验证）
   * 仅在实际 API 操作失败后调用，用于确认是否是登录过期导致的
   * 注意：此方法不会主动将本地登录状态设为 false
   */
  async verifyRemoteLoginStatus(userId?: number): Promise<boolean> {
    try {
      const client = await this.getApiClient(userId);
      return client.checkLoginStatus();
    } catch {
      return false;
    }
  }

  /**
   * 获取腾讯云创作中心文章列表（包含审核失败原因）
   */
  async fetchCreatorArticles(
    params: {
      hostStatus?: number;
      sortType?: string;
      page?: number;
      pageSize?: number;
    },
    userId?: number
  ) {
    const client = await this.getApiClient(userId);
    return client.fetchCreatorArticles(params);
  }

  /**
   * 获取文章状态统计
   */
  async fetchArticleStatusCount(userId?: number): Promise<ArticleStatusCount> {
    const client = await this.getApiClient(userId);
    return client.fetchArticleStatusCount();
  }

  /**
   * 将腾讯云状态码转换为文本
   * 根据 hostStatus 和 status 组合判断
   * 
   * hostStatus 说明：
   * - 1: 旧版已发布（兼容）
   * - 2: 已提交发布
   * - 3: 未通过
   * - 4: 回收站
   * 
   * status 说明（当 hostStatus=2 时）：
   * - 2: 发布成功（已发布）
   * - 其他: 审核中
   * 
   * 组合判断：
   * - hostStatus=2 且 status=2: 已发布
   * - hostStatus=2 且 status!=2: 审核中
   * - hostStatus=3: 未通过
   * - hostStatus=4: 回收站
   */
  private getStatusText(hostStatus: number, status?: number): string {
    if (hostStatus === 2) {
      // hostStatus=2 表示已提交发布，需要结合 status 判断
      return status === 2 ? "已发布" : "审核中";
    }
    
    const statusMap: Record<number, string> = {
      1: "已发布",
      3: "未通过",
      4: "回收站",
    };
    
    return statusMap[hostStatus] || "未知";
  }

  /**
   * 同步并匹配本地文章与腾讯云文章状态
   * 优先通过 tencentArticleId 匹配，其次通过标题匹配
   */
  async syncArticleStatus(userId?: number): Promise<SyncStatusResult> {
    try {
      const client = await this.getApiClient(userId);

      // 获取所有本地文章
      const localArticles = await this.articleRepo.find({
        where: { userId: userId || 1 },
        order: { createdAt: "DESC" },
      });

      if (localArticles.length === 0) {
        return {
          success: true,
          message: "没有本地文章需要同步",
          matchResults: [],
        };
      }

      // 获取腾讯云全部文章（分页获取）
      const tencentArticles: CreatorArticleInfo[] = [];
      let page = 1;
      const pageSize = 50;
      let hasMore = true;

      while (hasMore) {
        const result = await client.fetchCreatorArticles({
          hostStatus: 0, // 全部状态
          page,
          pageSize,
        });
        tencentArticles.push(...result.list);
        hasMore = result.list.length === pageSize;
        page++;
        // 防止无限循环，最多获取500篇
        if (page > 10) break;
      }

      // 获取状态统计
      const statusCount = await client.fetchArticleStatusCount();

      // 匹配本地文章与腾讯云文章
      const matchResults: ArticleMatchResult[] = [];

      for (const localArticle of localArticles) {
        const matchResult: ArticleMatchResult = {
          localArticleId: localArticle.id,
          localTitle: localArticle.title,
          matched: false,
        };

        // 优先通过 tencentArticleId 匹配
        if (localArticle.tencentArticleId) {
          const tencentId = parseInt(localArticle.tencentArticleId);
          const matched = tencentArticles.find(
            (t) => t.articleId === tencentId
          );
          if (matched) {
            matchResult.matched = true;
            matchResult.matchType = "id";
            matchResult.tencentArticleId = matched.articleId;
            matchResult.tencentTitle = matched.title;
            matchResult.tencentStatus = matched.hostStatus;
            matchResult.tencentStatusText = this.getStatusText(
              matched.hostStatus,
              matched.status
            );
            if (matched.rejectInfo) {
              matchResult.rejectReason = matched.rejectInfo.reason;
              matchResult.rejectTime = matched.rejectInfo.auditTime;
            }

            // 更新本地文章状态
            await this.updateLocalArticleStatus(localArticle, matched);
          }
        }

        // 如果没有通过ID匹配，尝试通过标题匹配
        if (!matchResult.matched) {
          const matched = tencentArticles.find(
            (t) => t.title.trim() === localArticle.title.trim()
          );
          if (matched) {
            matchResult.matched = true;
            matchResult.matchType = "title";
            matchResult.tencentArticleId = matched.articleId;
            matchResult.tencentTitle = matched.title;
            matchResult.tencentStatus = matched.hostStatus;
            matchResult.tencentStatusText = this.getStatusText(
              matched.hostStatus,
              matched.status
            );
            if (matched.rejectInfo) {
              matchResult.rejectReason = matched.rejectInfo.reason;
              matchResult.rejectTime = matched.rejectInfo.auditTime;
            }

            // 更新本地文章的腾讯云ID和状态
            localArticle.tencentArticleId = matched.articleId.toString();
            await this.updateLocalArticleStatus(localArticle, matched);
          }
        }

        // 如果本地文章有腾讯云ID但未能匹配到，说明腾讯云上不存在该文章
        // 重置为本地草稿状态
        if (!matchResult.matched && (localArticle.tencentArticleId || localArticle.tencentDraftId)) {
          console.log(`[ArticleSync] 文章未在腾讯云找到匹配，重置为本地草稿: ${localArticle.title}`);
          localArticle.tencentArticleId = undefined;
          localArticle.tencentDraftId = undefined;
          localArticle.tencentArticleUrl = undefined;
          localArticle.status = ArticleStatus.DRAFT;
          localArticle.errorMessage = undefined;
          localArticle.lastSyncedAt = new Date();
          await this.articleRepo.save(localArticle);
        }

        matchResults.push(matchResult);
      }

      const matchedCount = matchResults.filter((r) => r.matched).length;
      const rejectedCount = matchResults.filter(
        (r) => r.tencentStatus === 3
      ).length;

      return {
        success: true,
        message: `同步完成: ${matchedCount}/${localArticles.length} 篇文章匹配成功，${rejectedCount} 篇审核未通过`,
        matchResults,
        statusCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      return {
        success: false,
        message,
        matchResults: [],
      };
    }
  }

  /**
   * 更新本地文章状态
   * 
   * API 返回两个状态字段：
   * - hostStatus: 文章的发布状态
   *   - 1: 旧版已发布（兼容）
   *   - 2: 已提交发布
   *   - 3: 未通过
   *   - 4: 回收站
   * - status: 审核状态（当 hostStatus=2 时）
   *   - 2: 发布成功
   *   - 其他: 审核中
   * 
   * 组合判断逻辑：
   * - hostStatus=2 且 status=2: 已发布
   * - hostStatus=2 且 status!=2: 审核中
   * - hostStatus=3: 未通过
   * - hostStatus=4: 回收站
   */
  private async updateLocalArticleStatus(
    localArticle: Article,
    tencentArticle: CreatorArticleInfo
  ): Promise<void> {
    console.log(`[ArticleSync] 更新文章状态: articleId=${tencentArticle.articleId}, hostStatus=${tencentArticle.hostStatus}, status=${tencentArticle.status}`);
    
    // 根据腾讯云状态更新本地状态
    if (tencentArticle.hostStatus === 2) {
      // hostStatus=2 表示已提交发布，需要结合 status 判断
      if (tencentArticle.status === 2) {
        // hostStatus=2 且 status=2: 发布成功
        localArticle.status = ArticleStatus.PUBLISHED;
        localArticle.errorMessage = undefined;
      } else {
        // hostStatus=2 但 status!=2: 审核中
        localArticle.status = ArticleStatus.PENDING;
        localArticle.errorMessage = undefined;
      }
    } else if (tencentArticle.hostStatus === 1) {
      // 旧版已发布状态（兼容）
      localArticle.status = ArticleStatus.PUBLISHED;
      localArticle.errorMessage = undefined;
    } else if (tencentArticle.hostStatus === 3) {
      // 未通过
      localArticle.status = ArticleStatus.FAILED;
      localArticle.errorMessage = tencentArticle.rejectInfo?.reason;
    } else if (tencentArticle.hostStatus === 4) {
      // 回收站
      localArticle.status = ArticleStatus.FAILED;
      localArticle.errorMessage = "文章已被移入回收站";
    } else {
      // 其他未知状态，默认审核中
      localArticle.status = ArticleStatus.PENDING;
      localArticle.errorMessage = undefined;
    }

    // 更新腾讯云文章ID
    localArticle.tencentArticleId = tencentArticle.articleId.toString();
    localArticle.tencentArticleUrl = `https://cloud.tencent.com/developer/article/${tencentArticle.articleId}`;
    localArticle.lastSyncedAt = new Date();

    await this.articleRepo.save(localArticle);
  }

  /**
   * 获取审核失败的文章列表（包含失败原因）
   */
  async fetchRejectedArticles(
    userId?: number
  ): Promise<CreatorArticleInfo[]> {
    const client = await this.getApiClient(userId);
    const result = await client.fetchCreatorArticles({
      hostStatus: 3, // 未通过
      page: 1,
      pageSize: 100,
    });
    return result.list;
  }
}

// 导出单例
export const articleSyncService = new ArticleSyncService();
