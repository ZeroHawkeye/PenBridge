/**
 * 对齐语法渲染扩展
 * 支持 :::left :::right :::center :::justify 语法
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

/**
 * 对齐语法渲染扩展
 */
export function alignmentExtension(): Extension {
  return [alignmentDecorationPlugin, alignmentTheme];
}

// 对齐类型
type AlignType = "left" | "right" | "center" | "justify";

// 对齐块状态
interface AlignmentBlockState {
  isInBlock: boolean;
  alignType: AlignType | null;
  startLine: number;
}

// 对齐块开始正则: :::left, :::right, :::center, :::justify
const alignStartRE = /^:::(left|right|center|justify)\s*$/;
// 对齐块结束正则: :::
const alignEndRE = /^:::\s*$/;

// 对齐装饰插件
const alignmentDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    constructor(public view: EditorView) {
      this.recompute();
    }

    recompute(update?: ViewUpdate) {
      const decorations: Range<Decoration>[] = [];
      const lineDecorations: Range<Decoration>[] = [];

      // 需要遍历整个文档来正确识别对齐块
      const { doc } = this.view.state;
      const state: AlignmentBlockState = {
        isInBlock: false,
        alignType: null,
        startLine: 0,
      };

      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const text = line.text;

        // 检查对齐块开始
        const startMatch = text.match(alignStartRE);
        if (startMatch && !state.isInBlock) {
          state.isInBlock = true;
          state.alignType = startMatch[1] as AlignType;
          state.startLine = i;

          if (this.isInVisibleRange(line.from)) {
            const cursorOnLine =
              update && isCursorOnLine(update, line.from, line.to);

            // 对齐块开始行装饰
            const lineDeco = Decoration.line({
              attributes: {
                class: `cm-md-align cm-md-align-start cm-md-align-${state.alignType}`,
              },
            });
            lineDecorations.push(lineDeco.range(line.from));

            // 如果光标不在当前行，替换显示
            if (!cursorOnLine) {
              const deco = Decoration.replace({
                widget: new AlignmentStartWidget(state.alignType),
              });
              decorations.push(deco.range(line.from, line.to));
            }
          }
          continue;
        }

        // 检查对齐块结束
        if (alignEndRE.test(text) && state.isInBlock) {
          if (this.isInVisibleRange(line.from)) {
            const cursorOnLine =
              update && isCursorOnLine(update, line.from, line.to);

            const lineDeco = Decoration.line({
              attributes: {
                class: `cm-md-align cm-md-align-end cm-md-align-${state.alignType}`,
              },
            });
            lineDecorations.push(lineDeco.range(line.from));

            // 如果光标不在当前行，隐藏结束标记
            if (!cursorOnLine) {
              const deco = Decoration.replace({
                widget: new AlignmentEndWidget(),
              });
              decorations.push(deco.range(line.from, line.to));
            }
          }

          state.isInBlock = false;
          state.alignType = null;
          continue;
        }

        // 对齐块内容行
        if (state.isInBlock && state.alignType) {
          if (this.isInVisibleRange(line.from)) {
            const lineDeco = Decoration.line({
              attributes: {
                class: `cm-md-align cm-md-align-content cm-md-align-${state.alignType}`,
              },
            });
            lineDecorations.push(lineDeco.range(line.from));
          }
        }
      }

      this.decorations = Decoration.set(decorations, true);
      this.decorations = this.decorations.update({
        add: lineDecorations,
      });
    }

    isInVisibleRange(pos: number): boolean {
      for (const { from, to } of this.view.visibleRanges) {
        if (pos >= from && pos <= to) {
          return true;
        }
      }
      return false;
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.recompute(update);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * 对齐块开始 Widget
 */
class AlignmentStartWidget extends WidgetType {
  constructor(readonly alignType: AlignType) {
    super();
  }

  eq(other: AlignmentStartWidget) {
    return other.alignType === this.alignType;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-align-indicator";
    
    // 显示对齐类型图标
    const icons: Record<AlignType, string> = {
      left: "⬅",
      right: "➡",
      center: "↔",
      justify: "⇔",
    };
    
    span.textContent = icons[this.alignType];
    span.title = `对齐: ${this.alignType}`;
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 对齐块结束 Widget
 */
class AlignmentEndWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-align-end-indicator";
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// 对齐主题样式
const alignmentTheme = EditorView.baseTheme({
  // 对齐指示器
  ".cm-md-align-indicator": {
    display: "inline-block",
    fontSize: "0.75em",
    color: "var(--muted-foreground, #888)",
    backgroundColor: "var(--muted, #f0f0f0)",
    padding: "0.1em 0.4em",
    borderRadius: "3px",
  },
  ".cm-md-align-end-indicator": {
    display: "block",
    height: "0.25em",
  },
  // 对齐内容样式
  ".cm-md-align-content.cm-md-align-left": {
    textAlign: "left",
  },
  ".cm-md-align-content.cm-md-align-right": {
    textAlign: "right",
  },
  ".cm-md-align-content.cm-md-align-center": {
    textAlign: "center",
  },
  ".cm-md-align-content.cm-md-align-justify": {
    textAlign: "justify",
  },
  // 对齐块边框指示
  ".cm-md-align-start": {
    borderTop: "1px dashed var(--border, #e5e7eb)",
    paddingTop: "0.25em",
    marginTop: "0.5em",
  },
  ".cm-md-align-end": {
    borderBottom: "1px dashed var(--border, #e5e7eb)",
    paddingBottom: "0.25em",
    marginBottom: "0.5em",
  },
});
