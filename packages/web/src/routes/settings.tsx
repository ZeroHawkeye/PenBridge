import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { Cloud, Info, Mail, Calendar, Users, Key, Server, PenLine, Sparkles, Bot, Database } from "lucide-react";
import { isSuperAdmin } from "@/utils/auth";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  const handleTabChange = (tabId: string) => {
    navigate({
      to: "/settings",
      search: { tab: tabId as "server" | "tencent" | "juejin" | "email" | "schedule" | "users" | "account" | "editor" | "about" | "ai" | "data" },
      replace: true,
    });
  };

  const menuGroups = getSettingsMenu();

  return (
    <div className="flex h-full">
      {/* 设置侧边菜单 */}
      <div className="w-48 border-r border-border bg-muted/30 shrink-0">
        <div className="p-4">
          <h1 className="text-lg font-semibold">设置</h1>
        </div>
        <nav className="px-2 pb-4 space-y-4">
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
      </div>

      {/* 设置内容 */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl">
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
