// 文档索引 - 定义文档结构和元数据
import { Download, FileText, Upload, Clock, Sparkles, Settings, Terminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DocMeta {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  order: number;
}

// 文档元数据配置
export const docsMeta: DocMeta[] = [
  {
    id: "getting-started",
    title: "快速开始",
    description: "安装和配置 PenBridge",
    icon: Download,
    order: 1,
  },
  {
    id: "editor",
    title: "文章编辑",
    description: "Markdown 编辑器使用指南",
    icon: FileText,
    order: 2,
  },
  {
    id: "publishing",
    title: "发布文章",
    description: "多平台发布功能",
    icon: Upload,
    order: 3,
  },
  {
    id: "scheduling",
    title: "定时发布",
    description: "设置自动发布时间",
    icon: Clock,
    order: 4,
  },
  {
    id: "ai-assistant",
    title: "AI 助手",
    description: "AI 辅助写作功能",
    icon: Sparkles,
    order: 5,
  },
  {
    id: "settings",
    title: "设置",
    description: "应用配置选项",
    icon: Settings,
    order: 6,
  },
  {
    id: "development",
    title: "开发指南",
    description: "参与项目开发",
    icon: Terminal,
    order: 7,
  },
];

// 按 order 排序
export const sortedDocsMeta = [...docsMeta].sort((a, b) => a.order - b.order);

// 获取文档元数据
export function getDocMeta(id: string): DocMeta | undefined {
  return docsMeta.find((doc) => doc.id === id);
}

// 获取上一篇/下一篇文档
export function getAdjacentDocs(id: string): { prev?: DocMeta; next?: DocMeta } {
  const index = sortedDocsMeta.findIndex((doc) => doc.id === id);
  if (index === -1) return {};
  
  return {
    prev: index > 0 ? sortedDocsMeta[index - 1] : undefined,
    next: index < sortedDocsMeta.length - 1 ? sortedDocsMeta[index + 1] : undefined,
  };
}
