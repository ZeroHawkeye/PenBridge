/**
 * 表格渲染扩展
 * 将 GFM 表格渲染为类似 Excel 的对齐效果
 * 使用 StateField 支持块级装饰，光标进入时显示源码
 */

import { EditorState, Extension, StateField } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";

/**
 * 表格渲染扩展
 */
export function tableExtension(): Extension {
  return [tableDecorationField, tableClickHandler, tableTheme];
}

// 对齐方式
type AlignType = "left" | "center" | "right";

// 表格信息
interface TableInfo {
  startPos: number;
  endPos: number;
  headerCells: string[];
  bodyRows: string[][];
  alignments: AlignType[];
}

// 表格行匹配正则
const tableRowRE = /^\|(.+)\|$/;
// 表格分隔符正则 (如 |:---|:---:|---:|)
const tableSeparatorRE = /^\|(\s*:?-+:?\s*\|)+$/;

/**
 * 解析分隔符行获取对齐方式
 */
function parseAlignments(separatorLine: string): AlignType[] {
  const cells = separatorLine.slice(1, -1).split("|");
  return cells.map((cell) => {
    const trimmed = cell.trim();
    const hasLeft = trimmed.startsWith(":");
    const hasRight = trimmed.endsWith(":");
    if (hasLeft && hasRight) return "center";
    if (hasRight) return "right";
    return "left";
  });
}

/**
 * 解析单元格内容
 */
function parseCells(line: string): string[] {
  const trimmed = line.trim();
  if (!tableRowRE.test(trimmed)) return [];
  return trimmed.slice(1, -1).split("|").map((c) => c.trim());
}

/**
 * 判断行是否是表格行
 */
function isTableRow(text: string): boolean {
  return tableRowRE.test(text.trim());
}

/**
 * 判断行是否是分隔符行
 */
function isSeparatorRow(text: string): boolean {
  return tableSeparatorRE.test(text.trim());
}

/**
 * 检查光标是否在指定范围内
 */
function isCursorInRange(state: EditorState, from: number, to: number): boolean {
  const { selection } = state;
  for (const range of selection.ranges) {
    if (range.from <= to && range.to >= from) {
      return true;
    }
  }
  return false;
}

/**
 * 识别文档中的所有表格
 */
function findTables(state: EditorState): TableInfo[] {
  const { doc } = state;
  const tables: TableInfo[] = [];
  let i = 1;

  while (i <= doc.lines) {
    const line = doc.line(i);
    const text = line.text;

    if (isTableRow(text)) {
      const headerCells = parseCells(text);

      if (i + 1 <= doc.lines) {
        const nextLine = doc.line(i + 1);
        if (isSeparatorRow(nextLine.text)) {
          const alignments = parseAlignments(nextLine.text);

          const bodyRows: string[][] = [];
          let j = i + 2;
          while (j <= doc.lines) {
            const bodyLine = doc.line(j);
            if (isTableRow(bodyLine.text)) {
              bodyRows.push(parseCells(bodyLine.text));
              j++;
            } else {
              break;
            }
          }

          const endLine = doc.line(j - 1);
          tables.push({
            startPos: line.from,
            endPos: endLine.to,
            headerCells,
            bodyRows,
            alignments,
          });

          i = j;
          continue;
        }
      }
    }
    i++;
  }

  return tables;
}

/**
 * 构建表格装饰
 */
