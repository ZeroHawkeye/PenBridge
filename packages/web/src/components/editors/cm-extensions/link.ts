/**
 * 链接渲染扩展
 * 将 [text](url) 渲染为可点击的链接
 * 使用 mark 装饰而非 replace，避免选择区域偏移问题
 */

import { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { isCursorInside } from "./utils";

/**
 * 链接渲染扩展
 */
export function linkExtension(): Extension {
  return [linkDecorationPlugin, linkClickHandler, linkTheme];
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

          // Markdown 链接 - 使用 mark 装饰
          linkRE.lastIndex = 0;
          let match;
          while ((match = linkRE.exec(text)) !== null) {
            const matchStart = pos + match.index;
            const matchEnd = matchStart + match[0].length;

            // 光标在链接内时显示源码
            if (update && isCursorInside(update, matchStart, matchEnd)) {
              continue;
            }

            const linkText = match[1];
            const url = match[2];
            const title = match[3];

            // 隐藏开头的 [
            decorations.push(
              Decoration.mark({
                class: "cm-md-link-syntax-hidden",
              }).range(matchStart, matchStart + 1)
            );

            // 链接文字部分 - 添加链接样式和 data 属性
            decorations.push(
              Decoration.mark({
                class: "cm-md-link",
                attributes: {
                  "data-url": url,
                  "data-title": title || "",
                },
              }).range(matchStart + 1, matchStart + 1 + linkText.length)
            );

            // 隐藏 ](url) 或 ](url "title") 部分
            decorations.push(
              Decoration.mark({
                class: "cm-md-link-syntax-hidden",
              }).range(matchStart + 1 + linkText.length, matchEnd)
            );
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
            const hasAngleBrackets = match[0].startsWith("<");

            if (hasAngleBrackets) {
              // 隐藏 <
              decorations.push(
                Decoration.mark({
                  class: "cm-md-link-syntax-hidden",
                }).range(matchStart, matchStart + 1)
              );

              // URL 部分
              decorations.push(
                Decoration.mark({
                  class: "cm-md-link cm-md-auto-link",
                  attributes: {
                    "data-url": url,
                  },
                }).range(matchStart + 1, matchEnd - 1)
              );

              // 隐藏 >
              decorations.push(
                Decoration.mark({
                  class: "cm-md-link-syntax-hidden",
                }).range(matchEnd - 1, matchEnd)
              );
            } else {
              // 普通 URL，只添加样式
              decorations.push(
                Decoration.mark({
                  class: "cm-md-link cm-md-auto-link",
                  attributes: {
                    "data-url": url,
                  },
                }).range(matchStart, matchEnd)
              );
            }
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

// 链接点击处理
const linkClickHandler = EditorView.domEventHandlers({
  click(event, _view) {
    const target = event.target as HTMLElement;
    
    // 检查是否点击了链接
    if (target.classList.contains("cm-md-link")) {
      const url = target.getAttribute("data-url");
      if (url && (event.ctrlKey || event.metaKey)) {
        // Ctrl/Cmd + Click 打开链接
        window.open(url, "_blank", "noopener,noreferrer");
        event.preventDefault();
        return true;
      }
    }
    
    return false;
  },
});

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
  // 隐藏语法标记
  ".cm-md-link-syntax-hidden": {
    fontSize: "0",
    width: "0",
    display: "inline-block",
    overflow: "hidden",
  },
});
