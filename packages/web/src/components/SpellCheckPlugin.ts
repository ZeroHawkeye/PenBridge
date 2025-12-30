/**
 * Milkdown 拼写检查插件
 * 在拼写错误的单词下显示红色波浪线
 * 
 * 性能优化：
 * 1. 使用缓存的单词检查（checkWordCached）
 * 2. 延迟获取拼写建议（只在右键点击时）
 * 3. 增量检查（只检查变化的段落）
 * 4. 增加防抖时间
 */

import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, EditorView } from "@milkdown/kit/prose/view";
import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import {
  checkWordCached,
  getSuggestions,
  initSpellChecker,
  isSpellCheckerReady,
  addToCustomDictionary,
  clearWordCache,
} from "@/utils/spellCheck";

// 插件 key
export const spellCheckPluginKey = new PluginKey<DecorationSet>("spellCheck");

// 防抖时间（毫秒）
const DEBOUNCE_DELAY = 500;

// 缓存每个段落的检查结果，key 是段落内容的 hash
const paragraphCache = new Map<string, Decoration[]>();
const PARAGRAPH_CACHE_MAX_SIZE = 200;

/**
 * 简单的字符串 hash 函数
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * 检查单个文本节点中的拼写错误
 */
function checkTextNode(text: string, basePos: number): Decoration[] {
  const decorations: Decoration[] = [];
  // 匹配英文单词（至少2个字母）
  const wordRegex = /[a-zA-Z]{2,}/g;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    if (!checkWordCached(word)) {
      const from = basePos + match.index;
      const to = from + word.length;
      
      decorations.push(
        Decoration.inline(from, to, {
          class: "spell-error",
          "data-spell-word": word,
        })
      );
    }
  }

  return decorations;
}

/**
 * 查找文本节点中的拼写错误（带段落级缓存）
 */
function findSpellErrors(doc: ProseMirrorNode): Decoration[] {
  const decorations: Decoration[] = [];
  
  if (!isSpellCheckerReady()) {
    return decorations;
  }

  // 遍历文档中的所有块级节点（段落）
  doc.descendants((node, pos) => {
    // 只处理包含文本的块级节点
    if (node.isBlock && node.textContent) {
      const textContent = node.textContent;
      const cacheKey = hashString(textContent);
      
      // 检查段落缓存
      const cached = paragraphCache.get(cacheKey);
      if (cached) {
        // 需要调整位置偏移
        const offset = pos + 1; // +1 是因为段落开始位置
        cached.forEach(deco => {
          // 重新创建装饰，使用正确的位置
          const spec = deco.spec as { class: string; "data-spell-word": string };
          const from = (deco as { from: number }).from - 1 + offset;
          const to = (deco as { to: number }).to - 1 + offset;
          decorations.push(
            Decoration.inline(from, to, {
              class: spec.class,
              "data-spell-word": spec["data-spell-word"],
            })
          );
        });
        return false; // 不再遍历子节点
      }

      // 遍历段落内的文本节点
      const paragraphDecorations: Decoration[] = [];
      let textOffset = 0;
      
      node.forEach((child, childOffset) => {
        if (child.isText && child.text) {
          const nodeDecos = checkTextNode(child.text, childOffset + 1);
          paragraphDecorations.push(...nodeDecos);
        }
        textOffset += child.nodeSize;
      });

      // 缓存段落结果
      if (paragraphCache.size >= PARAGRAPH_CACHE_MAX_SIZE) {
        const firstKey = paragraphCache.keys().next().value;
        if (firstKey) paragraphCache.delete(firstKey);
      }
      paragraphCache.set(cacheKey, paragraphDecorations);

      // 调整位置并添加到结果
      const offset = pos + 1;
      paragraphDecorations.forEach(deco => {
        const spec = deco.spec as { class: string; "data-spell-word": string };
        const from = (deco as { from: number }).from + offset;
        const to = (deco as { to: number }).to + offset;
        decorations.push(
          Decoration.inline(from, to, {
            class: spec.class,
            "data-spell-word": spec["data-spell-word"],
          })
        );
      });

      return false; // 不再遍历子节点
    }
    return true;
  });

  return decorations;
}

/**
 * 更新装饰
 */
function updateDecorations(view: EditorView): void {
  if (!isSpellCheckerReady()) return;

  const { state } = view;
  const decorations = findSpellErrors(state.doc);
  const decorationSet = DecorationSet.create(state.doc, decorations);

  // 通过 transaction 更新插件状态
  const tr = state.tr.setMeta(spellCheckPluginKey, { decorations: decorationSet });
  view.dispatch(tr);
}

/**
 * 创建拼写检查插件
 */
