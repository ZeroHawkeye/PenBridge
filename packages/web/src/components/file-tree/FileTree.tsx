import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { FilePlus, FolderPlus, RefreshCw } from "lucide-react";
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
import { trpc } from "@/utils/trpc";
import { TreeNodeItem } from "./TreeNodeItem";
import { buildTree } from "./utils";
import type { DragData, DropTarget, DeleteTarget } from "./types";

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

  // 拖拽状态
  const [draggedItem, setDraggedItem] = useState<DragData | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

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
      setExpandedFolders(expanded);
    }
  }, [data?.folders]);

  // Mutations
  const createFolderMutation = trpc.folder.create.useMutation({
    onSuccess: async (folder: any) => {
      // 等待数据刷新完成
      await refetch();
      // 使用 setTimeout 确保 React 已完成渲染新节点
      // 需要稍微延迟以确保 DOM 更新完成
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
      // 刷新文章列表页面的数据
      trpcUtils.article.list.invalidate();
      // 导航到新创建的文章，带上 new 参数以便聚焦标题
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
      // 刷新文章列表页面的数据
      trpcUtils.article.list.invalidate();
      setDeleteDialogOpen(false);
      // 检查当前是否正在编辑被删除的文章，如果是则导航到文章列表
      const editMatch = location.pathname.match(/^\/articles\/(\d+)\/edit$/);
      if (editMatch && Number(editMatch[1]) === variables.id) {
        navigate({ to: "/articles" });
      }
      setDeleteTarget(null);
    },
  });

  // 移动文件夹的 mutation
  const moveFolderMutation = trpc.folder.move.useMutation({
    onSuccess: () => refetch(),
  });

  // 移动文章的 mutation
  const moveArticleMutation = trpc.articleExt.moveToFolder.useMutation({
    onSuccess: () => refetch(),
  });

  // 拖拽处理函数
  const handleDragStart = useCallback((item: DragData) => {
    setDraggedItem(item);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((target: DropTarget) => {
    setDropTarget(target);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (target: DropTarget) => {
      if (!draggedItem) return;

      const targetFolderId = target.type === "root" ? null : target.id;

      // 不要移动到当前位置
      if (draggedItem.parentId === targetFolderId) {
        handleDragEnd();
        return;
      }

      if (draggedItem.type === "folder") {
        moveFolderMutation.mutate({
          id: draggedItem.id,
          parentId: targetFolderId,
        });
      } else {
        moveArticleMutation.mutate({
          id: draggedItem.id,
          folderId: targetFolderId,
        });
      }

      handleDragEnd();
    },
    [draggedItem, moveFolderMutation, moveArticleMutation, handleDragEnd]
  );

  // 根目录放置处理
  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (draggedItem && draggedItem.parentId !== undefined) {
        e.dataTransfer.dropEffect = "move";
        setDropTarget({ type: "root" });
      }
    },
    [draggedItem]
  );

  const handleRootDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (draggedItem) {
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
        // 保存展开状态到服务器
        setExpandedMutation.mutate({ id, isExpanded: newState });
        return next;
      });
    },
    [setExpandedMutation]
  );

  const handleCreateFolder = useCallback(
    (parentId?: number) => {
      // 如果有父文件夹，先展开它
      if (parentId) {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.add(parentId);
          return next;
        });
        setExpandedMutation.mutate({ id: parentId, isExpanded: true });
      }
      // 创建文件夹
      createFolderMutation.mutate({
        name: "新建文件夹", // 先用默认名称创建，然后进入编辑状态
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

  // 构建树结构
  const treeNodes = buildTree(data?.folders || [], data?.articles || []);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* 文件树头部 */}
      <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span>文章</span>
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
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
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
