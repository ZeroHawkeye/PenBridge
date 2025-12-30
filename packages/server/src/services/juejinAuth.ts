import { AppDataSource } from "../db";
import { User } from "../entities/User";
import { createJuejinApiClient } from "./juejinApi";

export interface JuejinLoginResult {
  success: boolean;
  message: string;
  user?: {
    id: number;
    nickname?: string;
    avatarUrl?: string;
    userId?: string;
  };
}

/**
 * 从客户端设置掘金 cookies（Electron 客户端调用）
 */
export async function setJuejinCookiesFromClient(
  cookiesJson: string,
  nickname?: string,
  avatarUrl?: string,
  userId?: string
): Promise<JuejinLoginResult> {
  try {
    const userRepo = AppDataSource.getRepository(User);

    // 如果没有传入用户信息，尝试通过 API 获取
    let finalNickname = nickname;
    let finalAvatarUrl = avatarUrl;
    let finalUserId = userId;

    if (!finalNickname || !finalAvatarUrl) {
      try {
        const apiClient = createJuejinApiClient(cookiesJson);
        const userInfo = await apiClient.getUserInfo();
        if (userInfo) {
          finalNickname = finalNickname || userInfo.user_name;
          finalAvatarUrl = finalAvatarUrl || userInfo.avatar_large;
          finalUserId = finalUserId || userInfo.user_id;
          console.log("[JuejinAuth] 从 API 获取用户信息:", {
            nickname: finalNickname,
            avatarUrl: finalAvatarUrl,
            userId: finalUserId,
          });
        }
      } catch (apiError) {
        console.warn("[JuejinAuth] 获取用户信息失败，使用传入的值:", apiError);
      }
    }

    // 查找或创建用户（使用同一个用户记录，id=1）
    let user = await userRepo.findOne({ where: { id: 1 } });
    if (!user) {
      user = userRepo.create({
        juejinCookies: cookiesJson,
        juejinNickname: finalNickname,
        juejinAvatarUrl: finalAvatarUrl,
        juejinUserId: finalUserId,
        juejinLoggedIn: true,
        juejinLastLoginAt: new Date(),
      });
    } else {
      user.juejinCookies = cookiesJson;
      user.juejinNickname = finalNickname || user.juejinNickname;
      user.juejinAvatarUrl = finalAvatarUrl || user.juejinAvatarUrl;
      user.juejinUserId = finalUserId || user.juejinUserId;
      user.juejinLoggedIn = true;
      user.juejinLastLoginAt = new Date();
    }

    await userRepo.save(user);

    return {
      success: true,
      message: "Cookie 设置成功",
      user: {
        id: user.id,
        nickname: user.juejinNickname,
        avatarUrl: user.juejinAvatarUrl,
        userId: user.juejinUserId,
      },
    };
  } catch (error) {
    console.error("设置掘金 Cookie 失败:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "设置 Cookie 失败",
    };
  }
}

/**
 * 使用保存的 cookies 验证登录状态（自动登录）
 */
export async function juejinAutoLogin(userId: number = 1): Promise<JuejinLoginResult> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });

  if (!user || !user.juejinCookies) {
    return {
      success: false,
      message: "未找到保存的掘金登录信息，请使用客户端登录",
    };
  }

  // 只检查本地状态：有 cookies 且标记为已登录就认为登录有效
  if (user.juejinLoggedIn && user.juejinCookies) {
    console.log("[JuejinAuth] 使用本地保存的登录状态:", {
      nickname: user.juejinNickname,
      avatarUrl: user.juejinAvatarUrl,
    });

    return {
      success: true,
      message: "自动登录成功",
      user: {
        id: user.id,
        nickname: user.juejinNickname,
        avatarUrl: user.juejinAvatarUrl,
        userId: user.juejinUserId,
      },
    };
  }

  return {
    success: false,
    message: "未登录，请使用客户端登录",
  };
}

/**
 * 获取当前掘金登录状态
 */
export async function getJuejinLoginStatus(userId: number = 1): Promise<{
  isLoggedIn: boolean;
  user?: {
    id: number;
    nickname?: string;
    avatarUrl?: string;
    userId?: string;
  };
}> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });

  if (!user) {
    return { isLoggedIn: false };
  }

  return {
    isLoggedIn: user.juejinLoggedIn ?? false,
    user: user.juejinLoggedIn
      ? {
          id: user.id,
          nickname: user.juejinNickname,
          avatarUrl: user.juejinAvatarUrl,
          userId: user.juejinUserId,
        }
      : undefined,
  };
}

/**
 * 掘金登出
 */
export async function juejinLogout(userId: number = 1): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });

  if (user) {
    user.juejinLoggedIn = false;
    user.juejinCookies = undefined;
    await userRepo.save(user);
  }
}

/**
 * 获取掘金 Cookie 的会话信息（包括过期时间）
 */
export async function getJuejinSessionInfo(userId: number = 1): Promise<{
  isValid: boolean;
  remainingDays?: number;
  expiresDate?: string;
} | null> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });

  if (!user || !user.juejinCookies) {
    return null;
  }

  try {
    const apiClient = createJuejinApiClient(user.juejinCookies);
    const sessionInfo = apiClient.parseSidGuard();

    if (!sessionInfo) {
      return { isValid: false };
    }

    return {
      isValid: sessionInfo.remainingDays > 0,
      remainingDays: sessionInfo.remainingDays,
      expiresDate: sessionInfo.expiresDate,
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * 获取掘金 Cookies JSON
 */
export async function getJuejinCookies(userId: number = 1): Promise<string | null> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });

  if (!user || !user.juejinCookies || !user.juejinLoggedIn) {
    return null;
  }

  return user.juejinCookies;
}
