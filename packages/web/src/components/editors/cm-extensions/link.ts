/**
 * 链接渲染扩展
 * 将 [text](url) 渲染为可点击的链接
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
import { isCursorInside } from "./utils";

/**
 * 链接渲染扩展
 */
export function linkExtension(): Extension {
  return [linkDecorationPlugin, linkTheme];
}

// 链接正则: [text](url) 或 [text](url "title")
const linkRE = /\[([^\[\]]+)\]\(([^\)\s]+)(?:\s"([^"]*)")?\)/g;

// 自动链接: <https://...> 或 https://...
const autoLinkRE = /<(https?:\/\/[^>]+)>|(?<![(\[])https?:\/\/[^\s\)>\]]+/g;

// 链接装饰插件
const linkDecorationPlugin = ViewPlugin.fromClass(
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

      decorations.sort((a, b) => a.from - b.from);
      this.decorations = Decoration.set(decorations, true);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.recompute(update);
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

          // Markdown 链接
          linkRE.lastIndex = 0;
          let match;
          while ((match = linkRE.exec(text)) !== null) {
            const matchStart = pos + match.index;
            const matchEnd = matchStart + match[0].length;

            if (update && isCursorInside(update, matchStart, matchEnd)) {
              continue;
            }

            const deco = Decoration.replace({
              widget: new LinkWidget(match[1], match[2], match[3]),
            });
            decorations.push(deco.range(matchStart, matchEnd));
          }

          // 自动链接
          autoLinkRE.lastIndex = 0;
          while ((match = autoLinkRE.exec(text)) !== null) {
            const matchStart = pos + match.index;
            const matchEnd = matchStart + match[0].length;

            if (update && isCursorInside(update, matchStart, matchEnd)) {
              continue;
            }

            // 提取 URL（可能被 <> 包裹）
            const url = match[1] || match[0];
            
            const deco = Decoration.replace({
              widget: new LinkWidget(url, url),
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

/**
 * 链接 Widget
 */
class LinkWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly url: string,
    readonly title?: string
  ) {
    super();
  }

  eq(other: LinkWidget) {
    return (
      other.text === this.text &&
      other.url === this.url &&
      other.title === this.title
    );
  }

  toDOM() {
    const link = document.createElement("a");
    link.className = "cm-md-link";
    link.textContent = this.text;
    link.href = this.url;
    if (this.title) {
      link.title = this.title;
    }
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    
    // 阻止编辑器获取焦点
    link.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    
    // Ctrl/Cmd + Click 打开链接
    link.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        window.open(this.url, "_blank", "noopener,noreferrer");
      }
      e.preventDefault();
    });

    return link;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// 链接主题样式
const linkTheme = EditorView.baseTheme({
  ".cm-md-link": {
    color: "var(--primary, #2563eb)",
    textDecoration: "underline",
    textDecorationColor: "var(--primary, #2563eb)",
    textUnderlineOffset: "2px",
    cursor: "pointer",
    "&:hover": {
      textDecorationThickness: "2px",
    },
  },
});
