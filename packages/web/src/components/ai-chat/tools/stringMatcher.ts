/**
 * 智能字符串匹配工具
 * 处理换行符、空白字符、行号前缀等问题
 */

export interface MatchResult {
  found: boolean;
  position?: number;
  strategy: 'exact' | 'normalized-lines' | 'normalized-whitespace' | 'fuzzy' | 'none';
  confidence: number;
  warnings: string[];
  alternatives?: AlternativeMatch[];
}

export interface AlternativeMatch {
  position: number;
  similarity: number;
  preview: string;
  lineNumber: number;
}

/**
 * 标准化换行符（统一为 LF）
 */
export function normalizeLineEndings(text: string): string {
  // 将 CRLF (\r\n) 和 CR (\r) 统一转换为 LF (\n)
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * 去除行号前缀
 * 匹配格式："  1 | 内容" 或 " 10 | 内容" 或 "100 | 内容"
 * read_article 的格式：行号右对齐（用空格填充） + " | " + 内容
 *
 * Bug Fix: 之前的正则 /^[ ]{2,}/ 要求至少2个空格，导致两位数行号无法匹配
 * 新正则：匹配"0个或多个空格 + 数字 + 至少1个空格 + 分隔符"
 */
export function stripLineNumbers(text: string): string {
  // 匹配格式：可选空格 + 数字 + 至少1个空格 + | 或 → + 可选空格
  // 这样可以匹配所有 read_article 的行号格式，同时避免误匹配用户的 "1| 内容"（没有空格）
  return text.replace(/^\s*\d+\s+[|→]\s*/gm, '');
}

/**
 * 标准化空白字符（保留换行符，但标准化空格和制表符）
 * 注意：保留前导空格以避免破坏代码缩进
 */
export function normalizeWhitespace(text: string): string {
  // 将行内的多个空格/制表符标准化为单个空格，但保留前导空格（缩进）
  return text
    .split('\n')
    .map(line => {
      // 匹配前导空格 + 其余内容
      const match = line.match(/^(\s*)(.*?)(\s*)$/);
      if (!match) return line;

      const [, leading, content] = match;
      // 保留前导空格，标准化中间内容的空白，移除尾随空格
      return leading + content.replace(/\s+/g, ' ');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n'); // 多个连续换行符最多保留 2 个
}

/**
 * 获取文本在内容中的行号
 */
function getLineNumber(content: string, position: number): number {
  return content.substring(0, position).split('\n').length;
}

/**
 * 获取上下文预览
 */
function getContextPreview(content: string, position: number, contextLines: number = 2): string {
  const lines = content.split('\n');
  const lineNum = getLineNumber(content, position);
  const start = Math.max(0, lineNum - 1 - contextLines);
  const end = Math.min(lines.length, lineNum + contextLines);

  return lines.slice(start, end)
    .map((line, i) => {
      const currentLine = start + i + 1;
      const marker = currentLine === lineNum ? '→' : ' ';
      return `${marker} ${currentLine.toString().padStart(4)} | ${line}`;
    })
    .join('\n');
}

/**
 * 查找所有匹配位置
 */
function findAllOccurrences(content: string, search: string): number[] {
  const positions: number[] = [];
  let position = 0;

  while (position < content.length) {
    const index = content.indexOf(search, position);
    if (index === -1) break;
    positions.push(index);
    position = index + 1;
  }

  return positions;
}

/**
 * 计算两个字符串的相似度
 * 使用改进算法：结合位置匹配和字符集相似度
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  if (str1 === str2) return 1.0;

  // 1. 位置匹配度：逐字符比较（处理小的差异）
  const minLength = Math.min(str1.length, str2.length);
  let positionMatches = 0;
  for (let i = 0; i < minLength; i++) {
    if (str1[i] === str2[i]) positionMatches++;
  }
  const positionSimilarity = positionMatches / maxLength;

  // 2. 字符集相似度：计算包含的字符（处理顺序差异）
  const chars1 = new Set(str1);
  const chars2 = new Set(str2);
  let commonChars = 0;
  chars1.forEach(char => {
    if (chars2.has(char)) commonChars++;
  });
  const charSetSimilarity = (commonChars * 2) / (chars1.size + chars2.size);

  // 3. 长度相似度
  const lengthSimilarity = 1 - Math.abs(str1.length - str2.length) / maxLength;

  // 综合评分：位置匹配最重要，字符集和长度作为辅助
  return positionSimilarity * 0.6 + charSetSimilarity * 0.3 + lengthSimilarity * 0.1;
}

/**
 * 智能字符串匹配
 * 按照优先级尝试多种匹配策略
 */
export function intelligentMatch(
  content: string,
  searchText: string,
  options: {
    requireUnique?: boolean;
    maxAlternatives?: number;
    fuzzyThreshold?: number;
  } = {}
): MatchResult {
  const warnings: string[] = [];
  const requireUnique = options.requireUnique ?? true;
  const maxAlternatives = options.maxAlternatives ?? 5;
  const fuzzyThreshold = options.fuzzyThreshold ?? 0.8;

  // 策略 1：精确匹配
  const exactPositions = findAllOccurrences(content, searchText);
  if (exactPositions.length === 1) {
    return {
      found: true,
      position: exactPositions[0],
      strategy: 'exact',
      confidence: 1.0,
      warnings: [],
    };
  }

  if (exactPositions.length > 1) {
    if (requireUnique) {
      return {
        found: false,
        strategy: 'exact',
        confidence: 0,
        warnings: [`找到 ${exactPositions.length} 个精确匹配，无法确定唯一位置`],
        alternatives: exactPositions.slice(0, maxAlternatives).map(pos => ({
          position: pos,
          similarity: 1.0,
          preview: getContextPreview(content, pos, 2),
          lineNumber: getLineNumber(content, pos),
        })),
      };
    }

    // 如果不要求唯一，返回第一个匹配
    warnings.push(`找到 ${exactPositions.length} 个匹配，将替换第一个`);
    return {
      found: true,
      position: exactPositions[0],
      strategy: 'exact',
      confidence: 1.0,
      warnings,
      alternatives: exactPositions.slice(1, maxAlternatives).map(pos => ({
        position: pos,
        similarity: 1.0,
        preview: getContextPreview(content, pos, 2),
        lineNumber: getLineNumber(content, pos),
      })),
    };
  }

  // 策略 2：标准化换行符 + 去除行号前缀
  const normalizedContent = normalizeLineEndings(content);
  const cleanedSearch = stripLineNumbers(normalizeLineEndings(searchText));

  if (cleanedSearch !== searchText) {
    warnings.push('已自动移除行号前缀');
  }

  const normalizedPositions = findAllOccurrences(normalizedContent, cleanedSearch);
  if (normalizedPositions.length === 1) {
    // normalizedContent 和 content 只差在换行符，位置应该相同（因为normalizeLineEndings不改变位置）
    // 如果 content 本身就是 LF，position 完全相同；如果有 CRLF，需要映射
    // 简化处理：直接在 normalized 版本中查找，后续替换也用 normalized 版本
    return {
      found: true,
      position: normalizedPositions[0],
      strategy: 'normalized-lines',
      confidence: 0.95,
      warnings,
      // 注意：此位置是在 normalizedContent 中的，使用时需要在 normalized content 中操作
    };
  }

  if (normalizedPositions.length > 1 && requireUnique) {
    return {
      found: false,
      strategy: 'normalized-lines',
      confidence: 0,
      warnings: [...warnings, `标准化后找到 ${normalizedPositions.length} 个匹配`],
      alternatives: normalizedPositions.slice(0, maxAlternatives).map(pos => ({
        position: pos,
        similarity: 0.95,
        preview: getContextPreview(normalizedContent, pos, 2),
        lineNumber: getLineNumber(normalizedContent, pos),
      })),
    };
  }

  // 策略 3：标准化空白字符
  const fullyNormalizedContent = normalizeWhitespace(normalizedContent);
  const fullyNormalizedSearch = normalizeWhitespace(cleanedSearch);

  const whitespaceNormalizedPositions = findAllOccurrences(
    fullyNormalizedContent,
    fullyNormalizedSearch
  );

  if (whitespaceNormalizedPositions.length === 1) {
    warnings.push('已标准化空白字符（空格、制表符）');

    // 需要映射回原始位置
    const originalPosition = mapNormalizedPositionToOriginal(
      content,
      fullyNormalizedContent,
      whitespaceNormalizedPositions[0]
    );

    return {
      found: true,
      position: originalPosition,
      strategy: 'normalized-whitespace',
      confidence: 0.85,
      warnings,
    };
  }

  if (whitespaceNormalizedPositions.length > 1 && requireUnique) {
    return {
      found: false,
      strategy: 'normalized-whitespace',
      confidence: 0,
      warnings: [...warnings, `完全标准化后找到 ${whitespaceNormalizedPositions.length} 个匹配`],
      alternatives: whitespaceNormalizedPositions.slice(0, maxAlternatives).map(pos => {
        const originalPos = mapNormalizedPositionToOriginal(content, fullyNormalizedContent, pos);
        return {
          position: originalPos,
          similarity: 0.85,
          preview: getContextPreview(content, originalPos, 2),
          lineNumber: getLineNumber(content, originalPos),
        };
      }),
    };
  }

  // 策略 4：模糊匹配（在标准化后的内容中查找相似文本）
  const fuzzyMatches = findFuzzyMatches(
    fullyNormalizedContent,
    fullyNormalizedSearch,
    fuzzyThreshold
  );

  if (fuzzyMatches.length > 0) {
    const bestMatch = fuzzyMatches[0];
    const originalPosition = mapNormalizedPositionToOriginal(
      content,
      fullyNormalizedContent,
      bestMatch.position
    );

    if (fuzzyMatches.length === 1 || !requireUnique) {
      warnings.push(`使用模糊匹配（相似度 ${(bestMatch.similarity * 100).toFixed(0)}%）`);
      return {
        found: true,
        position: originalPosition,
        strategy: 'fuzzy',
        confidence: bestMatch.similarity,
        warnings,
        alternatives: fuzzyMatches.slice(1, maxAlternatives).map(match => {
          const pos = mapNormalizedPositionToOriginal(content, fullyNormalizedContent, match.position);
          return {
            position: pos,
            similarity: match.similarity,
            preview: getContextPreview(content, pos, 2),
            lineNumber: getLineNumber(content, pos),
          };
        }),
      };
    }

    return {
      found: false,
      strategy: 'fuzzy',
      confidence: bestMatch.similarity,
      warnings: [...warnings, `模糊匹配找到 ${fuzzyMatches.length} 个候选`],
      alternatives: fuzzyMatches.slice(0, maxAlternatives).map(match => {
        const pos = mapNormalizedPositionToOriginal(content, fullyNormalizedContent, match.position);
        return {
          position: pos,
          similarity: match.similarity,
          preview: getContextPreview(content, pos, 2),
          lineNumber: getLineNumber(content, pos),
        };
      }),
    };
  }

  // 未找到任何匹配
  return {
    found: false,
    strategy: 'none',
    confidence: 0,
    warnings: ['未找到任何匹配（包括模糊匹配）'],
  };
}

/**
 * 查找模糊匹配
 */
function findFuzzyMatches(
  content: string,
  searchText: string,
  threshold: number
): Array<{ position: number; similarity: number }> {
  const matches: Array<{ position: number; similarity: number }> = [];
  const searchLength = searchText.length;

  // 如果搜索文本过长（超过10KB），跳过模糊匹配以避免性能问题
  if (searchLength > 10240) {
    return matches;
  }

  // 使用滑动窗口在整个内容中查找（步长为搜索长度的10%，避免遗漏）
  const step = Math.max(1, Math.floor(searchLength * 0.1));
  const maxPosition = content.length - searchLength;

  for (let pos = 0; pos <= maxPosition; pos += step) {
    const candidate = content.substring(pos, pos + searchLength);
    const similarity = calculateSimilarity(searchText, candidate);

    if (similarity >= threshold) {
      matches.push({
        position: pos,
        similarity,
      });
    }

    // 限制最多返回20个匹配，避免性能问题
    if (matches.length >= 20) {
      break;
    }
  }

  // 按相似度排序
  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * 将标准化后的位置映射回原始位置
 */
function mapNormalizedPositionToOriginal(
  original: string,
  normalized: string,
  normalizedPosition: number
): number {
  // 简化实现：通过逐字符比较找到对应位置
  // 这是一个近似算法，对于大多数情况足够准确

  const normalizedLines = normalized.split('\n');
  const originalLines = original.split('\n');

  let normalizedCount = 0;
  let normalizedLineIndex = 0;

  // 找到标准化位置对应的行
  for (let i = 0; i < normalizedLines.length; i++) {
    if (normalizedCount + normalizedLines[i].length >= normalizedPosition) {
      normalizedLineIndex = i;
      break;
    }
    normalizedCount += normalizedLines[i].length + 1; // +1 for newline
  }

  // 计算该行内的偏移
  const lineOffset = normalizedPosition - normalizedCount;

  // 映射回原始行的位置
  let originalPosition = 0;
  for (let i = 0; i < normalizedLineIndex && i < originalLines.length; i++) {
    originalPosition += originalLines[i].length + 1;
  }

  // 在原始行内找到近似的位置
  if (normalizedLineIndex < originalLines.length) {
    const originalLine = originalLines[normalizedLineIndex];
    const normalizedLine = normalizedLines[normalizedLineIndex];

    // 按比例映射
    const ratio = lineOffset / Math.max(normalizedLine.length, 1);
    originalPosition += Math.floor(originalLine.length * ratio);
  }

  return originalPosition;
}
