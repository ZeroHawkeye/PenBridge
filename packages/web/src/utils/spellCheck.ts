/**
 * 英文拼写检查服务
 * 使用 nspell + hunspell 词典实现
 */

import nspell from "nspell";

// 单词本存储 key
const CUSTOM_DICTIONARY_KEY = "spell-check-custom-dictionary";
// 拼写检查启用状态 key
const SPELL_CHECK_ENABLED_KEY = "spell-check-enabled";

// 拼写检查设置变更事件名
export const SPELL_CHECK_CHANGED_EVENT = "spell-check-changed";

// 词典文件路径（相对于应用根目录）
const DICT_BASE_PATH = "./dict";

/**
 * 获取拼写检查是否启用（默认关闭）
 */
export function isSpellCheckEnabled(): boolean {
  try {
    const saved = localStorage.getItem(SPELL_CHECK_ENABLED_KEY);
    return saved === "true";
  } catch {
    return false;
  }
}

/**
 * 设置拼写检查启用状态
 */
export function setSpellCheckEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SPELL_CHECK_ENABLED_KEY, String(enabled));
    // 触发自定义事件通知其他组件
    window.dispatchEvent(new CustomEvent(SPELL_CHECK_CHANGED_EVENT, { detail: { enabled } }));
  } catch (e) {
    console.error("保存拼写检查设置失败:", e);
  }
}

// 技术术语白名单（常见的技术词汇，不需要检查）
const TECH_TERMS = new Set([
  // 编程语言和框架
  "javascript", "typescript", "python", "golang", "rust", "kotlin", "swift",
  "react", "vue", "angular", "svelte", "nextjs", "nuxt", "vite", "webpack",
  "nodejs", "deno", "bun", "npm", "yarn", "pnpm",
  // 云服务和工具
  "docker", "kubernetes", "nginx", "redis", "mongodb", "mysql", "postgresql",
  "aws", "azure", "gcp", "tencent", "aliyun", "vercel", "netlify",
  // 常见技术缩写
  "api", "apis", "url", "urls", "uri", "html", "css", "json", "xml", "yaml",
  "http", "https", "tcp", "udp", "ip", "dns", "cdn", "ssl", "tls",
  "sql", "nosql", "graphql", "restful", "grpc", "websocket",
  "ui", "ux", "cli", "gui", "sdk", "ide", "vscode", "vim", "git", "github",
  "ci", "cd", "devops", "sre", "agile", "scrum",
  // 常见技术词汇
  "async", "await", "callback", "promise", "middleware", "plugin", "config",
  "frontend", "backend", "fullstack", "microservice", "serverless",
  "localhost", "env", "dev", "prod", "staging", "debug", "deploy",
  "param", "params", "args", "argv", "stdin", "stdout", "stderr",
  "boolean", "nullable", "readonly", "instanceof", "typeof",
  "regex", "regexp", "jsx", "tsx", "scss", "sass", "less",
  "webpack", "rollup", "esbuild", "turbopack", "parcel",
  "eslint", "prettier", "typescript", "typecheck",
  "monorepo", "lerna", "turborepo", "changeset",
  "tailwind", "tailwindcss", "shadcn", "radix",
  "trpc", "prisma", "drizzle", "typeorm", "sequelize",
  "zod", "yup", "joi", "ajv",
  "milkdown", "prosemirror", "tiptap", "lexical", "slate",
  "hono", "express", "fastify", "koa", "nestjs",
  "vitest", "jest", "mocha", "chai", "cypress", "playwright",
  "storybook", "chromatic",
  "sentry", "datadog", "grafana", "prometheus",
  "linux", "ubuntu", "debian", "centos", "macos", "ios", "android",
  // Markdown 相关
  "markdown", "md", "mdx",
]);

// 拼写检查器实例类型
type SpellCheckerType = ReturnType<typeof nspell>;

// 拼写检查器实例
let spellChecker: SpellCheckerType | null = null;
let initPromise: Promise<void> | null = null;

// 用户自定义单词本（内存缓存）
let customDictionary: Set<string> = new Set();

// 单词检查结果缓存（避免重复检查同一个单词）
const wordCheckCache = new Map<string, boolean>();
// 缓存最大容量
const CACHE_MAX_SIZE = 5000;

/**
 * 从 localStorage 加载用户单词本
 */
function loadCustomDictionary(): Set<string> {
  try {
    const saved = localStorage.getItem(CUSTOM_DICTIONARY_KEY);
    if (saved) {
      const words = JSON.parse(saved) as string[];
      return new Set(words.map((w) => w.toLowerCase()));
    }
  } catch (e) {
    console.error("加载自定义单词本失败:", e);
  }
  return new Set();
}

/**
 * 保存用户单词本到 localStorage
 */
