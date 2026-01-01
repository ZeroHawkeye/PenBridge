import { z } from "zod";
import * as path from "path";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../shared";
import { AppDataSource } from "../../db";
import { Article } from "../../entities/Article";
import { getJuejinCookies } from "../../services/juejinAuth";
import { createJuejinApiClient } from "../../services/juejinApi";
import { processArticleImages, hasImagesToUpload } from "../../services/imageUpload";

// 掘金相关路由
export const juejinRouter = t.router({
  // 搜索标签
  searchTags: protectedProcedure
    .input(z.object({ keyword: z.string() }))
    .query(async ({ input }) => {
      const cookies = await getJuejinCookies();
      if (!cookies) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "请先登录掘金账号",
        });
      }

      const client = createJuejinApiClient(cookies);
      const tags = await client.searchTags(input.keyword);
      return tags;
    }),

  // 获取分类列表
  getCategories: protectedProcedure.query(async () => {
    const cookies = await getJuejinCookies();
    if (!cookies) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "请先登录掘金账号",
      });
    }

    const client = createJuejinApiClient(cookies);
    return client.fetchCategories();
  }),

  // 保存掘金发布配置
  saveConfig: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        categoryId: z.string(),
        tagIds: z.array(z.string()),
        tagNames: z.array(z.string()),
        briefContent: z.string(),
        isOriginal: z.number().min(0).max(1),
      })
    )
    .mutation(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);
      const article = await articleRepo.findOne({ where: { id: input.id } });

      if (!article) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文章不存在",
        });
      }

      article.juejinCategoryId = input.categoryId;
      article.juejinTagIds = input.tagIds;
      article.juejinTagNames = input.tagNames;
      article.juejinBriefContent = input.briefContent;
      article.juejinIsOriginal = input.isOriginal;

      await articleRepo.save(article);

      return { success: true };
    }),

  // 发布文章到掘金
  publish: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const cookies = await getJuejinCookies();
      if (!cookies) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "请先登录掘金账号",
        });
      }

      const articleRepo = AppDataSource.getRepository(Article);
      const article = await articleRepo.findOne({ where: { id: input.id } });

      if (!article) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文章不存在",
        });
      }

      // 验证必填字段
      if (!article.juejinCategoryId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "请先选择文章分类",
        });
      }

      if (!article.juejinTagIds || article.juejinTagIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "请至少选择一个标签",
        });
      }

      if (article.juejinTagIds.length > 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "最多选择3个标签",
        });
      }

      if (!article.juejinBriefContent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "请填写文章摘要",
        });
      }

      if (article.juejinBriefContent.length < 50) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "摘要至少需要50个字符",
        });
      }

      if (article.juejinBriefContent.length > 100) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "摘要不能超过100个字符",
        });
      }

      if (!article.content || article.content.length < 100) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "文章正文建议至少100字",
        });
      }

      try {
        const client = createJuejinApiClient(cookies);

        console.log("[Juejin] 开始发布文章:", {
          articleId: article.id,
          title: article.title,
          categoryId: article.juejinCategoryId,
          tagIds: article.juejinTagIds,
          existingDraftId: article.juejinDraftId || "无",
        });

        // 处理文章中的图片，上传到掘金 ImageX
        const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
        let contentToPublish = article.content;
        
        if (hasImagesToUpload(article.content, "juejin")) {
          console.log("[Juejin] 检测到需要上传的图片，开始上传到掘金...");
          try {
            const { content: processedContent, results } = await processArticleImages(
              article.content,
              client,
              UPLOAD_DIR,
              "juejin"
            );
            contentToPublish = processedContent;
            
            const successCount = results.filter(r => r.success).length;
            console.log(`[Juejin] 图片上传完成: ${successCount}/${results.length} 成功`);
            
            // 如果有图片上传失败，给出警告但继续发布
            if (successCount < results.length) {
              console.warn(`[Juejin] 警告: ${results.length - successCount} 张图片上传失败`);
            }
          } catch (imageError) {
            const errorMsg = imageError instanceof Error ? imageError.message : "未知错误";
            console.error("[Juejin] 图片上传失败:", errorMsg);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `图片上传失败: ${errorMsg}`,
            });
          }
        } else {
          console.log("[Juejin] 文章中没有需要上传的本地图片");
        }

        // 一键发布文章（复用已有草稿ID）
        const result = await client.publishArticleOneClick({
          title: article.title,
          markContent: contentToPublish,
          briefContent: article.juejinBriefContent,
          categoryId: article.juejinCategoryId,
          tagIds: article.juejinTagIds,
          isOriginal: article.juejinIsOriginal,
          existingDraftId: article.juejinDraftId || undefined,
        });

        // 更新文章状态（发布后进入审核状态，审核通过后才是published）
        article.juejinArticleId = result.article_id;
        article.juejinDraftId = result.draft_id;
        article.juejinArticleUrl = `https://juejin.cn/post/${result.article_id}`;
        article.juejinStatus = "pending"; // 掘金发布后需要审核，初始状态为审核中
        article.juejinLastSyncedAt = new Date();

        await articleRepo.save(article);

        console.log("[Juejin] 发布成功:", {
          articleId: result.article_id,
          draftId: result.draft_id,
          url: article.juejinArticleUrl,
        });

        return {
          success: true,
          message: "发布成功",
          articleId: result.article_id,
          articleUrl: article.juejinArticleUrl,
        };
      } catch (error) {
        // 详细记录错误日志
        console.error("[Juejin] 发布失败，详细信息:", {
          articleId: article.id,
          title: article.title,
          categoryId: article.juejinCategoryId,
          tagIds: article.juejinTagIds,
          briefContent: article.juejinBriefContent,
          contentLength: article.content?.length,
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          } : error,
        });
        
        // 更新错误状态
        article.juejinStatus = "failed";
        article.errorMessage = error instanceof Error ? error.message : "发布失败";
        await articleRepo.save(article);

        // 返回用户友好的错误消息
        let userMessage = "发布失败";
        if (error instanceof Error) {
          const msg = error.message;
          if (msg.includes("参数错误")) {
            userMessage = "发布参数错误，请检查分类、标签和摘要设置";
          } else if (msg.includes("登录") || msg.includes("UNAUTHORIZED")) {
            userMessage = "掘金登录已过期，请重新登录";
          } else if (msg.includes("频繁")) {
            userMessage = "操作过于频繁，请稍后再试";
          } else {
            userMessage = msg;
          }
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: userMessage,
        });
      }
    }),

  // 同步文章到掘金草稿
  syncToDraft: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const cookies = await getJuejinCookies();
      if (!cookies) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "请先登录掘金账号",
        });
      }

      const articleRepo = AppDataSource.getRepository(Article);
      const article = await articleRepo.findOne({ where: { id: input.id } });

      if (!article) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文章不存在",
        });
      }

      try {
        const client = createJuejinApiClient(cookies);

        // 处理文章中的图片，上传到掘金 ImageX
        const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
        let contentToSync = article.content;
        
        if (hasImagesToUpload(article.content, "juejin")) {
          console.log("[Juejin] 同步草稿: 检测到需要上传的图片，开始上传到掘金...");
          try {
            const { content: processedContent, results } = await processArticleImages(
              article.content,
              client,
              UPLOAD_DIR,
              "juejin"
            );
            contentToSync = processedContent;
            
            const successCount = results.filter(r => r.success).length;
            console.log(`[Juejin] 同步草稿: 图片上传完成: ${successCount}/${results.length} 成功`);
          } catch (imageError) {
            const errorMsg = imageError instanceof Error ? imageError.message : "未知错误";
            console.error("[Juejin] 同步草稿: 图片上传失败:", errorMsg);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `图片上传失败: ${errorMsg}`,
            });
          }
        }

        // 创建或更新草稿
        let draftId = article.juejinDraftId;

        if (!draftId) {
          // 创建新草稿
          const draft = await client.createDraft(article.title);
          draftId = draft.id;
        }

        // 更新草稿内容
        await client.updateDraft({
          id: draftId,
          title: article.title,
          markContent: contentToSync,
          briefContent: article.juejinBriefContent || "",
          categoryId: article.juejinCategoryId || "0",
          tagIds: article.juejinTagIds || [],
          isOriginal: article.juejinIsOriginal,
        });

        // 更新文章状态
        article.juejinDraftId = draftId;
        article.juejinStatus = "draft";
        article.juejinLastSyncedAt = new Date();

        await articleRepo.save(article);

        return {
          success: true,
          message: "草稿同步成功",
          draftId,
        };
      } catch (error) {
        console.error("[Juejin] 同步草稿失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "同步失败",
        });
      }
    }),

  // 获取掘金文章列表
  fetchArticles: protectedProcedure
    .input(
      z.object({
        auditStatus: z.number().nullable().optional(), // null-全部, 2-已发布, 1-审核中, 3-未通过
        keyword: z.string().optional(),
        pageNo: z.number().optional(),
        pageSize: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const cookies = await getJuejinCookies();
      if (!cookies) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "请先登录掘金账号",
        });
      }

      try {
        const client = createJuejinApiClient(cookies);
        const articles = await client.fetchUserArticles({
          auditStatus: input.auditStatus,
          keyword: input.keyword,
          pageNo: input.pageNo,
          pageSize: input.pageSize,
        });

        // 转换为前端友好的格式
        return articles.map((item) => ({
          articleId: item.article_id,
          title: item.article_info.title,
          briefContent: item.article_info.brief_content,
          coverImage: item.article_info.cover_image,
          viewCount: item.article_info.view_count,
          diggCount: item.article_info.digg_count,
          commentCount: item.article_info.comment_count,
          collectCount: item.article_info.collect_count,
          status: item.article_info.status,
          auditStatus: item.article_info.audit_status,
          verifyStatus: item.article_info.verify_status,
          draftId: item.article_info.draft_id,
          ctime: item.article_info.ctime,
          mtime: item.article_info.mtime,
          rtime: item.article_info.rtime,
          categoryId: item.category?.category_id,
          categoryName: item.category?.category_name,
          tags: item.tags?.map((t) => ({
            tagId: t.tag_id,
            tagName: t.tag_name,
          })) || [],
          url: `https://juejin.cn/post/${item.article_id}`,
        }));
      } catch (error) {
        console.error("[Juejin] 获取文章列表失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "获取失败",
        });
      }
    }),

  // 获取掘金文章状态统计
  fetchArticleStatusCount: protectedProcedure.query(async () => {
    const cookies = await getJuejinCookies();
    if (!cookies) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "请先登录掘金账号",
      });
    }

    try {
      const client = createJuejinApiClient(cookies);
      return client.fetchArticleStatusCount();
    } catch (error) {
      console.error("[Juejin] 获取文章状态统计失败:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "获取失败",
      });
    }
  }),

  // 同步本地文章与掘金文章状态
  syncArticleStatus: protectedProcedure.mutation(async () => {
    const cookies = await getJuejinCookies();
    if (!cookies) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "请先登录掘金账号",
      });
    }

    try {
      const client = createJuejinApiClient(cookies);
      const articleRepo = AppDataSource.getRepository(Article);

      // 获取掘金上的所有文章（分页获取）
      const allJuejinArticles: Array<{
        article_id: string;
        article_info: {
          article_id: string;
          title: string;
          status: number;
          audit_status: number;
          draft_id: string;
        };
      }> = [];

      let pageNo = 1;
      const pageSize = 50;
      while (true) {
        const articles = await client.fetchUserArticles({
          auditStatus: null,
          pageNo,
          pageSize,
        });
        if (articles.length === 0) break;
        allJuejinArticles.push(...articles);
        if (articles.length < pageSize) break;
        pageNo++;
      }

      // 获取本地所有文章（不仅是已发布到掘金的）
      const localArticles = await articleRepo.find({
        where: { userId: 1 },
        order: { createdAt: "DESC" },
      });

      let syncedCount = 0;
      let matchedCount = 0;
      const updates: Array<{ id: number; status: string; articleId: string; matchType?: string }> = [];

      // 辅助函数：根据掘金审核状态获取本地状态
      const getLocalStatus = (auditStatus: number, currentStatus?: string): string => {
        switch (auditStatus) {
          case 2:
            return "published";
          case 1:
            return "pending";
          case 3:
            return "rejected";
          default:
            return currentStatus || "unknown";
        }
      };

      for (const local of localArticles) {
        let juejinArticle: typeof allJuejinArticles[0] | undefined;
        let matchType: "id" | "title" | undefined;

        // 优先通过 juejinArticleId 匹配
        if (local.juejinArticleId) {
          juejinArticle = allJuejinArticles.find(
            (a) => a.article_id === local.juejinArticleId
          );
          if (juejinArticle) {
            matchType = "id";
          }
        }

        // 如果没有通过 ID 匹配，尝试通过标题匹配
        if (!juejinArticle) {
          juejinArticle = allJuejinArticles.find(
            (a) => a.article_info.title.trim() === local.title.trim()
          );
          if (juejinArticle) {
            matchType = "title";
            console.log(`[Juejin] 通过标题匹配到文章: "${local.title}" -> ${juejinArticle.article_id}`);
          }
        }

        if (juejinArticle) {
          matchedCount++;
          const newStatus = getLocalStatus(juejinArticle.article_info.audit_status, local.juejinStatus);
          const oldStatus = local.juejinStatus;
          
          // 更新掘金文章ID（如果是通过标题匹配的，需要保存ID）
          const needsIdUpdate = !local.juejinArticleId || local.juejinArticleId !== juejinArticle.article_id;
          const needsStatusUpdate = local.juejinStatus !== newStatus;

          if (needsIdUpdate || needsStatusUpdate) {
            // 使用 update 只更新掘金相关字段，避免覆盖其他平台字段
            const updateData: Partial<Article> = {
              juejinArticleId: juejinArticle.article_id,
              juejinArticleUrl: `https://juejin.cn/post/${juejinArticle.article_id}`,
              juejinStatus: newStatus,
              juejinLastSyncedAt: new Date(),
            };
            // 同步草稿ID
            if (juejinArticle.article_info.draft_id) {
              updateData.juejinDraftId = juejinArticle.article_info.draft_id;
            }
            await articleRepo.update(local.id, updateData);
            
            if (needsStatusUpdate) {
              syncedCount++;
              updates.push({
                id: local.id,
                status: newStatus,
                articleId: juejinArticle.article_id,
                matchType,
              });
              console.log(`[Juejin] 文章状态已更新: ${oldStatus} -> ${newStatus} (${matchType}匹配)`);
            }
          }
        } else {
          // 掘金上找不到对应文章
          // 如果本地有掘金相关状态但远程没有匹配，说明需要重置
          const hasJuejinData = local.juejinArticleId || local.juejinStatus;
          const needsReset = hasJuejinData && local.juejinStatus !== "draft";
          
          if (needsReset) {
            const oldArticleId = local.juejinArticleId || "unknown";
            const oldStatus = local.juejinStatus;
            console.log(`[Juejin] 文章在掘金上已不存在，重置状态: ${local.title} (原状态: ${oldStatus})`);
            
            // 使用 update 只更新掘金相关字段，避免覆盖其他平台字段
            // 注意：TypeORM 中 null 表示清除字段值
            await articleRepo.update(local.id, {
              juejinStatus: null as any,
              juejinArticleId: null as any,
              juejinArticleUrl: null as any,
              juejinDraftId: null as any,
              juejinLastSyncedAt: new Date(),
            });
            console.log(`[Juejin] 已重置掘金字段 (使用 update)`);
            
            syncedCount++;
            updates.push({
              id: local.id,
              status: "deleted",
              articleId: oldArticleId,
            });
          }
        }
      }

      return {
        success: true,
        message: `同步完成: ${matchedCount}/${localArticles.length} 篇文章匹配成功，${syncedCount} 篇状态有更新`,
        syncedCount,
        matchedCount,
        updates,
      };
    } catch (error) {
      console.error("[Juejin] 同步文章状态失败:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "同步失败",
      });
    }
  }),
});
