import Store from "electron-store";

// 存储 schema
interface StoreSchema {
  cookies: any[];
  userInfo: {
    nickname?: string;
    avatarUrl?: string;
    isLoggedIn: boolean;
  };
  // 服务器配置
  serverConfig: {
    baseUrl: string; // 云端服务器地址，如 http://localhost:3000 或 https://api.example.com
    isConfigured: boolean; // 是否已完成首次配置
  };
}

export function createStore() {
  const store = new Store<StoreSchema>({
    name: "tencent-dev-blog",
    defaults: {
      cookies: [],
      userInfo: {
        isLoggedIn: false,
      },
      serverConfig: {
        baseUrl: "",
        isConfigured: false,
      },
    },
  });

  return store;
}

export type { StoreSchema };
