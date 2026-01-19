import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../shared";
import { AppDataSource } from "../../db";
import { ClaudeCodeAuth } from "../../entities/ClaudeCodeAuth";
import { AIProvider, AIModel } from "../../entities/AIProvider";
import {
  generatePKCE,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
} from "../../services/claudeCodeAuth";
import { getClaudeCodeModels, refreshModelsCache } from "../../services/claudeCodeModels";

const pendingOAuthFlows = new Map<
  number,
  {
    verifier: string;
    challenge: string;
    subscriptionType: "max" | "pro";
    expiresAt: number;
  }
>();

export const claudeCodeAuthRouter = t.router({
  getStatus: protectedProcedure.query(async () => {
    const repo = AppDataSource.getRepository(ClaudeCodeAuth);
    const auth = await repo.findOne({ where: { userId: 1 } });

    if (!auth) {
      return { connected: false };
    }

    const isExpired = auth.authType === "oauth" && auth.expiresAt < Date.now();

    return {
      connected: true,
      authType: auth.authType,
      subscriptionType: auth.subscriptionType,
      email: auth.email,
      isExpired,
      expiresAt: auth.expiresAt,
    };
  }),

  startOAuthFlow: protectedProcedure
    .input(
      z.object({
        subscriptionType: z.enum(["max", "pro"]).default("max"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const pkce = generatePKCE();
        const authorizeUrl = buildAuthorizeUrl(
          pkce.challenge,
          pkce.verifier,
          input.subscriptionType === "max"
        );

        pendingOAuthFlows.set(1, {
          verifier: pkce.verifier,
          challenge: pkce.challenge,
          subscriptionType: input.subscriptionType,
          expiresAt: Date.now() + 10 * 60 * 1000,
        });

        const repo = AppDataSource.getRepository(ClaudeCodeAuth);
        let auth = await repo.findOne({ where: { userId: 1 } });

        if (auth) {
          auth.codeVerifier = pkce.verifier;
          auth.subscriptionType = input.subscriptionType;
        } else {
          auth = repo.create({
            userId: 1,
            authType: "oauth",
            accessToken: "",
            expiresAt: 0,
            codeVerifier: pkce.verifier,
            subscriptionType: input.subscriptionType,
          });
        }
        await repo.save(auth);

        return {
          authorizeUrl,
          expiresIn: 600,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "启动 OAuth 流程失败",
        });
      }
    }),

  completeOAuthFlow: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const pendingFlow = pendingOAuthFlows.get(1);
      const repo = AppDataSource.getRepository(ClaudeCodeAuth);
      const auth = await repo.findOne({ where: { userId: 1 } });

      const verifier = pendingFlow?.verifier || auth?.codeVerifier;

      if (!verifier) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "没有找到待处理的 OAuth 流程，请重新开始授权",
        });
      }

      if (pendingFlow && Date.now() > pendingFlow.expiresAt) {
        pendingOAuthFlows.delete(1);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OAuth 流程已过期，请重新开始",
        });
      }

      try {
        const tokens = await exchangeCodeForTokens(input.code, verifier);

        pendingOAuthFlows.delete(1);

        if (auth) {
          auth.authType = "oauth";
          auth.accessToken = tokens.access_token;
          auth.refreshToken = tokens.refresh_token;
          auth.expiresAt = Date.now() + tokens.expires_in * 1000;
          auth.codeVerifier = undefined;
        } else {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "认证记录丢失",
          });
        }

        await repo.save(auth);

        await ensureClaudeCodeProvider();

        return {
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "完成 OAuth 授权失败",
        });
      }
    }),

  cancelOAuthFlow: protectedProcedure.mutation(async () => {
    pendingOAuthFlows.delete(1);
    const repo = AppDataSource.getRepository(ClaudeCodeAuth);
    const auth = await repo.findOne({ where: { userId: 1 } });
    if (auth && auth.codeVerifier) {
      auth.codeVerifier = undefined;
      await repo.save(auth);
    }
    return { success: true };
  }),

  saveApiKey: protectedProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const repo = AppDataSource.getRepository(ClaudeCodeAuth);
      let auth = await repo.findOne({ where: { userId: 1 } });

      if (auth) {
        auth.authType = "api_key";
        auth.accessToken = input.apiKey;
        auth.refreshToken = undefined;
        auth.expiresAt = 0;
        auth.codeVerifier = undefined;
        auth.subscriptionType = undefined;
      } else {
        auth = repo.create({
          userId: 1,
          authType: "api_key",
          accessToken: input.apiKey,
          expiresAt: 0,
        });
      }

      await repo.save(auth);

      await ensureClaudeCodeProvider();

      return { success: true };
    }),

  refreshToken: protectedProcedure.mutation(async () => {
    const repo = AppDataSource.getRepository(ClaudeCodeAuth);
    const auth = await repo.findOne({ where: { userId: 1 } });

    if (!auth) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "未连接 Claude Code",
      });
    }

    if (auth.authType === "api_key") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "API Key 方式无需刷新 Token",
      });
    }

    if (!auth.refreshToken) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "没有可用的 refresh_token",
      });
    }

    try {
      const newTokens = await refreshAccessToken(auth.refreshToken);

      auth.accessToken = newTokens.access_token;
      auth.refreshToken = newTokens.refresh_token || auth.refreshToken;
      auth.expiresAt = Date.now() + newTokens.expires_in * 1000;
      await repo.save(auth);

      return {
        success: true,
        expiresAt: auth.expiresAt,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "刷新 Token 失败",
      });
    }
  }),

  disconnect: protectedProcedure.mutation(async () => {
    const repo = AppDataSource.getRepository(ClaudeCodeAuth);
    await repo.delete({ userId: 1 });

    const providerRepo = AppDataSource.getRepository(AIProvider);
    const modelRepo = AppDataSource.getRepository(AIModel);

    const provider = await providerRepo.findOne({
      where: { userId: 1, sdkType: "claude-code" },
    });

    if (provider) {
      await modelRepo.delete({ providerId: provider.id });
      await providerRepo.delete({ id: provider.id });
    }

    return { success: true };
  }),

  getModels: protectedProcedure.query(async () => {
    return getClaudeCodeModels();
  }),

  refreshModels: protectedProcedure.mutation(async () => {
    const models = await refreshModelsCache();
    return { success: true, count: models.length };
  }),

  getAuthInfo: protectedProcedure.query(async () => {
    const repo = AppDataSource.getRepository(ClaudeCodeAuth);
    const auth = await repo.findOne({ where: { userId: 1 } });

    if (!auth) {
      return null;
    }

    return {
      authType: auth.authType,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresAt: auth.expiresAt,
      subscriptionType: auth.subscriptionType,
    };
  }),

  testDirectRequest: protectedProcedure
    .input(
      z.object({
        includeClaudeCodeBeta: z.boolean().default(false),
      }).optional()
    )
    .mutation(async ({ input }) => {
    const repo = AppDataSource.getRepository(ClaudeCodeAuth);
    const auth = await repo.findOne({ where: { userId: 1 } });

    if (!auth || auth.authType !== "oauth") {
      return { error: "需要 OAuth 认证" };
    }

    const includeClaudeCodeBeta = input?.includeClaudeCodeBeta ?? false;

    const requestBody = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [{ role: "user", content: "Say hello" }],
      stream: false,
    };

    const betaFlags = includeClaudeCodeBeta
      ? "oauth-2025-04-20,interleaved-thinking-2025-05-14,claude-code-20250219"
      : "oauth-2025-04-20,interleaved-thinking-2025-05-14";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${auth.accessToken}`,
      "anthropic-beta": betaFlags,
      "anthropic-version": "2023-06-01",
      "user-agent": "claude-cli/2.1.2 (external, cli)",
    };

    console.log("[TestDirectRequest] 发送请求...");
    console.log("[TestDirectRequest] includeClaudeCodeBeta:", includeClaudeCodeBeta);
    console.log("[TestDirectRequest] Headers:", headers);
    console.log("[TestDirectRequest] Body:", requestBody);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages?beta=true", {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log("[TestDirectRequest] 响应状态:", response.status);
      console.log("[TestDirectRequest] 响应内容:", responseText);

      return {
        status: response.status,
        body: responseText,
        betaFlags,
      };
    } catch (error) {
      console.error("[TestDirectRequest] 错误:", error);
      return {
        error: error instanceof Error ? error.message : "请求失败",
      };
    }
  }),
});

async function ensureClaudeCodeProvider() {
  const providerRepo = AppDataSource.getRepository(AIProvider);
  const modelRepo = AppDataSource.getRepository(AIModel);

  let provider = await providerRepo.findOne({
    where: { userId: 1, sdkType: "claude-code" },
  });

  if (!provider) {
    const maxOrderResult = await providerRepo
      .createQueryBuilder("provider")
      .select("MAX(provider.order)", "maxOrder")
      .where("provider.userId = :userId", { userId: 1 })
      .getRawOne();

    provider = providerRepo.create({
      userId: 1,
      name: "Claude Code",
      baseUrl: "https://api.anthropic.com",
      apiKey: "",
      sdkType: "claude-code",
      enabled: true,
      order: (maxOrderResult?.maxOrder ?? -1) + 1,
    });

    await providerRepo.save(provider);

    const models = await getClaudeCodeModels();
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      const isDefaultModel = m.id.includes("sonnet-4") || m.id.includes("sonnet-4-");
      const model = modelRepo.create({
        userId: 1,
        providerId: provider.id,
        modelId: m.id,
        displayName: m.name,
        isDefault: i === 0 || isDefaultModel,
        enabled: true,
        order: i,
        contextLength: m.contextLength,
        capabilities: {
          reasoning: m.reasoning || false,
          streaming: true,
          functionCalling: m.functionCalling,
          vision: m.vision,
        },
        aiLoopConfig: {
          maxLoops: 20,
          unlimited: false,
        },
      });
      await modelRepo.save(model);
    }
  }

  return provider;
}
