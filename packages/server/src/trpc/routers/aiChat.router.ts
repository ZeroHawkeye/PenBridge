import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../shared";
import { AppDataSource } from "../../db";
import { AIChatSession, AIChatMessage, ToolCallRecord } from "../../entities/AIChat";

// AI 聊天相关路由
export const aiChatRouter = t.router({
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
          status: z.enum(["pending", "running", "completed", "failed", "awaiting_confirmation"]),
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
});
