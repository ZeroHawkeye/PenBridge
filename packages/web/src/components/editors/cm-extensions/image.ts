/**
 * 图片预览扩展
 * 将 ![alt](url) 渲染为内联图片
 * 点击图片时显示源码（将光标移动到图片语法位置）
 */

import { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { isCursorInside, toAbsoluteImageUrl } from "./utils";

/**
 * 图片预览扩展
 */
export function imageExtension(): Extension {
  return [imageDecorationPlugin, imageClickHandler, imageTheme];
}

// 图片正则: ![alt](url) 或 ![alt](url "title") 或带尺寸 ![alt](url =100x)
const imageRE = /!\[([^\[\]]*)\]\(([^\)\s]+)(?:\s"([^"]*)")?(?:\s=(\d+x\d*))?\)/g;

// 图片装饰插件
const imageDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    constructor(public view: EditorView) {
      this.recompute();
    }

    recompute(update?: ViewUpdate) {
      const decorations: Range<Decoration>[] = [];

      for (const { from, to } of this.view.visibleRanges) {
        this.getDecorationsFor(from, to, decorations, update);
      }

      this.decorations = Decoration.set(decorations, true);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        const prevDecoCount = this.decorations.size;
        this.recompute(update);
        
        // 如果装饰数量变化（说明有图片语法被显示/隐藏），请求重新测量
        if (this.decorations.size !== prevDecoCount) {
          this.view.requestMeasure();
        }
      }
    }

    getDecorationsFor(
      from: number,
      to: number,
      decorations: Range<Decoration>[],
      update?: ViewUpdate
    ) {
      const { doc } = this.view.state;

      let pos = from;
      const iter = doc.iterRange(from, to);

      while (!iter.next().done) {
        if (!iter.lineBreak) {
          const text = iter.value;

          imageRE.lastIndex = 0;
          let match;
          while ((match = imageRE.exec(text)) !== null) {
            const matchStart = pos + match.index;
            const matchEnd = matchStart + match[0].length;

            if (update && isCursorInside(update, matchStart, matchEnd, false)) {
              continue;
            }

            const deco = Decoration.replace({
              widget: new ImageWidget({
                alt: match[1],
                url: match[2],
                title: match[3],
                size: match[4],
                from: matchStart,
                to: matchEnd,
              }),
              inclusive: false,
            });
            decorations.push(deco.range(matchStart, matchEnd));
          }
        }
        pos += iter.value.length;
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// 图片点击处理扩展 - 点击图片或错误信息时将光标移动到图片语法位置
const imageClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    const target = event.target as HTMLElement;
    
    // 检查是否点击了图片或错误信息
    if (target.classList.contains("cm-md-image") || target.classList.contains("cm-md-image-error")) {
      const container = target.closest(".cm-md-image-container");
      if (!container) return false;
      
      // 从 data 属性获取图片位置
      const fromStr = container.getAttribute("data-from");
      
      if (fromStr) {
        const from = parseInt(fromStr, 10);
        
        // 将光标移动到图片语法开始位置（不全选，只定位光标）
        view.dispatch({
          selection: { anchor: from },
          scrollIntoView: true,
        });
        
        // 聚焦编辑器
        view.focus();
        
        return true; // 阻止默认行为
      }
    }
    
    return false;
  },
});

interface ImageSpec {
  alt: string;
  url: string;
  title?: string;
  size?: string; // 格式: "100x" 或 "100x50"
  from: number; // 图片语法的起始位置
  to: number; // 图片语法的结束位置
}

/**
 * 图片 Widget
 */
class ImageWidget extends WidgetType {
  constructor(readonly spec: ImageSpec) {
    super();
  }

  eq(other: ImageWidget) {
    return (
      this.spec.alt === other.spec.alt &&
      this.spec.url === other.spec.url &&
      this.spec.title === other.spec.title &&
      this.spec.size === other.spec.size &&
      this.spec.from === other.spec.from &&
      this.spec.to === other.spec.to
    );
  }

  // 图片可能改变行高，但返回 -1 让 CodeMirror 重新测量
  get estimatedHeight(): number {
    return -1;
  }

  toDOM() {
    const container = document.createElement("span");
    container.className = "cm-md-image-container";
    // 存储位置信息用于点击处理
    container.setAttribute("data-from", String(this.spec.from));
    container.setAttribute("data-to", String(this.spec.to));

    const img = document.createElement("img");
    img.className = "cm-md-image";
    img.alt = this.spec.alt || "";
    img.src = toAbsoluteImageUrl(this.spec.url);
    
    if (this.spec.title) {
      img.title = this.spec.title;
    }

    // 处理尺寸
    if (this.spec.size) {
      const [width, height] = this.spec.size.split("x");
      if (width) {
        img.style.width = `${width}px`;
      }
      if (height) {
        img.style.height = `${height}px`;
      }
    }

    // 加载错误处理
    img.addEventListener("error", () => {
      img.style.display = "none";
      const errorSpan = document.createElement("span");
      errorSpan.className = "cm-md-image-error";
      errorSpan.textContent = `[图片加载失败: ${this.spec.alt || this.spec.url}]`;
      container.appendChild(errorSpan);
    });

    container.appendChild(img);
    return container;
  }

  ignoreEvent(): boolean {
    // 不忽略任何事件，允许点击事件传递
    return false;
  }
}

// 图片主题样式
const imageTheme = EditorView.baseTheme({
  ".cm-md-image-container": {
    display: "inline-block",
    verticalAlign: "middle",
  },
  ".cm-md-image": {
    maxWidth: "100%",
    maxHeight: "400px",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "opacity 0.2s",
    "&:hover": {
      opacity: "0.9",
    },
  },
  ".cm-md-image-error": {
    color: "var(--destructive, #dc2626)",
    fontSize: "0.875em",
    fontStyle: "italic",
    cursor: "pointer",
    "&:hover": {
      textDecoration: "underline",
    },
  },
});
