import { useState, useEffect, useCallback } from "react";
import "@/types/electron.d";
import { cn } from "@/lib/utils";
import type { AppMode, LocalServerStatus } from "@/types/electron.d";

// 窗口控制按钮图标
const MinimizeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <rect fill="currentColor" x="0" y="4.5" width="10" height="1" />
  </svg>
);

const MaximizeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <rect
      fill="transparent"
      stroke="currentColor"
      strokeWidth="1"
      x="0.5"
      y="0.5"
      width="9"
      height="9"
    />
  </svg>
);

const RestoreIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <path
      fill="transparent"
      stroke="currentColor"
      strokeWidth="1"
      d="M2.5,0.5 h7 v7 h-2 v2 h-7 v-7 h2 z M2.5,2.5 v5 h5 v-5 z"
    />
  </svg>
);

const CloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <path
      fill="currentColor"
      d="M1.41 0L0 1.41L3.59 5L0 8.59L1.41 10L5 6.41L8.59 10L10 8.59L6.41 5L10 1.41L8.59 0L5 3.59L1.41 0Z"
    />
  </svg>
);

// 检测是否在 Electron 环境中
const isElectron = () => {
  return typeof window !== "undefined" && window.electronAPI?.window !== undefined;
};

// 服务器状态类型
type ServerStatusType = "connected" | "disconnected" | "checking" | "not-local";

interface TitleBarProps {
  title?: string;
}

function TitleBar({ title = "PenBridge" }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [inElectron, setInElectron] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatusType>("checking");
  const [serverUrl, setServerUrl] = useState<string>("");

  // 检查服务器状态
  const checkServerStatus = useCallback(async () => {
    if (!window.electronAPI?.appMode) return;

    try {
      const modeConfig = await window.electronAPI.appMode.get();
      setAppMode(modeConfig.mode);

      // 只在本地模式下检查服务器状态
      if (modeConfig.mode === "local") {
        const status: LocalServerStatus = await window.electronAPI.appMode.getLocalServerStatus();
        setServerUrl(status.url || "");
        
        if (status.running && status.healthy) {
          setServerStatus("connected");
        } else if (status.running) {
          setServerStatus("checking");
        } else {
          setServerStatus("disconnected");
        }
      } else if (modeConfig.mode === "cloud") {
        // 云端模式，检查服务器配置
        const serverConfig = await window.electronAPI.serverConfig.get();
        if (serverConfig.isConfigured && serverConfig.baseUrl) {
          setServerUrl(serverConfig.baseUrl);
          // 测试连接
          const result = await window.electronAPI.serverConfig.testConnection(serverConfig.baseUrl);
          setServerStatus(result.success ? "connected" : "disconnected");
        } else {
          setServerStatus("disconnected");
        }
      } else {
        setServerStatus("not-local");
      }
    } catch (error) {
      console.error("[TitleBar] 检查服务器状态失败:", error);
      setServerStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    const electronEnv = isElectron();
    setInElectron(electronEnv);

    if (!electronEnv) return;

    // 获取初始最大化状态
    window.electronAPI!.window.isMaximized().then(setIsMaximized);

    // 监听最大化状态变化
    const unsubscribe = window.electronAPI!.window.onMaximizedChange(
      (maximized: boolean) => {
        setIsMaximized(maximized);
      }
    );

    // 初始检查服务器状态
    checkServerStatus();

    // 定时检查服务器状态（每 10 秒）
    const statusInterval = setInterval(checkServerStatus, 10000);

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, [checkServerStatus]);

  const handleMinimize = () => {
    if (window.electronAPI?.window) {
      window.electronAPI.window.minimize();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.window) {
      window.electronAPI.window.maximize();
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.window) {
      window.electronAPI.window.close();
    }
  };

  // 获取状态显示信息
  const getStatusInfo = () => {
    if (appMode === null) {
      return { color: "text-muted-foreground", label: "未配置", dotColor: "bg-muted-foreground" };
    }

    const modeLabel = appMode === "local" ? "本地" : "云端";

    switch (serverStatus) {
      case "connected":
        return { 
          color: "text-green-500", 
          label: `${modeLabel} · 已连接`, 
          dotColor: "bg-green-500",
          tooltip: serverUrl 
        };
      case "disconnected":
        return { 
          color: "text-red-500", 
          label: `${modeLabel} · 未连接`, 
          dotColor: "bg-red-500",
          tooltip: "服务器未响应" 
        };
      case "checking":
        return { 
          color: "text-yellow-500", 
          label: `${modeLabel} · 检查中`, 
          dotColor: "bg-yellow-500 animate-pulse",
          tooltip: "正在检查连接..." 
        };
      default:
        return { 
          color: "text-muted-foreground", 
          label: "", 
          dotColor: "bg-muted-foreground",
          tooltip: "" 
        };
    }
  };

  // 如果不是 Electron 环境，不渲染标题栏
  if (!inElectron) {
    return null;
  }

  const statusInfo = getStatusInfo();

  return (
    <div
      className={cn(
        "flex items-center h-8 bg-sidebar border-b border-sidebar-border select-none shrink-0",
        "text-sidebar-foreground"
      )}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* 应用图标 */}
      <div className="flex items-center justify-center w-12 h-full">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-muted-foreground">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
      </div>

      {/* 标题 - 可拖拽区域 */}
      <div className="flex-1 text-center text-xs text-muted-foreground">
        {title}
      </div>

      {/* 服务器状态指示器 */}
      {appMode && (
        <div 
          className="flex items-center gap-1.5 px-2 h-full"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          title={statusInfo.tooltip}
        >
          <div className="flex items-center gap-1.5">
            <span className={cn("relative flex h-2 w-2")}>
              <span className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                serverStatus === "connected" && "animate-ping bg-green-400"
              )} />
              <span className={cn("relative inline-flex rounded-full h-2 w-2", statusInfo.dotColor)} />
            </span>
            <span className={cn("text-xs", statusInfo.color)}>
              {statusInfo.label}
            </span>
          </div>
        </div>
      )}

      {/* 窗口控制按钮 */}
      <div
        className="flex h-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          className="flex items-center justify-center w-11 h-full hover:bg-accent transition-colors"
          onClick={handleMinimize}
          aria-label="最小化"
        >
          <MinimizeIcon />
        </button>
        <button
          className="flex items-center justify-center w-11 h-full hover:bg-accent transition-colors"
          onClick={handleMaximize}
          aria-label={isMaximized ? "还原" : "最大化"}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          className="flex items-center justify-center w-11 h-full hover:bg-destructive hover:text-white transition-colors"
          onClick={handleClose}
          aria-label="关闭"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
