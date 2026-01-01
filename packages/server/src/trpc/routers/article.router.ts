import { z } from "zod";
import { t, protectedProcedure } from "../shared";
import { AppDataSource } from "../../db";
import { Article, ArticleStatus } from "../../entities/Article";
import { cleanupUnusedImages, deleteAllArticleImages } from "../../services/imageCleanup";

// 文章相关路由
export const articleRouter = t.router({
  // 获取文章列表
  list: protectedProcedure
    .input(
      z.object({
        status: z.nativeEnum(ArticleStatus).optional(),
        page: z.number().default(1),
        pageSize: z.number().default(10),
      })
    )
    .query(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);
      const { status, page, pageSize } = input;

      const where = status ? { status } : {};
      const [articles, total] = await articleRepo.findAndCount({
        where,
        order: { createdAt: "DESC" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      return {
        articles,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  // 获取单篇文章（完整数据，包含 content）
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);
      return articleRepo.findOne({ where: { id: input.id } });
    }),

  // 获取文章元数据（不含 content，用于快速加载）
  getMeta: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);
      return articleRepo.findOne({
        where: { id: input.id },
        select: [
          "id",
          "title",
          "summary",
          "tags",
          "status",
          "folderId",
          "order",
          "scheduledAt",
          "publishedAt",
          "tencentDraftId",
          "tencentArticleId",
          "tencentArticleUrl",
          "tencentTagIds",
          "sourceType",
          "lastSyncedAt",
          "errorMessage",
          "userId",
          "createdAt",
          "updatedAt",
          // 掘金相关字段
          "juejinDraftId",
          "juejinArticleId",
          "juejinArticleUrl",
          "juejinCategoryId",
          "juejinTagIds",
          "juejinTagNames",
          "juejinBriefContent",
          "juejinIsOriginal",
          "juejinStatus",
          "juejinLastSyncedAt",
        ],
      });
    }),

  // 获取文章内容（只返回 content，用于延迟加载）
  getContent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);
      const article = await articleRepo.findOne({
        where: { id: input.id },
        select: ["id", "content"],
      });
      return article ? { id: article.id, content: article.content } : null;
    }),

  // 创建文章
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        summary: z.string().nullish(),
        tags: z.array(z.string()).nullish(),
        scheduledAt: z.string().datetime().nullish(),
        tencentTagIds: z.array(z.number()).nullish(),
        sourceType: z.number().min(1).max(3).nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);

      const article = new Article();
      article.title = input.title;
      article.content = input.content;
      article.summary = input.summary ?? undefined;
      article.tags = input.tags ?? undefined;
      article.tencentTagIds = input.tencentTagIds ?? [];
      article.sourceType = input.sourceType ?? 1;
      article.status = input.scheduledAt
        ? ArticleStatus.SCHEDULED
        : ArticleStatus.DRAFT;
      article.scheduledAt = input.scheduledAt
        ? new Date(input.scheduledAt)
        : undefined;
      article.userId = 1; // 简化处理

      await articleRepo.save(article);
      return article;
    }),

  // 更新文章
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).nullish(),
        content: z.string().min(1).nullish(),
        summary: z.string().nullish(),
        tags: z.array(z.string()).nullish(),
        scheduledAt: z.string().datetime().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);
      const { id, title, content, summary, tags, scheduledAt } = input;

      const updateData: Partial<Article> = {};
      if (title !== null && title !== undefined) updateData.title = title;
      if (content !== null && content !== undefined)
        updateData.content = content;
      if (summary !== null && summary !== undefined)
        updateData.summary = summary;
      if (tags !== null && tags !== undefined) updateData.tags = tags;
      if (scheduledAt !== null && scheduledAt !== undefined)
        updateData.scheduledAt = new Date(scheduledAt);

      await articleRepo.update(id, updateData);

      // 如果更新了内容，异步清理未引用的图片
      if (content !== null && content !== undefined) {
        // 使用 setImmediate 异步执行，不阻塞响应
        setImmediate(() => {
          cleanupUnusedImages(id, content).catch((err) => {
            console.error(`[Router] 清理文章 ${id} 图片失败:`, err);
          });
        });
      }

      return articleRepo.findOne({ where: { id } });
    }),

  // 删除文章
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);
      await articleRepo.delete(input.id);
      
      // 异步删除文章的所有上传图片
      setImmediate(() => {
        deleteAllArticleImages(input.id).catch((err) => {
          console.error(`[Router] 删除文章 ${input.id} 图片失败:`, err);
        });
      });
      
      return { success: true };
    }),
});
