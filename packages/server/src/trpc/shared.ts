import { initTRPC, TRPCError } from "@trpc/server";
import { validateSession } from "../services/adminAuth";
import { AdminRole } from "../entities/AdminUser";
import { PlatformNotLoggedInError } from "../services/articleSync";

// 创建带有上下文的 tRPC
export interface Context {
  token?: string;
}

export interface AuthedContext extends Context {
  admin: {
    adminId: number;
    username: string;
    role: AdminRole;
  };
}

export const t = initTRPC.context<Context>().create();

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
export const protectedProcedure = t.procedure.use(isAuthed);
export const superAdminProcedure = t.procedure.use(isSuperAdmin);

/**
 * 包装可能抛出平台未登录错误的异步调用
 * 将 PlatformNotLoggedInError 转换为 PRECONDITION_FAILED TRPCError
 */
export async function wrapPlatformCall<T>(fn: () => Promise<T>): Promise<T> {
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
