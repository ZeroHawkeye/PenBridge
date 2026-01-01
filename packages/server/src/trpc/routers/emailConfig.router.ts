import { z } from "zod";
import { t, protectedProcedure } from "../shared";
import { AppDataSource } from "../../db";
import { EmailConfig } from "../../entities/EmailConfig";
import { emailService } from "../../services/emailService";

// 邮件配置相关路由
export const emailConfigRouter = t.router({
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
});
