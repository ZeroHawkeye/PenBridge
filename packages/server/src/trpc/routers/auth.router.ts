import { z } from "zod";
import { t, protectedProcedure } from "../shared";
import {
  waitForManualLogin,
  autoLogin,
  getLoginStatus,
  logout,
  setCookiesFromClient,
} from "../../services/tencentAuth";

// 腾讯云认证相关路由
export const authRouter = t.router({
  // 获取登录状态
  status: protectedProcedure.query(async () => {
    return getLoginStatus();
  }),

  // 手动登录（打开浏览器让用户登录）
  manualLogin: protectedProcedure.mutation(async () => {
    return waitForManualLogin();
  }),

  // 自动登录（使用保存的 cookies）
  autoLogin: protectedProcedure.mutation(async () => {
    return autoLogin();
  }),

  // 登出
  logout: protectedProcedure.mutation(async () => {
    await logout();
    return { success: true };
  }),

  // 从客户端设置 cookies（Electron 客户端调用）
  setCookies: protectedProcedure
    .input(
      z.object({
        cookies: z.string(),
        nickname: z.string().optional(),
        avatarUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return setCookiesFromClient(input.cookies, input.nickname, input.avatarUrl);
    }),
});
