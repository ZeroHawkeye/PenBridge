import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import { viteStaticCopy } from "vite-plugin-static-copy";
import commonjs from "vite-plugin-commonjs";

// 根据构建目标设置 base 路径
// - Electron 打包：使用相对路径 "./"（file:// 协议）
// - Docker/Web 部署：使用绝对路径 "/"（HTTP 协议）
const isElectron = process.env.BUILD_TARGET === "electron";

// 从 package.json 读取版本号
const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const appVersion = packageJson.version || "1.0.0";

export default defineConfig({
  plugins: [
    // TanStack Router 插件需要在 React 插件之前
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    // 支持 CommonJS/UMD 模块（如本地构建的 vditor）
    commonjs(),
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
        // 复制本地构建的 vditor 资源（包含修改过的 lute.min.js）
        {
          src: "node_modules/vditor/dist/*",
          dest: "vditor/dist",
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
    // mammoth 需要预构建以转换 CommonJS 为 ESM
    include: ["mammoth"],
  },
  server: {
    port: 5173,
  },
  // 定义全局常量，在构建时注入版本号
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    // 启用模块预加载 polyfill
    modulePreload: {
      polyfill: true,
    },
    // 代码分割优化
    rollupOptions: {
      output: {
        // 使用对象形式的 manualChunks，让 Rollup 自动处理依赖顺序
        // 不再分离 react-vendor，让 React 打包到主入口确保最先执行
        manualChunks(id) {
          // 使用函数形式，但不再分离 React，确保它在主包中最先加载
          // React 和 react-dom 保留在主包中，不做分离
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return; // 不分离，让 React 留在主包
          }
          // antd 和相关依赖
          if (id.includes("node_modules/antd/") || id.includes("@ant-design/")) {
            return "antd-vendor";
          }
          // 路由相关库
          if (id.includes("@tanstack/react-router")) {
            return "router-vendor";
          }
          // tRPC 和 React Query
          if (id.includes("@trpc/") || id.includes("@tanstack/react-query")) {
            return "query-vendor";
          }
          // radix-ui 组件
          if (id.includes("@radix-ui/")) {
            return "radix-vendor";
          }
          // Vditor 编辑器
          if (id.includes("vditor")) {
            return "vditor-vendor";
          }
          // lucide 图标
          if (id.includes("lucide-react")) {
            return "icons-vendor";
          }
          // mammoth (Word 导入) - 单独打包，延迟加载
          if (id.includes("mammoth")) {
            return "mammoth-vendor";
          }
        },
      },
    },
    // 增加 chunk 大小警告限制
    chunkSizeWarningLimit: 1500,
  },
});
