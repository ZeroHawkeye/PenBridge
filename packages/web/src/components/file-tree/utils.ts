import type {
  FolderItem,
  ArticleItem,
  TreeNode,
  VirtualFolderOrder,
} from "./types";
import { PUBLISH_PLATFORMS } from "./types";

/**
 * 构建树结构
 * 将文件夹和文章列表转换为树形结构
 */
export function buildTree(
  folders: FolderItem[],
  articles: ArticleItem[]
): TreeNode[] {
  const folderMap = new Map<number, TreeNode>();
  const rootNodes: TreeNode[] = [];

  // 创建文件夹节点
  folders.forEach((folder) => {
    folderMap.set(folder.id, {
      type: "folder",
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      isExpanded: folder.isExpanded,
      children: [],
    });
  });

  // 构建文件夹层级
  folders.forEach((folder) => {
    const node = folderMap.get(folder.id)!;
    if (folder.parentId && folderMap.has(folder.parentId)) {
      folderMap.get(folder.parentId)!.children!.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  // 添加文章到对应文件夹或根目录
  articles.forEach((article) => {
    const articleNode: TreeNode = {
      type: "article",
      id: article.id,
      name: article.title || "无标题",
      parentId: article.folderId,
      status: article.status,
    };

    if (article.folderId && folderMap.has(article.folderId)) {
      folderMap.get(article.folderId)!.children!.push(articleNode);
    } else {
      rootNodes.push(articleNode);
    }
  });

  return rootNodes;
}

/**
 * 按平台分组构建树结构
 * 已发布到指定平台的文章放在平台虚拟目录下，未发布的保持原有目录结构
 * @param virtualFolderOrder 虚拟目录的排序配置
 */
export function buildTreeByPlatform(
  folders: FolderItem[],
  articles: ArticleItem[],
  platformId: string,
  virtualFolderOrder?: VirtualFolderOrder | null
): TreeNode[] {
  const platform = PUBLISH_PLATFORMS.find((p) => p.id === platformId);
  if (!platform) {
    return buildTree(folders, articles);
  }

  // 分离已发布和未发布的文章
  const publishedArticles = articles.filter((a) => platform.checkPublished(a));
  const unpublishedArticles = articles.filter(
    (a) => !platform.checkPublished(a)
  );

  // 创建平台虚拟目录（已发布的文章）
  const platformFolder: TreeNode | null =
    publishedArticles.length > 0
      ? {
          type: "folder",
          id: -1, // 虚拟目录使用负数 ID
          name: `${platform.name}（已发布）`,
          isExpanded: true,
          isVirtual: true, // 标记为虚拟目录
          platformId: platformId,
          children: publishedArticles.map((article) => ({
            type: "article",
            id: article.id,
            name: article.title || "无标题",
            status: article.status,
          })),
        }
      : null;

  // 未发布的文章保持原有目录结构
  const folderMap = new Map<number, TreeNode>();
  const rootNodes: TreeNode[] = [];

  // 创建文件夹节点
  folders.forEach((folder) => {
    folderMap.set(folder.id, {
      type: "folder",
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      isExpanded: folder.isExpanded,
      children: [],
    });
  });

  // 构建文件夹层级
  folders.forEach((folder) => {
    const node = folderMap.get(folder.id)!;
    if (folder.parentId && folderMap.has(folder.parentId)) {
      folderMap.get(folder.parentId)!.children!.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  // 添加未发布的文章到对应文件夹或根目录
  unpublishedArticles.forEach((article) => {
    const articleNode: TreeNode = {
      type: "article",
      id: article.id,
      name: article.title || "无标题",
      parentId: article.folderId,
      status: article.status,
    };

    if (article.folderId && folderMap.has(article.folderId)) {
      folderMap.get(article.folderId)!.children!.push(articleNode);
    } else {
      rootNodes.push(articleNode);
    }
  });

  // 保留所有文件夹结构（包括空文件夹）

  // 如果没有虚拟目录，直接返回
  if (!platformFolder) {
    return rootNodes;
  }

  // 根据 virtualFolderOrder 插入虚拟目录
  if (!virtualFolderOrder || !virtualFolderOrder.afterNode) {
    // 默认放在最前面
    return [platformFolder, ...rootNodes];
  }

  // 找到要插入的位置
  const { type: afterType, id: afterId } = virtualFolderOrder.afterNode;
  const insertIndex = rootNodes.findIndex(
    (node: TreeNode) => node.type === afterType && node.id === afterId
  );

  if (insertIndex === -1) {
    // 找不到指定节点，放在最前面
    return [platformFolder, ...rootNodes];
  }

  // 插入到指定节点之后
  const result = [...rootNodes];
  result.splice(insertIndex + 1, 0, platformFolder);
  return result;
}

/**
 * 获取可用的分组选项
 * 只返回有已发布文章的平台
 */
export function getAvailableGroupOptions(
  articles: ArticleItem[]
): { id: string; name: string; count: number }[] {
  return PUBLISH_PLATFORMS.map((platform) => ({
    id: platform.id,
    name: platform.name,
    count: articles.filter((a) => platform.checkPublished(a)).length,
  })).filter((option) => option.count > 0);
}

// localStorage key for virtual folder order
const VIRTUAL_FOLDER_ORDER_KEY = "penbridge_virtual_folder_order";

/**
 * 保存虚拟目录排序配置到 localStorage
 */
export function saveVirtualFolderOrder(
  platformId: string,
  order: VirtualFolderOrder
): void {
  try {
    const stored = localStorage.getItem(VIRTUAL_FOLDER_ORDER_KEY);
    const orders: Record<string, VirtualFolderOrder> = stored
      ? JSON.parse(stored)
      : {};
    orders[platformId] = order;
    localStorage.setItem(VIRTUAL_FOLDER_ORDER_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error("Failed to save virtual folder order:", e);
  }
}

/**
 * 从 localStorage 获取虚拟目录排序配置
 */
export function getVirtualFolderOrder(
  platformId: string
): VirtualFolderOrder | null {
  try {
    const stored = localStorage.getItem(VIRTUAL_FOLDER_ORDER_KEY);
    if (!stored) return null;
    const orders: Record<string, VirtualFolderOrder> = JSON.parse(stored);
    return orders[platformId] || null;
  } catch (e) {
    console.error("Failed to get virtual folder order:", e);
    return null;
  }
}
