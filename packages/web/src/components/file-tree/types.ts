// 文件夹项类型
export interface FolderItem {
  id: number;
  name: string;
  parentId?: number;
  isExpanded: boolean;
  order: number;
}

// 文章项类型
export interface ArticleItem {
  id: number;
  title: string;
  folderId?: number;
  order: number;
  status: string;
  // 平台发布状态
  tencentArticleId?: string;
  tencentArticleUrl?: string;
  juejinArticleId?: string;
  juejinArticleUrl?: string;
  csdnArticleId?: string;
  csdnArticleUrl?: string;
}

// 发布平台定义
export interface PublishPlatform {
  id: string;
  name: string;
  // 用于检查文章是否已发布到该平台
  checkPublished: (article: ArticleItem) => boolean;
}

// 支持的发布平台列表
export const PUBLISH_PLATFORMS: PublishPlatform[] = [
  {
    id: "tencent",
    name: "腾讯云社区",
    checkPublished: (article) => !!article.tencentArticleId,
  },
  {
    id: "juejin",
    name: "掘金",
    checkPublished: (article) => !!article.juejinArticleId,
  },
  {
    id: "csdn",
    name: "CSDN",
    checkPublished: (article) => !!article.csdnArticleId,
  },
];

// 分组模式
export type GroupMode = "none" | string; // "none" 表示不分组，其他为平台 ID

// 树节点类型
export interface TreeNode {
  type: "folder" | "article";
  id: number;
  name: string;
  parentId?: number;
  isExpanded?: boolean;
  status?: string;
  children?: TreeNode[];
  // 虚拟目录相关（用于平台分组）
  isVirtual?: boolean;
  platformId?: string;
}

// 拖拽数据类型
export interface DragData {
  type: "folder" | "article";
  id: number;
  name: string;
  parentId?: number;
  isVirtual?: boolean; // 是否是虚拟目录
}

// 拖拽目标类型
export type DropTarget =
  | {
      type: "folder";
      id: number;
    }
  | {
      type: "root";
    }
  | {
      type: "sort";
      targetType: "folder" | "article";
      targetId: number;
      position: "before" | "after";
      depth: number;
    };

// 排序指示器（用于显示横线）
export interface DropIndicator {
  targetType: "folder" | "article";
  targetId: number;
  position: "before" | "after";
  depth: number;
}

// 删除目标类型
export interface DeleteTarget {
  type: "folder" | "article";
  id: number;
  name: string;
}

// 虚拟目录排序配置（存储到 localStorage）
export interface VirtualFolderOrder {
  platformId: string;
  // 排序位置：-1 表示在最前面，正数表示在某个根节点之后
  // 格式：{ type: 'folder' | 'article', id: number } 表示在该节点之后
  afterNode?: { type: "folder" | "article"; id: number } | null;
}
