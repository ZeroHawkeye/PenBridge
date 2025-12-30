import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import {
  ChevronRight,
  FilePlus,
  FolderPlus,
  FileText,
  FolderOpen,
  Folder,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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

// 类型定义
interface FolderItem {
  id: number;
  name: string;
  parentId?: number;
  isExpanded: boolean;
  order: number;
}

interface ArticleItem {
  id: number;
  title: string;
  folderId?: number;
  order: number;
  status: string;
}

interface TreeNode {
  type: "folder" | "article";
  id: number;
  name: string;
  parentId?: number;
  isExpanded?: boolean;
  status?: string;
  children?: TreeNode[];
}

// 拖拽数据类型
interface DragData {
  type: "folder" | "article";
  id: number;
  name: string;
  parentId?: number;
}

// 拖拽目标类型
type DropTarget = {
  type: "folder";
  id: number;
} | {
  type: "root";
};

// 构建树结构
function buildTree(
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

// 可编辑的输入框组件
function EditableInput({
  defaultValue,
  onSave,
  onCancel,
}: {
  defaultValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (value.trim()) {
        onSave(value.trim());
      }
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (value.trim()) {
          onSave(value.trim());
        } else {
          onCancel();
        }
      }}
      className="h-6 text-sm px-1 py-0"
    />
  );
}

