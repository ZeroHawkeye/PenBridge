import Store from "electron-store";

// 用户信息类型
interface UserInfo {
  nickname?: string;
  avatarUrl?: string;
  isLoggedIn: boolean;
}

// 掘金用户信息类型
interface JuejinUserInfo {
  nickname?: string;
  avatarUrl?: string;
  userId?: string;
  isLoggedIn: boolean;
}

// 应用运行模式
export type AppMode = "local" | "cloud" | null;

// 应用模式配置
interface AppModeConfig {
  mode: AppMode;           // 当前运行模式
  isConfigured: boolean;   // 是否已完成首次模式选择
}

// 存储 schema
interface StoreSchema {
  // 腾讯云社区
  cookies: any[];
  userInfo: UserInfo;
  // 掘金
  juejinCookies: any[];
  juejinUserInfo: JuejinUserInfo;
  // 应用模式配置
  appMode: AppModeConfig;
  // 服务器配置（云端模式使用）
  serverConfig: {
    baseUrl: string; // 云端服务器地址，如 http://localhost:3000 或 https://api.example.com
    isConfigured: boolean; // 是否已完成首次配置
  };
}

export function createStore() {
  const store = new Store<StoreSchema>({
    name: "pen-bridge",
    defaults: {
      // 腾讯云社区
      cookies: [],
      userInfo: {
        isLoggedIn: false,
      },
      // 掘金
      juejinCookies: [],
      juejinUserInfo: {
        isLoggedIn: false,
      },
      // 应用模式配置
      appMode: {
        mode: null,
        isConfigured: false,
      },
      // 服务器配置（云端模式）
      serverConfig: {
        baseUrl: "",
        isConfigured: false,
      },
    },
  });

  return store;
}

export type { StoreSchema, UserInfo, JuejinUserInfo, AppModeConfig };
