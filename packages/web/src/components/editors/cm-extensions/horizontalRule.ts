/**
 * 水平分割线渲染扩展
 * 将 --- 或 *** 或 ___ 渲染为水平线
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
 * 水平分割线渲染扩展
 */
export function horizontalRuleExtension(): Extension {
  return [horizontalRuleDecorationPlugin, horizontalRuleTheme];
}

// 水平线正则: ---, ***, ___ (至少3个字符)
const horizontalRuleRE = /^([-*_])\1{2,}\s*$/;

// 水平分割线装饰插件
const horizontalRuleDecorationPlugin = ViewPlugin.fromClass(
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
          const line = iter.value;

          if (horizontalRuleRE.test(line)) {
            const cursorOnLine =
              update && isCursorOnLine(update, pos, pos + line.length);

            if (!cursorOnLine) {
              // 替换为水平线 widget
              const deco = Decoration.replace({
                widget: new HorizontalRuleWidget(),
              });
              decorations.push(deco.range(pos, pos + line.length));
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

/**
 * 水平分割线 Widget
 */
class HorizontalRuleWidget extends WidgetType {
  eq() {
    return true;
  }

  // 内联 widget，不影响行高
  get estimatedHeight(): number {
    return -1;
  }

  toDOM() {
    const hr = document.createElement("div");
    hr.className = "cm-md-horizontal-rule";
    return hr;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// 水平分割线主题样式
const horizontalRuleTheme = EditorView.baseTheme({
  ".cm-md-horizontal-rule": {
    display: "block",
    height: "1px",
    margin: "1em 0",
    backgroundColor: "var(--border, #e5e7eb)",
    border: "none",
  },
});
