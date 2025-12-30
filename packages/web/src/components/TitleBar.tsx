import { useState, useEffect } from "react";
import "@/types/electron.d";
import { cn } from "@/lib/utils";

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

interface TitleBarProps {
  title?: string;
}

function TitleBar({ title = "PenBridge" }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [inElectron, setInElectron] = useState(false);

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

    return () => {
      unsubscribe();
    };
  }, []);

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

  // 如果不是 Electron 环境，不渲染标题栏
  if (!inElectron) {
    return null;
  }

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
