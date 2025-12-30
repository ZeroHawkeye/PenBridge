/**
 * 定时任务调度服务
 * 负责检查和执行定时发布任务
 */

import { LessThanOrEqual, In } from "typeorm";
import { AppDataSource } from "../db";
import { Article, ArticleStatus } from "../entities/Article";
import { ScheduledTask, TaskStatus, Platform, TencentPublishConfig } from "../entities/ScheduledTask";
import { User } from "../entities/User";
import { articleSyncService } from "./articleSync";
import { emailService } from "./emailService";

/**
 * 调度器配置
 */
interface SchedulerConfig {
  checkInterval: number;  // 检查间隔（毫秒）
  maxRetries: number;     // 最大重试次数
  retryDelay: number;     // 重试延迟（毫秒）
}

const DEFAULT_CONFIG: SchedulerConfig = {
  checkInterval: 60 * 1000,  // 每分钟检查一次
  maxRetries: 3,
  retryDelay: 5 * 60 * 1000,  // 5分钟后重试
};

/**
 * 定时任务调度服务类
 */
export class SchedulerService {
  private intervalId?: ReturnType<typeof setInterval>;
  private config: SchedulerConfig;
  private isRunning = false;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (this.intervalId) {
      console.log("[Scheduler] 调度器已在运行");
      return;
    }

    console.log("[Scheduler] 启动定时任务调度器");
    console.log(`[Scheduler] 检查间隔: ${this.config.checkInterval / 1000}秒`);

    // 启动时立即检查一次
    this.checkAndExecuteTasks();

