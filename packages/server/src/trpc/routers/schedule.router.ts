import { z } from "zod";
import { Not } from "typeorm";
import { t, protectedProcedure } from "../shared";
import { AppDataSource } from "../../db";
import { schedulerService } from "../../services/scheduler";
import {
  ScheduledTask,
  TaskStatus,
  Platform,
  TencentPublishConfig,
  JuejinPublishConfig,
  PlatformConfig,
} from "../../entities/ScheduledTask";

// 定时任务相关路由
export const scheduleRouter = t.router({
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
});
