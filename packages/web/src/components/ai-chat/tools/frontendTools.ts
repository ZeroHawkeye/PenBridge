/**
 * 前端工具执行器
 * 这些工具在浏览器端执行，直接操作编辑器状态
 * 修改类工具会返回待确认状态，需要用户确认后才能应用
 */

import type { FrontendToolContext, ToolCallRecord, PendingChange } from "../types";

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
        switch (section) {
          case "title":
            return { success: true, result: { title: context.title } };
          case "content":
            return { success: true, result: { content: context.content } };
          default:
            return {
              success: true,
              result: {
                title: context.title,
                content: context.content,
                contentLength: context.content.length,
              }
            };
        }
      }

      case "read_article_chunk": {
        const chunkSize = args.chunkSize || 2000;
        const chunkIndex = args.chunkIndex || 0;
        const start = chunkIndex * chunkSize;
        const chunk = context.content.slice(start, start + chunkSize);
        const totalChunks = Math.ceil(context.content.length / chunkSize);

        return {
          success: true,
          result: {
            chunk,
            chunkIndex,
            totalChunks,
            hasMore: chunkIndex < totalChunks - 1,
            chunkLength: chunk.length,
          },
        };
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

        if (!context.content.includes(args.search)) {
          return {
            success: false,
            error: "未找到要替换的内容"
          };
        }

        const newContent = context.content.replace(args.search, args.replace);

        // 返回待确认的变更
        return {
          success: true,
          result: {
            message: "内容替换待确认",
            requiresConfirmation: true,
          },
          pendingChange: {
            id: `change_${Date.now()}`,
            toolCallId,
            type: "content",
            operation: "replace",
            oldValue: context.content,
            newValue: newContent,
            description: `替换匹配的内容（搜索: ${args.search.slice(0, 50)}${args.search.length > 50 ? "..." : ""}）`,
            searchText: args.search,
            replaceText: args.replace,
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
      context.onContentChange(change.newValue);
      // 内容变更后需要刷新编辑器（因为 Milkdown 不会自动响应外部 value 变化）
      context.onEditorRefresh?.();
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
    "read_article_chunk",
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
