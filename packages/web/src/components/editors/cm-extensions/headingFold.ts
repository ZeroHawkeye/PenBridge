/**
 * 标题折叠扩展
 * 只允许标题行折叠其下属内容（到下一个同级或更高级标题为止）
 */

import { Extension, RangeSetBuilder, StateField, StateEffect } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
  gutter,
  GutterMarker,
} from "@codemirror/view";

// 匹配标题行
const headingRE = /^(#{1,6})\s/;

interface HeadingInfo {
  level: number;
  lineStart: number;
  lineEnd: number;
  contentStart: number;
  contentEnd: number;
}

// 折叠状态 Effect
const foldHeadingEffect = StateEffect.define<{ from: number; to: number }>();
const unfoldHeadingEffect = StateEffect.define<{ from: number; to: number }>();

// 折叠状态 StateField
interface FoldedRange {
  from: number;
  to: number;
}

const foldedRangesField = StateField.define<FoldedRange[]>({
  create() {
    return [];
  },
  update(ranges, tr) {
    let newRanges = ranges;

    // 处理文档变化时调整折叠范围
    if (tr.docChanged) {
      newRanges = ranges
        .map((range) => ({
          from: tr.changes.mapPos(range.from, 1),
          to: tr.changes.mapPos(range.to, -1),
        }))
        .filter((range) => range.from < range.to);
    }

    // 处理折叠/展开效果
    for (const effect of tr.effects) {
      if (effect.is(foldHeadingEffect)) {
        const { from, to } = effect.value;
        // 添加新的折叠范围（避免重复）
        if (!newRanges.some((r) => r.from === from && r.to === to)) {
          newRanges = [...newRanges, { from, to }];
        }
      } else if (effect.is(unfoldHeadingEffect)) {
        const { from, to } = effect.value;
        // 移除折叠范围
        newRanges = newRanges.filter((r) => !(r.from === from && r.to === to));
      }
    }

    return newRanges;
  },
});

/**
 * 获取文档中所有标题及其折叠范围
 */
function getHeadingsWithRanges(view: EditorView): HeadingInfo[] {
  const { doc } = view.state;
  const headings: HeadingInfo[] = [];

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const match = line.text.match(headingRE);
    if (match) {
      headings.push({
        level: match[1].length,
        lineStart: line.from,
        lineEnd: line.to,
        contentStart: line.to,
        contentEnd: line.to, // 稍后计算
      });
    }
  }

  // 计算每个标题的内容结束位置
  for (let i = 0; i < headings.length; i++) {
    const current = headings[i];
    let contentEnd = doc.length;

    // 查找下一个同级或更高级别的标题
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= current.level) {
        // 内容结束于下一个同级或更高级标题的行首之前
        contentEnd = headings[j].lineStart - 1;
        break;
      }
    }

    // 确保不超过文档末尾，且有实际内容
    current.contentEnd = Math.max(current.contentStart, Math.min(contentEnd, doc.length));
  }

  return headings;
}

/**
 * 检查某个范围是否已折叠
 */
function isRangeFolded(view: EditorView, from: number, to: number): boolean {
  const foldedRanges = view.state.field(foldedRangesField);
  return foldedRanges.some((r) => r.from === from && r.to === to);
}

/**
 * 折叠箭头 GutterMarker
 */
class FoldMarker extends GutterMarker {
  constructor(
    readonly isFolded: boolean,
    readonly from: number,
    readonly to: number
  ) {
    super();
  }

  eq(other: FoldMarker): boolean {
    return (
      other.isFolded === this.isFolded &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  toDOM(view: EditorView): Node {
    const wrapper = document.createElement("div");
    wrapper.className = `cm-heading-fold-marker ${this.isFolded ? "folded" : "expanded"}`;
    wrapper.title = this.isFolded ? "展开" : "折叠";

    // 使用 SVG 箭头图标
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
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
    wrapper.appendChild(svg);

    // 保存引用用于点击处理
    const from = this.from;
    const to = this.to;
    const isFolded = this.isFolded;

    wrapper.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (isFolded) {
        // 展开
        view.dispatch({
          effects: unfoldHeadingEffect.of({ from, to }),
        });
      } else {
        // 折叠
        view.dispatch({
          effects: foldHeadingEffect.of({ from, to }),
        });
      }
    });

    return wrapper;
  }
}

/**
 * 标题折叠 Gutter
 */
