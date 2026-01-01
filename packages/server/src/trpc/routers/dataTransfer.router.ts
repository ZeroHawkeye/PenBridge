import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../shared";
import {
  exportDataToZip,
  importDataFromZip,
  previewZipData,
  getImageStats,
} from "../../services/dataExportImport";

// 数据导入导出路由
export const dataTransferRouter = t.router({
  // 导出数据为 ZIP（返回 base64 编码的 ZIP 数据）
  export: protectedProcedure
    .input(
      z.object({
        includeSensitiveData: z.boolean().default(false),
        encryptionPassword: z.string().optional(),
        includeArticles: z.boolean().default(true),
        includeFolders: z.boolean().default(true),
        includeUsers: z.boolean().default(true),
        includeAdminUsers: z.boolean().default(true),
        includeAIConfig: z.boolean().default(true),
        includeEmailConfig: z.boolean().default(true),
        includeScheduledTasks: z.boolean().default(true),
        includeImages: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const zipBuffer = await exportDataToZip(input);
        // 转换为 base64 以便通过 JSON 传输
        const base64Data = zipBuffer.toString("base64");
        return {
          success: true,
          data: base64Data,
          message: "导出成功",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "导出失败",
        });
      }
    }),

  // 从 ZIP 导入数据
  import: protectedProcedure
    .input(
      z.object({
        zipData: z.string(), // base64 编码的 ZIP 数据
        decryptionPassword: z.string().optional(),
        overwriteExisting: z.boolean().default(false),
        importArticles: z.boolean().default(true),
        importFolders: z.boolean().default(true),
        importUsers: z.boolean().default(true),
        importAdminUsers: z.boolean().default(true),
        importAIConfig: z.boolean().default(true),
        importEmailConfig: z.boolean().default(true),
        importScheduledTasks: z.boolean().default(true),
        importImages: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const { zipData, ...options } = input;
      try {
        // 将 base64 转换回 Buffer
        const zipBuffer = Buffer.from(zipData, "base64");
        const result = await importDataFromZip(zipBuffer, options);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "导入失败",
        });
      }
    }),

  // 预览 ZIP 文件内容（不实际导入，只返回统计信息）
  preview: protectedProcedure
    .input(
      z.object({
        zipData: z.string(), // base64 编码的 ZIP 数据
        decryptionPassword: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const zipBuffer = Buffer.from(input.zipData, "base64");
        const result = await previewZipData(zipBuffer, input.decryptionPassword);

        if (!result.success) {
          throw new Error(result.message);
        }

        return {
          success: true,
          stats: {
            version: result.metadata?.version || "未知",
            appVersion: result.metadata?.appVersion || "未知",
            exportedAt: result.metadata?.exportedAt || "未知",
            encrypted: result.metadata?.encrypted || false,
            includeSensitiveData: result.metadata?.includeSensitiveData || false,
            counts: result.counts,
          },
          message: "预览成功",
        };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "解析失败",
        });
      }
    }),

  // 获取当前图片统计信息（用于导出预览）
  getImageStats: protectedProcedure.query(() => {
    return getImageStats();
  }),
});
