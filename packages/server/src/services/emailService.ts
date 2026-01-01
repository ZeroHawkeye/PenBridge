/**
 * 邮件发送服务
 * 使用 SMTP 发送通知邮件
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { AppDataSource } from "../db";
import { EmailConfig } from "../entities/EmailConfig";
import { ScheduledTask, TaskStatus } from "../entities/ScheduledTask";
import { Article } from "../entities/Article";

/**
 * 邮件模板类型
 */
export type EmailTemplateType =
  | "publish_success"
  | "publish_failed"
  | "cookie_expired"
  | "test";

/**
 * 邮件模板参数
 */
export interface EmailTemplateParams {
  articleTitle?: string;
  articleUrl?: string;
  errorMessage?: string;
  platform?: string;
  scheduledTime?: string;
  executedTime?: string;
}

/**
 * 邮件服务类
 */
export class EmailService {
  // 使用 getter 懒加载，避免模块加载时数据库未初始化的问题
  private get emailConfigRepo() {
    return AppDataSource.getRepository(EmailConfig);
  }

  /**
   * 创建邮件传输器
   */
  private createTransporter(config: EmailConfig): Transporter {
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 465,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }

  /**
   * 获取用户的邮件配置
   */
  async getEmailConfig(userId: number): Promise<EmailConfig | null> {
    return this.emailConfigRepo.findOne({ where: { userId } });
  }

  /**
   * 检查邮件配置是否有效
   */
  isConfigValid(config: EmailConfig | null): boolean {
    if (!config || !config.enabled) return false;
    return !!(
      config.smtpHost &&
      config.smtpPort &&
      config.smtpUser &&
      config.smtpPass &&
      config.notifyEmail
    );
  }

  /**
   * 生成邮件内容
   */
  private generateEmailContent(
    type: EmailTemplateType,
    params: EmailTemplateParams
  ): { subject: string; html: string } {
    const platformName = this.getPlatformName(params.platform || "tencent");

    switch (type) {
      case "publish_success":
        return {
          subject: `[发布成功] ${params.articleTitle || "文章"}`,
          html: `
            <div style="font-family: 'Microsoft YaHei', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #52c41a; border-bottom: 2px solid #52c41a; padding-bottom: 10px;">
                文章发布成功
              </h2>
              <div style="background: #f6ffed; border: 1px solid #b7eb8f; border-radius: 4px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 8px 0;"><strong>文章标题：</strong>${params.articleTitle || "未知"}</p>
                <p style="margin: 0 0 8px 0;"><strong>发布平台：</strong>${platformName}</p>
                <p style="margin: 0 0 8px 0;"><strong>计划时间：</strong>${params.scheduledTime || "立即发布"}</p>
                <p style="margin: 0 0 8px 0;"><strong>执行时间：</strong>${params.executedTime || new Date().toLocaleString("zh-CN")}</p>
                ${params.articleUrl ? `<p style="margin: 0;"><strong>文章链接：</strong><a href="${params.articleUrl}" style="color: #1890ff;">${params.articleUrl}</a></p>` : ""}
              </div>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                此邮件由 PenBridge 多平台文章管理工具自动发送
              </p>
            </div>
          `,
        };

      case "publish_failed":
        return {
          subject: `[发布失败] ${params.articleTitle || "文章"}`,
          html: `
            <div style="font-family: 'Microsoft YaHei', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #ff4d4f; border-bottom: 2px solid #ff4d4f; padding-bottom: 10px;">
                文章发布失败
              </h2>
              <div style="background: #fff2f0; border: 1px solid #ffccc7; border-radius: 4px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 8px 0;"><strong>文章标题：</strong>${params.articleTitle || "未知"}</p>
                <p style="margin: 0 0 8px 0;"><strong>发布平台：</strong>${platformName}</p>
                <p style="margin: 0 0 8px 0;"><strong>计划时间：</strong>${params.scheduledTime || "未设置"}</p>
                <p style="margin: 0 0 8px 0;"><strong>执行时间：</strong>${params.executedTime || new Date().toLocaleString("zh-CN")}</p>
                <p style="margin: 0; color: #ff4d4f;"><strong>错误信息：</strong>${params.errorMessage || "未知错误"}</p>
              </div>
              <p style="color: #666; font-size: 14px;">
                请检查文章内容和发布配置，或重新登录平台后再试。
              </p>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                此邮件由 PenBridge 多平台文章管理工具自动发送
              </p>
            </div>
          `,
        };

      case "cookie_expired":
        return {
          subject: `[登录失效] ${platformName}登录状态已过期`,
          html: `
            <div style="font-family: 'Microsoft YaHei', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #faad14; border-bottom: 2px solid #faad14; padding-bottom: 10px;">
                登录状态已过期
              </h2>
              <div style="background: #fffbe6; border: 1px solid #ffe58f; border-radius: 4px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 8px 0;"><strong>平台：</strong>${platformName}</p>
                <p style="margin: 0 0 8px 0;"><strong>检测时间：</strong>${new Date().toLocaleString("zh-CN")}</p>
                ${params.articleTitle ? `<p style="margin: 0 0 8px 0;"><strong>待发布文章：</strong>${params.articleTitle}</p>` : ""}
                ${params.scheduledTime ? `<p style="margin: 0;"><strong>计划发布时间：</strong>${params.scheduledTime}</p>` : ""}
              </div>
              <p style="color: #666; font-size: 14px;">
                <strong>请尽快重新登录平台</strong>，否则定时发布任务将无法执行。
              </p>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                此邮件由 PenBridge 多平台文章管理工具自动发送
              </p>
            </div>
          `,
        };

      case "test":
        return {
          subject: "[测试邮件] 邮件配置测试",
          html: `
            <div style="font-family: 'Microsoft YaHei', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 10px;">
                邮件配置测试成功
              </h2>
              <div style="background: #e6f7ff; border: 1px solid #91d5ff; border-radius: 4px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0;">
                  恭喜！您的邮件通知配置已成功设置。
                </p>
              </div>
              <p style="color: #666; font-size: 14px;">
                当定时发布任务执行完成或出现异常时，您将收到邮件通知。
              </p>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                此邮件由 PenBridge 多平台文章管理工具自动发送
              </p>
            </div>
          `,
        };

      default:
        return {
          subject: "通知",
          html: "<p>通知内容</p>",
        };
    }
  }

