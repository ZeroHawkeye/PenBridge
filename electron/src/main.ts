import { app, BrowserWindow, ipcMain, session, Menu, globalShortcut, shell } from "electron";
import * as path from "path";
import { TencentAuth } from "./auth/tencentAuth";
import { JuejinAuth } from "./auth/juejinAuth";
import { createStore, AppMode } from "./store";
import { initAutoUpdater } from "./autoUpdater";
import {
  startLocalServer,
  stopLocalServer,
  getLocalServerUrl,
  getLocalServerStatus,
  LOCAL_SERVER_PORT,
  LOCAL_SERVER_HOST,
} from "./localServer";

// 存储实例
const store = createStore();

// 主窗口引用
let mainWindow: BrowserWindow | null = null;

// 腾讯认证模块
const tencentAuth = new TencentAuth(store);

// 掘金认证模块
const juejinAuth = new JuejinAuth(store);

// 前端开发服务器地址（仅开发环境使用）
const WEB_URL = process.env.WEB_URL || "http://localhost:5173";

// 判断是否为开发环境：检查打包后的前端文件是否存在
const isDev = !app.isPackaged;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 无边框窗口
    titleBarStyle: "hidden", // 隐藏标题栏
    show: false, // 先不显示，等加载完成后再显示
    icon: path.join(__dirname, "../assets/icon.ico"), // 窗口图标
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      spellcheck: false, // 禁用 Chromium 内置拼写检查，使用自定义实现
    },
    title: "PenBridge",
    backgroundColor: "#ffffff", // 白色背景，减少视觉闪烁
  });

  // 备用：如果 2 秒内没有触发 did-finish-load，强制显示窗口
  const showTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log("[App] 强制显示窗口（超时）");
      mainWindow.show();
    }
  }, 2000);
  
  // 页面加载完成后显示窗口，避免白屏
  // 使用 did-finish-load 比 ready-to-show 更快触发
  mainWindow.webContents.once("did-finish-load", () => {
    clearTimeout(showTimeout); // 清除超时定时器
    mainWindow?.show();
  });

  // 加载前端页面
  if (isDev) {
    // 开发环境：加载 Vite 开发服务器
    mainWindow.loadURL(WEB_URL);
    // 开发环境自动打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：加载打包后的前端
    const webPath = path.join(__dirname, "../web/index.html");
    console.log("Loading web from:", webPath);
    mainWindow.loadFile(webPath);
    // 生产环境不自动打开开发者工具，可通过快捷键 Ctrl+Shift+I 或 F12 打开
  }

  // 注册 Ctrl+Shift+I 快捷键打开/关闭开发者工具
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === "i") {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
    // F12 也可以打开开发者工具
    if (input.key === "F12") {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// 注册 IPC 处理器（窗口控制）
function registerWindowHandlers() {
  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle("window:close", () => {
    mainWindow?.close();
  });

  ipcMain.handle("window:isMaximized", () => {
    return mainWindow?.isMaximized() ?? false;
  });
}

// 设置窗口事件监听
function setupWindowEvents() {
  if (!mainWindow) return;

  // 监听窗口最大化状态变化，通知渲染进程
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window:maximized-change", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window:maximized-change", false);
  });
}

// 获取当前配置的服务器地址
// 如果未配置，返回空字符串（不使用默认值）
function getServerUrl(): string {
  const config = store.get("serverConfig");
  return config?.baseUrl || "";
}

// 注册服务器配置相关 IPC 处理器
function registerServerConfigHandlers() {
  // 获取服务器配置
  ipcMain.handle("serverConfig:get", () => {
    const config = store.get("serverConfig");
    return config || { baseUrl: "", isConfigured: false };
  });

  // 设置服务器配置
  ipcMain.handle("serverConfig:set", (_event, config: { baseUrl: string }) => {
    try {
      // 规范化 URL，去除末尾斜杠
      let baseUrl = config.baseUrl.trim();
      if (baseUrl.endsWith("/")) {
        baseUrl = baseUrl.slice(0, -1);
      }

      store.set("serverConfig", {
        baseUrl,
        isConfigured: true,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "保存配置失败",
      };
    }
  });

  // 检查是否已配置
  ipcMain.handle("serverConfig:isConfigured", () => {
    const config = store.get("serverConfig");
    return config?.isConfigured === true;
  });

  // 测试服务器连接
  ipcMain.handle("serverConfig:testConnection", async (_event, baseUrl: string) => {
    try {
      // 规范化 URL
      let url = baseUrl.trim();
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }

      // 尝试请求根路径健康检查端点
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

      const response = await fetch(`${url}/`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === "ok") {
          return { success: true, message: "连接成功" };
        }
      }
      return { success: false, message: `服务器返回状态码: ${response.status}` };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return { success: false, message: "连接超时，请检查地址是否正确" };
        }
        return { success: false, message: `连接失败: ${error.message}` };
      }
      return { success: false, message: "连接失败" };
    }
  });
}