const headingFoldGutter = gutter({
  class: "cm-heading-fold-gutter",
  markers: (view) => {
    const builder = new RangeSetBuilder<GutterMarker>();
    const headings = getHeadingsWithRanges(view);

    for (const heading of headings) {
      // 只有当标题下有内容时才显示折叠按钮
      if (heading.contentEnd > heading.contentStart) {
        const isFolded = isRangeFolded(
          view,
          heading.contentStart,
          heading.contentEnd
        );
        builder.add(
          heading.lineStart,
          heading.lineStart,
          new FoldMarker(isFolded, heading.contentStart, heading.contentEnd)
        );
      }
    }

    return builder.finish();
  },
});

/**
 * 构建折叠装饰
 * 使用 StateField 来处理跨行替换装饰（ViewPlugin 不支持跨行替换）
 */
function buildFoldDecorations(state: { doc: { lineAt: (pos: number) => { number: number } }; field: <T>(field: StateField<T>) => T }): DecorationSet {
  const foldedRanges = state.field(foldedRangesField);
  const decorations: { from: number; to: number; deco: Decoration }[] = [];

  for (const range of foldedRanges) {
    // 计算折叠了多少行
    const fromLine = state.doc.lineAt(range.from);
    const toLine = state.doc.lineAt(range.to);
    const lineCount = toLine.number - fromLine.number;

    if (lineCount > 0 && range.to > range.from) {
      // 替换折叠的内容为占位符
      decorations.push({
        from: range.from,
        to: range.to,
        deco: Decoration.replace({
          widget: new FoldPlaceholderWidget(lineCount, range.from, range.to),
          block: true, // 标记为块级装饰，支持跨行
        }),
      });
    }
  }

  // 按位置排序
  decorations.sort((a, b) => a.from - b.from);

  return Decoration.set(
    decorations.map((d) => d.deco.range(d.from, d.to))
  );
}

/**
 * 折叠装饰 StateField
 * 使用 StateField 代替 ViewPlugin，以支持跨行替换装饰
 */
const foldDecorationField = StateField.define<DecorationSet>({
  create(state) {
    return buildFoldDecorations(state);
  },
  update(decorations, tr) {
    // 如果文档变化或有折叠/展开效果，重新构建装饰
    if (
      tr.docChanged ||
      tr.effects.some(
        (e) => e.is(foldHeadingEffect) || e.is(unfoldHeadingEffect)
      )
    ) {
      return buildFoldDecorations(tr.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * 折叠占位符 Widget
 */
class FoldPlaceholderWidget extends WidgetType {
  constructor(
    readonly lineCount: number,
    readonly from: number,
    readonly to: number
  ) {
    super();
  }

  eq(other: FoldPlaceholderWidget): boolean {
    return (
      other.lineCount === this.lineCount &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-heading-fold-placeholder-widget";
    span.textContent = ` ${this.lineCount} 行已折叠 `;
    span.title = "点击展开";

    const from = this.from;
    const to = this.to;

    span.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        effects: unfoldHeadingEffect.of({ from, to }),
      });
    });

    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 标题折叠主题样式
 */
const headingFoldTheme = EditorView.baseTheme({
  // Gutter 容器
  ".cm-heading-fold-gutter": {
    width: "20px",
  },

  // 折叠标记容器 - 使用 div 以便更好控制对齐
  ".cm-heading-fold-marker": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "100%",
    cursor: "pointer",
    color: "var(--muted-foreground, #888)",
    transition: "all 0.15s ease",
    opacity: "0.5",
  },

  ".cm-heading-fold-marker:hover": {
    backgroundColor: "var(--muted, rgba(0,0,0,0.06))",
    color: "var(--foreground, #333)",
    opacity: "1",
  },

  ".cm-heading-fold-marker.folded": {
    color: "var(--primary, #3b82f6)",
    opacity: "0.7",
  },

  ".cm-heading-fold-marker.folded:hover": {
    backgroundColor: "hsl(var(--primary) / 0.1)",
    color: "var(--primary, #3b82f6)",
    opacity: "1",
  },

  ".cm-heading-fold-marker svg": {
    flexShrink: "0",
  },

  // 折叠占位符 widget
  ".cm-heading-fold-placeholder-widget": {
    display: "inline-block",
    padding: "2px 10px",
    marginLeft: "4px",
    fontSize: "0.8em",
    color: "var(--muted-foreground, #888)",
    backgroundColor: "var(--muted, rgba(0,0,0,0.05))",
    borderRadius: "4px",
    cursor: "pointer",
    verticalAlign: "middle",
    userSelect: "none",
  },

  ".cm-heading-fold-placeholder-widget:hover": {
    backgroundColor: "hsl(var(--primary) / 0.1)",
    color: "var(--primary, #3b82f6)",
  },
});

/**
 * 标题折叠扩展
 * 只允许标题折叠其下属内容
 */
export function headingFoldExtension(): Extension {
  return [
    foldedRangesField,
    headingFoldGutter,
    foldDecorationField,
    headingFoldTheme,
  ];
}
