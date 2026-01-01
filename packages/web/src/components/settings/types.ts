// 设置页面类型定义

import type { LucideIcon } from "lucide-react";

// 菜单项类型
export type MenuItem = {
  id: string;
  icon: LucideIcon;
  label: string;
};

export type MenuGroup = {
  title: string;
  items: MenuItem[];
};

// 更新状态类型
export interface UpdateStatusType {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  progress: number;
  version: string | null;
  releaseNotes: string | null;
}
