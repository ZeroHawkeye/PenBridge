import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { IsNull, Not } from "typeorm";
import {
  waitForManualLogin,
  autoLogin,
  getLoginStatus,
  logout,
  setCookiesFromClient,
} from "../services/tencentAuth";
import {
  setJuejinCookiesFromClient,
  juejinAutoLogin,
  getJuejinLoginStatus,
  juejinLogout,
  getJuejinSessionInfo,
  getJuejinCookies,
} from "../services/juejinAuth";
import { createJuejinApiClient } from "../services/juejinApi";
import { articleSyncService } from "../services/articleSync";
import { schedulerService } from "../services/scheduler";
import { emailService } from "../services/emailService";
import { cleanupUnusedImages, deleteAllArticleImages } from "../services/imageCleanup";
import {
  adminLogin,
  validateSession,
  destroySession,
  changePassword,
  createAdmin,
  getAllAdmins,
  updateAdmin,
  deleteAdmin,
} from "../services/adminAuth";
import { AppDataSource } from "../db";
import { Article, ArticleStatus } from "../entities/Article";
import { User } from "../entities/User";
import { Folder } from "../entities/Folder";
import { ScheduledTask, TaskStatus, Platform, TencentPublishConfig } from "../entities/ScheduledTask";
import { EmailConfig } from "../entities/EmailConfig";
import { AdminRole } from "../entities/AdminUser";

// 创建带有上下文的 tRPC
interface Context {
  token?: string;
}

const t = initTRPC.context<Context>().create();

// 鉴权中间件
const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "未登录",
    });
  }

  const session = await validateSession(ctx.token);
  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "登录已过期，请重新登录",
    });
  }

  return next({
    ctx: {
      ...ctx,
      admin: session,
    },
  });
});

// 超级管理员权限中间件
const isSuperAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "未登录",
    });
  }

  const session = await validateSession(ctx.token);
  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "登录已过期，请重新登录",
    });
  }

  if (session.role !== AdminRole.SUPER_ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "需要超级管理员权限",
    });
  }

  return next({
    ctx: {
      ...ctx,
      admin: session,
    },
  });
});

// 受保护的 procedure
const protectedProcedure = t.procedure.use(isAuthed);
const superAdminProcedure = t.procedure.use(isSuperAdmin);

