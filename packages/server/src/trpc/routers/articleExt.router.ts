import { z } from "zod";
import { t, protectedProcedure } from "../shared";
import { AppDataSource } from "../../db";
import { Article, ArticleStatus } from "../../entities/Article";

// 扩展文章相关接口路由
export const articleExtRouter = t.router({
  // 在指定文件夹中创建文章
  createInFolder: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        folderId: z.number().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);

      // 获取同级文章的最大排序值
      const maxOrderResult = await articleRepo
        .createQueryBuilder("article")
        .select("MAX(article.order)", "maxOrder")
        .where(
          input.folderId
            ? "article.folderId = :folderId"
            : "article.folderId IS NULL",
          { folderId: input.folderId }
        )
        .getRawOne();

      const article = articleRepo.create({
        title: input.title,
        content: "",
        status: ArticleStatus.DRAFT,
        userId: 1,
        folderId: input.folderId ?? undefined,
        order: (maxOrderResult?.maxOrder ?? -1) + 1,
      });

      await articleRepo.save(article);
      return article;
    }),

  // 移动文章到指定文件夹
  moveToFolder: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        folderId: z.number().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);
      await articleRepo.update(input.id, {
        folderId: input.folderId ?? undefined,
      });
      return articleRepo.findOne({ where: { id: input.id } });
    }),

  // 重命名文章
  rename: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const articleRepo = AppDataSource.getRepository(Article);
      await articleRepo.update(input.id, { title: input.title });
      return articleRepo.findOne({ where: { id: input.id } });
    }),
});
