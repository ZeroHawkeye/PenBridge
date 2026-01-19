import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MatchPosition {
  range: Range;
  index: number;
}

interface EditorSearchBoxProps {
  isOpen: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
  initialSearchText?: string;
}

// 搜索高亮的样式类名
const HIGHLIGHT_CLASS = "editor-search-highlight";
const HIGHLIGHT_CURRENT_CLASS = "editor-search-highlight-current";

export function EditorSearchBox({ isOpen, onClose, containerRef, initialSearchText }: EditorSearchBoxProps) {
  const [searchText, setSearchText] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement | null>(null);
  const matchPositionsRef = useRef<MatchPosition[]>([]);

  // 创建高亮层
  const ensureHighlightLayer = useCallback(() => {
    const container = containerRef.current;
    if (!container) return null;

    let layer = highlightLayerRef.current;
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "editor-search-highlight-layer";
      layer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 0;
        overflow: visible;
      `;
      
      // 将高亮层添加到滚动容器内，使用滚动容器作为定位参考
      container.style.position = "relative";
      container.appendChild(layer);
      highlightLayerRef.current = layer;
    }
    return layer;
  }, [containerRef]);

  // 清除所有高亮
  const clearHighlights = useCallback(() => {
    const layer = highlightLayerRef.current;
    if (layer) {
      layer.innerHTML = "";
    }
    matchPositionsRef.current = [];
    setMatchCount(0);
    setCurrentIndex(0);
  }, []);



  // 渲染高亮
  const renderHighlights = useCallback((currentIdx: number) => {
    const layer = ensureHighlightLayer();
    if (!layer) return;

    const container = containerRef.current;
    if (!container) return;

    // 清除现有高亮
    layer.innerHTML = "";

    // 使用滚动容器的 rect 作为参考，需要考虑滚动偏移
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;

    // 渲染每个匹配的高亮
    matchPositionsRef.current.forEach((match, idx) => {
      try {
        const rects = match.range.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i];
          if (rect.width > 0 && rect.height > 0) {
            // 计算相对于滚动容器内容的位置（需要加上滚动偏移）
            const highlight = document.createElement("div");
            highlight.className = idx === currentIdx 
              ? `${HIGHLIGHT_CLASS} ${HIGHLIGHT_CURRENT_CLASS}` 
              : HIGHLIGHT_CLASS;
            highlight.style.cssText = `
              position: absolute;
              left: ${rect.left - containerRect.left + scrollLeft}px;
              top: ${rect.top - containerRect.top + scrollTop}px;
              width: ${rect.width}px;
              height: ${rect.height}px;
              pointer-events: none;
            `;
            layer.appendChild(highlight);
          }
        }
      } catch {
        // 忽略无效的 range
      }
    });
  }, [containerRef, ensureHighlightLayer]);

  // 执行搜索
  const performSearch = useCallback((query: string) => {
    clearHighlights();

    if (!query.trim() || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    // 获取编辑器内容区域 - 支持 Vditor 三种模式和旧版 Milkdown/ProseMirror
    const editor = container.querySelector(".vditor-ir")           // Vditor 即时渲染模式
      || container.querySelector(".vditor-wysiwyg")                // Vditor 所见即所得模式
      || container.querySelector(".vditor-sv")                     // Vditor 分屏预览模式
      || container.querySelector(".vditor")                        // Vditor 容器
      || container.querySelector(".ProseMirror")                   // ProseMirror (保留兼容)
      || container.querySelector(".milkdown")
      || container.querySelector(".milkdown-editor");
    
    if (!editor) {
      console.warn("[EditorSearchBox] 未找到编辑器内容区域");
      return;
    }

    const matches: MatchPosition[] = [];
    const queryLower = query.toLowerCase();

    // 使用 TreeWalker 遍历所有文本节点
    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tagName = parent.tagName.toLowerCase();
          if (tagName === "script" || tagName === "style") {
            return NodeFilter.FILTER_REJECT;
          }
          // 跳过不可见的文本
          const style = window.getComputedStyle(parent);
          if (style.display === "none" || style.visibility === "hidden") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const text = textNode.textContent || "";
      const textLower = text.toLowerCase();
      
      let startIndex = 0;
      let matchIndex: number;

      while ((matchIndex = textLower.indexOf(queryLower, startIndex)) !== -1) {
        try {
          const range = document.createRange();
          range.setStart(textNode, matchIndex);
          range.setEnd(textNode, matchIndex + query.length);

          matches.push({
            range,
            index: matches.length,
          });
        } catch {
          // 忽略无效的范围
        }

        startIndex = matchIndex + query.length;
      }
    }

    matchPositionsRef.current = matches;
    setMatchCount(matches.length);

    if (matches.length > 0) {
      setCurrentIndex(0);
      renderHighlights(0);
      scrollToMatch(0);
    }
  }, [containerRef, clearHighlights, renderHighlights]);

  // 滚动到指定匹配项
  const scrollToMatch = useCallback((index: number) => {
    const matches = matchPositionsRef.current;
    if (index < 0 || index >= matches.length) return;

    const match = matches[index];
    const scrollContainer = containerRef.current;
    
    if (!scrollContainer) return;

    try {
      const rect = match.range.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      // 检查是否在可视区域
      const isVisible = 
        rect.top >= containerRect.top + 50 &&
        rect.bottom <= containerRect.bottom - 50;

      if (!isVisible) {
        const scrollTop = scrollContainer.scrollTop;
        const targetTop = rect.top - containerRect.top + scrollTop - containerRect.height / 2 + rect.height / 2;
        
        scrollContainer.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth",
        });

        // 滚动后重新渲染高亮（因为位置会变）
        setTimeout(() => {
          renderHighlights(index);
        }, 300);
      }
    } catch {
      // 忽略错误
    }
  }, [containerRef, renderHighlights]);

  // 导航到下一个结果
  const goToNext = useCallback(() => {
    if (matchCount === 0) return;
    const nextIndex = (currentIndex + 1) % matchCount;
    setCurrentIndex(nextIndex);
    renderHighlights(nextIndex);
    scrollToMatch(nextIndex);
  }, [matchCount, currentIndex, renderHighlights, scrollToMatch]);

  // 导航到上一个结果
  const goToPrevious = useCallback(() => {
    if (matchCount === 0) return;
    const prevIndex = (currentIndex - 1 + matchCount) % matchCount;
    setCurrentIndex(prevIndex);
    renderHighlights(prevIndex);
    scrollToMatch(prevIndex);
  }, [matchCount, currentIndex, renderHighlights, scrollToMatch]);

  // 处理输入变化
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    performSearch(value);
  }, [performSearch]);

  // 处理关闭
  const handleClose = useCallback(() => {
    clearHighlights();
    setSearchText("");
    // 移除高亮层
    if (highlightLayerRef.current) {
      highlightLayerRef.current.remove();
      highlightLayerRef.current = null;
    }
    onClose();
  }, [clearHighlights, onClose]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevious();
      } else {
        goToNext();
      }
    }
  }, [handleClose, goToNext, goToPrevious]);

  // 监听滚动事件，更新高亮位置
  useEffect(() => {
    if (!isOpen || matchCount === 0) return;

    const container = containerRef.current;
    if (!container) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        renderHighlights(currentIndex);
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [isOpen, matchCount, currentIndex, containerRef, renderHighlights]);

  // 打开时聚焦输入框，并处理初始搜索文本
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // 如果有初始搜索文本，填充并执行搜索
      if (initialSearchText && initialSearchText.trim()) {
        setSearchText(initialSearchText);
        performSearch(initialSearchText);
      }
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen, initialSearchText, performSearch]);

  // 关闭时清理
  useEffect(() => {
    if (!isOpen) {
      clearHighlights();
      if (highlightLayerRef.current) {
        highlightLayerRef.current.remove();
        highlightLayerRef.current = null;
      }
    }
  }, [isOpen, clearHighlights]);

  if (!isOpen) return null;

  return (
    <div 
      className="h-0 overflow-visible"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div 
        className="flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1.5 animate-in fade-in-0 slide-in-from-top-2 duration-200"
        style={{
          position: "absolute",
          top: 8,
          right: 16,
        }}
      >
        <Input
          ref={inputRef}
          type="text"
          placeholder="搜索..."
          value={searchText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-48 h-8 text-sm"
        />
        
        {/* 结果计数 */}
        {searchText && (
          <span className="text-xs text-muted-foreground px-2 whitespace-nowrap min-w-[60px] text-center">
            {matchCount > 0 ? `${currentIndex + 1}/${matchCount}` : "0/0"}
          </span>
        )}

        {/* 导航按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={goToPrevious}
          disabled={matchCount === 0}
          title="上一个 (Shift+Enter)"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={goToNext}
          disabled={matchCount === 0}
          title="下一个 (Enter)"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>

        {/* 关闭按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleClose}
          title="关闭 (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default EditorSearchBox;
