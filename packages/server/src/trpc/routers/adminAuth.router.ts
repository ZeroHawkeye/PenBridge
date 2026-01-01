import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../shared";
import {
  adminLogin,
  validateSession,
  destroySession,
  changePassword,
} from "../../services/adminAuth";

// 管理员认证相关路由
export const adminAuthRouter = t.router({
  // 管理员登录
  login: t.procedure
    .input(
      z.object({
        username: z.string().min(1, "请输入用户名"),
        password: z.string().min(1, "请输入密码"),
      })
    )
    .mutation(async ({ input }) => {
      const result = await adminLogin(input.username, input.password);
      if (!result) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }
      return result;
    }),

  // 验证当前 session
  validate: t.procedure.query(async ({ ctx }) => {
    if (!ctx.token) {
      return { valid: false, admin: null };
    }
    const session = await validateSession(ctx.token);
    if (!session) {
      return { valid: false, admin: null };
    }
    return { valid: true, admin: session };
  }),

  // 登出
  logout: t.procedure.mutation(async ({ ctx }) => {
    if (ctx.token) {
      await destroySession(ctx.token);
    }
    return { success: true };
  }),

  // 修改自己的密码
  changePassword: protectedProcedure
    .input(
      z.object({
        oldPassword: z.string().min(1, "请输入原密码"),
        newPassword: z.string().min(6, "新密码至少6位"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const success = await changePassword(
        (ctx as any).admin.adminId,
        input.oldPassword,
        input.newPassword
      );
      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "原密码错误",
        });
      }
      return { success: true };
    }),
});
