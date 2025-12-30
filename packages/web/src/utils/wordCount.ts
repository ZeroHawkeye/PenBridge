/**
 * 文档字数统计工具
 * 按照标准文档统计方式进行统计
 */

export interface WordCountResult {
  /** 字符数（不含空格） */
  characters: number;
  /** 字符数（含空格） */
  charactersWithSpaces: number;
  /** 中文字符数 */
  chineseCharacters: number;
  /** 英文单词数 */
  englishWords: number;
  /** 数字个数 */
  numbers: number;
  /** 标点符号数 */
  punctuation: number;
  /** 段落数 */
  paragraphs: number;
  /** 行数 */
  lines: number;
}

/**
 * 从 Markdown 内容中提取纯文本
 * 移除 Markdown 语法标记
 */
function extractPlainText(markdown: string): string {
  return markdown
    // 移除代码块
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    // 移除图片
    .replace(/!\[.*?\]\(.*?\)/g, "")
    // 移除链接，保留链接文字
    .replace(/\[([^\]]*)\]\(.*?\)/g, "$1")
    // 移除标题标记
    .replace(/^#{1,6}\s+/gm, "")
    // 移除粗体/斜体标记
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/__([^_]*)__/g, "$1")
    .replace(/_([^_]*)_/g, "$1")
    // 移除删除线
    .replace(/~~([^~]*)~~/g, "$1")
    // 移除引用标记
    .replace(/^>\s+/gm, "")
    // 移除列表标记
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    // 移除分割线
    .replace(/^[-*_]{3,}$/gm, "")
    // 移除表格语法
    .replace(/\|/g, " ")
    .replace(/^[-:]+$/gm, "")
    // 移除 HTML 标签
    .replace(/<[^>]*>/g, "");
}

/**
 * 统计 Markdown 文档的字数
 * @param markdown Markdown 格式的文本内容
 * @returns 字数统计结果
 */
export function countWords(markdown: string): WordCountResult {
  const plainText = extractPlainText(markdown);
  
  // 统计中文字符（包括中文标点）
  const chineseCharacters = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;
  
  // 统计英文单词（连续的英文字母组成一个单词）
  const englishWords = (plainText.match(/[a-zA-Z]+/g) || []).length;
  
  // 统计数字（连续的数字算一个）
  const numbers = (plainText.match(/\d+/g) || []).length;
  
  // 统计标点符号（中英文标点）
  const punctuation = (plainText.match(/[，。！？、；：""''（）【】《》,.!?;:'"()\[\]<>]/g) || []).length;
  
  // 字符数（不含空格）：移除所有空白字符后的长度
  const characters = plainText.replace(/\s/g, "").length;
  
  // 字符数（含空格）
  const charactersWithSpaces = plainText.length;
  
  // 段落数：非空行的数量
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0).length;
  
  // 行数：所有非空行
  const lines = markdown
    .split("\n")
    .filter((line) => line.trim().length > 0).length;

  return {
    characters,
    charactersWithSpaces,
    chineseCharacters,
    englishWords,
    numbers,
    punctuation,
    paragraphs,
    lines,
  };
}

/**
 * 格式化字数显示
 * @param count 字数统计结果
 * @returns 格式化的字符串
 */
export function formatWordCount(count: WordCountResult): string {
  const totalWords = count.chineseCharacters + count.englishWords;
  return `${totalWords} 字`;
}

/**
 * 格式化详细字数显示
 * @param count 字数统计结果
 * @returns 详细的统计信息
 */
export function formatWordCountDetail(count: WordCountResult): string {
  return `中文: ${count.chineseCharacters} | 英文: ${count.englishWords} 词 | 字符: ${count.characters}`;
}
