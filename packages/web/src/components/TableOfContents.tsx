import { useMemo } from "react";
import { cn } from "@/lib/utils";

// 标题项接口
export interface HeadingItem {
  id: string;
  text: string;
  level: number; // 1-5
}

// 从 Markdown 内容中提取标题（支持 h1-h5）
export function extractHeadings(markdown: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const lines = markdown.split("\n");
  
  // 用于生成唯一 ID
  const idCountMap = new Map<string, number>();
  
  for (const line of lines) {
    // 匹配 # 到 ##### 的标题（最多5级）
    const match = line.match(/^(#{1,5})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      
      // 生成 slug 作为 ID
      const baseId = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, "-") // 保留中文字符
        .replace(/^-|-$/g, "");
      
      // 处理重复 ID
      const count = idCountMap.get(baseId) || 0;
      idCountMap.set(baseId, count + 1);
      const id = count > 0 ? `${baseId}-${count}` : baseId;
      
      headings.push({ id, text, level });
    }
  }
  
  return headings;
}

interface TableOfContentsProps {
  content: string;
  className?: string;
  onHeadingClick?: (heading: HeadingItem) => void;
  activeHeadingId?: string;
}

export function TableOfContents({
  content,
  className,
  onHeadingClick,
  activeHeadingId,
}: TableOfContentsProps) {
  // 提取标题
  const headings = useMemo(() => extractHeadings(content), [content]);
  
  if (headings.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground py-4 px-3", className)}>
        暂无标题
      </div>
    );
  }
  
  // 计算最小层级，用于相对缩进
  const minLevel = Math.min(...headings.map(h => h.level));
  
  return (
    <div className={cn("h-full overflow-hidden", className)}>
      <div className="h-full overflow-y-auto overflow-x-hidden">
        <nav className="py-2 px-2">
          <ul className="space-y-0.5">
            {headings.map((heading, index) => {
              const indent = (heading.level - minLevel) * 10; // 每级缩进 10px
              const isActive = activeHeadingId === heading.id;
              
              return (
                <li key={`${heading.id}-${index}`}>
                  <div
                    onClick={() => onHeadingClick?.(heading)}
                    className={cn(
                      "flex items-center py-1.5 pr-2 rounded-md text-sm transition-colors cursor-pointer",
                      "hover:bg-accent/50 hover:text-accent-foreground",
                      isActive 
                        ? "bg-accent text-accent-foreground font-medium" 
                        : "text-muted-foreground"
                    )}
                    style={{ paddingLeft: `${6 + indent}px` }}
                    title={heading.text}
                  >
                    <span className={cn(
                      "shrink-0 text-xs opacity-50 mr-1",
                      heading.level === 1 && "font-semibold",
                    )}>
                      H{heading.level}
                    </span>
                    <span className="truncate">{heading.text}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default TableOfContents;
