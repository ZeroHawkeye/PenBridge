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
import { articleSyncService, PlatformNotLoggedInError } from "../services/articleSync";
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
import { ScheduledTask, TaskStatus, Platform, TencentPublishConfig, JuejinPublishConfig, PlatformConfig } from "../entities/ScheduledTask";
import { EmailConfig } from "../entities/EmailConfig";
import { AdminRole } from "../entities/AdminUser";
import { AIProvider, AIModel } from "../entities/AIProvider";
import { AIChatSession, AIChatMessage, ToolCallRecord } from "../entities/AIChat";

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

/**
 * 包装可能抛出平台未登录错误的异步调用
 * 将 PlatformNotLoggedInError 转换为 PRECONDITION_FAILED TRPCError
 */
async function wrapPlatformCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof PlatformNotLoggedInError) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: error.message,
      });
    }
    throw error;
  }
}

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
          // 腾讯云配置
          tencentConfig: z.object({
            tagIds: z.array(z.number()),
            tagNames: z.array(z.string()).optional(),
            sourceType: z.union([z.literal(1), z.literal(2), z.literal(3)]),
            summary: z.string().optional(),
          }).optional(),
          // 掘金配置
          juejinConfig: z.object({
            categoryId: z.string(),
            categoryName: z.string().optional(),
            tagIds: z.array(z.string()),
            tagNames: z.array(z.string()).optional(),
            briefContent: z.string(),
            isOriginal: z.union([z.literal(0), z.literal(1)]),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        // 根据平台选择配置
        let config: PlatformConfig;
        if (input.platform === Platform.JUEJIN) {
          if (!input.juejinConfig) {
            throw new Error("缺少掘金发布配置");
          }
          config = input.juejinConfig as JuejinPublishConfig;
        } else {
          if (!input.tencentConfig) {
            throw new Error("缺少腾讯云发布配置");
          }
          config = input.tencentConfig as TencentPublishConfig;
        }

        const task = await schedulerService.createTask({
          articleId: input.articleId,
          userId: 1, // 简化处理
          platform: input.platform,
          scheduledAt: new Date(input.scheduledAt),
          config,
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
          platform: z.nativeEnum(Platform).optional(),
          scheduledAt: z.string().datetime().optional(),
          // 腾讯云配置
          tencentConfig: z.object({
            tagIds: z.array(z.number()),
            tagNames: z.array(z.string()).optional(),
            sourceType: z.union([z.literal(1), z.literal(2), z.literal(3)]),
            summary: z.string().optional(),
          }).optional(),
          // 掘金配置
          juejinConfig: z.object({
            categoryId: z.string(),
            categoryName: z.string().optional(),
            tagIds: z.array(z.string()),
            tagNames: z.array(z.string()).optional(),
            briefContent: z.string(),
            isOriginal: z.union([z.literal(0), z.literal(1)]),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const updates: { scheduledAt?: Date; config?: PlatformConfig } = {};
        if (input.scheduledAt) {
          updates.scheduledAt = new Date(input.scheduledAt);
        }
        // 根据平台选择配置
        if (input.juejinConfig) {
          updates.config = input.juejinConfig as JuejinPublishConfig;
        } else if (input.tencentConfig) {
          updates.config = input.tencentConfig as TencentPublishConfig;
        }
        return schedulerService.updateTask(input.taskId, 1, updates);
      }),

    // 获取文章的定时任务
    getByArticle: protectedProcedure
      .input(z.object({ 
        articleId: z.number(),
        platform: z.nativeEnum(Platform).optional(),
      }))
      .query(async ({ input }) => {
        return schedulerService.getArticleTask(input.articleId, input.platform);
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
  }),

  // AI 配置相关
  aiConfig: t.router({
    // 获取所有 AI 供应商
    listProviders: protectedProcedure.query(async () => {
      const providerRepo = AppDataSource.getRepository(AIProvider);
      const providers = await providerRepo.find({
        where: { userId: 1 },
        order: { order: "ASC", createdAt: "ASC" },
      });
      // 隐藏 API Key，只返回是否已设置
      return providers.map((p) => ({
        ...p,
        apiKey: p.apiKey ? "••••••••" : "",
        hasApiKey: !!p.apiKey,
      }));
    }),

    // 创建 AI 供应商
    createProvider: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1, "请输入供应商名称"),
          baseUrl: z.string().url("请输入有效的 URL"),
          apiKey: z.string().min(1, "请输入 API Key"),
        })
      )
      .mutation(async ({ input }) => {
        const providerRepo = AppDataSource.getRepository(AIProvider);

        // 获取最大排序值
        const maxOrderResult = await providerRepo
          .createQueryBuilder("provider")
          .select("MAX(provider.order)", "maxOrder")
          .where("provider.userId = :userId", { userId: 1 })
          .getRawOne();

        const provider = providerRepo.create({
          ...input,
          userId: 1,
          order: (maxOrderResult?.maxOrder ?? -1) + 1,
        });

        await providerRepo.save(provider);

        return {
          ...provider,
          apiKey: "••••••••",
          hasApiKey: true,
        };
      }),

    // 更新 AI 供应商
    updateProvider: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          baseUrl: z.string().url().optional(),
          apiKey: z.string().optional(),
          enabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const providerRepo = AppDataSource.getRepository(AIProvider);
        const { id, ...updateData } = input;

        // 如果 apiKey 是占位符，不更新
        if (updateData.apiKey === "••••••••") {
          delete updateData.apiKey;
        }

        await providerRepo.update({ id, userId: 1 }, updateData);

        const provider = await providerRepo.findOne({ where: { id, userId: 1 } });
        if (!provider) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "供应商不存在",
          });
        }

        return {
          ...provider,
          apiKey: provider.apiKey ? "••••••••" : "",
          hasApiKey: !!provider.apiKey,
        };
      }),

    // 删除 AI 供应商
    deleteProvider: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const providerRepo = AppDataSource.getRepository(AIProvider);
        const modelRepo = AppDataSource.getRepository(AIModel);

        // 先删除关联的模型
        await modelRepo.delete({ providerId: input.id, userId: 1 });
        // 再删除供应商
        await providerRepo.delete({ id: input.id, userId: 1 });

        return { success: true };
      }),

    // 获取供应商下的所有模型
    listModels: protectedProcedure
      .input(z.object({ providerId: z.number().optional() }))
      .query(async ({ input }) => {
        const modelRepo = AppDataSource.getRepository(AIModel);
        const where: { userId: number; providerId?: number } = { userId: 1 };
        if (input.providerId) {
          where.providerId = input.providerId;
        }
        return modelRepo.find({
          where,
          order: { order: "ASC", createdAt: "ASC" },
        });
      }),

    // 创建模型
    createModel: protectedProcedure
      .input(
        z.object({
          providerId: z.number(),
          modelId: z.string().min(1, "请输入模型标识"),
          displayName: z.string().min(1, "请输入显示名称"),
          isDefault: z.boolean().optional(),
          parameters: z.object({
            temperature: z.number().min(0).max(2).optional(),
            maxTokens: z.number().min(1).optional(),
            topP: z.number().min(0).max(1).optional(),
            frequencyPenalty: z.number().min(-2).max(2).optional(),
            presencePenalty: z.number().min(-2).max(2).optional(),
          }).optional(),
          // 模型能力配置
          capabilities: z.object({
            // 深度思考/推理模式
            thinking: z.object({
              supported: z.boolean(),
              enabled: z.boolean(),
              apiFormat: z.enum(["standard", "openai"]).optional(),
              reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
              reasoningSummary: z.enum(["auto", "detailed", "concise", "disabled"]).optional(),
            }).optional(),
            // 流式输出
            streaming: z.object({
              supported: z.boolean(),
              enabled: z.boolean(),
            }).optional(),
            // 函数调用/工具使用
            functionCalling: z.object({
              supported: z.boolean(),
            }).optional(),
            // 视觉理解（多模态）
            vision: z.object({
              supported: z.boolean(),
            }).optional(),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const modelRepo = AppDataSource.getRepository(AIModel);

        // 获取最大排序值
        const maxOrderResult = await modelRepo
          .createQueryBuilder("model")
          .select("MAX(model.order)", "maxOrder")
          .where("model.userId = :userId AND model.providerId = :providerId", {
            userId: 1,
            providerId: input.providerId,
          })
          .getRawOne();

        // 如果设为默认，需要取消其他模型的默认状态
        if (input.isDefault) {
          await modelRepo.update(
            { userId: 1 },
            { isDefault: false }
          );
        }

        const model = modelRepo.create({
          ...input,
          userId: 1,
          order: (maxOrderResult?.maxOrder ?? -1) + 1,
        });

        await modelRepo.save(model);
        return model;
      }),

    // 更新模型
    updateModel: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          modelId: z.string().min(1).optional(),
          displayName: z.string().min(1).optional(),
          isDefault: z.boolean().optional(),
          enabled: z.boolean().optional(),
          parameters: z.object({
            temperature: z.number().min(0).max(2).optional(),
            maxTokens: z.number().min(1).optional(),
            topP: z.number().min(0).max(1).optional(),
            frequencyPenalty: z.number().min(-2).max(2).optional(),
            presencePenalty: z.number().min(-2).max(2).optional(),
          }).optional(),
          // 模型能力配置
          capabilities: z.object({
            // 深度思考/推理模式
            thinking: z.object({
              supported: z.boolean(),
              enabled: z.boolean(),
              apiFormat: z.enum(["standard", "openai"]).optional(),
              reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
              reasoningSummary: z.enum(["auto", "detailed", "concise", "disabled"]).optional(),
            }).optional(),
            // 流式输出
            streaming: z.object({
              supported: z.boolean(),
              enabled: z.boolean(),
            }).optional(),
            // 函数调用/工具使用
            functionCalling: z.object({
              supported: z.boolean(),
            }).optional(),
            // 视觉理解（多模态）
            vision: z.object({
              supported: z.boolean(),
            }).optional(),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const modelRepo = AppDataSource.getRepository(AIModel);
        const { id, ...updateData } = input;

        // 如果设为默认，需要取消其他模型的默认状态
        if (updateData.isDefault) {
          await modelRepo.update(
            { userId: 1 },
            { isDefault: false }
          );
        }

        await modelRepo.update({ id, userId: 1 }, updateData);

        const model = await modelRepo.findOne({ where: { id, userId: 1 } });
        if (!model) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "模型不存在",
          });
        }

        return model;
      }),

    // 删除模型
    deleteModel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const modelRepo = AppDataSource.getRepository(AIModel);
        await modelRepo.delete({ id: input.id, userId: 1 });
        return { success: true };
      }),

    // 获取默认模型
    getDefaultModel: protectedProcedure.query(async () => {
      const modelRepo = AppDataSource.getRepository(AIModel);
      const providerRepo = AppDataSource.getRepository(AIProvider);

      const model = await modelRepo.findOne({
        where: { userId: 1, isDefault: true, enabled: true },
      });

      if (!model) {
        return null;
      }

      const provider = await providerRepo.findOne({
        where: { id: model.providerId, userId: 1, enabled: true },
      });

      if (!provider) {
        return null;
      }

      return {
        model,
        provider: {
          id: provider.id,
          name: provider.name,
          baseUrl: provider.baseUrl,
        },
      };
    }),

    // 测试 AI 连接（完整对话）
    testConnection: protectedProcedure
      .input(
        z.object({
          providerId: z.number(),
          modelId: z.string(),
          message: z.string().min(1, "请输入测试消息"),
        })
      )
      .mutation(async ({ input }) => {
        const providerRepo = AppDataSource.getRepository(AIProvider);
        const provider = await providerRepo.findOne({
          where: { id: input.providerId, userId: 1 },
        });

        if (!provider) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "供应商不存在",
          });
        }

        try {
          const startTime = Date.now();
          
          // 发送对话请求
          const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${provider.apiKey}`,
            },
            body: JSON.stringify({
              model: input.modelId,
              messages: [{ role: "user", content: input.message }],
              max_tokens: 1024,
              temperature: 0.7,
            }),
          });

          const endTime = Date.now();
          const duration = endTime - startTime;

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
            );
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "无响应内容";
          const usage = data.usage || {};

          return {
            success: true,
            message: "连接成功",
            response: content,
            usage: {
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0,
            },
            duration,
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "连接失败",
            response: null,
            usage: null,
            duration: 0,
          };
        }
      }),
  }),

  // AI 聊天相关
  aiChat: t.router({
    // 创建新会话
    createSession: protectedProcedure
      .input(
        z.object({
          articleId: z.number().optional(),
          title: z.string().optional(),
          modelId: z.string().optional(),
          providerId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const sessionRepo = AppDataSource.getRepository(AIChatSession);
        
        const session = sessionRepo.create({
          userId: 1,
          articleId: input.articleId,
          title: input.title || "新对话",
          modelId: input.modelId,
          providerId: input.providerId,
        });
        
        await sessionRepo.save(session);
        return session;
      }),

    // 获取会话列表
    listSessions: protectedProcedure
      .input(
        z.object({
          articleId: z.number().optional(),
          page: z.number().default(1),
          pageSize: z.number().default(20),
        })
      )
      .query(async ({ input }) => {
        const sessionRepo = AppDataSource.getRepository(AIChatSession);
        
        const where: { userId: number; articleId?: number } = { userId: 1 };
        if (input.articleId) {
          where.articleId = input.articleId;
        }
        
        const [sessions, total] = await sessionRepo.findAndCount({
          where,
          order: { updatedAt: "DESC" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        });
        
        return {
          sessions,
          total,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(total / input.pageSize),
        };
      }),

    // 获取单个会话
    getSession: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const sessionRepo = AppDataSource.getRepository(AIChatSession);
        const session = await sessionRepo.findOne({
          where: { id: input.id, userId: 1 },
        });
        
        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "会话不存在",
          });
        }
        
        return session;
      }),

    // 更新会话
    updateSession: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          modelId: z.string().optional(),
          providerId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const sessionRepo = AppDataSource.getRepository(AIChatSession);
        const { id, ...updateData } = input;
        
        await sessionRepo.update({ id, userId: 1 }, updateData);
        
        const session = await sessionRepo.findOne({ where: { id, userId: 1 } });
        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "会话不存在",
          });
        }
        
        return session;
      }),

    // 删除会话
    deleteSession: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const sessionRepo = AppDataSource.getRepository(AIChatSession);
        const messageRepo = AppDataSource.getRepository(AIChatMessage);
        
        // 先删除会话下的所有消息
        await messageRepo.delete({ sessionId: input.id });
        // 再删除会话
        await sessionRepo.delete({ id: input.id, userId: 1 });
        
        return { success: true };
      }),

    // 获取会话消息
    getMessages: protectedProcedure
      .input(
        z.object({
          sessionId: z.number(),
          page: z.number().default(1),
          pageSize: z.number().default(50),
        })
      )
      .query(async ({ input }) => {
        const messageRepo = AppDataSource.getRepository(AIChatMessage);
        const sessionRepo = AppDataSource.getRepository(AIChatSession);
        
        // 验证会话归属
        const session = await sessionRepo.findOne({
          where: { id: input.sessionId, userId: 1 },
        });
        
        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "会话不存在",
          });
        }
        
        const [messages, total] = await messageRepo.findAndCount({
          where: { sessionId: input.sessionId },
          order: { createdAt: "ASC" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        });
        
        return {
          messages,
          total,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(total / input.pageSize),
        };
      }),

    // 添加消息（用于保存用户消息和 AI 回复）
    addMessage: protectedProcedure
      .input(
        z.object({
          sessionId: z.number(),
          role: z.enum(["user", "assistant", "system", "tool"]),
          content: z.string(),
          reasoning: z.string().optional(),
          toolCalls: z.array(z.object({
            id: z.string(),
            type: z.enum(["function", "mcp"]).optional(),
            name: z.string(),
            arguments: z.string(),
            result: z.string().optional(),
            status: z.enum(["pending", "running", "completed", "failed", "awaiting_confirmation"]),
            executionLocation: z.enum(["frontend", "backend"]).optional(),
            error: z.string().optional(),
            startedAt: z.string().optional(),
            completedAt: z.string().optional(),
          })).optional(),
          toolCallId: z.string().optional(),
          usage: z.object({
            promptTokens: z.number(),
            completionTokens: z.number(),
            totalTokens: z.number(),
          }).optional(),
          status: z.enum(["pending", "streaming", "completed", "failed"]).default("completed"),
          error: z.string().optional(),
          duration: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const messageRepo = AppDataSource.getRepository(AIChatMessage);
        const sessionRepo = AppDataSource.getRepository(AIChatSession);
        
        // 验证会话归属
        const session = await sessionRepo.findOne({
          where: { id: input.sessionId, userId: 1 },
        });
        
        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "会话不存在",
          });
        }
        
        const message = messageRepo.create({
          sessionId: input.sessionId,
          role: input.role,
          content: input.content,
          reasoning: input.reasoning,
          toolCalls: input.toolCalls as ToolCallRecord[],
          toolCallId: input.toolCallId,
          usage: input.usage,
          status: input.status,
          error: input.error,
          duration: input.duration,
        });
        
        await messageRepo.save(message);
        
        // 更新会话统计
        session.messageCount += 1;
        if (input.usage) {
          session.totalTokens += input.usage.totalTokens;
        }
        // 如果是第一条用户消息，更新会话标题
        if (input.role === "user" && session.messageCount === 1) {
          session.title = input.content.slice(0, 50) + (input.content.length > 50 ? "..." : "");
        }
        await sessionRepo.save(session);
        
        return message;
      }),

    // 更新消息（用于更新流式消息或工具调用结果）
    updateMessage: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          content: z.string().optional(),
          reasoning: z.string().optional(),
          toolCalls: z.array(z.object({
            id: z.string(),
            type: z.enum(["function", "mcp"]),
            name: z.string(),
            arguments: z.string(),
            result: z.string().optional(),
            status: z.enum(["pending", "running", "completed", "failed"]),
            executionLocation: z.enum(["frontend", "backend"]),
            error: z.string().optional(),
            startedAt: z.string().optional(),
            completedAt: z.string().optional(),
          })).optional(),
          usage: z.object({
            promptTokens: z.number(),
            completionTokens: z.number(),
            totalTokens: z.number(),
          }).optional(),
          status: z.enum(["pending", "streaming", "completed", "failed"]).optional(),
          error: z.string().optional(),
          duration: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const messageRepo = AppDataSource.getRepository(AIChatMessage);
        const { id, ...updateData } = input;
        
        await messageRepo.update(id, updateData as any);
        
        return messageRepo.findOne({ where: { id } });
      }),

    // 清空会话消息
    clearMessages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        const messageRepo = AppDataSource.getRepository(AIChatMessage);
        const sessionRepo = AppDataSource.getRepository(AIChatSession);
        
        // 验证会话归属
        const session = await sessionRepo.findOne({
          where: { id: input.sessionId, userId: 1 },
        });
        
        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "会话不存在",
          });
        }
        
        await messageRepo.delete({ sessionId: input.sessionId });
        
        // 重置会话统计
        session.messageCount = 0;
        session.totalTokens = 0;
        await sessionRepo.save(session);
        
        return { success: true };
      }),

    // 获取或创建文章关联的默认会话
    getOrCreateArticleSession: protectedProcedure
      .input(
        z.object({
          articleId: z.number(),
          modelId: z.string().optional(),
          providerId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const sessionRepo = AppDataSource.getRepository(AIChatSession);
        
        // 查找文章关联的最近会话
        let session = await sessionRepo.findOne({
          where: { articleId: input.articleId, userId: 1 },
          order: { updatedAt: "DESC" },
        });
        
        if (!session) {
          // 创建新会话
          session = sessionRepo.create({
            userId: 1,
            articleId: input.articleId,
            title: "文章助手",
            modelId: input.modelId,
            providerId: input.providerId,
          });
          await sessionRepo.save(session);
        }
        
        return session;
      }),
  }),
});

export type AppRouter = typeof appRouter;
