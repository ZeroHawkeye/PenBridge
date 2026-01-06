/**
 * 代码块渲染扩展
 * 为代码块添加语法高亮和样式
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
 * 代码块渲染扩展
 */
export function codeblockExtension(): Extension {
  return [codeblockDecorationPlugin, codeblockTheme];
}

// 代码块状态
interface CodeBlockState {
  isInCodeBlock: boolean;
  language: string;
  startLine: number;
}

// 代码块装饰插件
const codeblockDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    constructor(public view: EditorView) {
      this.recompute();
    }

    recompute(update?: ViewUpdate) {
      const decorations: Range<Decoration>[] = [];
      const lineDecorations: Range<Decoration>[] = [];

      // 需要遍历整个文档来正确识别代码块
      const { doc } = this.view.state;
      const state: CodeBlockState = {
        isInCodeBlock: false,
        language: "",
        startLine: 0,
      };

      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const text = line.text;

        // 检查代码块开始/结束
        const fenceMatch = text.match(/^```(\w*)/);
        
        if (fenceMatch) {
          if (!state.isInCodeBlock) {
            // 代码块开始
            state.isInCodeBlock = true;
            state.language = fenceMatch[1] || "";
            state.startLine = i;

            // 检查是否在可见范围内
            if (this.isInVisibleRange(line.from)) {
              const cursorOnLine = update && isCursorOnLine(update, line.from, line.to);
              
              // 代码块开始行装饰
              const lineDeco = Decoration.line({
                attributes: {
                  class: "cm-md-codeblock cm-md-codeblock-start",
                },
              });
              lineDecorations.push(lineDeco.range(line.from));

              // 如果光标不在当前行，隐藏 ``` 并显示语言标签
              if (!cursorOnLine && state.language) {
                const deco = Decoration.replace({
                  widget: new CodeBlockHeaderWidget(state.language),
                });
                decorations.push(deco.range(line.from, line.to));
              }
            }
          } else {
            // 代码块结束
            if (this.isInVisibleRange(line.from)) {
              const cursorOnLine = update && isCursorOnLine(update, line.from, line.to);
              
              const lineDeco = Decoration.line({
                attributes: {
                  class: "cm-md-codeblock cm-md-codeblock-end",
                },
              });
              lineDecorations.push(lineDeco.range(line.from));

              // 如果光标不在当前行，隐藏结束的 ```
              if (!cursorOnLine) {
                const deco = Decoration.replace({
                  widget: new CodeBlockFooterWidget(),
                });
                decorations.push(deco.range(line.from, line.to));
              }
            }
            
            state.isInCodeBlock = false;
            state.language = "";
          }
        } else if (state.isInCodeBlock) {
          // 代码块内容行
          if (this.isInVisibleRange(line.from)) {
            const lineDeco = Decoration.line({
              attributes: {
                class: "cm-md-codeblock cm-md-codeblock-content",
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
 * 代码块头部 Widget
 */
class CodeBlockHeaderWidget extends WidgetType {
  constructor(readonly language: string) {
    super();
  }

  eq(other: CodeBlockHeaderWidget) {
    return other.language === this.language;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-codeblock-header";
    span.textContent = this.language.toUpperCase();
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 代码块底部 Widget
 */
class CodeBlockFooterWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-codeblock-footer";
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// 代码块主题样式
const codeblockTheme = EditorView.baseTheme({
  ".cm-md-codeblock": {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: "0.9em",
    backgroundColor: "var(--muted, rgba(0,0,0,0.04))",
  },
  ".cm-md-codeblock-start": {
    borderTopLeftRadius: "6px",
    borderTopRightRadius: "6px",
    paddingTop: "0.5em",
  },
  ".cm-md-codeblock-end": {
    borderBottomLeftRadius: "6px",
    borderBottomRightRadius: "6px",
    paddingBottom: "0.5em",
  },
  ".cm-md-codeblock-content": {
    paddingLeft: "1em",
  },
  ".cm-md-codeblock-header": {
    display: "inline-block",
    fontSize: "0.75em",
    fontWeight: "500",
    color: "var(--muted-foreground, #666)",
    backgroundColor: "var(--muted, rgba(0,0,0,0.08))",
    padding: "0.1em 0.5em",
    borderRadius: "3px",
    marginBottom: "0.25em",
  },
  ".cm-md-codeblock-footer": {
    display: "block",
    height: "0.25em",
  },
});
