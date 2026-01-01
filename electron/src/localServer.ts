/**
 * 本地 Server 模块 - 在 Electron 主进程中启动本地 HTTP 服务器
 * 
 * 使用 Node.js 原生 HTTP 模块，避免对 Bun 的依赖
 * 复用 packages/server 的业务逻辑
 */
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";

// 本地模式专用端口（不常用端口，避免冲突）
export const LOCAL_SERVER_PORT = 36925;
export const LOCAL_SERVER_HOST = "127.0.0.1";

// 服务器进程引用
let serverProcess: ChildProcess | null = null;
let isServerRunning = false;

/**
 * 获取服务器可执行文件路径
 * 使用 Bun 编译的独立二进制文件（无需 Node.js）
 * 
 * 支持多架构：根据当前运行的 CPU 架构选择对应的可执行文件
 */
function getServerExecutablePath(): string | null {
  // 根据当前架构选择可执行文件名
  const arch = process.arch; // 'x64', 'arm64', 'ia32', etc.
  const platform = process.platform;
  
  // 构建可执行文件名列表（按优先级）
  const exeNames: string[] = [];
  
  if (platform === "win32") {
    // Windows: 优先使用带架构后缀的文件名，然后是通用名
    exeNames.push(`pen-bridge-server-${arch}.exe`);
    exeNames.push("pen-bridge-server.exe");
  } else {
    // macOS / Linux: 优先使用带架构后缀的文件名，然后是通用名
    exeNames.push(`pen-bridge-server-${arch}`);
    exeNames.push("pen-bridge-server");
  }
  
  // 可能的目录路径
  const searchDirs = [
    // electron-builder asarUnpack 解包后的路径
    path.join(process.resourcesPath, "app.asar.unpacked", "server"),
    // 备用路径
    path.join(app.getAppPath().replace("app.asar", "app.asar.unpacked"), "server"),
    // 直接在 resources 目录
    path.join(process.resourcesPath, "server"),
    // 在 app 目录内
    path.join(app.getAppPath(), "server"),
  ];
  
  console.log(`[Local Server] 正在查找服务器可执行文件 (arch: ${arch}, platform: ${platform})...`);
  
  // 遍历目录和文件名组合
  for (const dir of searchDirs) {
    for (const exeName of exeNames) {
      const fullPath = path.join(dir, exeName);
      console.log(`[Local Server] 检查路径: ${fullPath}, 存在: ${fs.existsSync(fullPath)}`);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }
  
  return null;
}

/**
 * 获取数据目录路径
 * 使用 Electron 的 userData 目录存储数据库和上传文件
 */
export function getDataDirectory(): string {
  return path.join(app.getPath("userData"), "server-data");
}

/**
 * 获取本地服务器 URL
 */
export function getLocalServerUrl(): string {
  return `http://${LOCAL_SERVER_HOST}:${LOCAL_SERVER_PORT}`;
}

/**
 * 检查端口是否可用
 */
async function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("net");
    const server = net.createServer();
    
    server.once("error", () => {
      resolve(false);
    });
    
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, host);
  });
}

/**
 * 等待服务器就绪
 */
async function waitForServerReady(url: string, maxRetries: number = 60): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${url}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(1000),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === "ok") {
          return true;
        }
      }
    } catch {
      // 忽略错误，继续重试
    }
    
    // 等待 100ms 后重试（加快轮询频率）
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  
  return false;
}

/**
 * 启动本地服务器
 * 
 * 启动 Bun 编译的独立二进制服务器
 * 注意：此函数仅在生产环境中被调用（开发环境使用独立的 dev:server）
 */
