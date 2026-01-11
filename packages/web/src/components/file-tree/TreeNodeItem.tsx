import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  FilePlus,
  FolderPlus,
  FileText,
  FolderOpen,
  Folder,
  Pencil,
  Trash2,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { EditableInput } from "./EditableInput";
import type { TreeNode, DragData, DropTarget, FolderItem, DropIndicator } from "./types";

interface TreeNodeItemProps {
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
  dropIndicator: DropIndicator | null;
  onDragStart: (data: DragData) => void;
  onDragEnd: () => void;
  onDragOver: (target: DropTarget) => void;
  onDragLeave: () => void;
  onDrop: (target: DropTarget) => void;
  onDropIndicatorChange: (indicator: DropIndicator | null) => void;
  allFolders: FolderItem[];
  /** 文章点击回调，用于移动端关闭侧边栏 */
  onArticleClick?: () => void;
}

/**
 * 树节点组件
 * 渲染文件夹或文章节点，支持拖拽、重命名、删除等操作
 */
export function TreeNodeItem({
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
  dropIndicator,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onDropIndicatorChange,
  allFolders,
  onArticleClick,
}: TreeNodeItemProps) {
  const [isEditing, setIsEditing] = useState(false);

  // 当 editingFolderId 变化时，如果是当前节点则进入编辑状态
  useEffect(() => {
    if (
      node.type === "folder" &&
      node.id === editingFolderId &&
      editingFolderId !== null
    ) {
      setIsEditing(true);
    }
  }, [node.type, node.id, editingFolderId]);

  const navigate = useNavigate();
  const trpcUtils = trpc.useContext();
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExpanded = node.type === "folder" && expandedFolders.has(node.id);

  const handleArticleMouseEnter = useCallback(() => {
    if (node.type !== "article") return;
    prefetchTimerRef.current = setTimeout(() => {
      trpcUtils.article.getMeta.prefetch({ id: node.id });
      trpcUtils.article.getContent.prefetch({ id: node.id });
    }, 100);
  }, [node.type, node.id, trpcUtils]);

  const handleArticleMouseLeave = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  const handleSaveName = (newName: string) => {
    if (node.type === "folder") {
      onRenameFolder(node.id, newName);
      onEditingComplete();
    } else {
      onRenameArticle(node.id, newName);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (node.type === "folder" && node.id === editingFolderId) {
      onEditingComplete();
    }
  };

  // 检查当前节点是否被拖拽
  const isDragging =
    draggedItem?.type === node.type && draggedItem?.id === node.id;

  // 检查当前文件夹是否是有效的放置目标（拖入文件夹内部）
  const isValidDropTarget = useCallback(() => {
    if (!draggedItem) return false;
    if (node.type !== "folder") return false;
    // 虚拟目录不能作为放置目标
    if (node.isVirtual) return false;
    // 虚拟目录不能拖入其他文件夹
    if (draggedItem.isVirtual) return false;
    // 不能拖到自己上
    if (draggedItem.type === "folder" && draggedItem.id === node.id)
      return false;
    // 不能拖到自己的子文件夹中
    if (draggedItem.type === "folder") {
      const isDescendant = (
        parentId: number | undefined,
        _targetId: number
      ): boolean => {
        if (!parentId) return false;
        if (parentId === draggedItem.id) return true;
        const parent = allFolders.find((f) => f.id === parentId);
        return parent ? isDescendant(parent.parentId, _targetId) : false;
      };
      if (isDescendant(node.id, draggedItem.id)) return false;
      // 递归检查目标节点是否是被拖拽节点的子孙
      const getAllDescendantIds = (folderId: number): number[] => {
        const children = allFolders.filter((f) => f.parentId === folderId);
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

  // 检查当前节点是否是放置目标（拖入文件夹内部）
  const isDropTargetNode =
    dropTarget?.type === "folder" &&
    dropTarget?.id === node.id &&
    isValidDropTarget();

  // 检查当前节点是否显示排序指示器
  const showIndicatorBefore =
    dropIndicator?.targetType === node.type &&
    dropIndicator?.targetId === node.id &&
    dropIndicator?.position === "before";
  const showIndicatorAfter =
    dropIndicator?.targetType === node.type &&
    dropIndicator?.targetId === node.id &&
    dropIndicator?.position === "after";

  // 计算放置位置（上半部分=before，中间=into，下半部分=after）
  const calculateDropPosition = (e: React.DragEvent): "before" | "into" | "after" => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // 对于文件夹，分三段：上1/4放前面，中间1/2放里面，下1/4放后面
    if (node.type === "folder" && !node.isVirtual && isValidDropTarget()) {
      if (y < height * 0.25) return "before";
      if (y > height * 0.75) return "after";
      return "into";
    }

    // 对于文章或虚拟目录，只分上下两段
    return y < height * 0.5 ? "before" : "after";
  };

  // 拖拽事件处理
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: node.type,
        id: node.id,
        name: node.name,
        parentId: node.parentId,
        isVirtual: node.isVirtual,
      })
    );
    onDragStart({
      type: node.type,
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      isVirtual: node.isVirtual,
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    onDragEnd();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) return;
    // 不能拖到自己上
    if (draggedItem.type === node.type && draggedItem.id === node.id) return;

    const position = calculateDropPosition(e);

    if (position === "into") {
      // 拖入文件夹
      e.dataTransfer.dropEffect = "move";
      onDragOver({ type: "folder", id: node.id });
      onDropIndicatorChange(null);
    } else {
      // 排序：显示指示器
      e.dataTransfer.dropEffect = "move";
      onDragOver({ type: "root" }); // 清除文件夹高亮
      onDropIndicatorChange({
        targetType: node.type,
        targetId: node.id,
        position,
        depth,
      });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    // 不在这里清除，让父组件处理
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('[TreeNodeItem] handleDrop', {
      draggedItem,
      node: { type: node.type, id: node.id, name: node.name, depth }
    });

    if (!draggedItem) {
      console.log('[TreeNodeItem] No draggedItem');
      return;
    }
    if (draggedItem.type === node.type && draggedItem.id === node.id) {
      console.log('[TreeNodeItem] Same node, skipping');
      return;
    }

    const position = calculateDropPosition(e);
    console.log('[TreeNodeItem] Drop position', { position });

    if (position === "into" && isValidDropTarget()) {
      // 拖入文件夹
      console.log('[TreeNodeItem] Calling onDrop with folder target');
      onDrop({ type: "folder", id: node.id });
    } else if (position !== "into") {
      // 排序放置
      const dropTarget = {
        type: "sort" as const,
        targetType: node.type,
        targetId: node.id,
        position,
        depth,
      };
      console.log('[TreeNodeItem] Calling onDrop with sort target', dropTarget);
      onDrop(dropTarget);
    }
  };

  if (node.type === "folder") {
    const isVirtualFolder = node.isVirtual === true;

    const folderContent = (
      <div className="relative">
        {/* 排序指示器 - 上方 */}
        {showIndicatorBefore && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-primary z-10 pointer-events-none"
            style={{ top: -1, marginLeft: `${depth * 20 + 8}px` }}
          />
        )}
        <button
          draggable={!isEditing}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => onToggleFolder(node.id)}
          className={cn(
            "flex items-center w-full px-2 py-1 text-sm hover:bg-accent rounded-sm group",
            "text-left transition-colors overflow-hidden",
            isDragging && "opacity-50",
            isDropTargetNode && "bg-primary/20 ring-2 ring-primary ring-inset"
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 mr-1 shrink-0 transition-transform",
              isExpanded && "rotate-90"
            )}
          />
          {isVirtualFolder ? (
            <Globe className="h-4 w-4 mr-2 shrink-0 text-blue-500" />
          ) : isExpanded ? (
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
            <span className="truncate flex-1 min-w-0 text-foreground">
              {node.name}
            </span>
          )}
        </button>
        {/* 排序指示器 - 下方 */}
        {showIndicatorAfter && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-primary z-10 pointer-events-none"
            style={{ bottom: -1, marginLeft: `${depth * 20 + 8}px` }}
          />
        )}
      </div>
    );

    return (
      <div>
        {isVirtualFolder ? (
          folderContent
        ) : (
          <ContextMenu>
            <ContextMenuTrigger>
              {folderContent}
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
        )}

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
                  dropIndicator={dropIndicator}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onDropIndicatorChange={onDropIndicatorChange}
                  allFolders={allFolders}
                  onArticleClick={onArticleClick}
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
        <div className="relative">
          {/* 排序指示器 - 上方 */}
          {showIndicatorBefore && (
            <div
              className="absolute left-0 right-0 h-0.5 bg-primary z-10 pointer-events-none"
              style={{ top: -1, marginLeft: `${depth * 20 + 8}px` }}
            />
          )}
          <Link
            draggable={!isEditing}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMouseEnter={handleArticleMouseEnter}
            onMouseLeave={handleArticleMouseLeave}
            to="/articles/$id/edit"
            params={{ id: String(node.id) }}
            onClick={onArticleClick}
            className={cn(
              "flex items-center w-full px-2 py-1 text-sm hover:bg-accent rounded-sm group",
              "transition-colors text-foreground overflow-hidden",
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
              <span className="truncate flex-1 min-w-0">{node.name}</span>
            )}
          </Link>
          {/* 排序指示器 - 下方 */}
          {showIndicatorAfter && (
            <div
              className="absolute left-0 right-0 h-0.5 bg-primary z-10 pointer-events-none"
              style={{ bottom: -1, marginLeft: `${depth * 20 + 8}px` }}
            />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() =>
            navigate({ to: "/articles/$id/edit", params: { id: String(node.id) } })
          }
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