// 注册通用工具 IPC 处理器
function registerUtilityHandlers() {
  // 在系统默认浏览器中打开外部链接
  ipcMain.handle("shell:openExternal", async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "打开链接失败",
      };
    }
  });
}

// 开发环境下的默认后端地址
const DEV_SERVER_URL = "http://localhost:3000";

// 注册应用模式相关 IPC 处理器
function registerAppModeHandlers() {
  // 获取应用模式配置
  ipcMain.handle("appMode:get", () => {
    const config = store.get("appMode");
    return config || { mode: null, isConfigured: false };
  });

  // 设置应用模式
  ipcMain.handle("appMode:set", async (_event, mode: AppMode) => {
    try {
      if (mode === "local") {
        if (isDev) {
          // 开发环境：使用开发者手动启动的后端服务（端口 3000）
          // 不自动启动后端，开发者应运行 dev:server
          console.log("[App] 开发环境本地模式，使用开发服务器地址:", DEV_SERVER_URL);
          
          // 保存模式配置
          store.set("appMode", {
            mode: "local",
            isConfigured: true,
          });

          // 设置服务器配置为开发服务器地址
          store.set("serverConfig", {
            baseUrl: DEV_SERVER_URL,
            isConfigured: true,
          });

          return { success: true, serverUrl: DEV_SERVER_URL };
        } else {
          // 生产环境：启动本地服务器
          const result = await startLocalServer();
          if (!result.success) {
            return {
              success: false,
              message: result.error || "启动本地服务器失败",
            };
          }

          // 保存模式配置
          store.set("appMode", {
            mode: "local",
            isConfigured: true,
          });

          // 同时设置服务器配置为本地地址
          store.set("serverConfig", {
            baseUrl: result.url!,
            isConfigured: true,
          });

          return { success: true, serverUrl: result.url };
        }
      } else if (mode === "cloud") {
        // 云端模式：停止本地服务器（如果正在运行）
        if (!isDev) {
          await stopLocalServer();
        }

        // 保存模式配置
        store.set("appMode", {
          mode: "cloud",
          isConfigured: true,
        });

        return { success: true };
      } else {
        return { success: false, message: "无效的模式" };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "设置模式失败",
      };
    }
  });

  // 检查模式是否已配置
  ipcMain.handle("appMode:isConfigured", () => {
    const config = store.get("appMode");
    return config?.isConfigured === true;
  });

  // 获取本地服务器状态
  ipcMain.handle("appMode:getLocalServerStatus", async () => {
    if (isDev) {
      // 开发环境：检查开发服务器是否运行
      try {
        const response = await fetch(`${DEV_SERVER_URL}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          const data = await response.json();
          return {
            running: true,
            url: DEV_SERVER_URL,
            healthy: data.status === "ok",
          };
        }
      } catch {
        // 开发服务器未运行
      }
      return {
        running: false,
        url: DEV_SERVER_URL,
        healthy: false,
      };
    }
    return getLocalServerStatus();
  });

  // 手动启动本地服务器
  ipcMain.handle("appMode:startLocalServer", async () => {
    if (isDev) {
      // 开发环境不自动启动，提示用户手动运行
      return {
        success: false,
        error: "开发环境请手动运行 'bun run dev:server' 启动后端服务",
      };
    }
    return startLocalServer();
  });

  // 手动停止本地服务器
  ipcMain.handle("appMode:stopLocalServer", async () => {
    if (isDev) {
      // 开发环境不管理后端服务
      return { success: true };
    }
    await stopLocalServer();
    return { success: true };
  });

  // 重置模式配置（用于重新选择）
  ipcMain.handle("appMode:reset", async () => {
    if (!isDev) {
      await stopLocalServer();
    }
    store.set("appMode", {
      mode: null,
      isConfigured: false,
    });
    store.set("serverConfig", {
      baseUrl: "",
      isConfigured: false,
    });
    return { success: true };
  });
}

// 注册腾讯云社区 IPC 处理器
function registerTencentAuthHandlers() {
  // 获取登录状态
  ipcMain.handle("auth:status", async () => {
    return tencentAuth.getLoginStatus();
  });

  // 打开登录窗口
  ipcMain.handle("auth:login", async () => {
    return tencentAuth.openLoginWindow(mainWindow);
  });

  // 登出
  ipcMain.handle("auth:logout", async () => {
    return tencentAuth.logout();
  });

  // 获取 cookies（用于发送给后端）
  ipcMain.handle("auth:getCookies", async () => {
    return tencentAuth.getCookies();
  });

  // 同步 cookies 到后端
  ipcMain.handle("auth:syncToServer", async () => {
    const cookies = tencentAuth.getCookies();
    if (!cookies) {
      return { success: false, message: "未登录" };
    }

    const serverUrl = getServerUrl();
    if (!serverUrl) {
      return { success: false, message: "服务器地址未配置，请先在设置中配置服务器地址" };
    }

    try {
      // 使用 tRPC 批处理格式
      const response = await fetch(`${serverUrl}/trpc/auth.setCookies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookies: cookies,
        }),
      });
      const result = await response.json();

      // tRPC 响应格式处理
      if (result.result?.data) {
        return result.result.data;
      }
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "同步失败",
      };
    }
  });
}

