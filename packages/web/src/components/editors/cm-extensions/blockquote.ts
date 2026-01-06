/**
 * 引用块渲染扩展
 * 为 > 开头的行添加引用样式
 */

import { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";

/**
 * 引用块渲染扩展
 */
export function blockquoteExtension(): Extension {
  return [blockquoteDecorationPlugin, blockquoteTheme];
}

// 引用正则
const blockquoteRE = /^>\s?/;

// 引用块装饰插件
const blockquoteDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    constructor(public view: EditorView) {
      this.recompute();
    }

    recompute() {
      const lineDecorations: Range<Decoration>[] = [];

      for (const { from, to } of this.view.visibleRanges) {
        this.getDecorationsFor(from, to, lineDecorations);
      }

      this.decorations = Decoration.set(lineDecorations, true);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.recompute();
      }
    }

    getDecorationsFor(
      from: number,
      to: number,
      lineDecorations: Range<Decoration>[]
    ) {
      const { doc } = this.view.state;

      let pos = from;
      const iter = doc.iterRange(from, to);

      while (!iter.next().done) {
        if (!iter.lineBreak) {
          const line = iter.value;

          if (blockquoteRE.test(line)) {
            const deco = Decoration.line({
              attributes: {
                class: "cm-md-blockquote",
              },
            });
            lineDecorations.push(deco.range(pos));
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

// 引用块主题样式
const blockquoteTheme = EditorView.baseTheme({
  ".cm-md-blockquote": {
    borderLeft: "3px solid var(--primary, #2563eb)",
    paddingLeft: "1em",
    marginLeft: "0",
    color: "var(--muted-foreground, #666)",
    fontStyle: "italic",
    backgroundColor: "var(--muted, rgba(0,0,0,0.02))",
  },
});
