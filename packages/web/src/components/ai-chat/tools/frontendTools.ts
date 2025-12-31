/**
 * 前端工具执行器
 * 这些工具在浏览器端执行，直接操作编辑器状态
 * 修改类工具会返回待确认状态，需要用户确认后才能应用
 */

import type { FrontendToolContext, ToolCallRecord, PendingChange } from "../types";
import { intelligentMatch, normalizeLineEndings, stripLineNumbers } from "./stringMatcher";
import { shouldSkipDiff } from "./optimizedDiff";

// 工具执行结果
export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  // 如果需要用户确认，返回待确认的变更
  pendingChange?: PendingChange;
}

/**
 * 判断是否是修改类工具（需要用户确认）
 */
export function isModifyingTool(toolName: string): boolean {
  return [
    "update_title",
    "insert_content",
    "replace_content",
    "replace_all_content",
  ].includes(toolName);
}

/**
 * 执行前端工具
 * 对于修改类工具，返回待确认的变更而不是直接应用
 */
export async function executeFrontendTool(
  toolCallId: string,
  toolName: string,
  argsString: string,
  context: FrontendToolContext
): Promise<ToolExecutionResult> {
  let args: Record<string, any> = {};

  try {
    args = JSON.parse(argsString || "{}");
  } catch {
    return { success: false, error: "参数解析失败" };
  }

  try {
    switch (toolName) {
      case "read_article": {
        const section = args.section || "all";
        const startLine = args.startLine as number | undefined;
        const endLine = args.endLine as number | undefined;
        
        // 将内容按行分割
        const lines = context.content.split('\n');
        const totalLines = lines.length;
        
        // 如果指定了行范围，按行读取
        if (startLine !== undefined) {
          const start = Math.max(1, startLine);
          const end = endLine !== undefined 
            ? Math.min(totalLines, endLine) 
            : Math.min(totalLines, start + 199); // 默认读取 200 行
          
          // 提取指定行范围的内容（带行号）
          const selectedLines: string[] = [];
          for (let i = start - 1; i < end && i < totalLines; i++) {
            // 格式化行号，保持对齐
            const lineNum = String(i + 1).padStart(String(totalLines).length, ' ');
            selectedLines.push(`${lineNum} | ${lines[i]}`);
          }
          
          return {
            success: true,
            result: {
              content: selectedLines.join('\n'),
              startLine: start,
              endLine: Math.min(end, totalLines),
              totalLines,
              hasMoreBefore: start > 1,
              hasMoreAfter: end < totalLines,
              ...(section === "all" || section === "title" ? { title: context.title } : {}),
            }
          };
        }
        
        // 不指定行范围时的传统模式
        switch (section) {
          case "title":
            return { success: true, result: { title: context.title } };
          case "content": {
            // 为完整内容也添加行号
            const numberedLines = lines.map((line, i) => {
              const lineNum = String(i + 1).padStart(String(totalLines).length, ' ');
              return `${lineNum} | ${line}`;
            });
            return { 
              success: true, 
              result: { 
                content: numberedLines.join('\n'),
                totalLines,
              } 
            };
          }
          default: {
            // all: 返回标题和带行号的内容
            const numberedLines = lines.map((line, i) => {
              const lineNum = String(i + 1).padStart(String(totalLines).length, ' ');
              return `${lineNum} | ${line}`;
            });
            return {
              success: true,
              result: {
                title: context.title,
                content: numberedLines.join('\n'),
                totalLines,
              }
            };
          }
        }
      }

      case "update_title": {
        if (!args.title) {
          return { success: false, error: "缺少 title 参数" };
        }

        // 返回待确认的变更
        return {
          success: true,
          result: {
            message: "标题修改待确认",
            requiresConfirmation: true,
          },
          pendingChange: {
            id: `change_${Date.now()}`,
            toolCallId,
            type: "title",
            operation: "update",
            oldValue: context.title,
            newValue: args.title,
            description: `将标题从 "${context.title}" 修改为 "${args.title}"`,
          },
        };
      }

      case "insert_content": {
        if (!args.content) {
          return { success: false, error: "缺少 content 参数" };
        }
        const position = args.position || "end";
        let newContent: string;

        if (position === "start") {
          newContent = args.content + "\n\n" + context.content;
        } else {
          newContent = context.content + "\n\n" + args.content;
        }

        // 返回待确认的变更
        return {
          success: true,
          result: {
            message: `内容插入待确认`,
            requiresConfirmation: true,
            position,
          },
          pendingChange: {
            id: `change_${Date.now()}`,
            toolCallId,
            type: "content",
            operation: "insert",
            oldValue: context.content,
            newValue: newContent,
            description: `在${position === "start" ? "开头" : "末尾"}插入 ${args.content.length} 字符的内容`,
            position,
          },
        };
      }

      case "replace_content": {
        if (!args.search || args.replace === undefined) {
          return { success: false, error: "缺少 search 或 replace 参数" };
        }

        // 使用智能匹配
        const matchResult = intelligentMatch(context.content, args.search, {
          requireUnique: !args.replaceAll,
          maxAlternatives: 5,
          fuzzyThreshold: 0.85,
        });

        // 匹配失败
        if (!matchResult.found) {
          let errorMessage = matchResult.warnings.join('\n');

          // 如果有候选匹配，列出来
          if (matchResult.alternatives && matchResult.alternatives.length > 0) {
            errorMessage += `\n\n找到 ${matchResult.alternatives.length} 个可能的匹配位置：\n`;
            matchResult.alternatives.forEach((alt, i) => {
              errorMessage += `\n${i + 1}. 第 ${alt.lineNumber} 行（相似度 ${(alt.similarity * 100).toFixed(0)}%）：\n${alt.preview}\n`;
            });
            errorMessage += `\n建议：\n`;
            errorMessage += `1. 提供更多上下文使搜索文本唯一\n`;
            errorMessage += `2. 使用 replaceAll: true 替换所有匹配\n`;
            errorMessage += `3. 使用 replaceAt: N 只替换第 N 个匹配\n`;
            errorMessage += `4. 使用 replaceRange 限定行范围`;
          } else {
            errorMessage += `\n\n可能的原因：\n`;
            errorMessage += `- 搜索文本包含了行号前缀（如 "1 | "），请只提供实际内容\n`;
            errorMessage += `- 换行符不匹配（Windows CRLF vs Unix LF）\n`;
            errorMessage += `- 空白字符（空格、制表符）不一致\n`;
            errorMessage += `\n提示：系统已自动尝试标准化换行符和空白字符，但仍未找到匹配`;
          }

          return {
            success: false,
            error: errorMessage,
          };
        }

        // 执行替换
        let newContent: string;
        let description: string;
        let occurrences = 1;

        if (args.replaceAll) {
          // 替换所有匹配
          const normalizedContent = normalizeLineEndings(context.content);
          const normalizedSearch = stripLineNumbers(normalizeLineEndings(args.search));
          const normalizedReplace = normalizeLineEndings(args.replace);

          newContent = normalizedContent.replaceAll(normalizedSearch, normalizedReplace);
          occurrences = normalizedContent.split(normalizedSearch).length - 1;
          description = `替换所有 ${occurrences} 处匹配`;
        } else if (args.replaceAt !== undefined) {
          // 替换第 N 个匹配
          const n = args.replaceAt;
          const normalizedContent = normalizeLineEndings(context.content);
          const normalizedSearch = stripLineNumbers(normalizeLineEndings(args.search));
          const normalizedReplace = normalizeLineEndings(args.replace);

          const parts = normalizedContent.split(normalizedSearch);
          if (n < 1 || n > parts.length - 1) {
            return {
              success: false,
              error: `replaceAt=${n} 超出范围（共找到 ${parts.length - 1} 个匹配）`,
            };
          }

          // 只替换第 n 个
          newContent = parts.slice(0, n).join(normalizedSearch) +
                      normalizedReplace +
                      parts.slice(n + 1).join(normalizedSearch);
          description = `替换第 ${n}/${parts.length - 1} 处匹配`;
        } else if (args.replaceRange) {
          // 替换指定行范围内的匹配
          const { startLine, endLine } = args.replaceRange;
          const lines = context.content.split('\n');

          if (startLine < 1 || endLine > lines.length || startLine > endLine) {
            return {
              success: false,
              error: `行范围 ${startLine}-${endLine} 无效（文档共 ${lines.length} 行）`,
            };
          }

          const beforeLines = lines.slice(0, startLine - 1);
          const rangeLines = lines.slice(startLine - 1, endLine);
          const afterLines = lines.slice(endLine);

          const normalizedSearch = stripLineNumbers(normalizeLineEndings(args.search));
          const normalizedReplace = normalizeLineEndings(args.replace);
          const rangeContent = rangeLines.join('\n');
          const newRangeContent = rangeContent.replaceAll(normalizedSearch, normalizedReplace);

          occurrences = rangeContent.split(normalizedSearch).length - 1;
          newContent = [...beforeLines, ...newRangeContent.split('\n'), ...afterLines].join('\n');
          description = `替换第 ${startLine}-${endLine} 行内的 ${occurrences} 处匹配`;
        } else {
          // 单次替换（已验证唯一性）
          const normalizedContent = normalizeLineEndings(context.content);
          const normalizedSearch = stripLineNumbers(normalizeLineEndings(args.search));
          const normalizedReplace = normalizeLineEndings(args.replace);

          newContent = normalizedContent.replace(normalizedSearch, normalizedReplace);
          description = `替换匹配的内容（${matchResult.strategy} 策略）`;

          if (matchResult.warnings.length > 0) {
            description += ` - ${matchResult.warnings.join(', ')}`;
          }
        }

        // 检查是否应该跳过 Diff（文件太大）
        const diffCheck = shouldSkipDiff(context.content, newContent, 5 * 1024 * 1024);

        // 返回待确认的变更
        return {
          success: true,
          result: {
            message: "内容替换待确认",
            requiresConfirmation: true,
            matchStrategy: matchResult.strategy,
            confidence: matchResult.confidence,
            warnings: matchResult.warnings,
            occurrences,
            skipDiff: diffCheck.shouldSkip,
            diffSkipReason: diffCheck.reason,
          },
          pendingChange: {
            id: `change_${Date.now()}`,
            toolCallId,
            type: "content",
            operation: "replace",
            oldValue: context.content,
            newValue: newContent,
            description,
            searchText: args.search,
            replaceText: args.replace,
            skipDiff: diffCheck.shouldSkip,
          },
        };
      }

      case "replace_all_content": {
        if (!args.content) {
          return { success: false, error: "缺少 content 参数" };
        }

        // 返回待确认的变更
        return {
          success: true,
          result: {
            message: "全文替换待确认",
            requiresConfirmation: true,
          },
          pendingChange: {
            id: `change_${Date.now()}`,
            toolCallId,
            type: "content",
            operation: "replace_all",
            oldValue: context.content,
            newValue: args.content,
            description: `完全替换文章内容（${context.content.length} 字符 -> ${args.content.length} 字符）`,
          },
        };
      }

      default:
        return {
          success: false,
          error: `未知的前端工具: ${toolName}`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "工具执行失败"
    };
  }
}

/**
 * 应用待确认的变更
 */
export function applyPendingChange(
  change: PendingChange,
  context: FrontendToolContext
): { success: boolean; error?: string } {
  try {
    if (change.type === "title") {
      context.onTitleChange(change.newValue);
    } else {
      // 优先使用 setEditorContent 直接更新编辑器内容（不重建编辑器，保持滚动位置）
      if (context.setEditorContent) {
        context.setEditorContent(change.newValue);
      } else {
        // 回退：更新状态并刷新编辑器
        context.onContentChange(change.newValue);
        context.onEditorRefresh?.();
      }
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "应用变更失败"
    };
  }
}

/**
 * 检查是否为前端工具
 */
export function isFrontendTool(toolName: string): boolean {
  const frontendTools = [
    "read_article",
    "update_title",
    "insert_content",
    "replace_content",
    "replace_all_content",
  ];
  return frontendTools.includes(toolName);
}

/**
 * 批量执行工具调用
 * 返回执行结果和待确认的变更列表
 */
export async function executeToolCalls(
  toolCalls: ToolCallRecord[],
  context: FrontendToolContext,
  executeBackendTool: (toolCallId: string, toolName: string, args: string) => Promise<{ success: boolean; result?: any; error?: string }>
): Promise<{ results: ToolCallRecord[]; pendingChanges: PendingChange[] }> {
  const results: ToolCallRecord[] = [];
  const pendingChanges: PendingChange[] = [];

  for (const toolCall of toolCalls) {
    const startedAt = new Date().toISOString();

    let result: ToolExecutionResult;

    if (toolCall.executionLocation === "frontend") {
      // 前端执行
      result = await executeFrontendTool(
        toolCall.id,
        toolCall.name,
        toolCall.arguments,
        context
      );

      // 如果有待确认的变更
      if (result.pendingChange) {
        pendingChanges.push(result.pendingChange);
        results.push({
          ...toolCall,
          status: "awaiting_confirmation",
          result: result.result ? JSON.stringify(result.result) : undefined,
          pendingChange: result.pendingChange,
          startedAt,
        });
        continue;
      }
    } else {
      // 后端执行
      result = await executeBackendTool(
        toolCall.id,
        toolCall.name,
        toolCall.arguments
      );
    }

    results.push({
      ...toolCall,
      status: result.success ? "completed" : "failed",
      result: result.result ? JSON.stringify(result.result) : undefined,
      error: result.error,
      startedAt,
      completedAt: new Date().toISOString(),
    });
  }

  return { results, pendingChanges };
}
