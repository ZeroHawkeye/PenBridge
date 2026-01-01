import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, superAdminProcedure } from "../shared";
import {
  createAdmin,
  getAllAdmins,
  updateAdmin,
  deleteAdmin,
} from "../../services/adminAuth";
import { AdminRole } from "../../entities/AdminUser";

// 管理员管理路由（仅超级管理员）
export const adminUserRouter = t.router({
  // 获取所有管理员列表
  list: superAdminProcedure.query(async () => {
    return getAllAdmins();
  }),

  // 创建管理员
  create: superAdminProcedure
    .input(
      z.object({
        username: z.string().min(1, "请输入用户名"),
        password: z.string().min(6, "密码至少6位"),
        role: z.nativeEnum(AdminRole).default(AdminRole.ADMIN),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await createAdmin(input.username, input.password, input.role);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "创建失败",
        });
      }
    }),

  // 更新管理员
  update: superAdminProcedure
    .input(
      z.object({
        id: z.number(),
        username: z.string().min(1).optional(),
        password: z.string().min(6).optional(),
        role: z.nativeEnum(AdminRole).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      try {
        return await updateAdmin(id, data);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "更新失败",
        });
      }
    }),

  // 删除管理员
  delete: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await deleteAdmin(input.id);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "删除失败",
        });
      }
    }),
});
