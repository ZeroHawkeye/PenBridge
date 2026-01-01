import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

// 根据构建目标设置 base 路径
// - Electron 打包：使用相对路径 "./"（file:// 协议）
// - Docker/Web 部署：使用绝对路径 "/"（HTTP 协议）
const isElectron = process.env.BUILD_TARGET === "electron";

export default defineConfig({
  plugins: [
    // TanStack Router 插件需要在 React 插件之前
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    // 复制拼写检查词典文件到构建目录
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/dictionary-en/index.aff",
          dest: "dict",
        },
        {
          src: "node_modules/dictionary-en/index.dic",
          dest: "dict",
        },
      ],
    }),
  ],
  // Electron 打包使用相对路径，Docker/Web 部署使用绝对路径
  base: isElectron ? "./" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ["mammoth"],
  },
  server: {
    port: 5173,
  },
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 React 相关库打包到一起
          "react-vendor": ["react", "react-dom"],
          // 将 Ant Design 单独打包
          "antd-vendor": ["antd", "@ant-design/icons"],
          // 将路由相关库打包
          "router-vendor": ["@tanstack/react-router"],
          // 将 tRPC 和 React Query 打包
          "query-vendor": ["@trpc/client", "@trpc/react-query", "@tanstack/react-query"],
          // 将 radix-ui 组件打包
          "radix-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-separator",
            "@radix-ui/react-tabs",
            "@radix-ui/react-switch",
            "@radix-ui/react-label",
            "@radix-ui/react-avatar",
            "@radix-ui/react-slot",
          ],
          // Markdown 编辑器 (Milkdown)
          "mdeditor-vendor": ["@milkdown/crepe", "@milkdown/kit"],
          // lucide 图标
          "icons-vendor": ["lucide-react"],
        },
      },
    },
    // 增加 chunk 大小警告限制
    chunkSizeWarningLimit: 1500,
  },
});
