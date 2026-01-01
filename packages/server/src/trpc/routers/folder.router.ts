import { z } from "zod";
import { t, protectedProcedure } from "../shared";
import { AppDataSource } from "../../db";
import { Article } from "../../entities/Article";
import { Folder } from "../../entities/Folder";

// 文件夹相关路由
export const folderRouter = t.router({
  // 获取文件夹树结构（只返回文件树所需的轻量字段，不包含 content）
  tree: protectedProcedure.query(async () => {
    const folderRepo = AppDataSource.getRepository(Folder);
    const articleRepo = AppDataSource.getRepository(Article);

    // 获取所有文件夹
    const folders = await folderRepo.find({
      order: { order: "ASC", createdAt: "ASC" },
    });

    // 获取所有文章（只选择文件树需要的字段，排除 content 大字段）
    const articles = await articleRepo.find({
      select: [
        "id",
        "title",
        "status",
        "folderId",
        "order",
        "createdAt",
        "updatedAt",
        "scheduledAt",
        "publishedAt",
        "tencentArticleId",
        "tencentArticleUrl",
      ],
      order: { order: "ASC", createdAt: "DESC" },
    });

    return { folders, articles };
  }),

  // 创建文件夹
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        parentId: z.number().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const folderRepo = AppDataSource.getRepository(Folder);

      // 获取同级文件夹的最大排序值
      const maxOrderResult = await folderRepo
        .createQueryBuilder("folder")
        .select("MAX(folder.order)", "maxOrder")
        .where(
          input.parentId
            ? "folder.parentId = :parentId"
            : "folder.parentId IS NULL",
          { parentId: input.parentId }
        )
        .getRawOne();

      const folder = folderRepo.create({
        name: input.name,
        parentId: input.parentId ?? undefined,
        order: (maxOrderResult?.maxOrder ?? -1) + 1,
      });

      await folderRepo.save(folder);
      return folder;
    }),

  // 重命名文件夹
  rename: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const folderRepo = AppDataSource.getRepository(Folder);
      await folderRepo.update(input.id, { name: input.name });
      return folderRepo.findOne({ where: { id: input.id } });
    }),

  // 删除文件夹（及其子文件夹和文章）
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const folderRepo = AppDataSource.getRepository(Folder);
      const articleRepo = AppDataSource.getRepository(Article);

      // 递归获取所有子文件夹ID
      const getAllChildFolderIds = async (
        parentId: number
      ): Promise<number[]> => {
        const children = await folderRepo.find({ where: { parentId } });
        const ids = children.map((f) => f.id);
        for (const child of children) {
          const childIds = await getAllChildFolderIds(child.id);
          ids.push(...childIds);
        }
        return ids;
      };

      const folderIds = [input.id, ...(await getAllChildFolderIds(input.id))];

      // 将这些文件夹下的文章移到根目录
      for (const folderId of folderIds) {
        await articleRepo.update(
          { folderId },
          { folderId: undefined as any }
        );
      }

      // 删除所有相关文件夹
      await folderRepo.delete(folderIds);

      return { success: true };
    }),

  // 移动文件夹
  move: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        parentId: z.number().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const folderRepo = AppDataSource.getRepository(Folder);
      await folderRepo.update(input.id, {
        parentId: input.parentId ?? undefined,
      });
      return folderRepo.findOne({ where: { id: input.id } });
    }),

  // 更新文件夹展开状态
  setExpanded: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        isExpanded: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const folderRepo = AppDataSource.getRepository(Folder);
      await folderRepo.update(input.id, { isExpanded: input.isExpanded });
      return { success: true };
    }),
});
