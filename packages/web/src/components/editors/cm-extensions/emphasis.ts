/**
 * 强调样式渲染扩展
 * 包括：粗体、斜体、删除线、行内代码
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
 * 强调样式渲染扩展
 */
export function emphasisExtension(): Extension {
  return [emphasisDecorationPlugin, emphasisTheme];
}

// 正则表达式
const emphasisPatterns = {
  // 粗体: **text** 或 __text__
  bold: [/\*\*([^\*\n]+?)\*\*(?!\*)/g, /__([^_\n]+?)__(?!_)/g],
  // 斜体: *text* 或 _text_（需要排除粗体）
  italic: [/(?<!\*)\*([^\*\n]+?)\*(?!\*)/g, /(?<!_)_([^_\n]+?)_(?!_)/g],
  // 删除线: ~~text~~
  strikethrough: [/~~([^~\n]+?)~~(?!~)/g],
  // 行内代码: `code`
  inlineCode: [/`([^`\n]+?)`(?!`)/g],
};

// 强调样式装饰插件
const emphasisDecorationPlugin = ViewPlugin.fromClass(
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

      // 按位置排序
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

      // 遍历文档
      let pos = from;
      const iter = doc.iterRange(from, to);

      while (!iter.next().done) {
        if (!iter.lineBreak) {
          const text = iter.value;

          // 粗体
          for (const pattern of emphasisPatterns.bold) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
              const matchStart = pos + match.index;
              const matchEnd = matchStart + match[0].length;
              
              // 检查光标是否在范围内
              if (update && isCursorInside(update, matchStart, matchEnd)) {
                continue;
              }
              
              // 内容不能全是空白
              if (match[1].trim().length === 0) continue;
              
              const deco = Decoration.replace({
                widget: new EmphasisWidget("bold", match[1]),
              });
              decorations.push(deco.range(matchStart, matchEnd));
            }
          }

          // 斜体
          for (const pattern of emphasisPatterns.italic) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
              const matchStart = pos + match.index;
              const matchEnd = matchStart + match[0].length;
              
              if (update && isCursorInside(update, matchStart, matchEnd)) {
                continue;
              }
              
              if (match[1].trim().length === 0) continue;
              
              const deco = Decoration.replace({
                widget: new EmphasisWidget("italic", match[1]),
              });
              decorations.push(deco.range(matchStart, matchEnd));
            }
          }

          // 删除线
          for (const pattern of emphasisPatterns.strikethrough) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
              const matchStart = pos + match.index;
              const matchEnd = matchStart + match[0].length;
              
              if (update && isCursorInside(update, matchStart, matchEnd)) {
                continue;
              }
              
              if (match[1].trim().length === 0) continue;
              
              const deco = Decoration.replace({
                widget: new EmphasisWidget("strikethrough", match[1]),
              });
              decorations.push(deco.range(matchStart, matchEnd));
            }
          }

          // 行内代码
          for (const pattern of emphasisPatterns.inlineCode) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
              const matchStart = pos + match.index;
              const matchEnd = matchStart + match[0].length;
              
              if (update && isCursorInside(update, matchStart, matchEnd)) {
                continue;
              }
              
              const deco = Decoration.replace({
                widget: new EmphasisWidget("inlineCode", match[1]),
              });
              decorations.push(deco.range(matchStart, matchEnd));
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

type EmphasisType = "bold" | "italic" | "strikethrough" | "inlineCode";

/**
 * 强调样式 Widget
 */
class EmphasisWidget extends WidgetType {
  constructor(
    readonly type: EmphasisType,
    readonly content: string
  ) {
    super();
  }

  eq(other: EmphasisWidget) {
    return other.type === this.type && other.content === this.content;
  }

  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.content;
    
    switch (this.type) {
      case "bold":
        span.className = "cm-md-bold";
        break;
      case "italic":
        span.className = "cm-md-italic";
        break;
      case "strikethrough":
        span.className = "cm-md-strikethrough";
        break;
      case "inlineCode":
        span.className = "cm-md-inline-code";
        break;
    }
    
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// 强调样式主题
const emphasisTheme = EditorView.baseTheme({
  ".cm-md-bold": {
    fontWeight: "bold",
  },
  ".cm-md-italic": {
    fontStyle: "italic",
  },
  ".cm-md-strikethrough": {
    textDecoration: "line-through",
    color: "var(--muted-foreground, #888)",
  },
  ".cm-md-inline-code": {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: "0.9em",
    padding: "0.1em 0.3em",
    backgroundColor: "var(--muted, rgba(0,0,0,0.06))",
    borderRadius: "3px",
  },
});
