import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { FilePlus, FolderPlus, RefreshCw, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/utils/trpc";
import { TreeNodeItem } from "./TreeNodeItem";
import {
  buildTree,
  buildTreeByPlatform,
  getAvailableGroupOptions,
  getVirtualFolderOrder,
  saveVirtualFolderOrder,
} from "./utils";
import type {
  DragData,
  DropTarget,
  DropIndicator,
  DeleteTarget,
  GroupMode,
  TreeNode,
} from "./types";

interface FileTreeProps {
  /** 文章点击回调，用于移动端关闭侧边栏 */
  onArticleClick?: () => void;
}

/**
 * 主文件树组件
 * 显示文章和文件夹的树形结构，支持拖拽、创建、重命名、删除等操作
 */
export function FileTree({ onArticleClick }: FileTreeProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set()
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  // 正在编辑的新建文件夹 ID
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  // 分组模式：none 表示不分组，其他为平台 ID
  const [groupMode, setGroupMode] = useState<GroupMode>("none");

  // 拖拽状态
  const [draggedItem, setDraggedItem] = useState<DragData | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  // 获取 tRPC context 用于手动刷新其他查询
  const trpcUtils = trpc.useContext();

  // 获取树结构数据
  const { data, refetch, isFetching } = trpc.folder.tree.useQuery();

  // 初始化展开状态
  useEffect(() => {
    if (data?.folders) {
      const expanded = new Set<number>(
        data.folders
          .filter((f: any) => f.isExpanded)
          .map((f: any) => f.id as number)
      );
      // 虚拟目录默认展开（使用负数 ID）
      expanded.add(-1);
      setExpandedFolders(expanded);
    }
  }, [data?.folders]);

  // Mutations
  const createFolderMutation = trpc.folder.create.useMutation({
    onSuccess: async (folder: any) => {
      await refetch();
      setTimeout(() => {
        setEditingFolderId(folder.id);
      }, 50);
    },
  });

  const renameFolderMutation = trpc.folder.rename.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteFolderMutation = trpc.folder.delete.useMutation({
    onSuccess: () => {
      refetch();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
  });

  const setExpandedMutation = trpc.folder.setExpanded.useMutation();

  const createArticleMutation = trpc.articleExt.createInFolder.useMutation({
    onSuccess: (article: any) => {
      refetch();
      trpcUtils.article.list.invalidate();
      navigate({
        to: "/articles/$id/edit",
        params: { id: String(article.id) },
        search: { new: true },
      });
    },
  });

  const renameArticleMutation = trpc.articleExt.rename.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteArticleMutation = trpc.article.delete.useMutation({
    onSuccess: (_: any, variables: { id: number }) => {
      refetch();
      trpcUtils.article.list.invalidate();
      setDeleteDialogOpen(false);
      const editMatch = location.pathname.match(/^\/articles\/(\d+)\/edit$/);
      if (editMatch && Number(editMatch[1]) === variables.id) {
        navigate({ to: "/articles" });
      }
      setDeleteTarget(null);
    },
  });

  const moveFolderMutation = trpc.folder.move.useMutation({
    onSuccess: () => refetch(),
  });

  const moveArticleMutation = trpc.articleExt.moveToFolder.useMutation({
    onSuccess: () => refetch(),
  });

  // 获取可用的分组选项（只显示有已发布文章的平台）
  const availableGroupOptions = useMemo(() => {
    return getAvailableGroupOptions(data?.articles || []);
  }, [data?.articles]);

  // 构建树结构（根据分组模式）- 需要在 handleDrop 之前定义
  const treeNodes = useMemo(() => {
    if (groupMode === "none") {
      return buildTree(data?.folders || [], data?.articles || []);
    }
    const virtualFolderOrder = getVirtualFolderOrder(groupMode);
    return buildTreeByPlatform(
      data?.folders || [],
      data?.articles || [],
      groupMode,
      virtualFolderOrder
    );
  }, [data?.folders, data?.articles, groupMode]);

  // 拖拽处理函数
  const handleDragStart = useCallback((item: DragData) => {
    setDraggedItem(item);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTarget(null);
    setDropIndicator(null);
  }, []);

  const handleDragOver = useCallback((target: DropTarget) => {
    setDropTarget(target);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
    setDropIndicator(null);
  }, []);

  const handleDropIndicatorChange = useCallback((indicator: DropIndicator | null) => {
    setDropIndicator(indicator);
  }, []);

  // 查找节点在树中的位置信息
  const findNodePosition = useCallback((
    nodes: TreeNode[],
    targetType: "folder" | "article",
    targetId: number,
    position: "before" | "after"
  ): { parentId: number | null; siblings: TreeNode[]; index: number } | null => {
    // 在根级别查找
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === targetType && node.id === targetId) {
        const targetIndex = position === "before" ? i : i + 1;
        return { parentId: null, siblings: nodes, index: targetIndex };
      }
      // 在子节点中查找
      if (node.children) {
        for (let j = 0; j < node.children.length; j++) {
          const child = node.children[j];
          if (child.type === targetType && child.id === targetId) {
            const targetIndex = position === "before" ? j : j + 1;
            return { 
              parentId: node.isVirtual ? null : node.id, 
              siblings: node.children, 
              index: targetIndex 
            };
          }
          // 继续递归
          if (child.children) {
            const result = findNodePositionInChildren(child.children, child.id, targetType, targetId, position);
            if (result) return result;
          }
        }
      }
    }
    return null;
  }, []);

  // 递归在子节点中查找
  const findNodePositionInChildren = (
    nodes: TreeNode[],
    parentId: number,
    targetType: "folder" | "article",
    targetId: number,
    position: "before" | "after"
  ): { parentId: number | null; siblings: TreeNode[]; index: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === targetType && node.id === targetId) {
        const targetIndex = position === "before" ? i : i + 1;
        return { parentId, siblings: nodes, index: targetIndex };
      }
      if (node.children) {
        const result = findNodePositionInChildren(node.children, node.id, targetType, targetId, position);
        if (result) return result;
      }
    }
    return null;
  };

  const handleDrop = useCallback(
    (target: DropTarget) => {
      console.log('[FileTree] handleDrop called', { target, draggedItem });
      
      if (!draggedItem) {
        console.log('[FileTree] No draggedItem, returning');
        return;
      }

      if (target.type === "root") {
        console.log('[FileTree] Drop to root', { 
          draggedItemParentId: draggedItem.parentId,
          isNull: draggedItem.parentId === null,
          isUndefined: draggedItem.parentId === undefined 
        });
        // 移动到根目录
        if (draggedItem.parentId === null || draggedItem.parentId === undefined) {
          console.log('[FileTree] Already at root, skipping');
          handleDragEnd();
          return;
        }
        if (draggedItem.type === "folder") {
          console.log('[FileTree] Moving folder to root');
          moveFolderMutation.mutate({
            id: draggedItem.id,
            parentId: null,
          });
        } else {
          console.log('[FileTree] Moving article to root');
          moveArticleMutation.mutate({
            id: draggedItem.id,
            folderId: null,
          });
        }
      } else if (target.type === "folder") {
        // 移动到文件夹内
        if (draggedItem.parentId === target.id) {
          handleDragEnd();
          return;
        }
        if (draggedItem.type === "folder") {
          moveFolderMutation.mutate({
            id: draggedItem.id,
            parentId: target.id,
          });
        } else {
          moveArticleMutation.mutate({
            id: draggedItem.id,
            folderId: target.id,
          });
        }
      } else if (target.type === "sort") {
        // 排序放置
        const { targetType, targetId, position } = target;
        console.log('[FileTree] Sort drop', { targetType, targetId, position, draggedItem });
        
        // 虚拟目录的排序处理
        if (draggedItem.isVirtual && groupMode !== "none") {
          const positionInfo = findNodePosition(treeNodes, targetType, targetId, position);
          if (positionInfo) {
            const { siblings, index } = positionInfo;
            // 找到插入位置前面的节点
            const prevNode = index > 0 ? siblings[index - 1] : null;
            if (prevNode && !prevNode.isVirtual) {
              saveVirtualFolderOrder(groupMode, {
                platformId: groupMode,
                afterNode: { type: prevNode.type as "folder" | "article", id: prevNode.id },
              });
            } else if (index === 0) {
              // 放在最前面
              saveVirtualFolderOrder(groupMode, {
                platformId: groupMode,
                afterNode: null,
              });
            }
            refetch();
          }
          handleDragEnd();
          return;
        }

        // 普通节点的排序/移动
        // 如果目标在根级别（depth === 0），移动到根目录
        // 否则找到目标的父节点
        const positionInfo = findNodePosition(treeNodes, targetType, targetId, position);
        console.log('[FileTree] Position info', { positionInfo, treeNodes });
        
        if (positionInfo) {
          const { parentId: newParentId } = positionInfo;
          
          // 统一处理 null 和 undefined（都表示根目录）
          const currentParentId = draggedItem.parentId ?? null;
          const targetParentId = newParentId ?? null;
          
          console.log('[FileTree] Parent comparison', { 
            currentParentId, 
            targetParentId, 
            areEqual: currentParentId === targetParentId 
          });
          
          // 移动到新的父节点（如果不同）
          if (draggedItem.type === "folder") {
            if (currentParentId !== targetParentId) {
              moveFolderMutation.mutate({
                id: draggedItem.id,
                parentId: targetParentId,
              });
            }
          } else {
            if (currentParentId !== targetParentId) {
              moveArticleMutation.mutate({
                id: draggedItem.id,
                folderId: targetParentId,
              });
            }
          }
        }
      }

      handleDragEnd();
    },
    [draggedItem, groupMode, moveFolderMutation, moveArticleMutation, handleDragEnd, refetch, findNodePosition, treeNodes]
  );

  // 根目录放置处理
  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // 允许任何有父级的节点拖到根目录（虚拟目录除外）
      // 使用 draggedItem.parentId !== undefined && draggedItem.parentId !== null 来判断
      const hasParent = draggedItem?.parentId !== undefined && draggedItem?.parentId !== null;
      if (draggedItem && !draggedItem.isVirtual && hasParent) {
        e.dataTransfer.dropEffect = "move";
        setDropTarget({ type: "root" });
      }
    },
    [draggedItem]
  );

  const handleRootDragLeave = useCallback(() => {
    setDropTarget(null);
    setDropIndicator(null);
  }, []);

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const hasParent = draggedItem?.parentId !== undefined && draggedItem?.parentId !== null;
      if (draggedItem && !draggedItem.isVirtual && hasParent) {
        handleDrop({ type: "root" });
      }
    },
    [draggedItem, handleDrop]
  );

  // 处理函数
  const handleToggleFolder = useCallback(
    (id: number) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        const newState = !next.has(id);
        if (newState) {
          next.add(id);
        } else {
          next.delete(id);
        }
        if (id > 0) {
          setExpandedMutation.mutate({ id, isExpanded: newState });
        }
        return next;
      });
    },
    [setExpandedMutation]
  );

  const handleCreateFolder = useCallback(
    (parentId?: number) => {
      if (parentId) {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.add(parentId);
          return next;
        });
        setExpandedMutation.mutate({ id: parentId, isExpanded: true });
      }
      createFolderMutation.mutate({
        name: "新建文件夹",
        parentId,
      });
    },
    [createFolderMutation, setExpandedMutation]
  );

  const handleCreateArticle = useCallback(
    (folderId?: number) => {
      createArticleMutation.mutate({
        title: "无标题",
        folderId,
      });
    },
    [createArticleMutation]
  );

  const handleRenameFolder = useCallback(
    (id: number, name: string) => {
      renameFolderMutation.mutate({ id, name });
    },
    [renameFolderMutation]
  );

  const handleRenameArticle = useCallback(
    (id: number, title: string) => {
      renameArticleMutation.mutate({ id, title });
    },
    [renameArticleMutation]
  );

  const handleDeleteFolder = useCallback(
    (id: number) => {
      const folder = data?.folders?.find((f: any) => f.id === id);
      setDeleteTarget({
        type: "folder",
        id,
        name: folder?.name || "文件夹",
      });
      setDeleteDialogOpen(true);
    },
    [data?.folders]
  );

  const handleDeleteArticle = useCallback(
    (id: number) => {
      const article = data?.articles?.find((a: any) => a.id === id);
      setDeleteTarget({
        type: "article",
        id,
        name: article?.title || "文章",
      });
      setDeleteDialogOpen(true);
    },
    [data?.articles]
  );

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "folder") {
      deleteFolderMutation.mutate({ id: deleteTarget.id });
    } else {
      deleteArticleMutation.mutate({ id: deleteTarget.id });
    }
  }, [deleteTarget, deleteFolderMutation, deleteArticleMutation]);

  // 当前分组的显示名称
  const currentGroupLabel = useMemo(() => {
    if (groupMode === "none") return "全部文章";
    const option = availableGroupOptions.find((o) => o.id === groupMode);
    return option ? option.name : "全部文章";
  }, [groupMode, availableGroupOptions]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* 文件树头部 */}
      <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {/* 分组选择器 */}
        {availableGroupOptions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs font-medium text-muted-foreground hover:text-foreground gap-1"
              >
                <Filter className="h-3 w-3" />
                <span className="max-w-[80px] truncate">{currentGroupLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={groupMode}
                onValueChange={(value) => setGroupMode(value as GroupMode)}
              >
                <DropdownMenuRadioItem value="none">
                  全部文章
                </DropdownMenuRadioItem>
                {availableGroupOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.id} value={option.id}>
                    {option.name}（{option.count}）
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span>文章</span>
        )}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => refetch()}
            title="刷新"
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => handleCreateArticle()}
            title="新建文章"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => handleCreateFolder()}
            title="新建文件夹"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Separator />

      {/* 右键菜单区域（空白处） */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <ScrollArea className="flex-1 w-full">
            <div
              className={cn(
                "py-2 min-h-full w-full transition-colors",
                dropTarget?.type === "root" &&
                  "bg-primary/10 ring-2 ring-primary ring-inset"
              )}
              onDragOver={handleRootDragOver}
              onDragLeave={handleRootDragLeave}
              onDrop={handleRootDrop}
            >
              {treeNodes.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  右键创建文章或文件夹
                </div>
              ) : (
                treeNodes.map((node) => (
                  <TreeNodeItem
                    key={`${node.type}-${node.id}`}
                    node={node}
                    expandedFolders={expandedFolders}
                    editingFolderId={editingFolderId}
                    onToggleFolder={handleToggleFolder}
                    onCreateFolder={handleCreateFolder}
                    onCreateArticle={handleCreateArticle}
                    onRenameFolder={handleRenameFolder}
                    onRenameArticle={handleRenameArticle}
                    onDeleteFolder={handleDeleteFolder}
                    onDeleteArticle={handleDeleteArticle}
                    onEditingComplete={() => setEditingFolderId(null)}
                    draggedItem={draggedItem}
                    dropTarget={dropTarget}
                    dropIndicator={dropIndicator}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDropIndicatorChange={handleDropIndicatorChange}
                    allFolders={data?.folders || []}
                    onArticleClick={onArticleClick}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => handleCreateArticle()}>
            <FilePlus className="h-4 w-4 mr-2" />
            新建文章
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleCreateFolder()}>
            <FolderPlus className="h-4 w-4 mr-2" />
            新建文件夹
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === "folder"
                ? `确定要删除文件夹 "${deleteTarget?.name}" 吗？文件夹内的文章将移动到根目录。`
                : `确定要删除文章 "${deleteTarget?.name}" 吗？此操作无法撤销。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={
                deleteFolderMutation.isLoading || deleteArticleMutation.isLoading
              }
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