function saveCustomDictionary(words: Set<string>): void {
  try {
    const arr = Array.from(words);
    localStorage.setItem(CUSTOM_DICTIONARY_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error("保存自定义单词本失败:", e);
  }
}

/**
 * 初始化拼写检查器
 */
export async function initSpellChecker(): Promise<void> {
  if (spellChecker) return;
  
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // 通过 fetch 加载词典文件（作为文本）
      const [affResponse, dicResponse] = await Promise.all([
        fetch(`${DICT_BASE_PATH}/index.aff`),
        fetch(`${DICT_BASE_PATH}/index.dic`),
      ]);

      if (!affResponse.ok || !dicResponse.ok) {
        throw new Error("无法加载拼写检查词典文件");
      }

      // 获取文本内容（nspell 支持字符串格式）
      const affText = await affResponse.text();
      const dicText = await dicResponse.text();
      
      spellChecker = nspell(affText, dicText);
      customDictionary = loadCustomDictionary();
      
      // 将自定义单词添加到检查器
      customDictionary.forEach((word) => {
        spellChecker?.add(word);
      });
      
      console.log("拼写检查器初始化完成");
    } catch (err) {
      console.error("加载英文词典失败:", err);
      throw err;
    }
  })();

  return initPromise;
}

/**
 * 检查单词是否拼写正确（内部实现，无缓存）
 * @param word 要检查的单词
 * @returns true 表示正确，false 表示错误
 */
function checkWordInternal(word: string): boolean {
  if (!spellChecker) return true; // 未初始化时不报错
  
  const lowerWord = word.toLowerCase();
  
  // 技术术语白名单
  if (TECH_TERMS.has(lowerWord)) {
    return true;
  }
  
  // 用户自定义单词本
  if (customDictionary.has(lowerWord)) {
    return true;
  }
  
  // 纯数字或包含数字的标识符跳过
  if (/^\d+$/.test(word) || /^[a-zA-Z]+\d+[a-zA-Z\d]*$/.test(word)) {
    return true;
  }
  
  // 驼峰命名拆分检查（如 useState -> use + State）
  if (/[a-z][A-Z]/.test(word)) {
    const parts = word.split(/(?=[A-Z])/);
    return parts.every((part) => checkWordCached(part));
  }
  
  return spellChecker.correct(word);
}

/**
 * 检查单词是否拼写正确（带缓存）
 * @param word 要检查的单词
 * @returns true 表示正确，false 表示错误
 */
export function checkWordCached(word: string): boolean {
  const lowerWord = word.toLowerCase();
  
  // 检查缓存
  const cached = wordCheckCache.get(lowerWord);
  if (cached !== undefined) {
    return cached;
  }
  
  // 执行检查
  const result = checkWordInternal(word);
  
  // 缓存结果（限制大小）
  if (wordCheckCache.size >= CACHE_MAX_SIZE) {
    // 删除最早的条目（简单策略）
    const firstKey = wordCheckCache.keys().next().value;
    if (firstKey) wordCheckCache.delete(firstKey);
  }
  wordCheckCache.set(lowerWord, result);
  
  return result;
}

/**
 * 检查单词是否拼写正确（无缓存版本，向后兼容）
 * @param word 要检查的单词
 * @returns true 表示正确，false 表示错误
 */
export function checkWord(word: string): boolean {
  return checkWordCached(word);
}

/**
 * 清除单词检查缓存
 */
export function clearWordCache(): void {
  wordCheckCache.clear();
}

/**
 * 获取单词的拼写建议
 * @param word 拼写错误的单词
 * @returns 建议的正确拼写列表
 */
export function getSuggestions(word: string): string[] {
  if (!spellChecker) return [];
  return spellChecker.suggest(word).slice(0, 5);
}

/**
 * 添加单词到用户单词本
 * @param word 要添加的单词
 */
export function addToCustomDictionary(word: string): void {
  const lowerWord = word.toLowerCase();
  customDictionary.add(lowerWord);
  spellChecker?.add(lowerWord);
  saveCustomDictionary(customDictionary);
}

/**
 * 从用户单词本移除单词
 * @param word 要移除的单词
 */
export function removeFromCustomDictionary(word: string): void {
  const lowerWord = word.toLowerCase();
  customDictionary.delete(lowerWord);
  spellChecker?.remove(lowerWord);
  saveCustomDictionary(customDictionary);
}

/**
 * 获取用户单词本中的所有单词
 */
export function getCustomDictionary(): string[] {
  return Array.from(customDictionary).sort();
}

/**
 * 清空用户单词本
 */
export function clearCustomDictionary(): void {
  customDictionary.clear();
  localStorage.removeItem(CUSTOM_DICTIONARY_KEY);
}

/**
 * 检查拼写检查器是否已初始化
 */
export function isSpellCheckerReady(): boolean {
  return spellChecker !== null;
}

export interface SpellError {
  word: string;
  start: number;
  end: number;
  suggestions: string[];
}

/**
 * 检查文本中的拼写错误
 * @param text 要检查的文本
 * @returns 拼写错误列表
 */
export function checkText(text: string): SpellError[] {
  if (!spellChecker) return [];
  
  const errors: SpellError[] = [];
  // 匹配英文单词（至少2个字母）
  const wordRegex = /[a-zA-Z]{2,}/g;
  let match;
  
  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    if (!checkWord(word)) {
      errors.push({
        word,
        start: match.index,
        end: match.index + word.length,
        suggestions: getSuggestions(word),
      });
    }
  }
  
  return errors;
}
