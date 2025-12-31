/**
 * 优化的 Diff 算法
 * 避免全文扫描，减少内存消耗
 */

import Diff from 'diff';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'separator';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
  changedLines: number;
  totalChangedCharacters: number;
}

export interface OptimizedDiffResult {
  lines: DiffLine[];
  stats: DiffStats;
  truncated: boolean;
  unchangedPrefix: number;
  unchangedSuffix: number;
}

/**
 * 条带化处理：去除头尾未变更的行
 */
function stripUnchangedLines(
  oldLines: string[],
  newLines: string[]
): {
  startLine: number;
  endLine: number;
  oldStripped: string[];
  newStripped: string[];
} {
  let startLine = 0;

  // 找到第一个不同的行
  while (
    startLine < Math.min(oldLines.length, newLines.length) &&
    oldLines[startLine] === newLines[startLine]
  ) {
    startLine++;
  }

  let endLine = 0;

  // 从末尾找到第一个不同的行
  while (
    endLine < Math.min(oldLines.length, newLines.length) - startLine &&
    oldLines[oldLines.length - 1 - endLine] === newLines[newLines.length - 1 - endLine]
  ) {
    endLine++;
  }

  const oldStripped = oldLines.slice(startLine, oldLines.length - endLine);
  const newStripped = newLines.slice(startLine, newLines.length - endLine);

  return {
    startLine,
    endLine,
    oldStripped,
    newStripped,
  };
}

/**
 * 计算 Diff 统计信息
 */
