import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../shared";
import { AppDataSource } from "../../db";
import { AIProvider, AIModel, defaultCapabilities, defaultAILoopConfig } from "../../entities/AIProvider";

// 模型能力 schema
const capabilitiesSchema = z.object({
  reasoning: z.boolean().default(false),
  streaming: z.boolean().default(true),
  functionCalling: z.boolean().default(true),
  vision: z.boolean().default(false),
});

// AI Loop 配置 schema
const aiLoopConfigSchema = z.object({
  maxLoops: z.number().min(1).max(100).default(20),
  unlimited: z.boolean().default(false),
});

// 模型参数 schema
const parametersSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
});

// AI 配置相关路由
export const aiConfigRouter = t.router({
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
        sdkType: z.enum(["openai", "openai-compatible"]).default("openai-compatible"),
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
        sdkType: z.enum(["openai", "openai-compatible"]).optional(),
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
        contextLength: z.number().min(1).nullish().transform(val => val ?? undefined),
        parameters: parametersSchema.optional(),
        capabilities: capabilitiesSchema.optional(),
        aiLoopConfig: aiLoopConfigSchema.optional(),
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
        capabilities: input.capabilities || defaultCapabilities,
        aiLoopConfig: input.aiLoopConfig || defaultAILoopConfig,
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
        contextLength: z.number().min(1).nullish().transform(val => val ?? undefined),
        parameters: parametersSchema.optional(),
        capabilities: capabilitiesSchema.optional(),
        aiLoopConfig: aiLoopConfigSchema.optional(),
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
        sdkType: provider.sdkType,
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
});
