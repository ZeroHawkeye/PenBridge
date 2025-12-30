// 认证相关工具函数

const AUTH_TOKEN_KEY = "admin_auth_token";
const AUTH_USER_KEY = "admin_auth_user";

// 管理员角色类型
export enum AdminRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
}

// 管理员信息类型
export interface AdminInfo {
  adminId: number;
  username: string;
  role: AdminRole;
}

/**
 * 获取认证 token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * 设置认证 token
 */
export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * 清除认证 token
 */
export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

/**
 * 获取当前用户信息
 */
export function getAuthUser(): AdminInfo | null {
  const userStr = localStorage.getItem(AUTH_USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * 设置当前用户信息
 */
export function setAuthUser(user: AdminInfo): void {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * 检查是否是超级管理员
 */
export function isSuperAdmin(): boolean {
  const user = getAuthUser();
  return user?.role === AdminRole.SUPER_ADMIN;
}
