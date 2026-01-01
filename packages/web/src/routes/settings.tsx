import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Cloud, Info, Mail, Calendar, Users, Key, Server, PenLine, Sparkles, Bot, Database, ChevronRight } from "lucide-react";
import { isSuperAdmin } from "@/utils/auth";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

// 导入设置组件
import {
  TencentAuthSettings,
  JuejinAuthSettings,
  EmailNotificationSettings,
  ScheduleTaskSettings,
  UserManagementSettings,
  AccountSecuritySettings,
  ServerConfigSettings,
  EditorSettings,
  AIConfigSettings,
  DataTransferSettings,
  AboutSettings,
} from "@/components/settings";

// 导入类型定义
import type { MenuItem, MenuGroup } from "@/components/settings";

// 设置菜单项（用户管理仅超级管理员可见）
const getSettingsMenu = (): MenuGroup[] => {
  const groups: MenuGroup[] = [
    {
      title: "发布渠道",
      items: [
        { id: "tencent", icon: Cloud, label: "腾讯云社区" },
        { id: "juejin", icon: Sparkles, label: "掘金" },
      ],
    },
    {
      title: "AI 设置",
      items: [
        { id: "ai", icon: Bot, label: "AI 配置" },
      ],
    },
    {
      title: "系统设置",
      items: [
        { id: "schedule", icon: Calendar, label: "定时任务" },
        { id: "email", icon: Mail, label: "邮件通知" },
        { id: "server", icon: Server, label: "服务器配置" },
        { id: "editor", icon: PenLine, label: "编辑器设置" },
        { id: "data", icon: Database, label: "数据管理" },
      ],
    },
  ];

  // 账户管理分组
  const accountItems: MenuItem[] = [];
  
  // 超级管理员可以管理用户
  if (isSuperAdmin()) {
    accountItems.push({ id: "users", icon: Users, label: "用户管理" });
  }

  // 所有用户都可以修改自己的密码
  accountItems.push({ id: "account", icon: Key, label: "账号安全" });
  
  groups.push({
    title: "账户管理",
    items: accountItems,
  });

  // 其他分组
  groups.push({
    title: "其他",
    items: [
      { id: "about", icon: Info, label: "关于" },
    ],
  });

  return groups;
};

function SettingsPage() {
  const navigate = useNavigate();
  const { tab } = useSearch({ from: "/settings" });
  const activeTab = tab || "tencent";
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleTabChange = (tabId: string) => {
    navigate({
      to: "/settings",
      search: { tab: tabId as "server" | "tencent" | "juejin" | "email" | "schedule" | "users" | "account" | "editor" | "about" | "ai" | "data" },
      replace: true,
    });
    // 移动端选择后关闭菜单
    if (isMobile) {
      setMenuOpen(false);
    }
  };

  const menuGroups = getSettingsMenu();

  // 获取当前选中项的标签
  const getCurrentTabLabel = () => {
    for (const group of menuGroups) {
      for (const item of group.items) {
        if (item.id === activeTab) {
          return item.label;
        }
      }
    }
    return "设置";
  };

  // 设置菜单内容（桌面端和移动端共用）
  const SettingsMenu = () => (
    <nav className={cn("space-y-4", isMobile ? "px-4 py-2" : "px-2 pb-4")}>
      {menuGroups.map((group) => (
        <div key={group.title}>
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {group.title}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                  activeTab === item.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* 移动端：顶部菜单栏 */}
      {isMobile && (
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0">
          <h1 className="text-lg font-semibold">设置</h1>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setMenuOpen(true)}
          >
            {getCurrentTabLabel()}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 移动端：菜单抽屉 */}
      {isMobile && (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="right" className="w-64 p-0">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle>设置菜单</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-60px)]">
              <SettingsMenu />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}

      {/* 桌面端：侧边菜单 */}
      {!isMobile && (
        <div className="w-48 border-r border-border bg-muted/30 shrink-0">
          <div className="p-4">
            <h1 className="text-lg font-semibold">设置</h1>
          </div>
          <SettingsMenu />
        </div>
      )}

      {/* 设置内容 */}
      <ScrollArea className="flex-1">
        <div className={cn("p-4 md:p-6 max-w-2xl", isMobile && "pb-20")}>
          {activeTab === "server" && <ServerConfigSettings />}
          {activeTab === "tencent" && <TencentAuthSettings />}
          {activeTab === "juejin" && <JuejinAuthSettings />}
          {activeTab === "email" && <EmailNotificationSettings />}
          {activeTab === "schedule" && <ScheduleTaskSettings />}
          {activeTab === "users" && isSuperAdmin() && <UserManagementSettings />}
          {activeTab === "account" && <AccountSecuritySettings />}
          {activeTab === "editor" && <EditorSettings />}
          {activeTab === "ai" && <AIConfigSettings />}
          {activeTab === "data" && <DataTransferSettings />}
          {activeTab === "about" && <AboutSettings />}
        </div>
      </ScrollArea>
    </div>
  );
}

// 定义 search params 的验证 schema
const settingsSearchSchema = z.object({
  tab: z.enum(["server", "tencent", "juejin", "email", "schedule", "users", "account", "editor", "about", "ai", "data"]).optional().catch("tencent"),
});

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  validateSearch: settingsSearchSchema,
});