  /**
   * 获取平台显示名称
   */
  private getPlatformName(platform: string): string {
    const platformNames: Record<string, string> = {
      tencent: "腾讯云开发者社区",
      juejin: "掘金",
      csdn: "CSDN",
    };
    return platformNames[platform] || platform;
  }

  /**
   * 发送邮件
   */
  async sendEmail(
    userId: number,
    type: EmailTemplateType,
    params: EmailTemplateParams
  ): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getEmailConfig(userId);

      if (!this.isConfigValid(config)) {
        return { success: false, message: "邮件配置未启用或不完整" };
      }

      // 检查是否需要发送此类型的通知
      if (type === "publish_success" && !config!.notifyOnSuccess) {
        return { success: false, message: "未启用成功通知" };
      }
      if (type === "publish_failed" && !config!.notifyOnFailed) {
        return { success: false, message: "未启用失败通知" };
      }
      if (type === "cookie_expired" && !config!.notifyOnCookieExpired) {
        return { success: false, message: "未启用 Cookie 失效通知" };
      }

      const transporter = this.createTransporter(config!);
      const { subject, html } = this.generateEmailContent(type, params);

      await transporter.sendMail({
        from: config!.fromEmail
          ? `"${config!.fromName || "文章管理工具"}" <${config!.fromEmail}>`
          : config!.smtpUser,
        to: config!.notifyEmail,
        subject,
        html,
      });

      console.log(`[EmailService] 邮件发送成功: ${type} -> ${config!.notifyEmail}`);
      return { success: true, message: "邮件发送成功" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "发送失败";
      console.error(`[EmailService] 邮件发送失败: ${message}`);
      return { success: false, message };
    }
  }

  /**
   * 发送测试邮件
   */
  async sendTestEmail(userId: number): Promise<{ success: boolean; message: string }> {
    return this.sendEmail(userId, "test", {});
  }

  /**
   * 发送任务执行结果通知
   */
  async notifyTaskResult(task: ScheduledTask): Promise<void> {
    try {
      const articleRepo = AppDataSource.getRepository(Article);
      const article = await articleRepo.findOne({ where: { id: task.articleId } });

      const params: EmailTemplateParams = {
        articleTitle: article?.title || "未知文章",
        articleUrl: task.resultUrl,
        errorMessage: task.errorMessage,
        platform: task.platform,
        scheduledTime: task.scheduledAt.toLocaleString("zh-CN"),
        executedTime: task.executedAt?.toLocaleString("zh-CN"),
      };

      if (task.status === TaskStatus.SUCCESS) {
        await this.sendEmail(task.userId, "publish_success", params);
      } else if (task.status === TaskStatus.FAILED) {
        // 检查是否是 Cookie 失效导致的失败
        const isCookieExpired =
          task.errorMessage?.includes("未登录") ||
          task.errorMessage?.includes("登录") ||
          task.errorMessage?.includes("Cookie") ||
          task.errorMessage?.includes("1001");

        if (isCookieExpired) {
          await this.sendEmail(task.userId, "cookie_expired", params);
        } else {
          await this.sendEmail(task.userId, "publish_failed", params);
        }
      }
    } catch (error) {
      console.error("[EmailService] 发送任务通知失败:", error);
    }
  }

  /**
   * 发送 Cookie 即将过期预警
   */
  async notifyCookieExpiring(
    userId: number,
    platform: string,
    pendingTasks: Array<{ title: string; scheduledAt: Date }>
  ): Promise<void> {
    try {
      const params: EmailTemplateParams = {
        platform,
        articleTitle: pendingTasks.map((t) => t.title).join("、"),
        scheduledTime: pendingTasks
          .map((t) => t.scheduledAt.toLocaleString("zh-CN"))
          .join("、"),
      };

      await this.sendEmail(userId, "cookie_expired", params);
    } catch (error) {
      console.error("[EmailService] 发送 Cookie 过期预警失败:", error);
    }
  }

  /**
   * 验证 SMTP 配置是否正确
   */
  async verifySmtpConfig(config: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPass: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });

      await transporter.verify();
      return { success: true, message: "SMTP 配置验证成功" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "验证失败";
      return { success: false, message: `SMTP 配置验证失败: ${message}` };
    }
  }
}

// 导出单例
export const emailService = new EmailService();