function calculateStats(lines: DiffLine[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  let totalChangedCharacters = 0;

  for (const line of lines) {
    if (line.type === 'added') {
      added++;
      totalChangedCharacters += line.content.length;
    } else if (line.type === 'removed') {
      removed++;
      totalChangedCharacters += line.content.length;
    } else if (line.type === 'unchanged') {
      unchanged++;
    }
  }

  return {
    added,
    removed,
    unchanged,
    changedLines: added + removed,
    totalChangedCharacters,
  };
}

/**
 * 生成优化的 Diff
 *
 * 优化策略：
 * 1. 条带化：只计算变更区域的 diff
 * 2. 上下文限制：只保留变更行周围的上下文
 * 3. 行数限制：超大 diff 时截断显示
 */
export function generateOptimizedDiff(
  oldText: string,
  newText: string,
  options: {
    contextLines?: number;      // 上下文行数（默认 3）
    maxDisplayLines?: number;    // 最多显示的行数（默认 500）
    skipIfTooLarge?: number;     // 文件超过此大小时跳过 diff（字节，默认 1MB）
  } = {}
): OptimizedDiffResult | null {
  const contextLines = options.contextLines ?? 3;
  const maxDisplayLines = options.maxDisplayLines ?? 500;
  const skipIfTooLarge = options.skipIfTooLarge ?? 1024 * 1024; // 1 MB

  // 检查文件大小（使用字符数估算，UTF-16每字符约2字节）
  const oldSize = oldText.length * 2;
  const newSize = newText.length * 2;

  if (oldSize > skipIfTooLarge || newSize > skipIfTooLarge) {
    console.warn(
      `[OptimizedDiff] 文件过大（约 ${Math.max(oldSize, newSize)} 字节），跳过 Diff 计算`
    );
    return null;
  }

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // 条带化：去除头尾未变更的部分
  const { startLine, endLine, oldStripped, newStripped } = stripUnchangedLines(oldLines, newLines);

  // 如果没有任何变更
  if (oldStripped.length === 0 && newStripped.length === 0) {
    return {
      lines: [],
      stats: {
        added: 0,
        removed: 0,
        unchanged: oldLines.length,
        changedLines: 0,
        totalChangedCharacters: 0,
      },
      truncated: false,
      unchangedPrefix: oldLines.length,
      unchangedSuffix: 0,
    };
  }

  // 计算变更区域的 diff（包含上下文）
  const contextStart = Math.max(0, startLine - contextLines);
  const contextEnd = Math.min(
    oldLines.length,
    oldLines.length - endLine + contextLines
  );

  const oldWithContext = oldLines.slice(contextStart, oldLines.length - endLine + contextLines);
  const newWithContext = newLines.slice(contextStart, newLines.length - endLine + contextLines);

  // 使用 diff 库计算变更
  const changes = Diff.diffLines(oldWithContext.join('\n'), newWithContext.join('\n'));

  // 生成 diff 行
  const diffLines: DiffLine[] = [];
  let oldLineNum = contextStart + 1;
  let newLineNum = contextStart + 1;

  for (const change of changes) {
    const changeLines = change.value.split('\n');
    // 移除最后一个空字符串（如果是换行符结尾）
    if (changeLines[changeLines.length - 1] === '') {
      changeLines.pop();
    }

    for (const line of changeLines) {
      if (change.added) {
        diffLines.push({
          type: 'added',
          content: line,
          newLineNum: newLineNum++,
        });
      } else if (change.removed) {
        diffLines.push({
          type: 'removed',
          content: line,
          oldLineNum: oldLineNum++,
        });
      } else {
        diffLines.push({
          type: 'unchanged',
          content: line,
          oldLineNum: oldLineNum++,
          newLineNum: newLineNum++,
        });
      }
    }
  }

  // 过滤：只显示变更行和周围的上下文
  const filteredLines = filterContextLines(diffLines, contextLines);

  // 如果结果太长，截断显示
  let truncated = false;
  let finalLines = filteredLines;

  if (filteredLines.length > maxDisplayLines) {
    truncated = true;
    const half = Math.floor(maxDisplayLines / 2);

    finalLines = [
      ...filteredLines.slice(0, half),
      {
        type: 'separator',
        content: `... 省略 ${filteredLines.length - maxDisplayLines} 行 ...`,
      },
      ...filteredLines.slice(-half),
    ];
  }

  const stats = calculateStats(filteredLines);

  return {
    lines: finalLines,
    stats,
    truncated,
    unchangedPrefix: startLine,
    unchangedSuffix: endLine,
  };
}

/**
 * 过滤上下文行：只保留变更行周围的上下文
 */
function filterContextLines(lines: DiffLine[], contextLines: number): DiffLine[] {
  const changedIndices = new Set<number>();

  // 找出所有变更行的索引
  lines.forEach((line, i) => {
    if (line.type === 'added' || line.type === 'removed') {
      changedIndices.add(i);
    }
  });

  // 如果没有变更，返回空
  if (changedIndices.size === 0) {
    return [];
  }

  // 为每个变更行添加上下文
  const includeIndices = new Set<number>();

  changedIndices.forEach(index => {
    for (let i = Math.max(0, index - contextLines); i <= Math.min(lines.length - 1, index + contextLines); i++) {
      includeIndices.add(i);
    }
  });

  // 构建结果，添加分隔符表示省略的部分
  const result: DiffLine[] = [];
  let lastIncluded = -1;

  includeIndices.forEach(index => {
    // 如果跳过了一些行，添加分隔符
    if (lastIncluded !== -1 && index - lastIncluded > 1) {
      result.push({
        type: 'separator',
        content: `... (省略 ${index - lastIncluded - 1} 行未变更内容) ...`,
      });
    }

    result.push(lines[index]);
    lastIncluded = index;
  });

  return result;
}

/**
 * 生成变更摘要（不计算完整 diff）
 */
export function generateChangeSummary(
  oldText: string,
  newText: string
): {
  isModified: boolean;
  addedChars: number;
  removedChars: number;
  addedLines: number;
  removedLines: number;
  changedPercent: number;
} {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const { startLine, endLine, oldStripped, newStripped } = stripUnchangedLines(oldLines, newLines);

  const addedLines = newStripped.length;
  const removedLines = oldStripped.length;
  const addedChars = newText.length - oldText.length;
  const removedChars = Math.max(0, oldText.length - newText.length);

  const totalLines = Math.max(oldLines.length, newLines.length);
  const changedLines = addedLines + removedLines;
  const changedPercent = totalLines > 0 ? (changedLines / totalLines) * 100 : 0;

  return {
    isModified: startLine < oldLines.length || endLine > 0 || oldLines.length !== newLines.length,
    addedChars,
    removedChars,
    addedLines,
    removedLines,
    changedPercent,
  };
}

/**
 * 检查是否应该跳过 Diff 计算
 */
export function shouldSkipDiff(
  oldText: string,
  newText: string,
  maxSize: number = 1024 * 1024 // 1 MB
): {
  shouldSkip: boolean;
  reason?: string;
  oldSize: number;
  newSize: number;
} {
  // 使用字符数估算大小（UTF-16每字符约2字节）
  const oldSize = oldText.length * 2;
  const newSize = newText.length * 2;

  if (oldSize > maxSize || newSize > maxSize) {
    return {
      shouldSkip: true,
      reason: `文件过大（约 ${Math.max(oldSize, newSize)} 字节 > ${maxSize} 字节）`,
      oldSize,
      newSize,
    };
  }

  return {
    shouldSkip: false,
    oldSize,
    newSize,
  };
}
