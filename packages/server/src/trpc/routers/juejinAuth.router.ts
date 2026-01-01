import { z } from "zod";
import { t, protectedProcedure } from "../shared";
import {
  setJuejinCookiesFromClient,
  juejinAutoLogin,
  getJuejinLoginStatus,
  juejinLogout,
  getJuejinSessionInfo,
} from "../../services/juejinAuth";

// 掘金认证相关路由
export const juejinAuthRouter = t.router({
  // 获取登录状态
  status: protectedProcedure.query(async () => {
    return getJuejinLoginStatus();
  }),

  // 自动登录（使用保存的 cookies）
  autoLogin: protectedProcedure.mutation(async () => {
    return juejinAutoLogin();
  }),

  // 登出
  logout: protectedProcedure.mutation(async () => {
    await juejinLogout();
    return { success: true };
  }),

  // 从客户端设置 cookies（Electron 客户端调用）
  setCookies: protectedProcedure
    .input(
      z.object({
        cookies: z.string(),
        nickname: z.string().optional(),
        avatarUrl: z.string().optional(),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return setJuejinCookiesFromClient(
        input.cookies,
        input.nickname,
        input.avatarUrl,
        input.userId
      );
    }),

  // 获取会话信息（包括过期时间）
  sessionInfo: protectedProcedure.query(async () => {
    return getJuejinSessionInfo();
  }),
});