export function createSpellCheckPlugin(): Plugin<DecorationSet> {
  let updateTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleUpdate = (view: EditorView) => {
    if (updateTimer) {
      clearTimeout(updateTimer);
    }
    updateTimer = setTimeout(() => {
      updateDecorations(view);
    }, DEBOUNCE_DELAY);
  };

  return new Plugin<DecorationSet>({
    key: spellCheckPluginKey,
    state: {
      init(_, { doc }) {
        return DecorationSet.create(doc, []);
      },
      apply(tr, oldSet, _oldState, newState) {
        // 检查是否有 meta 更新
        const meta = tr.getMeta(spellCheckPluginKey) as { decorations?: DecorationSet } | undefined;
        if (meta?.decorations) {
          return meta.decorations;
        }
        
        // 映射现有装饰
        return oldSet.map(tr.mapping, newState.doc);
      },
    },
    props: {
      decorations(state) {
        return spellCheckPluginKey.getState(state) ?? DecorationSet.empty;
      },
      // 处理右键菜单
      handleDOMEvents: {
        contextmenu(view, event) {
          const target = event.target as HTMLElement;
          if (target.classList?.contains("spell-error")) {
            // 阻止默认菜单，显示自定义菜单
            event.preventDefault();
            showSpellSuggestionMenu(view, target, event);
            return true;
          }
          return false;
        },
      },
    },
    view(editorView) {
      // 初始化拼写检查器
      initSpellChecker().then(() => {
        scheduleUpdate(editorView);
      });

      return {
        update(view, prevState) {
          if (view.state.doc !== prevState.doc) {
            scheduleUpdate(view);
          }
        },
        destroy() {
          if (updateTimer) {
            clearTimeout(updateTimer);
          }
          // 清理缓存
          paragraphCache.clear();
          clearWordCache();
          // 移除可能存在的菜单
          removeSpellMenu();
        },
      };
    },
  });
}

// 当前显示的菜单元素
let currentMenu: HTMLElement | null = null;

/**
 * 移除拼写建议菜单
 */
function removeSpellMenu(): void {
  if (currentMenu) {
    currentMenu.remove();
    currentMenu = null;
  }
}

/**
 * 显示拼写建议菜单
 */
function showSpellSuggestionMenu(view: EditorView, target: HTMLElement, event: MouseEvent): void {
  removeSpellMenu();

  const word = target.dataset.spellWord || "";
  // 延迟获取建议 - 只在用户右键点击时才计算
  const suggestions = getSuggestions(word);

  // 创建菜单容器
  const menu = document.createElement("div");
  menu.className = "spell-suggestion-menu";
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: var(--background, white);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px 0;
    min-width: 160px;
    max-width: 240px;
    z-index: 9999;
    font-size: 13px;
  `;

  // 添加建议项
  if (suggestions.length > 0) {
    suggestions.forEach((suggestion) => {
      const item = document.createElement("div");
      item.className = "spell-menu-item";
      item.textContent = suggestion;
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        color: var(--foreground, #111);
      `;
      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--accent, #f3f4f6)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
      });
      item.addEventListener("click", () => {
        replaceWord(view, target, suggestion);
        removeSpellMenu();
      });
      menu.appendChild(item);
    });

    // 分隔线
    const separator = document.createElement("div");
    separator.style.cssText = `
      height: 1px;
      background: var(--border, #e5e7eb);
      margin: 4px 0;
    `;
    menu.appendChild(separator);
  } else {
    // 无建议
    const noSuggestion = document.createElement("div");
    noSuggestion.textContent = "无拼写建议";
    noSuggestion.style.cssText = `
      padding: 8px 12px;
      color: var(--muted-foreground, #6b7280);
      font-style: italic;
    `;
    menu.appendChild(noSuggestion);

    const separator = document.createElement("div");
    separator.style.cssText = `
      height: 1px;
      background: var(--border, #e5e7eb);
      margin: 4px 0;
    `;
    menu.appendChild(separator);
  }

  // 添加到词典选项
  const addToDictItem = document.createElement("div");
  addToDictItem.className = "spell-menu-item";
  addToDictItem.textContent = `添加 "${word}" 到单词本`;
  addToDictItem.style.cssText = `
    padding: 8px 12px;
    cursor: pointer;
    color: var(--foreground, #111);
  `;
  addToDictItem.addEventListener("mouseenter", () => {
    addToDictItem.style.background = "var(--accent, #f3f4f6)";
  });
  addToDictItem.addEventListener("mouseleave", () => {
    addToDictItem.style.background = "transparent";
  });
  addToDictItem.addEventListener("click", () => {
    addToCustomDictionary(word);
    // 清除缓存，因为词典变化了
    paragraphCache.clear();
    clearWordCache();
    removeSpellMenu();
    // 重新检查拼写
    updateDecorations(view);
  });
  menu.appendChild(addToDictItem);

  // 添加到 body
  document.body.appendChild(menu);
  currentMenu = menu;

  // 点击其他地方关闭菜单
  const closeHandler = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      removeSpellMenu();
      document.removeEventListener("click", closeHandler);
    }
  };
  // 延迟添加监听器，避免立即触发
  setTimeout(() => {
    document.addEventListener("click", closeHandler);
  }, 0);
}

/**
 * 替换单词
 */
function replaceWord(view: EditorView, target: HTMLElement, replacement: string): void {
  // 获取装饰的位置
  const pos = view.posAtDOM(target, 0);
  const word = target.dataset.spellWord || "";
  
  // 创建替换事务
  const { state } = view;
  const from = pos;
  const to = pos + word.length;
  
  const tr = state.tr.replaceWith(from, to, state.schema.text(replacement));
  view.dispatch(tr);
}

// 导出添加到词典的函数
export { addToCustomDictionary };
