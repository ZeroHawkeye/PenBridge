import { t } from "./shared";

// 导入所有子路由
import { adminAuthRouter } from "./routers/adminAuth.router";
import { adminUserRouter } from "./routers/adminUser.router";
import { authRouter } from "./routers/auth.router";
import { juejinAuthRouter } from "./routers/juejinAuth.router";
import { csdnAuthRouter } from "./routers/csdnAuth.router";
import { articleRouter } from "./routers/article.router";
import { syncRouter } from "./routers/sync.router";
import { folderRouter } from "./routers/folder.router";
import { articleExtRouter } from "./routers/articleExt.router";
import { scheduleRouter } from "./routers/schedule.router";
import { emailConfigRouter } from "./routers/emailConfig.router";
import { juejinRouter } from "./routers/juejin.router";
import { csdnRouter } from "./routers/csdn.router";
import { aiConfigRouter } from "./routers/aiConfig.router";
import { aiChatRouter } from "./routers/aiChat.router";
import { dataTransferRouter } from "./routers/dataTransfer.router";
import { copilotAuthRouter } from "./routers/copilotAuth.router";
import { claudeCodeAuthRouter } from "./routers/claudeCodeAuth.router";

// 组合所有路由
export const appRouter = t.router({
  // 健康检查（无需认证）
  health: t.procedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),

  // 管理员认证相关
  adminAuth: adminAuthRouter,

  // 管理员管理（仅超级管理员）
  adminUser: adminUserRouter,

  // 腾讯云认证相关
  auth: authRouter,

  // 掘金认证相关
  juejinAuth: juejinAuthRouter,

  // CSDN 认证相关
  csdnAuth: csdnAuthRouter,

  // 文章相关
  article: articleRouter,

  // 同步相关 - 使用 API 直接调用
  sync: syncRouter,

  // 文件夹相关
  folder: folderRouter,

  // 扩展文章相关接口
  articleExt: articleExtRouter,

  // 定时任务相关
  schedule: scheduleRouter,

  // 邮件配置相关
  emailConfig: emailConfigRouter,

  // 掘金相关
  juejin: juejinRouter,

  // CSDN 相关
  csdn: csdnRouter,

  // AI 配置相关
  aiConfig: aiConfigRouter,

  // AI 聊天相关
  aiChat: aiChatRouter,

  // 数据导入导出
  dataTransfer: dataTransferRouter,

  copilotAuth: copilotAuthRouter,
  claudeCodeAuth: claudeCodeAuthRouter,
});

export type AppRouter = typeof appRouter;