function buildTableDecorations(state: EditorState): DecorationSet {
  const tables = findTables(state);
  const decorations: { from: number; to: number; deco: Decoration }[] = [];

  for (const table of tables) {
    const cursorInTable = isCursorInRange(state, table.startPos, table.endPos);

    if (cursorInTable) {
      // 光标在表格内，添加行装饰高亮
      const { doc } = state;
      for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
        const line = doc.line(lineNum);
        if (line.from >= table.startPos && line.to <= table.endPos) {
          decorations.push({
            from: line.from,
            to: line.from,
            deco: Decoration.line({
              attributes: { class: "cm-md-table-editing" },
            }),
          });
        }
      }
    } else {
      // 光标不在表格内，用 Widget 替换
      decorations.push({
        from: table.startPos,
        to: table.endPos,
        deco: Decoration.replace({
          widget: new TableWidget(table),
          block: true,
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
 * 表格装饰 StateField
 */
const tableDecorationField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorations(state);
  },
  update(_decorations, tr) {
    // 文档变化或选区变化时重新构建装饰
    if (tr.docChanged || tr.selection) {
      return buildTableDecorations(tr.state);
    }
    return buildTableDecorations(tr.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * 表格 Widget - 渲染为 HTML 表格
 */
class TableWidget extends WidgetType {
  constructor(readonly table: TableInfo) {
    super();
  }

  eq(other: TableWidget) {
    return (
      this.table.startPos === other.table.startPos &&
      this.table.endPos === other.table.endPos &&
      JSON.stringify(this.table.headerCells) === JSON.stringify(other.table.headerCells) &&
      JSON.stringify(this.table.bodyRows) === JSON.stringify(other.table.bodyRows)
    );
  }

  // 块级 widget，估算高度（每行约 30px）
  get estimatedHeight(): number {
    return (this.table.bodyRows.length + 1) * 30;
  }

  toDOM() {
    const { headerCells, bodyRows, alignments, startPos, endPos } = this.table;

    // 计算列数
    const colCount = Math.max(
      headerCells.length,
      ...bodyRows.map((row) => row.length)
    );

    // 计算每列的最大宽度（字符数）
    const colWidths: number[] = [];
    for (let col = 0; col < colCount; col++) {
      let maxWidth = headerCells[col]?.length || 0;
      for (const row of bodyRows) {
        const cellWidth = row[col]?.length || 0;
        if (cellWidth > maxWidth) maxWidth = cellWidth;
      }
      colWidths.push(maxWidth);
    }

    // 创建表格容器
    const container = document.createElement("div");
    container.className = "cm-md-table-container";
    container.setAttribute("data-from", String(startPos));
    container.setAttribute("data-to", String(endPos));

    // 创建表格
    const table = document.createElement("table");
    table.className = "cm-md-table";

    // 表头
    const thead = document.createElement("thead");
    const headerTr = document.createElement("tr");
    for (let col = 0; col < colCount; col++) {
      const th = document.createElement("th");
      th.textContent = headerCells[col] || "";
      th.style.textAlign = alignments[col] || "left";
      th.style.minWidth = `${Math.max(colWidths[col] * 0.6, 3)}em`;
      headerTr.appendChild(th);
    }
    thead.appendChild(headerTr);
    table.appendChild(thead);

    // 表体
    const tbody = document.createElement("tbody");
    for (const row of bodyRows) {
      const tr = document.createElement("tr");
      for (let col = 0; col < colCount; col++) {
        const td = document.createElement("td");
        td.textContent = row[col] || "";
        td.style.textAlign = alignments[col] || "left";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    container.appendChild(table);
    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// 点击表格时定位到源码
const tableClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    const target = event.target as HTMLElement;
    const container = target.closest(".cm-md-table-container");
    if (container) {
      const from = parseInt(container.getAttribute("data-from") || "0", 10);
      view.dispatch({
        selection: { anchor: from },
        scrollIntoView: true,
      });
      view.focus();
      return true;
    }
    return false;
  },
});

// 表格主题样式
const tableTheme = EditorView.baseTheme({
  // 表格容器
  ".cm-md-table-container": {
    display: "block",
    margin: "0.25em 0",
    overflowX: "auto",
    cursor: "pointer",
  },

  // 表格
  ".cm-md-table": {
    borderCollapse: "collapse",
    width: "auto",
    fontFamily: "inherit",
    fontSize: "0.95em",
    lineHeight: "1.4",
  },

  // 表头
  ".cm-md-table thead th": {
    backgroundColor: "var(--muted, #f3f4f6)",
    fontWeight: "600",
    color: "var(--foreground, #111)",
    padding: "0.4em 0.8em",
    border: "1px solid var(--border, #e5e7eb)",
    whiteSpace: "nowrap",
  },

  // 表体单元格
  ".cm-md-table tbody td": {
    padding: "0.35em 0.8em",
    border: "1px solid var(--border, #e5e7eb)",
    color: "var(--foreground, #333)",
    whiteSpace: "nowrap",
  },

  // 表体交替行颜色
  ".cm-md-table tbody tr:nth-child(even)": {
    backgroundColor: "var(--muted, rgba(0, 0, 0, 0.02))",
  },

  // 鼠标悬停效果
  ".cm-md-table tbody tr:hover": {
    backgroundColor: "var(--accent, rgba(59, 130, 246, 0.08))",
  },

  // 编辑模式下的高亮
  ".cm-md-table-editing": {
    backgroundColor: "rgba(59, 130, 246, 0.06)",
  },
});