// 树节点组件
function TreeNodeItem({
  node,
  depth = 0,
  expandedFolders,
  editingFolderId,
  onToggleFolder,
  onCreateFolder,
  onCreateArticle,
  onRenameFolder,
  onRenameArticle,
  onDeleteFolder,
  onDeleteArticle,
  onEditingComplete,
  draggedItem,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  allFolders,
}: {
  node: TreeNode;
  depth?: number;
  expandedFolders: Set<number>;
  editingFolderId: number | null;
  onToggleFolder: (id: number) => void;
  onCreateFolder: (parentId?: number) => void;
  onCreateArticle: (folderId?: number) => void;
  onRenameFolder: (id: number, name: string) => void;
  onRenameArticle: (id: number, title: string) => void;
  onDeleteFolder: (id: number) => void;
  onDeleteArticle: (id: number) => void;
  onEditingComplete: () => void;
  draggedItem: DragData | null;
  dropTarget: DropTarget | null;
  onDragStart: (data: DragData) => void;
  onDragEnd: () => void;
  onDragOver: (target: DropTarget) => void;
  onDragLeave: () => void;
  onDrop: (target: DropTarget) => void;
  allFolders: FolderItem[];
}) {
  const [isEditing, setIsEditing] = useState(false);

  // 当 editingFolderId 变化时，如果是当前节点则进入编辑状态
  useEffect(() => {
    if (node.type === "folder" && node.id === editingFolderId && editingFolderId !== null) {
      setIsEditing(true);
    }
  }, [node.type, node.id, editingFolderId]);
  const navigate = useNavigate();
  const isExpanded =
    node.type === "folder" && expandedFolders.has(node.id);

  const handleSaveName = (newName: string) => {
    if (node.type === "folder") {
      onRenameFolder(node.id, newName);
      // 清除正在编辑状态
      onEditingComplete();
    } else {
      onRenameArticle(node.id, newName);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // 如果是新建文件夹取消编辑，也要清除状态
    if (node.type === "folder" && node.id === editingFolderId) {
      onEditingComplete();
    }
  };

  // 检查当前节点是否被拖拽
  const isDragging = draggedItem?.type === node.type && draggedItem?.id === node.id;

  // 检查当前文件夹是否是有效的放置目标
  const isValidDropTarget = useCallback(() => {
    if (!draggedItem) return false;
    if (node.type !== "folder") return false;
    // 不能拖到自己上
    if (draggedItem.type === "folder" && draggedItem.id === node.id) return false;
    // 不能拖到自己的子文件夹中
    if (draggedItem.type === "folder") {
      const isDescendant = (parentId: number | undefined, targetId: number): boolean => {
        if (!parentId) return false;
        if (parentId === draggedItem.id) return true;
        const parent = allFolders.find(f => f.id === parentId);
        return parent ? isDescendant(parent.parentId, targetId) : false;
      };
      if (isDescendant(node.id, draggedItem.id)) return false;
      // 递归检查目标节点是否是被拖拽节点的子孙
      const getAllDescendantIds = (folderId: number): number[] => {
        const children = allFolders.filter(f => f.parentId === folderId);
        const ids: number[] = [];
        for (const child of children) {
          ids.push(child.id);
          ids.push(...getAllDescendantIds(child.id));
        }
        return ids;
      };
      const descendantIds = getAllDescendantIds(draggedItem.id);
      if (descendantIds.includes(node.id)) return false;
    }
    return true;
  }, [draggedItem, node, allFolders]);

  // 检查当前节点是否是放置目标
  const isDropTarget = dropTarget?.type === "folder" && dropTarget?.id === node.id && isValidDropTarget();

  // 拖拽事件处理
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({
      type: node.type,
      id: node.id,
      name: node.name,
      parentId: node.parentId,
    }));
    onDragStart({
      type: node.type,
      id: node.id,
      name: node.name,
      parentId: node.parentId,
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    onDragEnd();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.type === "folder" && isValidDropTarget()) {
      e.dataTransfer.dropEffect = "move";
      onDragOver({ type: "folder", id: node.id });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    onDragLeave();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.type === "folder" && isValidDropTarget()) {
      onDrop({ type: "folder", id: node.id });
    }
  };

  if (node.type === "folder") {
    return (
      <div>
        <ContextMenu>
          <ContextMenuTrigger>
            <button
              draggable={!isEditing}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => onToggleFolder(node.id)}
              className={cn(
                "flex items-center w-full px-2 py-1 text-sm hover:bg-accent rounded-sm group min-w-0",
                "text-left transition-colors",
                isDragging && "opacity-50",
                isDropTarget && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
              style={{ paddingLeft: `${depth * 20 + 8}px` }}
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 mr-1 shrink-0 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 mr-2 shrink-0 text-yellow-600" />
              ) : (
                <Folder className="h-4 w-4 mr-2 shrink-0 text-yellow-600" />
              )}
              {isEditing ? (
                <EditableInput
                  defaultValue={node.name}
                  onSave={handleSaveName}
                  onCancel={handleCancelEdit}
                />
              ) : (
                <span className="truncate text-foreground">{node.name}</span>
              )}
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onCreateArticle(node.id)}>
              <FilePlus className="h-4 w-4 mr-2" />
              新建文章
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCreateFolder(node.id)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              新建文件夹
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              重命名
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => onDeleteFolder(node.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除文件夹
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {isExpanded && node.children && (
          <div>
            {node.children.length === 0 ? (
              <div
                className="px-3 py-1 text-xs text-muted-foreground"
                style={{ paddingLeft: `${(depth + 1) * 20 + 20}px` }}
              >
                空文件夹
              </div>
            ) : (
              node.children.map((child) => (
                <TreeNodeItem
                  key={`${child.type}-${child.id}`}
                  node={child}
                  depth={depth + 1}
                  expandedFolders={expandedFolders}
                  editingFolderId={editingFolderId}
                  onToggleFolder={onToggleFolder}
                  onCreateFolder={onCreateFolder}
                  onCreateArticle={onCreateArticle}
                  onRenameFolder={onRenameFolder}
                  onRenameArticle={onRenameArticle}
                  onDeleteFolder={onDeleteFolder}
                  onDeleteArticle={onDeleteArticle}
                  onEditingComplete={onEditingComplete}
                  draggedItem={draggedItem}
                  dropTarget={dropTarget}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  allFolders={allFolders}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // 文章节点
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Link
          draggable={!isEditing}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          to="/articles/$id/edit"
          params={{ id: String(node.id) }}
          className={cn(
            "flex items-center w-full px-2 py-1 text-sm hover:bg-accent rounded-sm group min-w-0",
            "transition-colors text-foreground",
            isDragging && "opacity-50"
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <FileText className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
          {isEditing ? (
            <EditableInput
              defaultValue={node.name}
              onSave={handleSaveName}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <span className="truncate">{node.name}</span>
          )}
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => navigate({ to: "/articles/$id/edit", params: { id: String(node.id) } })}
        >
          <Pencil className="h-4 w-4 mr-2" />
          编辑文章
        </ContextMenuItem>
        <ContextMenuItem onClick={() => setIsEditing(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          重命名
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onDeleteArticle(node.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          删除文章
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// 主文件树组件
export function FileTree() {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set()
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "folder" | "article";
    id: number;
    name: string;
  } | null>(null);
  // 正在编辑的新建文件夹 ID
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);

  // 拖拽状态
  const [draggedItem, setDraggedItem] = useState<DragData | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // 获取树结构数据
  const { data, refetch, isFetching } = trpc.folder.tree.useQuery();

  // 初始化展开状态
  useEffect(() => {
    if (data?.folders) {
      const expanded = new Set<number>(
        data.folders.filter((f: any) => f.isExpanded).map((f: any) => f.id as number)
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
      // 导航到新创建的文章，带上 new 参数以便聚焦标题
      navigate({ to: "/articles/$id/edit", params: { id: String(article.id) }, search: { new: true } });
    },
  });

  const renameArticleMutation = trpc.articleExt.rename.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteArticleMutation = trpc.article.delete.useMutation({
    onSuccess: (_: any, variables: { id: number }) => {
      refetch();
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

  const handleDrop = useCallback((target: DropTarget) => {
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
  }, [draggedItem, moveFolderMutation, moveArticleMutation, handleDragEnd]);

  // 根目录放置处理
  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItem && draggedItem.parentId !== undefined) {
      e.dataTransfer.dropEffect = "move";
      setDropTarget({ type: "root" });
    }
  }, [draggedItem]);

  const handleRootDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItem) {
      handleDrop({ type: "root" });
    }
  }, [draggedItem, handleDrop]);

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
        name: "新建文件夹",  // 先用默认名称创建，然后进入编辑状态
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

  const handleDeleteFolder = useCallback((id: number) => {
    const folder = data?.folders?.find((f: any) => f.id === id);
    setDeleteTarget({
      type: "folder",
      id,
      name: folder?.name || "文件夹",
    });
    setDeleteDialogOpen(true);
  }, [data?.folders]);

  const handleDeleteArticle = useCallback((id: number) => {
    const article = data?.articles?.find((a: any) => a.id === id);
    setDeleteTarget({
      type: "article",
      id,
      name: article?.title || "文章",
    });
    setDeleteDialogOpen(true);
  }, [data?.articles]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "folder") {
      deleteFolderMutation.mutate({ id: deleteTarget.id });
    } else {
      deleteArticleMutation.mutate({ id: deleteTarget.id });
    }
  }, [deleteTarget, deleteFolderMutation, deleteArticleMutation]);

  // 构建树结构
  const treeNodes = buildTree(
    data?.folders || [],
    data?.articles || []
  );

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
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
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
                dropTarget?.type === "root" && "bg-primary/10 ring-2 ring-primary ring-inset"
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