export const appRouter = t.router({
  // 健康检查（无需认证）
  health: t.procedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),

  // 管理员认证相关
  adminAuth: t.router({
    // 管理员登录
    login: t.procedure
      .input(
        z.object({
          username: z.string().min(1, "请输入用户名"),
          password: z.string().min(1, "请输入密码"),
        })
      )
      .mutation(async ({ input }) => {
        const result = await adminLogin(input.username, input.password);
        if (!result) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "用户名或密码错误",
          });
        }
        return result;
      }),

    // 验证当前 session
    validate: t.procedure.query(async ({ ctx }) => {
      if (!ctx.token) {
        return { valid: false, admin: null };
      }
      const session = await validateSession(ctx.token);
      if (!session) {
        return { valid: false, admin: null };
      }
      return { valid: true, admin: session };
    }),

    // 登出
    logout: t.procedure.mutation(async ({ ctx }) => {
      if (ctx.token) {
        await destroySession(ctx.token);
      }
      return { success: true };
    }),

    // 修改自己的密码
    changePassword: protectedProcedure
      .input(
        z.object({
          oldPassword: z.string().min(1, "请输入原密码"),
          newPassword: z.string().min(6, "新密码至少6位"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const success = await changePassword(
          (ctx as any).admin.adminId,
          input.oldPassword,
          input.newPassword
        );
        if (!success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "原密码错误",
          });
        }
        return { success: true };
      }),
  }),

  // 管理员管理（仅超级管理员）
  adminUser: t.router({
    // 获取所有管理员列表
    list: superAdminProcedure.query(async () => {
      return getAllAdmins();
    }),

    // 创建管理员
    create: superAdminProcedure
      .input(
        z.object({
          username: z.string().min(1, "请输入用户名"),
          password: z.string().min(6, "密码至少6位"),
          role: z.nativeEnum(AdminRole).default(AdminRole.ADMIN),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await createAdmin(input.username, input.password, input.role);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "创建失败",
          });
        }
      }),

    // 更新管理员
    update: superAdminProcedure
      .input(
        z.object({
          id: z.number(),
          username: z.string().min(1).optional(),
          password: z.string().min(6).optional(),
          role: z.nativeEnum(AdminRole).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        try {
          return await updateAdmin(id, data);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "更新失败",
          });
        }
      }),

    // 删除管理员
    delete: superAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await deleteAdmin(input.id);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "删除失败",
          });
        }
      }),
  }),

  // 腾讯云认证相关
  auth: t.router({
    // 获取登录状态
    status: protectedProcedure.query(async () => {
      return getLoginStatus();
    }),

    // 手动登录（打开浏览器让用户登录）
    manualLogin: protectedProcedure.mutation(async () => {
      return waitForManualLogin();
    }),

    // 自动登录（使用保存的 cookies）
    autoLogin: protectedProcedure.mutation(async () => {
      return autoLogin();
    }),

    // 登出
    logout: protectedProcedure.mutation(async () => {
      await logout();
      return { success: true };
    }),

    // 从客户端设置 cookies（Electron 客户端调用）
    setCookies: protectedProcedure
      .input(
        z.object({
          cookies: z.string(),
          nickname: z.string().optional(),
          avatarUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return setCookiesFromClient(input.cookies, input.nickname, input.avatarUrl);
      }),
  }),

  // 掘金认证相关
  juejinAuth: t.router({
    // 获取登录状态
    status: protectedProcedure.query(async () => {
      return getJuejinLoginStatus();
    }),

    // 自动登录（使用保存的 cookies）
    autoLogin: protectedProcedure.mutation(async () => {
      return juejinAutoLogin();
    }),

    // 登出
    logout: protectedProcedure.mutation(async () => {
      await juejinLogout();
      return { success: true };
    }),

    // 从客户端设置 cookies（Electron 客户端调用）
    setCookies: protectedProcedure
      .input(
        z.object({
          cookies: z.string(),
          nickname: z.string().optional(),
          avatarUrl: z.string().optional(),
          userId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return setJuejinCookiesFromClient(
          input.cookies,
          input.nickname,
          input.avatarUrl,
          input.userId
        );
      }),

    // 获取会话信息（包括过期时间）
    sessionInfo: protectedProcedure.query(async () => {
      return getJuejinSessionInfo();
    }),
  }),

  // 文章相关
  article: t.router({
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

  }),

  // 同步相关 - 使用 API 直接调用
  sync: t.router({
    // 同步文章到腾讯云草稿箱
    syncToDraft: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return articleSyncService.syncToDraft(input.id);
      }),

    // 使用 API 发布文章
    publishViaApi: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return articleSyncService.publishArticle(input.id);
      }),

    // 删除腾讯云草稿
    deleteDraft: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return articleSyncService.deleteDraft(input.id);
      }),

    // 搜索标签
    searchTags: protectedProcedure
      .input(z.object({ keyword: z.string() }))
      .query(async ({ input }) => {
        return articleSyncService.searchTags(input.keyword);
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
        return articleSyncService.setArticleTags(input.id, input.tagIds);
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
        return articleSyncService.setSourceType(input.id, input.sourceType);
      }),

    // 获取腾讯云草稿列表
    fetchTencentDrafts: protectedProcedure.query(async () => {
      return articleSyncService.fetchTencentDrafts();
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
        return articleSyncService.fetchTencentArticles(input);
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
        return articleSyncService.fetchCreatorArticles(input);
      }),

    // 获取文章状态统计
    fetchArticleStatusCount: protectedProcedure.query(async () => {
      return articleSyncService.fetchArticleStatusCount();
    }),

    // 同步并匹配本地文章与腾讯云文章状态
    syncArticleStatus: protectedProcedure.mutation(async () => {
      return articleSyncService.syncArticleStatus();
    }),

    // 获取审核失败的文章列表（包含失败原因）
    fetchRejectedArticles: protectedProcedure.query(async () => {
      return articleSyncService.fetchRejectedArticles();
    }),
  }),

  // 文件夹相关
  folder: t.router({
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
  }),

  // 扩展文章相关接口
  articleExt: t.router({
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
  }),

  // 定时任务相关
  schedule: t.router({
    // 创建定时发布任务
    create: protectedProcedure
      .input(
        z.object({
          articleId: z.number(),
          platform: z.nativeEnum(Platform).default(Platform.TENCENT),
          scheduledAt: z.string().datetime(),
          config: z.object({
            tagIds: z.array(z.number()),
            tagNames: z.array(z.string()).optional(),
            sourceType: z.union([z.literal(1), z.literal(2), z.literal(3)]),
            summary: z.string().optional(),
          }),
        })
      )
      .mutation(async ({ input }) => {
        const task = await schedulerService.createTask({
          articleId: input.articleId,
          userId: 1, // 简化处理
          platform: input.platform,
          scheduledAt: new Date(input.scheduledAt),
          config: input.config as TencentPublishConfig,
        });
        return task;
      }),

    // 取消定时任务
    cancel: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        await schedulerService.cancelTask(input.taskId, 1);
        return { success: true };
      }),

    // 更新定时任务
    update: protectedProcedure
      .input(
        z.object({
          taskId: z.number(),
          scheduledAt: z.string().datetime().optional(),
          config: z.object({
            tagIds: z.array(z.number()),
            tagNames: z.array(z.string()).optional(),
            sourceType: z.union([z.literal(1), z.literal(2), z.literal(3)]),
            summary: z.string().optional(),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const updates: { scheduledAt?: Date; config?: TencentPublishConfig } = {};
        if (input.scheduledAt) {
          updates.scheduledAt = new Date(input.scheduledAt);
        }
        if (input.config) {
          updates.config = input.config as TencentPublishConfig;
        }
        return schedulerService.updateTask(input.taskId, 1, updates);
      }),

    // 获取文章的定时任务
    getByArticle: protectedProcedure
      .input(z.object({ articleId: z.number() }))
      .query(async ({ input }) => {
        return schedulerService.getArticleTask(input.articleId);
      }),

    // 获取用户的定时任务列表
    list: protectedProcedure
      .input(
        z.object({
          status: z.array(z.nativeEnum(TaskStatus)).optional(),
        })
      )
      .query(async ({ input }) => {
        return schedulerService.getUserTasks(1, input.status);
      }),

    // 获取待执行的定时任务列表
    listPending: protectedProcedure.query(async () => {
      return schedulerService.getUserTasks(1, [TaskStatus.PENDING]);
    }),

    // 获取任务历史记录
    listHistory: protectedProcedure
      .input(
        z.object({
          page: z.number().default(1),
          pageSize: z.number().default(20),
        })
      )
      .query(async ({ input }) => {
        const taskRepo = AppDataSource.getRepository(ScheduledTask);
        const [tasks, total] = await taskRepo.findAndCount({
          where: { userId: 1 },
          order: { createdAt: "DESC" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          relations: ["article"],
        });
        return {
          tasks,
          total,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(total / input.pageSize),
        };
      }),

    // 清空历史记录（只清空非 pending 状态的任务）
    clearHistory: protectedProcedure.mutation(async () => {
      const taskRepo = AppDataSource.getRepository(ScheduledTask);
      const result = await taskRepo.delete({
        userId: 1,
        status: Not(TaskStatus.PENDING),
      });
      return {
        success: true,
        deletedCount: result.affected || 0,
      };
    }),
  }),

  // 邮件配置相关
  emailConfig: t.router({
    // 获取邮件配置
    get: protectedProcedure.query(async () => {
      const configRepo = AppDataSource.getRepository(EmailConfig);
      let config = await configRepo.findOne({ where: { userId: 1 } });
      
      // 如果不存在，创建默认配置
      if (!config) {
        config = configRepo.create({
          userId: 1,
          enabled: false,
          smtpSecure: true,
          notifyOnSuccess: true,
          notifyOnFailed: true,
          notifyOnCookieExpired: true,
        });
        await configRepo.save(config);
      }
      
      // 隐藏密码
      if (config.smtpPass) {
        config.smtpPass = "••••••••";
      }
      
      return config;
    }),

    // 保存邮件配置
    save: protectedProcedure
      .input(
        z.object({
          smtpHost: z.string().optional(),
          smtpPort: z.number().optional(),
          smtpSecure: z.boolean().optional(),
          smtpUser: z.string().optional(),
          smtpPass: z.string().optional(),
          fromName: z.string().optional(),
          fromEmail: z.string().optional(),
          notifyEmail: z.string().optional(),
          notifyOnSuccess: z.boolean().optional(),
          notifyOnFailed: z.boolean().optional(),
          notifyOnCookieExpired: z.boolean().optional(),
          enabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const configRepo = AppDataSource.getRepository(EmailConfig);
        let config = await configRepo.findOne({ where: { userId: 1 } });
        
        if (!config) {
          config = configRepo.create({ userId: 1 });
        }
        
        // 更新配置
        if (input.smtpHost !== undefined) config.smtpHost = input.smtpHost;
        if (input.smtpPort !== undefined) config.smtpPort = input.smtpPort;
        if (input.smtpSecure !== undefined) config.smtpSecure = input.smtpSecure;
        if (input.smtpUser !== undefined) config.smtpUser = input.smtpUser;
        // 密码只在非占位符时更新
        if (input.smtpPass !== undefined && input.smtpPass !== "••••••••") {
          config.smtpPass = input.smtpPass;
        }
        if (input.fromName !== undefined) config.fromName = input.fromName;
        if (input.fromEmail !== undefined) config.fromEmail = input.fromEmail;
        if (input.notifyEmail !== undefined) config.notifyEmail = input.notifyEmail;
        if (input.notifyOnSuccess !== undefined) config.notifyOnSuccess = input.notifyOnSuccess;
        if (input.notifyOnFailed !== undefined) config.notifyOnFailed = input.notifyOnFailed;
        if (input.notifyOnCookieExpired !== undefined) config.notifyOnCookieExpired = input.notifyOnCookieExpired;
        if (input.enabled !== undefined) config.enabled = input.enabled;
        
        await configRepo.save(config);
        
        // 隐藏密码
        if (config.smtpPass) {
          config.smtpPass = "••••••••";
        }
        
        return config;
      }),

    // 验证 SMTP 配置
    verify: protectedProcedure
      .input(
        z.object({
          smtpHost: z.string(),
          smtpPort: z.number(),
          smtpSecure: z.boolean(),
          smtpUser: z.string(),
          smtpPass: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        // 如果密码是占位符，从数据库获取真实密码
        let password = input.smtpPass;
        if (password === "••••••••") {
          const configRepo = AppDataSource.getRepository(EmailConfig);
          const config = await configRepo.findOne({ where: { userId: 1 } });
          if (config?.smtpPass) {
            password = config.smtpPass;
          } else {
            return { success: false, message: "请先保存 SMTP 密码" };
          }
        }
        
        return emailService.verifySmtpConfig({
          smtpHost: input.smtpHost,
          smtpPort: input.smtpPort,
          smtpSecure: input.smtpSecure,
          smtpUser: input.smtpUser,
          smtpPass: password,
        });
      }),

    // 发送测试邮件
    sendTest: protectedProcedure.mutation(async () => {
      return emailService.sendTestEmail(1);
    }),
  }),

  // 掘金相关
  juejin: t.router({
    // 搜索标签
    searchTags: protectedProcedure
      .input(z.object({ keyword: z.string() }))
      .query(async ({ input }) => {
        const cookies = await getJuejinCookies();
        if (!cookies) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
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
          code: "UNAUTHORIZED",
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
            code: "UNAUTHORIZED",
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

          // 一键发布文章（复用已有草稿ID）
          const result = await client.publishArticleOneClick({
            title: article.title,
            markContent: article.content,
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
            code: "UNAUTHORIZED",
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
            markContent: article.content,
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
            code: "UNAUTHORIZED",
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

    // 同步本地文章与掘金文章状态
    syncArticleStatus: protectedProcedure.mutation(async () => {
      const cookies = await getJuejinCookies();
      if (!cookies) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
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

        // 获取本地所有已发布到掘金的文章
        const localArticles = await articleRepo.find({
          where: { juejinArticleId: Not(IsNull()) },
        });

        let syncedCount = 0;
        const updates: Array<{ id: number; status: string; articleId: string }> = [];

        for (const local of localArticles) {
          const juejinArticle = allJuejinArticles.find(
            (a) => a.article_id === local.juejinArticleId
          );

          if (juejinArticle) {
            // 根据掘金的审核状态更新本地状态
            let newStatus: string;
            switch (juejinArticle.article_info.audit_status) {
              case 2:
                newStatus = "published";
                break;
              case 1:
                newStatus = "pending";
                break;
              case 3:
                newStatus = "rejected";
                break;
              default:
                newStatus = local.juejinStatus || "unknown";
            }

            if (local.juejinStatus !== newStatus) {
              local.juejinStatus = newStatus;
              local.juejinLastSyncedAt = new Date();
              await articleRepo.save(local);
              syncedCount++;
              updates.push({
                id: local.id,
                status: newStatus,
                articleId: local.juejinArticleId!,
              });
            }
          }
        }

        return {
          success: true,
          message: `同步完成，更新了 ${syncedCount} 篇文章状态`,
          syncedCount,
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
  }),
});

export type AppRouter = typeof appRouter;
