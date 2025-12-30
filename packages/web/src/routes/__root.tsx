import { createRootRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Home,
  FileText,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from "lucide-react";
import { App } from "antd";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import TitleBar from "@/components/TitleBar";
import { FileTree } from "@/components/FileTree";
import { isAuthenticated, clearAuthToken, getAuthUser } from "@/utils/auth";
import { isServerConfiguredSync } from "@/utils/serverConfig";
import { trpc } from "@/utils/trpc";

// 侧边栏宽度限制
const SIDEBAR_MIN_WIDTH = 150;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 224; // 原来的 w-56 = 14rem = 224px

// 左侧功能按钮配置
const sidebarButtons = [
  { id: "home", icon: Home, label: "首页", to: "/" },
  { id: "articles", icon: FileText, label: "文章", to: "/articles" },
  { id: "settings", icon: Settings, label: "设置", to: "/settings" },
];

// 根据路径获取当前活动的功能
function getActiveView(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/articles")) return "articles";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}

function RootComponent() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = getActiveView(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const authUser = getAuthUser();

  const logoutMutation = trpc.adminAuth.logout.useMutation({
    onSuccess: () => {
      clearAuthToken();
      // 使用 replace 避免 hash 路由在刷新前被解析导致短暂报错
      const targetUrl = new URL(window.location.href);
      targetUrl.hash = "#/login";
      window.location.replace(targetUrl.href);
    },
  });

  // 检查服务器配置和登录状态
  useEffect(() => {
    // 如果在设置页，不做任何跳转
    if (location.pathname === "/setup") {
      return;
    }

    // 检查是否已配置服务器
    if (!isServerConfiguredSync()) {
      navigate({ to: "/setup" });
      return;
    }

    // 如果当前不在登录页且未登录，则跳转
    if (location.pathname !== "/login" && !isAuthenticated()) {
      navigate({ to: "/login" });
    }
  }, [location.pathname, navigate]);

  // 如果在设置页面，只显示 TitleBar 和内容
  if (location.pathname === "/setup") {
    return (
      <App>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          <TitleBar />
          <Outlet />
        </div>
      </App>
    );
  }

  // 如果服务器未配置，不显示主布局
  if (!isServerConfiguredSync()) {
    return null;
  }

  // 如果在登录页，只显示 TitleBar 和内容
  if (location.pathname === "/login") {
    return (
      <App>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          <TitleBar />
          <Outlet />
        </div>
      </App>
    );
  }

  // 如果未登录，也不显示主布局
  if (!isAuthenticated()) {
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // 从 localStorage 恢复侧边栏状态和宽度
  useEffect(() => {
    const savedOpen = localStorage.getItem("sidebar-open");
    if (savedOpen !== null) {
      setSidebarOpen(savedOpen === "true");
    }
    const savedWidth = localStorage.getItem("sidebar-width");
    if (savedWidth !== null) {
      const width = parseInt(savedWidth, 10);
      if (width >= SIDEBAR_MIN_WIDTH && width <= SIDEBAR_MAX_WIDTH) {
        setSidebarWidth(width);
      }
    }
  }, []);

  // 保存侧边栏状态到 localStorage
  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-open", String(next));
      return next;
    });
  };

  // 开始拖拽调整宽度
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // 处理拖拽调整宽度
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // 计算新宽度：鼠标位置 - 左侧功能栏宽度(48px)
      const newWidth = e.clientX - 48;
      const clampedWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        // 保存宽度到 localStorage
        localStorage.setItem("sidebar-width", String(sidebarWidth));
      }
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // 防止选中文本
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing, sidebarWidth]);

  return (
    <App>
      <TooltipProvider delayDuration={0}>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          {/* 自定义标题栏 */}
          <TitleBar />

          <div className="flex flex-1 overflow-hidden">
            {/* 最左侧功能按钮栏 - Obsidian 风格 */}
            <div className="flex flex-col w-12 bg-sidebar border-r border-sidebar-border shrink-0">
              {/* 功能按钮 */}
              <div className="flex flex-col items-center py-2 gap-1">
                {sidebarButtons.map((item) => (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <Link to={item.to}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-9 w-9 text-foreground",
                            activeView === item.id && "bg-accent"
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              {/* 底部按钮 */}
              <div className="mt-auto flex flex-col items-center py-2 gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-foreground"
                      onClick={toggleSidebar}
                    >
                      {sidebarOpen ? (
                        <PanelLeftClose className="h-5 w-5" />
                      ) : (
                        <PanelLeft className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
                  </TooltipContent>
                </Tooltip>
                
                {/* 登出按钮 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground"
                      onClick={handleLogout}
                      disabled={logoutMutation.isLoading}
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    退出登录 ({authUser?.username})
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* 侧边栏文件树 - 可折叠且可调整宽度 */}
            <div
              ref={sidebarRef}
              className={cn(
                "relative border-r border-border bg-sidebar overflow-hidden shrink-0",
                !sidebarOpen && "w-0 border-r-0",
                !isResizing && "transition-all duration-200"
              )}
              style={{ width: sidebarOpen ? sidebarWidth : 0 }}
            >
              {sidebarOpen && <FileTree />}
              {/* 拖拽调整宽度的分隔条 */}
              {sidebarOpen && (
                <div
                  className={cn(
                    "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors",
                    isResizing && "bg-primary/30"
                  )}
                  onMouseDown={startResizing}
                />
              )}
            </div>

            {/* 主内容区 */}
            <main className="flex-1 overflow-auto bg-background">
              <div className="h-full">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </TooltipProvider>
    </App>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