export async function startLocalServer(): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  if (isServerRunning) {
    return { success: true, url: getLocalServerUrl() };
  }

  try {
    // 检查端口是否可用
    const portAvailable = await isPortAvailable(LOCAL_SERVER_PORT, LOCAL_SERVER_HOST);
    if (!portAvailable) {
      // 端口被占用，可能是之前的实例还在运行，尝试连接
      const serverUrl = getLocalServerUrl();
      const isReady = await waitForServerReady(serverUrl, 5);
      if (isReady) {
        console.log("本地服务器已在运行中");
        isServerRunning = true;
        return { success: true, url: serverUrl };
      }
      
      return {
        success: false,
        error: `端口 ${LOCAL_SERVER_PORT} 被占用且无法连接，请检查是否有其他程序占用该端口`,
      };
    }

    // 确保数据目录存在
    const dataDir = getDataDirectory();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 查找 Bun 编译的二进制可执行文件
    const serverPath = getServerExecutablePath();
    
    console.log("[Local Server] resourcesPath:", process.resourcesPath);
    console.log("[Local Server] appPath:", app.getAppPath());
    
    if (!serverPath) {
      console.log("[Local Server] 未找到服务器可执行文件");
      return {
        success: false,
        error: "未找到服务器文件，请确保应用已正确安装。如果问题持续存在，请重新安装应用。",
      };
    }
    
    console.log(`[Local Server] 启动服务器，路径: ${serverPath}`);
    
    // 设置环境变量
    const env = {
      ...process.env,
      PEN_BRIDGE_PORT: String(LOCAL_SERVER_PORT),
      PEN_BRIDGE_HOST: LOCAL_SERVER_HOST,
      PEN_BRIDGE_DATA_DIR: dataDir,
    };
    
    // 直接运行 Bun 编译的独立二进制文件（无需 Node.js）
    serverProcess = spawn(serverPath, [], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (!serverProcess) {
      return { success: false, error: "无法启动服务器进程" };
    }

    // 收集启动错误信息
    let startupError = "";
    
    // 监听输出
    serverProcess.stdout?.on("data", (data) => {
      console.log(`[Local Server] ${data.toString().trim()}`);
    });

    serverProcess.stderr?.on("data", (data) => {
      const msg = data.toString().trim();
      console.error(`[Local Server Error] ${msg}`);
      startupError += msg + "\n";
    });

    // 监听进程早期退出
    let processExited = false;
    let exitCode: number | null = null;
    
    serverProcess.on("exit", (code) => {
      console.log(`[Local Server] 进程退出，代码: ${code}`);
      processExited = true;
      exitCode = code;
      isServerRunning = false;
      serverProcess = null;
    });

    serverProcess.on("error", (err) => {
      console.error("[Local Server] 进程错误:", err);
      startupError += err.message + "\n";
      isServerRunning = false;
    });

    // 等待服务器就绪
    const serverUrl = getLocalServerUrl();
    const isReady = await waitForServerReady(serverUrl);
    
    if (isReady) {
      isServerRunning = true;
      console.log(`[Local Server] 服务器已就绪: ${serverUrl}`);
      return { success: true, url: serverUrl };
    } else {
      // 启动失败，终止进程
      await stopLocalServer();
      
      // 生成详细错误信息
      let errorMsg = "服务器启动超时";
      if (processExited) {
        errorMsg = `服务器进程异常退出 (代码: ${exitCode})`;
      }
      if (startupError) {
        errorMsg += `\n${startupError.slice(0, 500)}`;
      }
      
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error("[Local Server] 启动失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "启动失败",
    };
  }
}

/**
 * 停止本地服务器
 * 
 * 发送 SIGTERM 信号并等待进程退出
 * 如果超时（5秒）则强制终止进程
 */
export async function stopLocalServer(): Promise<void> {
  if (!serverProcess) {
    isServerRunning = false;
    return;
  }
  
  console.log("[Local Server] 正在停止服务器...");
  
  const proc = serverProcess;
  serverProcess = null;
  isServerRunning = false;
  
  return new Promise<void>((resolve) => {
    let forceKillTimeout: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;
    
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
        forceKillTimeout = null;
      }
      resolve();
    };
    
    // 监听进程退出
    proc.once("exit", (code) => {
      console.log(`[Local Server] 服务器进程已退出，代码: ${code}`);
      cleanup();
    });
    
    // 发送 SIGTERM 信号
    proc.kill("SIGTERM");
    
    // 设置超时强制终止
    forceKillTimeout = setTimeout(() => {
      if (!resolved) {
        console.log("[Local Server] 进程未响应 SIGTERM，强制终止...");
        try {
          // Windows 下使用 taskkill 强制终止
          if (process.platform === "win32") {
            const pid = proc.pid;
            if (pid) {
              spawn("taskkill", ["/pid", String(pid), "/f", "/t"], {
                stdio: "ignore",
              });
            }
          } else {
            proc.kill("SIGKILL");
          }
        } catch (err) {
          console.error("[Local Server] 强制终止失败:", err);
        }
        cleanup();
      }
    }, 5000);
  });
}

/**
 * 检查本地服务器是否运行中
 */
export function isLocalServerRunning(): boolean {
  return isServerRunning;
}

/**
 * 获取服务器状态
 */
export async function getLocalServerStatus(): Promise<{
  running: boolean;
  url: string;
  healthy: boolean;
}> {
  const url = getLocalServerUrl();
  let healthy = false;
  
  if (isServerRunning) {
    try {
      const response = await fetch(`${url}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      
      if (response.ok) {
        const data = await response.json();
        healthy = data.status === "ok";
      }
    } catch {
      healthy = false;
    }
  }
  
  return {
    running: isServerRunning,
    url,
    healthy,
  };
}
