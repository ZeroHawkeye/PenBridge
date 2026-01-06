/**
 * 列表渲染扩展
 * 包括有序列表、无序列表和复选框
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
 * 列表渲染扩展
 */
export function listExtension(): Extension {
  return [listDecorationPlugin, listTheme];
}

// 列表正则
const unorderedListRE = /^(\s*)[-*+]\s/;
const orderedListRE = /^(\s*)(\d+)\.\s/;
const taskListRE = /^(\s*)[-*+]\s\[([ xX])\]\s/;

// 列表装饰插件
const listDecorationPlugin = ViewPlugin.fromClass(
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
      const { doc } = this.view.state;

      let pos = from;
      const iter = doc.iterRange(from, to);

      while (!iter.next().done) {
        if (!iter.lineBreak) {
          const line = iter.value;
          let match;

          // 检查任务列表（优先于无序列表）
          if ((match = line.match(taskListRE))) {
            const indent = match[1].length;
            const checked = match[2].toLowerCase() === "x";
            const cursorOnLine = update && isCursorOnLine(update, pos, pos + line.length);

            // 行级装饰
            const lineDeco = Decoration.line({
              attributes: {
                class: `cm-md-list cm-md-task-list`,
                style: `padding-left: ${indent * 1.5 + 0.5}em`,
              },
            });
            lineDecorations.push(lineDeco.range(pos));

            // 替换复选框（如果光标不在当前行）
            if (!cursorOnLine) {
              const checkboxStart = pos + match[1].length;
              const checkboxEnd = checkboxStart + match[0].length - match[1].length;
              
              const deco = Decoration.replace({
                widget: new TaskCheckboxWidget(checked, pos, this.view),
              });
              decorations.push(deco.range(checkboxStart, checkboxEnd));
            }
          }
          // 无序列表
          else if ((match = line.match(unorderedListRE))) {
            const indent = match[1].length;
            const cursorOnLine = update && isCursorOnLine(update, pos, pos + line.length);

            const lineDeco = Decoration.line({
              attributes: {
                class: "cm-md-list cm-md-unordered-list",
                style: `padding-left: ${indent * 1.5 + 0.5}em`,
              },
            });
            lineDecorations.push(lineDeco.range(pos));

            // 替换列表标记为圆点
            if (!cursorOnLine) {
              const markerStart = pos + match[1].length;
              const markerEnd = markerStart + 2; // "- " 或 "* "
              
              const deco = Decoration.replace({
                widget: new ListBulletWidget(),
              });
              decorations.push(deco.range(markerStart, markerEnd));
            }
          }
          // 有序列表
          else if ((match = line.match(orderedListRE))) {
            const indent = match[1].length;
            // match[2] 是数字，保留原始数字显示让用户自由编辑

            const lineDeco = Decoration.line({
              attributes: {
                class: "cm-md-list cm-md-ordered-list",
                style: `padding-left: ${indent * 1.5 + 0.5}em`,
              },
            });
            lineDecorations.push(lineDeco.range(pos));

            // 有序列表保留数字显示，只添加样式（不隐藏数字）
            // 这样用户可以自由编辑序号
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
 * 列表圆点 Widget
 */
class ListBulletWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-list-bullet";
    span.textContent = "•";
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 任务复选框 Widget
 */
class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly linePos: number,
    readonly view: EditorView
  ) {
    super();
  }

  eq(other: TaskCheckboxWidget) {
    return other.checked === this.checked;
  }

  toDOM() {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "cm-md-task-checkbox";
    checkbox.checked = this.checked;

    // 点击切换状态
    checkbox.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const newState = !this.checked;
      const doc = this.view.state.doc;
      const line = doc.lineAt(this.linePos);
      const text = line.text;
      
      // 替换 [ ] 或 [x]
      const newText = text.replace(
        /\[([ xX])\]/,
        newState ? "[x]" : "[ ]"
      );
      
      this.view.dispatch({
        changes: {
          from: line.from,
          to: line.to,
          insert: newText,
        },
      });
    });

    return checkbox;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// 列表主题样式
const listTheme = EditorView.baseTheme({
  ".cm-md-list": {
    position: "relative",
  },
  ".cm-md-list-bullet": {
    color: "var(--primary, #2563eb)",
    fontWeight: "bold",
    marginRight: "0.5em",
  },
  ".cm-md-task-checkbox": {
    marginRight: "0.5em",
    width: "1em",
    height: "1em",
    cursor: "pointer",
    accentColor: "var(--primary, #2563eb)",
  },
});
