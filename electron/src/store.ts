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

// 存储 schema
interface StoreSchema {
  // 腾讯云社区
  cookies: any[];
  userInfo: UserInfo;
  // 掘金
  juejinCookies: any[];
  juejinUserInfo: JuejinUserInfo;
  // 服务器配置
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
      // 服务器配置
      serverConfig: {
        baseUrl: "",
        isConfigured: false,
      },
    },
  });

  return store;
}

export type { StoreSchema, UserInfo, JuejinUserInfo };
