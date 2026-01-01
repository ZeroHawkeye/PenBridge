import { useState, useCallback, useEffect } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { EditableInput } from "./EditableInput";
import type { TreeNode, DragData, DropTarget, FolderItem } from "./types";

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
  onDragStart: (data: DragData) => void;
  onDragEnd: () => void;
  onDragOver: (target: DropTarget) => void;
  onDragLeave: () => void;
  onDrop: (target: DropTarget) => void;
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
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
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
  const isExpanded = node.type === "folder" && expandedFolders.has(node.id);

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
  const isDragging =
    draggedItem?.type === node.type && draggedItem?.id === node.id;

  // 检查当前文件夹是否是有效的放置目标
  const isValidDropTarget = useCallback(() => {
    if (!draggedItem) return false;
    if (node.type !== "folder") return false;
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

  // 检查当前节点是否是放置目标
  const isDropTargetNode =
    dropTarget?.type === "folder" &&
    dropTarget?.id === node.id &&
    isValidDropTarget();

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
      })
    );
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
                <span className="truncate flex-1 min-w-0 text-foreground">
                  {node.name}
                </span>
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
        <Link
          draggable={!isEditing}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
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
