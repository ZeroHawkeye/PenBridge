import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createRouter,
  createHashHistory,
} from "@tanstack/react-router";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./utils/trpc";
import { routeTree } from "./routeTree.gen";
import { getAuthToken, clearAuthToken } from "./utils/auth";
import { getTrpcUrl, initServerConfig } from "./utils/serverConfig";

import "./index.css";

// 隐藏首屏加载提示
function hideAppLoading() {
  const loading = document.getElementById("app-loading");
  if (loading) {
    loading.classList.add("hidden");
    // 动画结束后移除元素
    setTimeout(() => loading.remove(), 300);
  }
}

// 创建 QueryClient（不依赖服务器配置，可以提前创建）
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 优化查询缓存，减少不必要的请求
        staleTime: 1000 * 60, // 1分钟内数据视为新鲜
        retry: (failureCount, error: any) => {
          // 如果是认证错误，不重试
          if (error?.data?.code === "UNAUTHORIZED") {
            return false;
          }
          return failureCount < 1;
        },
        onError: (error: any) => {
          // 如果是认证错误，清除 token 并跳转登录页
          if (error?.data?.code === "UNAUTHORIZED") {
            clearAuthToken();
            if (!window.location.hash.includes("/login")) {
              window.location.href = window.location.pathname + "#/login";
            }
          }
        },
      },
      mutations: {
        onError: (error: any) => {
          // 如果是认证错误，清除 token 并跳转登录页
          if (error?.data?.code === "UNAUTHORIZED") {
            clearAuthToken();
            if (!window.location.hash.includes("/login")) {
              window.location.href = window.location.pathname + "#/login";
            }
          }
        },
      },
    },
  });
}

// 创建 tRPC 客户端（必须在 initServerConfig 之后调用，确保 localStorage 已同步）
function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        // 动态获取服务器地址（此时 localStorage 已经同步完成）
        url: getTrpcUrl(),
        headers: () => {
          const token = getAuthToken();
          if (token) {
            return {
              Authorization: `Bearer ${token}`,
            };
          }
          return {};
        },
      }),
    ],
  });
}

// 使用 Hash History 以支持 Electron file:// 协议
// 这样 URL 会变成 index.html#/articles 而不是 /articles
const hashHistory = createHashHistory();

const router = createRouter({
  routeTree,
  history: hashHistory,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// 注册全局快捷键
function registerGlobalShortcuts() {
  document.addEventListener("keydown", (event) => {
    // Ctrl+R 完整刷新页面
    if (event.ctrlKey && event.key === "r") {
      event.preventDefault();
      window.location.reload();
    }
  });
}

// 初始化并渲染应用
async function initApp() {
  // 注册全局快捷键
  registerGlobalShortcuts();

  // 初始化服务器配置（从 Electron 同步到 localStorage）
  // 必须在创建 tRPC 客户端之前完成
  await initServerConfig();

  // 在配置初始化完成后创建客户端
  const queryClient = createQueryClient();
  const trpcClient = createTrpcClient();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </trpc.Provider>
    </React.StrictMode>
  );

  // React 渲染完成后隐藏加载提示
  hideAppLoading();
}

initApp();
