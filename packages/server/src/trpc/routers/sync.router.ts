import { z } from "zod";
import { t, protectedProcedure, wrapPlatformCall } from "../shared";
import { articleSyncService } from "../../services/articleSync";

// 同步相关路由 - 使用 API 直接调用
export const syncRouter = t.router({
  // 同步文章到腾讯云草稿箱
  syncToDraft: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return wrapPlatformCall(() => articleSyncService.syncToDraft(input.id));
    }),

  // 使用 API 发布文章
  publishViaApi: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return wrapPlatformCall(() => articleSyncService.publishArticle(input.id));
    }),

  // 删除腾讯云草稿
  deleteDraft: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return wrapPlatformCall(() => articleSyncService.deleteDraft(input.id));
    }),

  // 搜索标签
  searchTags: protectedProcedure
    .input(z.object({ keyword: z.string() }))
    .query(async ({ input }) => {
      return wrapPlatformCall(() => articleSyncService.searchTags(input.keyword));
    }),

  // 设置文章标签
  setTags: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        tagIds: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      return wrapPlatformCall(() => articleSyncService.setArticleTags(input.id, input.tagIds));
    }),

  // 设置文章来源类型
  setSourceType: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        sourceType: z.number().min(1).max(3),
      })
    )
    .mutation(async ({ input }) => {
      return wrapPlatformCall(() => articleSyncService.setSourceType(input.id, input.sourceType));
    }),

  // 获取腾讯云草稿列表
  fetchTencentDrafts: protectedProcedure.query(async () => {
    return wrapPlatformCall(() => articleSyncService.fetchTencentDrafts());
  }),

  // 获取腾讯云文章列表
  fetchTencentArticles: protectedProcedure
    .input(
      z.object({
        pageNumber: z.number().optional(),
        pageSize: z.number().optional(),
        status: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return wrapPlatformCall(() => articleSyncService.fetchTencentArticles(input));
    }),

  // 检查 API 登录状态
  checkApiLoginStatus: protectedProcedure.query(async () => {
    const isLoggedIn = await articleSyncService.checkLoginStatus();
    return { isLoggedIn };
  }),

  // 获取创作中心文章列表（包含审核失败原因）
  fetchCreatorArticles: protectedProcedure
    .input(
      z.object({
        hostStatus: z.number().optional(), // 0-全部, 1-已发布, 2-审核中, 3-未通过, 4-回收站
        sortType: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return wrapPlatformCall(() => articleSyncService.fetchCreatorArticles(input));
    }),

  // 获取文章状态统计
  fetchArticleStatusCount: protectedProcedure.query(async () => {
    return wrapPlatformCall(() => articleSyncService.fetchArticleStatusCount());
  }),

  // 同步并匹配本地文章与腾讯云文章状态
  syncArticleStatus: protectedProcedure.mutation(async () => {
    return wrapPlatformCall(() => articleSyncService.syncArticleStatus());
  }),

  // 获取审核失败的文章列表（包含失败原因）
  fetchRejectedArticles: protectedProcedure.query(async () => {
    return wrapPlatformCall(() => articleSyncService.fetchRejectedArticles());
  }),
});
