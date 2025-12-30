import { AppDataSource } from "../db";
import { User } from "../entities/User";
import { createTencentApiClient } from "./tencentApi";

const TENCENT_DEVELOPER_URL = "https://cloud.tencent.com/developer";
const TENCENT_CREATOR_URL = "https://cloud.tencent.com/developer/creator";

export interface LoginResult {
  success: boolean;
  message: string;
  user?: {
    id: number;
    nickname?: string;
    avatarUrl?: string;
  };
}

// 从客户端设置 cookies（Electron 客户端调用）
export async function setCookiesFromClient(
  cookiesJson: string,
  nickname?: string,
  avatarUrl?: string
): Promise<LoginResult> {
  try {
    const userRepo = AppDataSource.getRepository(User);

    // 如果没有传入 nickname 或 avatarUrl，则通过 API 获取
    let finalNickname = nickname;
    let finalAvatarUrl = avatarUrl;

    if (!finalNickname || !finalAvatarUrl) {
      try {
        const apiClient = createTencentApiClient(cookiesJson);
        const session = await apiClient.getUserSession();
        if (session.isLogined && session.userInfo) {
          finalNickname = finalNickname || session.userInfo.nickname;
          finalAvatarUrl = finalAvatarUrl || session.userInfo.avatarUrl;
          console.log("[TencentAuth] 从 API 获取用户信息:", {
            nickname: finalNickname,
            avatarUrl: finalAvatarUrl,
          });
        }
      } catch (apiError) {
        console.warn("[TencentAuth] 获取用户信息失败，使用传入的值:", apiError);
      }
    }

    // 查找或创建用户
    let user = await userRepo.findOne({ where: { id: 1 } });
    if (!user) {
      user = userRepo.create({
        nickname: finalNickname,
        avatarUrl: finalAvatarUrl,
        cookies: cookiesJson,
        isLoggedIn: true,
        lastLoginAt: new Date(),
      });
    } else {
      user.nickname = finalNickname || user.nickname;
      user.avatarUrl = finalAvatarUrl || user.avatarUrl;
      user.cookies = cookiesJson;
      user.isLoggedIn = true;
      user.lastLoginAt = new Date();
    }

    await userRepo.save(user);

    return {
      success: true,
      message: "Cookie 设置成功",
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
      },
    };
  } catch (error) {
    console.error("设置 Cookie 失败:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "设置 Cookie 失败",
    };
  }
}

// 等待用户手动登录（已废弃，改用 Electron 客户端登录）
// 保留此函数以兼容旧代码，但会返回错误提示
export async function waitForManualLogin(): Promise<LoginResult> {
  return {
    success: false,
    message: "请使用 Electron 客户端进行登录，或手动设置 Cookie",
  };
}

// 使用保存的 cookies 验证登录状态
// 注意：只要本地有 cookies 且 isLoggedIn=true，就认为已登录
// 不主动调用 API 验证，避免因网络问题或临时失效导致登录状态丢失
// 只有用户主动 logout 才会清除登录状态
export async function autoLogin(userId: number = 1): Promise<LoginResult> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });

  if (!user || !user.cookies) {
    return {
      success: false,
      message: "未找到保存的登录信息，请使用客户端登录",
    };
  }

  // 只检查本地状态：有 cookies 且标记为已登录就认为登录有效
  if (user.isLoggedIn && user.cookies) {
    console.log("[TencentAuth] 使用本地保存的登录状态:", {
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    });

    return {
      success: true,
      message: "自动登录成功",
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  return {
    success: false,
    message: "未登录，请使用客户端登录",
  };
}

// 获取当前登录状态
export async function getLoginStatus(userId: number = 1): Promise<{
  isLoggedIn: boolean;
  user?: { id: number; nickname?: string; avatarUrl?: string };
}> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });
  
  if (!user) {
    return { isLoggedIn: false };
  }
  
  return {
    isLoggedIn: user.isLoggedIn,
    user: user.isLoggedIn
      ? {
          id: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
        }
      : undefined,
  };
}

// 登出
export async function logout(userId: number = 1): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });

  if (user) {
    user.isLoggedIn = false;
    user.cookies = undefined;
    await userRepo.save(user);
  }
}
