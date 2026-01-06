/**
 * 标题渲染扩展
 * 隐藏 # 符号，根据级别放大显示
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
import { isCursorOnLine } from "./utils";

// 匹配标题行开头的 # 符号
export const headingRE = /^#{1,6}\s/;

const MAX_HEADING_LEVEL = 6;

/**
 * 标题渲染扩展
 */
export function headingExtension(): Extension {
  return [headingDecorationPlugin, headingTheme];
}

// 标题装饰插件
const headingDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    constructor(public view: EditorView) {
      this.recompute();
    }

    recompute(update?: ViewUpdate) {
      const decorations: Range<Decoration>[] = [];
      const lineDecorations: Range<Decoration>[] = [];

      for (const { from, to } of this.view.visibleRanges) {
        this.getDecorationsFor(from, to, decorations, lineDecorations, update);
      }

      this.decorations = Decoration.set(decorations, true);
      this.decorations = this.decorations.update({
        add: lineDecorations,
      });
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
      lineDecorations: Range<Decoration>[],
      update?: ViewUpdate
    ) {
      const { state } = this.view;
      const { doc } = state;

      // 遍历可见范围内的每一行
      let pos = from;
      const iter = doc.iterRange(from, to);
      
      while (!iter.next().done) {
        if (!iter.lineBreak) {
          const line = iter.value;
          const match = line.match(headingRE);
          
          if (match) {
            const hashCount = (match[0].match(/#/g) || []).length;
            const level = Math.min(hashCount, MAX_HEADING_LEVEL);
            
            // 检查光标是否在当前行
            const cursorOnLine = update && isCursorOnLine(update, pos, pos + line.length);
            
            if (!cursorOnLine) {
              // 隐藏 # 符号，用指示器 widget 替代
              const deco = Decoration.replace({
                widget: new HeadingIndicatorWidget(level),
                inclusive: true,
              });
              decorations.push(deco.range(pos, pos + match[0].length));
            }
            
            // 添加行级装饰（应用标题样式）
            const headingLine = Decoration.line({
              attributes: {
                class: `cm-heading cm-h${level}`,
              },
            });
            lineDecorations.push(headingLine.range(pos));
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
 * 标题指示器 Widget
 */
class HeadingIndicatorWidget extends WidgetType {
  constructor(readonly level: number) {
    super();
  }

  eq(other: HeadingIndicatorWidget) {
    return other.level === this.level;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = `cm-heading-indicator cm-h${this.level}-indicator`;
    span.textContent = `H${this.level}`;
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// 标题主题样式
const headingTheme = EditorView.baseTheme({
  // 标题行基础样式
  ".cm-heading": {
    fontWeight: "600",
  },
  // 各级标题字号
  ".cm-h1": { fontSize: "1.875em", lineHeight: "1.3" },
  ".cm-h2": { fontSize: "1.5em", lineHeight: "1.35" },
  ".cm-h3": { fontSize: "1.25em", lineHeight: "1.4" },
  ".cm-h4": { fontSize: "1.125em", lineHeight: "1.45" },
  ".cm-h5": { fontSize: "1em", lineHeight: "1.5" },
  ".cm-h6": { fontSize: "0.875em", lineHeight: "1.5", color: "var(--muted-foreground, #666)" },
  
  // 标题指示器样式
  ".cm-heading-indicator": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.5em",
    height: "1.2em",
    marginRight: "0.25em",
    fontSize: "0.6em",
    fontWeight: "bold",
    color: "var(--muted-foreground, #888)",
    backgroundColor: "var(--muted, #f0f0f0)",
    borderRadius: "3px",
    verticalAlign: "middle",
  },
});