// 注册掘金 IPC 处理器
function registerJuejinAuthHandlers() {
  // 获取登录状态
  ipcMain.handle("juejinAuth:status", async () => {
    return juejinAuth.getLoginStatus();
  });

  // 打开登录窗口
  ipcMain.handle("juejinAuth:login", async () => {
    return juejinAuth.openLoginWindow(mainWindow);
  });

  // 登出
  ipcMain.handle("juejinAuth:logout", async () => {
    return juejinAuth.logout();
  });

  // 获取 cookies（用于发送给后端）
  ipcMain.handle("juejinAuth:getCookies", async () => {
    return juejinAuth.getCookies();
  });

  // 同步 cookies 到后端
  ipcMain.handle("juejinAuth:syncToServer", async () => {
    const cookies = juejinAuth.getCookies();
    if (!cookies) {
      return { success: false, message: "未登录" };
    }

    const serverUrl = getServerUrl();
    if (!serverUrl) {
      return { success: false, message: "服务器地址未配置，请先在设置中配置服务器地址" };
    }

    try {
      // 使用 tRPC 批处理格式
      const response = await fetch(`${serverUrl}/trpc/juejinAuth.setCookies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookies: cookies,
        }),
      });
      const result = await response.json();

      // tRPC 响应格式处理
      if (result.result?.data) {
        return result.result.data;
      }
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "同步失败",
      };
    }
  });
}

// 注册 IPC 处理器
function registerIpcHandlers() {
  registerTencentAuthHandlers();
  registerJuejinAuthHandlers();
}

// 初始化应用模式（启动本地服务器等）
async function initializeAppMode() {
  // 开发环境下不自动启动本地服务器，开发者应手动运行 dev:server
  if (isDev) {
    console.log("[App] 开发环境，跳过自动启动本地服务器（请手动运行 dev:server）");
    return;
  }
  
  const appModeConfig = store.get("appMode");
  
  if (appModeConfig?.mode === "local" && appModeConfig.isConfigured) {
    console.log("[App] 检测到本地模式，正在启动本地服务器...");
    
    const result = await startLocalServer();
    if (result.success) {
      console.log(`[App] 本地服务器已启动: ${result.url}`);
      
      // 更新服务器配置
      store.set("serverConfig", {
        baseUrl: result.url!,
        isConfigured: true,
      });
    } else {
      console.error(`[App] 本地服务器启动失败: ${result.error}`);
    }
  }
}

// 应用就绪
app.whenReady().then(async () => {
  // 隐藏默认菜单栏
  Menu.setApplicationMenu(null);

  registerWindowHandlers();
  registerServerConfigHandlers();
  registerUtilityHandlers();
  registerAppModeHandlers();
  registerIpcHandlers();
  
  // 先创建窗口，让用户看到界面（避免等待服务器启动）
  createMainWindow();
  setupWindowEvents();

  // 初始化自动更新（仅在主窗口创建后）
  if (mainWindow) {
    initAutoUpdater(mainWindow);
  }
  
  // 异步初始化应用模式（本地模式下启动服务器）
  // 不阻塞窗口显示
  initializeAppMode().catch((err) => {
    console.error("[App] 初始化应用模式失败:", err);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      setupWindowEvents();
    }
  });
});

// 标记是否正在退出
let isQuitting = false;

// 所有窗口关闭时退出
app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    // 停止本地服务器（等待清理完成）
    await stopLocalServer();
    app.quit();
  }
});

// 应用退出前清理
app.on("before-quit", async (event) => {
  // 如果已经在退出过程中，不要重复处理
  if (isQuitting) {
    return;
  }
  
  // 标记正在退出
  isQuitting = true;
  
  // 阻止默认行为，等待清理完成
  event.preventDefault();
  
  // 停止本地服务器
  await stopLocalServer();
  
  // 清理完成后真正退出
  app.exit(0);
});
