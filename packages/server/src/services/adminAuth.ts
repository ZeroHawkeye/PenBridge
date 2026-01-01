import { AppDataSource } from "../db";
import { AdminUser, AdminRole } from "../entities/AdminUser";
import { AdminSession } from "../entities/AdminSession";
import { LessThan } from "typeorm";
import bcrypt from "bcryptjs";

// 密码哈希轮数
const SALT_ROUNDS = 10;

// 初始超级管理员配置
const INITIAL_ADMIN = {
  username: "admin",
  password: "Nzlgipe1@rn",
};

/**
 * 密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * 生成简单的 session token
 */
export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

// Session 有效期（7 天）
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 创建 session（持久化到数据库）
 */
export async function createSession(admin: AdminUser): Promise<string> {
  const sessionRepo = AppDataSource.getRepository(AdminSession);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const session = sessionRepo.create({
    token,
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    expiresAt,
  });

  await sessionRepo.save(session);

  return token;
}

/**
 * 验证 session（从数据库查询）
 */
export async function validateSession(token: string): Promise<{
  adminId: number;
  username: string;
  role: AdminRole;
} | null> {
  const sessionRepo = AppDataSource.getRepository(AdminSession);
  const session = await sessionRepo.findOne({ where: { token } });

  if (!session) {
    return null;
  }

  if (new Date() > session.expiresAt) {
    // 删除过期的 session
    await sessionRepo.remove(session);
    return null;
  }

  return {
    adminId: session.adminId,
    username: session.username,
    role: session.role,
  };
}

/**
 * 销毁 session（从数据库删除）
 */
export async function destroySession(token: string): Promise<void> {
  const sessionRepo = AppDataSource.getRepository(AdminSession);
  await sessionRepo.delete({ token });
}

/**
 * 清理过期的 session
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const sessionRepo = AppDataSource.getRepository(AdminSession);
  const result = await sessionRepo.delete({
    expiresAt: LessThan(new Date()),
  });
  return result.affected || 0;
}

/**
 * 初始化超级管理员账户
 * 仅在没有任何管理员时创建
 */
export async function initializeSuperAdmin(): Promise<void> {
  const adminRepo = AppDataSource.getRepository(AdminUser);

  const existingAdmins = await adminRepo.count();
  if (existingAdmins > 0) {
    console.log("管理员账户已存在，跳过初始化");
    return;
  }

  const passwordHash = await hashPassword(INITIAL_ADMIN.password);
  const superAdmin = adminRepo.create({
    username: INITIAL_ADMIN.username,
    passwordHash,
    role: AdminRole.SUPER_ADMIN,
  });

  await adminRepo.save(superAdmin);
  console.log(`超级管理员账户已创建: ${INITIAL_ADMIN.username}`);
}

/**
 * 管理员登录
 */
export async function adminLogin(
  username: string,
  password: string
): Promise<{ token: string; admin: Omit<AdminUser, "passwordHash"> } | null> {
  const adminRepo = AppDataSource.getRepository(AdminUser);

  const admin = await adminRepo.findOne({ where: { username } });
  if (!admin) {
    return null;
  }

  const isValid = await verifyPassword(password, admin.passwordHash);
  if (!isValid) {
    return null;
  }

  // 更新最后登录时间
  admin.lastLoginAt = new Date();
  await adminRepo.save(admin);

  const token = await createSession(admin);

  // 返回不包含密码哈希的管理员信息
  const { passwordHash: _, ...adminInfo } = admin;
  return { token, admin: adminInfo };
}

/**
 * 修改密码
 */
export async function changePassword(
  adminId: number,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  const adminRepo = AppDataSource.getRepository(AdminUser);

  const admin = await adminRepo.findOne({ where: { id: adminId } });
  if (!admin) {
    return false;
  }

  const isValid = await verifyPassword(oldPassword, admin.passwordHash);
  if (!isValid) {
    return false;
  }

  admin.passwordHash = await hashPassword(newPassword);
  await adminRepo.save(admin);

  return true;
}

/**
 * 创建新管理员（仅超级管理员可用）
 */
export async function createAdmin(
  username: string,
  password: string,
  role: AdminRole = AdminRole.ADMIN
): Promise<Omit<AdminUser, "passwordHash">> {
  const adminRepo = AppDataSource.getRepository(AdminUser);

  const existingAdmin = await adminRepo.findOne({ where: { username } });
  if (existingAdmin) {
    throw new Error("用户名已存在");
  }

  const passwordHash = await hashPassword(password);
  const admin = adminRepo.create({
    username,
    passwordHash,
    role,
  });

  await adminRepo.save(admin);

  const { passwordHash: _, ...adminInfo } = admin;
  return adminInfo;
}

/**
 * 获取所有管理员列表
 */
export async function getAllAdmins(): Promise<Omit<AdminUser, "passwordHash">[]> {
  const adminRepo = AppDataSource.getRepository(AdminUser);
  const admins = await adminRepo.find({
    order: { createdAt: "ASC" },
  });

  return admins.map(({ passwordHash: _, ...admin }) => admin);
}

/**
 * 更新管理员信息
 */
export async function updateAdmin(
  adminId: number,
  data: { username?: string; password?: string; role?: AdminRole }
): Promise<Omit<AdminUser, "passwordHash">> {
  const adminRepo = AppDataSource.getRepository(AdminUser);

  const admin = await adminRepo.findOne({ where: { id: adminId } });
  if (!admin) {
    throw new Error("管理员不存在");
  }

  if (data.username && data.username !== admin.username) {
    const existingAdmin = await adminRepo.findOne({
      where: { username: data.username },
    });
    if (existingAdmin) {
      throw new Error("用户名已存在");
    }
    admin.username = data.username;
  }

  if (data.password) {
    admin.passwordHash = await hashPassword(data.password);
  }

  if (data.role !== undefined) {
    admin.role = data.role;
  }

  await adminRepo.save(admin);

  const { passwordHash: _, ...adminInfo } = admin;
  return adminInfo;
}

/**
 * 删除管理员
 */
export async function deleteAdmin(adminId: number): Promise<void> {
  const adminRepo = AppDataSource.getRepository(AdminUser);

  const admin = await adminRepo.findOne({ where: { id: adminId } });
  if (!admin) {
    throw new Error("管理员不存在");
  }

  // 不能删除超级管理员
  if (admin.role === AdminRole.SUPER_ADMIN) {
    // 检查是否是唯一的超级管理员
    const superAdminCount = await adminRepo.count({
      where: { role: AdminRole.SUPER_ADMIN },
    });
    if (superAdminCount <= 1) {
      throw new Error("不能删除唯一的超级管理员");
    }
  }

  await adminRepo.remove(admin);
}