    // 设置定时检查
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTasks();
    }, this.config.checkInterval);
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log("[Scheduler] 调度器已停止");
    }
  }

  /**
   * 检查并执行到期的任务
   */
  private async checkAndExecuteTasks(): Promise<void> {
    if (this.isRunning) {
      console.log("[Scheduler] 上一轮检查尚未完成，跳过本次检查");
      return;
    }

    this.isRunning = true;
    const now = new Date();
    console.log(`[Scheduler] 检查任务... 当前时间: ${now.toISOString()} (本地: ${now.toLocaleString("zh-CN")})`);

    try {
      // 检查数据库是否已初始化
      if (!AppDataSource.isInitialized) {
        console.log("[Scheduler] 数据库尚未初始化，跳过本次检查");
        return;
      }

      const taskRepo = AppDataSource.getRepository(ScheduledTask);

      // 先查询所有 pending 任务（不带时间过滤）用于调试
      const allPendingTasks = await taskRepo.find({
        where: {
          status: TaskStatus.PENDING,
        },
      });

      if (allPendingTasks.length > 0) {
        console.log(`[Scheduler] 当前共有 ${allPendingTasks.length} 个待执行任务:`);
        for (const task of allPendingTasks) {
          const scheduledTime = task.scheduledAt;
          const isDue = scheduledTime <= now;
          console.log(`[Scheduler]   - 任务 #${task.id}: 计划=${scheduledTime.toISOString()} (本地: ${scheduledTime.toLocaleString("zh-CN")}), 已到期=${isDue}`);
        }
      } else {
        console.log("[Scheduler] 当前没有待执行的定时任务");
      }

      // 查找所有已到期且待执行的任务
      const pendingTasks = await taskRepo.find({
        where: {
          status: TaskStatus.PENDING,
          scheduledAt: LessThanOrEqual(now),
        },
        order: {
          scheduledAt: "ASC",
        },
      });

      if (pendingTasks.length > 0) {
        console.log(`[Scheduler] 发现 ${pendingTasks.length} 个已到期任务，准备执行`);
      }

      for (const task of pendingTasks) {
        await this.executeTask(task);
      }
    } catch (error) {
      console.error("[Scheduler] 检查任务失败:", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    const taskRepo = AppDataSource.getRepository(ScheduledTask);

    console.log(`[Scheduler] 开始执行任务 #${task.id}, 文章ID: ${task.articleId}, 平台: ${task.platform}`);

    // 标记为执行中
    task.status = TaskStatus.RUNNING;
    await taskRepo.save(task);

    try {
      // 先检查登录状态
      const isLoggedIn = await this.checkLoginStatus(task.userId, task.platform);
      if (!isLoggedIn) {
        throw new Error("登录状态已失效，请重新登录");
      }

      // 根据平台执行不同的发布逻辑
      switch (task.platform) {
        case Platform.TENCENT:
          await this.executeTencentPublish(task);
          break;
        default:
          throw new Error(`不支持的平台: ${task.platform}`);
      }

      // 执行成功
      task.status = TaskStatus.SUCCESS;
      task.executedAt = new Date();
      await taskRepo.save(task);

      console.log(`[Scheduler] 任务 #${task.id} 执行成功`);

      // 发送成功通知
      if (!task.notified) {
        await emailService.notifyTaskResult(task);
        task.notified = true;
        await taskRepo.save(task);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      console.error(`[Scheduler] 任务 #${task.id} 执行失败:`, errorMessage);

      task.errorMessage = errorMessage;
      task.executedAt = new Date();
      task.retryCount += 1;

      // 判断是否需要重试
      const isCookieExpired = this.isCookieExpiredError(errorMessage);
      const canRetry = !isCookieExpired && task.retryCount < task.maxRetries;

      if (canRetry) {
        // 安排重试
        task.status = TaskStatus.PENDING;
        task.scheduledAt = new Date(Date.now() + this.config.retryDelay);
        console.log(`[Scheduler] 任务 #${task.id} 将在 ${task.scheduledAt.toLocaleString("zh-CN")} 重试 (${task.retryCount}/${task.maxRetries})`);
      } else {
        // 标记为失败
        task.status = TaskStatus.FAILED;
        console.log(`[Scheduler] 任务 #${task.id} 最终失败: ${errorMessage}`);

        // 发送失败通知
        if (!task.notified) {
          await emailService.notifyTaskResult(task);
          task.notified = true;
        }
      }

      await taskRepo.save(task);
    }
  }

  /**
   * 检查登录状态
   * 只检查本地数据库中的登录状态，不调用远程 API
   * 这样可以避免因网络问题导致误判登录失效
   */
  private async checkLoginStatus(userId: number, platform: Platform): Promise<boolean> {
    try {
      if (platform === Platform.TENCENT) {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId } });
        // 只检查本地状态：有 cookies 且标记为已登录
        return !!(user && user.isLoggedIn && user.cookies);
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 判断是否是 Cookie 过期错误
   */
  private isCookieExpiredError(message: string): boolean {
    const keywords = ["未登录", "登录", "cookie", "Cookie", "COOKIE", "1001", "session"];
    return keywords.some((keyword) => message.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * 执行腾讯云发布
   */
  private async executeTencentPublish(task: ScheduledTask): Promise<void> {
    const articleRepo = AppDataSource.getRepository(Article);
    const taskRepo = AppDataSource.getRepository(ScheduledTask);

    // 获取文章
    const article = await articleRepo.findOne({
      where: { id: task.articleId },
    });

    if (!article) {
      throw new Error("文章不存在");
    }

    // 应用定时任务中保存的配置
    const config = task.config as TencentPublishConfig;
    article.tencentTagIds = config.tagIds;
    article.sourceType = config.sourceType;
    if (config.summary) {
      article.summary = config.summary;
    }
    await articleRepo.save(article);

    // 执行发布
    const result = await articleSyncService.publishArticle(task.articleId, task.userId);

    if (!result.success) {
      throw new Error(result.message);
    }

    // 更新任务结果
    task.resultUrl = result.articleUrl;
    await taskRepo.save(task);
  }

  /**
   * 创建定时任务
   */
  async createTask(params: {
    articleId: number;
    userId: number;
    platform: Platform;
    scheduledAt: Date;
    config: TencentPublishConfig;
  }): Promise<ScheduledTask> {
    const taskRepo = AppDataSource.getRepository(ScheduledTask);
    const articleRepo = AppDataSource.getRepository(Article);

    // 验证文章存在
    const article = await articleRepo.findOne({
      where: { id: params.articleId },
    });
    if (!article) {
      throw new Error("文章不存在");
    }

    // 检查是否已有相同的待执行任务
    const existingTask = await taskRepo.findOne({
      where: {
        articleId: params.articleId,
        platform: params.platform,
        status: In([TaskStatus.PENDING, TaskStatus.RUNNING]),
      },
    });

    if (existingTask) {
      throw new Error("该文章已有待执行的定时发布任务");
    }

    // 验证定时时间
    if (params.scheduledAt <= new Date()) {
      throw new Error("定时发布时间必须在当前时间之后");
    }

    // 创建任务
    const task = taskRepo.create({
      articleId: params.articleId,
      userId: params.userId,
      platform: params.platform,
      scheduledAt: params.scheduledAt,
      config: params.config,
      status: TaskStatus.PENDING,
      maxRetries: this.config.maxRetries,
    });

    await taskRepo.save(task);

    // 更新文章状态
    article.status = ArticleStatus.SCHEDULED;
    article.scheduledAt = params.scheduledAt;
    await articleRepo.save(article);

    console.log(`[Scheduler] 创建定时任务 #${task.id}`);
    console.log(`[Scheduler] - 计划时间: ${params.scheduledAt.toISOString()} (本地: ${params.scheduledAt.toLocaleString("zh-CN")})`);
    console.log(`[Scheduler] - 当前时间: ${new Date().toISOString()} (本地: ${new Date().toLocaleString("zh-CN")})`);

    return task;
  }

  /**
   * 取消定时任务
   */
  async cancelTask(taskId: number, userId: number): Promise<void> {
    const taskRepo = AppDataSource.getRepository(ScheduledTask);
    const articleRepo = AppDataSource.getRepository(Article);

    const task = await taskRepo.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new Error("任务不存在");
    }

    if (task.status !== TaskStatus.PENDING) {
      throw new Error("只能取消待执行的任务");
    }

    // 更新任务状态
    task.status = TaskStatus.CANCELLED;
    await taskRepo.save(task);

    // 更新文章状态
    const article = await articleRepo.findOne({
      where: { id: task.articleId },
    });
    if (article && article.status === ArticleStatus.SCHEDULED) {
      article.status = ArticleStatus.DRAFT;
      article.scheduledAt = undefined;
      await articleRepo.save(article);
    }

    console.log(`[Scheduler] 取消定时任务 #${taskId}`);
  }

  /**
   * 获取用户的定时任务列表
   */
  async getUserTasks(
    userId: number,
    status?: TaskStatus[]
  ): Promise<ScheduledTask[]> {
    const taskRepo = AppDataSource.getRepository(ScheduledTask);

    const where: any = { userId };
    if (status && status.length > 0) {
      where.status = In(status);
    }

    return taskRepo.find({
      where,
      order: { scheduledAt: "DESC" },
      relations: ["article"],
    });
  }

  /**
   * 获取文章的定时任务
   */
  async getArticleTask(articleId: number): Promise<ScheduledTask | null> {
    const taskRepo = AppDataSource.getRepository(ScheduledTask);

    return taskRepo.findOne({
      where: {
        articleId,
        status: In([TaskStatus.PENDING, TaskStatus.RUNNING]),
      },
    });
  }

  /**
   * 更新定时任务
   */
  async updateTask(
    taskId: number,
    userId: number,
    updates: {
      scheduledAt?: Date;
      config?: TencentPublishConfig;
    }
  ): Promise<ScheduledTask> {
    const taskRepo = AppDataSource.getRepository(ScheduledTask);
    const articleRepo = AppDataSource.getRepository(Article);

    const task = await taskRepo.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new Error("任务不存在");
    }

    if (task.status !== TaskStatus.PENDING) {
      throw new Error("只能修改待执行的任务");
    }

    // 更新字段
    if (updates.scheduledAt) {
      if (updates.scheduledAt <= new Date()) {
        throw new Error("定时发布时间必须在当前时间之后");
      }
      task.scheduledAt = updates.scheduledAt;

      // 同步更新文章的定时时间
      const article = await articleRepo.findOne({
        where: { id: task.articleId },
      });
      if (article) {
        article.scheduledAt = updates.scheduledAt;
        await articleRepo.save(article);
      }
    }

    if (updates.config) {
      task.config = updates.config;
    }

    await taskRepo.save(task);

    console.log(`[Scheduler] 更新定时任务 #${taskId}`);

    return task;
  }

  /**
   * 检查即将执行的任务的登录状态
   * 在任务执行前提前检查，如果登录失效则发送通知
   */
  async checkUpcomingTasksLoginStatus(hoursAhead: number = 1): Promise<void> {
    const taskRepo = AppDataSource.getRepository(ScheduledTask);
    const articleRepo = AppDataSource.getRepository(Article);
    const userRepo = AppDataSource.getRepository(User);

    const checkTime = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);

    // 查找即将执行的任务
    const upcomingTasks = await taskRepo.find({
      where: {
        status: TaskStatus.PENDING,
        scheduledAt: LessThanOrEqual(checkTime),
      },
    });

    // 按用户和平台分组
    const tasksByUserPlatform = new Map<string, ScheduledTask[]>();

    for (const task of upcomingTasks) {
      const key = `${task.userId}-${task.platform}`;
      if (!tasksByUserPlatform.has(key)) {
        tasksByUserPlatform.set(key, []);
      }
      tasksByUserPlatform.get(key)!.push(task);
    }

    // 检查每个用户-平台的登录状态
    for (const [key, tasks] of tasksByUserPlatform) {
      const [userIdStr, platform] = key.split("-");
      const userId = parseInt(userIdStr);

      const isLoggedIn = await this.checkLoginStatus(userId, platform as Platform);

      if (!isLoggedIn) {
        // 获取文章标题
        const pendingArticles = await Promise.all(
          tasks.map(async (task) => {
            const article = await articleRepo.findOne({
              where: { id: task.articleId },
            });
            return {
              title: article?.title || "未知文章",
              scheduledAt: task.scheduledAt,
            };
          })
        );

        // 发送通知
        await emailService.notifyCookieExpiring(userId, platform, pendingArticles);

        console.log(`[Scheduler] 用户 ${userId} 的 ${platform} 登录状态已失效，已发送通知`);
      }
    }
  }
}

// 导出单例
export const schedulerService = new SchedulerService();
