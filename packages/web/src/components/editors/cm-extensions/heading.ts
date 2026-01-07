/**
 * 标题渲染扩展
 * 隐藏 # 符号，显示标题级别指示器和折叠按钮
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
import {
  foldHeadingEffect,
  unfoldHeadingEffect,
  getHeadingsWithRanges,
  isRangeFolded,
  type HeadingInfo,
} from "./headingFold";

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

      // 获取所有标题的折叠范围信息
      const headings = getHeadingsWithRanges(this.view);
      const headingMap = new Map<number, HeadingInfo>();
      for (const h of headings) {
        headingMap.set(h.lineStart, h);
      }

      for (const { from, to } of this.view.visibleRanges) {
        this.getDecorationsFor(from, to, decorations, lineDecorations, headingMap, update);
      }

      this.decorations = Decoration.set(decorations, true);
      this.decorations = this.decorations.update({
        add: lineDecorations,
      });
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        const prevDecoCount = this.decorations.size;
        this.recompute(update);
        // 如果装饰数量变化，请求重新测量
        if (this.decorations.size !== prevDecoCount) {
          this.view.requestMeasure();
        }
      }
      // 监听折叠状态变化
      for (const effect of update.transactions.flatMap(t => t.effects)) {
        if (effect.is(foldHeadingEffect) || effect.is(unfoldHeadingEffect)) {
          this.recompute(update);
          break;
        }
      }
    }

    getDecorationsFor(
      from: number,
      to: number,
      decorations: Range<Decoration>[],
      lineDecorations: Range<Decoration>[],
      headingMap: Map<number, HeadingInfo>,
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
            
            // 获取标题的折叠信息
            const headingInfo = headingMap.get(pos);
            const hasFoldableContent = headingInfo && headingInfo.contentEnd > headingInfo.contentStart;
            const isFolded = headingInfo && hasFoldableContent 
              ? isRangeFolded(this.view, headingInfo.contentStart, headingInfo.contentEnd)
              : false;
            
            // 检查光标是否在当前行
            const cursorOnLine = update && isCursorOnLine(update, pos, pos + line.length);
            
            if (!cursorOnLine) {
              // 隐藏 # 符号，用指示器 widget 替代（包含折叠按钮）
              // inclusive: false 确保选择区域不会被 widget 阻断
              const deco = Decoration.replace({
                widget: new HeadingIndicatorWidget(
                  level,
                  hasFoldableContent ?? false,
                  isFolded,
                  headingInfo?.contentStart ?? 0,
                  headingInfo?.contentEnd ?? 0
                ),
                inclusive: false,
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
 * 标题指示器 Widget（包含折叠按钮）
 */
class HeadingIndicatorWidget extends WidgetType {
  constructor(
    readonly level: number,
    readonly hasFoldableContent: boolean,
    readonly isFolded: boolean,
    readonly contentStart: number,
    readonly contentEnd: number
  ) {
    super();
  }

  eq(other: HeadingIndicatorWidget) {
    return (
      other.level === this.level &&
      other.hasFoldableContent === this.hasFoldableContent &&
      other.isFolded === this.isFolded &&
      other.contentStart === this.contentStart &&
      other.contentEnd === this.contentEnd
    );
  }

  // 返回 -1 表示这是内联 widget，不影响行高计算
  // 这可以帮助 CodeMirror 正确计算选择区域
  get estimatedHeight(): number {
    return -1;
  }

  toDOM(view: EditorView) {
    const container = document.createElement("span");
    container.className = "cm-heading-indicator-container";

    // 折叠按钮（如果有可折叠内容）
    if (this.hasFoldableContent) {
      const foldButton = document.createElement("span");
      foldButton.className = `cm-heading-fold-button ${this.isFolded ? "folded" : "expanded"}`;
      foldButton.title = this.isFolded ? "展开" : "折叠";

      // 使用 SVG 箭头图标
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "12");
      svg.setAttribute("height", "12");
      svg.setAttribute("viewBox", "0 0 16 16");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      if (this.isFolded) {
        // 向右箭头 (已折叠，点击展开)
        path.setAttribute("d", "M6 4l4 4-4 4");
      } else {
        // 向下箭头 (已展开，点击折叠)
        path.setAttribute("d", "M4 6l4 4 4-4");
      }
      svg.appendChild(path);
      foldButton.appendChild(svg);

      // 点击处理
      const contentStart = this.contentStart;
      const contentEnd = this.contentEnd;
      const isFolded = this.isFolded;

      foldButton.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isFolded) {
          view.dispatch({
            effects: unfoldHeadingEffect.of({ from: contentStart, to: contentEnd }),
          });
        } else {
          view.dispatch({
            effects: foldHeadingEffect.of({ from: contentStart, to: contentEnd }),
          });
        }
      });

      container.appendChild(foldButton);
    }

    // 标题级别指示器
    const indicator = document.createElement("span");
    indicator.className = `cm-heading-indicator cm-h${this.level}-indicator`;
    indicator.textContent = `H${this.level}`;
    container.appendChild(indicator);

    return container;
  }

  ignoreEvent(event: Event): boolean {
    // 允许点击事件传播到折叠按钮
    return event.type !== "mousedown";
  }
}

// 标题主题样式
const headingTheme = EditorView.baseTheme({
  // 标题行基础样式
  ".cm-heading": {
    fontWeight: "600",
  },
  // 各级标题字号和行高
  // 设置明确的 lineHeight 确保 CodeMirror 能正确计算选择区域
  // 使用 "normal" 让浏览器根据字体大小自动计算，避免选择偏移
  ".cm-h1": { fontSize: "1.875em", lineHeight: "1.4" },
  ".cm-h2": { fontSize: "1.5em", lineHeight: "1.4" },
  ".cm-h3": { fontSize: "1.25em", lineHeight: "1.5" },
  ".cm-h4": { fontSize: "1.125em", lineHeight: "1.6" },
  ".cm-h5": { fontSize: "1em", lineHeight: "1.75" },
  ".cm-h6": { fontSize: "0.875em", lineHeight: "1.75", color: "var(--muted-foreground, #666)" },

  // 标题指示器容器 - 使用 baseline 对齐确保与文本一致
  ".cm-heading-indicator-container": {
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
    marginRight: "0.25em",
    verticalAlign: "baseline",
    // 确保高度不超过文本高度
    height: "1em",
  },

  // 折叠按钮样式
  ".cm-heading-fold-button": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    cursor: "pointer",
    color: "var(--muted-foreground, #888)",
    borderRadius: "3px",
    transition: "all 0.15s ease",
    opacity: "0.5",
  },

  ".cm-heading-fold-button:hover": {
    backgroundColor: "var(--muted, rgba(0,0,0,0.06))",
    color: "var(--foreground, #333)",
    opacity: "1",
  },

  ".cm-heading-fold-button.folded": {
    color: "var(--primary, #3b82f6)",
    opacity: "0.7",
  },

  ".cm-heading-fold-button.folded:hover": {
    backgroundColor: "hsl(var(--primary) / 0.1)",
    color: "var(--primary, #3b82f6)",
    opacity: "1",
  },

  // 标题指示器样式
  ".cm-heading-indicator": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "1.5em",
    height: "1.2em",
    padding: "0 0.2em",
    fontSize: "0.6em",
    fontWeight: "bold",
    color: "var(--muted-foreground, #888)",
    backgroundColor: "var(--muted, #f0f0f0)",
    borderRadius: "3px",
  },
});
