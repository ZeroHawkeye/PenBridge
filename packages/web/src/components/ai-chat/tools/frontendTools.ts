/**
 * 前端工具执行器
 * 这些工具在浏览器端执行，直接操作编辑器状态
 * 修改类工具会返回待确认状态，需要用户确认后才能应用
 */

import type { FrontendToolContext, ToolCallRecord, PendingChange } from "../types";
import { ToolRegistry } from "../types";
import { exactReplace } from "./stringMatcher";
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
 * 判断是否是修改类工具（默认需要用户确认）
 * 使用工具注册表进行判断，确保与工具定义保持一致
 */
export function isModifyingTool(toolName: string): boolean {
  return ToolRegistry.isWriteTool(toolName);
}

/**
 * 获取所有前端工具名称
 * 使用工具注册表获取，确保与工具定义保持一致
 */
export function getAllFrontendToolNames(): string[] {
  return ToolRegistry.getFrontendToolNames();
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
        const MAX_LINES = 2000; // 最大读取行数限制
        const MAX_CHARS = 3000; // 最大字符数限制，避免智谱等 API 返回 network_error
        
        // 将内容按行分割
        const lines = context.content.split('\n');
        const totalLines = lines.length;
        
        // 辅助函数：限制内容长度
        const truncateContent = (content: string, maxChars: number): { text: string; truncated: boolean } => {
          if (content.length <= maxChars) {
            return { text: content, truncated: false };
          }
          // 在最后一个完整行处截断
          const truncated = content.substring(0, maxChars);
          const lastNewline = truncated.lastIndexOf('\n');
          if (lastNewline > maxChars * 0.5) {
            return { text: truncated.substring(0, lastNewline), truncated: true };
          }
          return { text: truncated, truncated: true };
        };
        
        if (section === "title") {
          return { success: true, result: { title: context.title, totalLines } };
        }
        
        if (startLine === undefined || endLine === undefined) {
          return { 
            success: false, 
            error: `必须指定 startLine 和 endLine 参数。文章共 ${totalLines} 行，建议每次读取 100-200 行。` 
          };
        }
        
        const start = Math.max(1, startLine);
        let end = Math.min(totalLines, endLine);
        
        // 确保不超过最大行数限制
        if (end - start + 1 > MAX_LINES) {
          end = start + MAX_LINES - 1;
        }
        
        // 提取指定行范围的内容（带行号）
        const selectedLines: string[] = [];
        for (let i = start - 1; i < end && i < totalLines; i++) {
          // 格式化行号，保持对齐
          const lineNum = String(i + 1).padStart(String(totalLines).length, ' ');
          selectedLines.push(`${lineNum} | ${lines[i]}`);
        }
        
        // 应用字符数限制
        const rawContent = selectedLines.join('\n');
        const { text: contentText, truncated } = truncateContent(rawContent, MAX_CHARS);
        const actualEndLine = truncated 
          ? start + contentText.split('\n').length - 1 
          : Math.min(end, totalLines);
        
        return {
          success: true,
          result: {
            content: contentText,
            startLine: start,
            endLine: actualEndLine,
            totalLines,
            hasMoreBefore: start > 1,
            hasMoreAfter: actualEndLine < totalLines,
            ...(truncated ? { note: `内容已截断至 ${actualEndLine} 行，请继续读取后续内容` } : {}),
            ...(section === "all" ? { title: context.title } : {}),
          }
        };
      }

      case "update_title": {
        if (!args.title) {
          return { success: false, error: "缺少 title 参数" };
        }

        // 返回待确认的变更
        // 使用 toolCallId 作为 PendingChange.id，确保唯一性（toolCallId 由 AI 模型生成，全局唯一）
        return {
          success: true,
          result: {
            message: "标题修改待确认",
            requiresConfirmation: true,
          },
          pendingChange: {
            id: toolCallId,
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
        
        const lines = context.content.split('\n');
        const totalLines = lines.length;
        const afterLine = args.afterLine as number | undefined;
        
        let newContent: string;
        let insertPosition: string;
        
        if (afterLine === 0) {
          newContent = args.content + "\n\n" + context.content;
          insertPosition = "开头";
        } else if (afterLine === undefined || afterLine >= totalLines) {
          newContent = context.content + "\n\n" + args.content;
          insertPosition = "末尾";
        } else {
          const beforeLines = lines.slice(0, afterLine);
          const afterLines = lines.slice(afterLine);
          newContent = beforeLines.join('\n') + "\n\n" + args.content + "\n\n" + afterLines.join('\n');
          insertPosition = `第 ${afterLine} 行后`;
        }

        // 返回待确认的变更
        // 使用 toolCallId 作为 PendingChange.id，确保唯一性
        return {
          success: true,
          result: {
            message: `内容插入待确认`,
            requiresConfirmation: true,
            insertPosition,
            afterLine: afterLine ?? totalLines,
          },
          pendingChange: {
            id: toolCallId,
            toolCallId,
            type: "content",
            operation: "insert",
            oldValue: context.content,
            newValue: newContent,
            description: `在${insertPosition}插入 ${args.content.length} 字符的内容`,
          },
        };
      }

      case "replace_content": {
        if (!args.search || args.replace === undefined) {
          return { success: false, error: "缺少 search 或 replace 参数" };
        }

        // 验证搜索文本不能为空（空字符串会导致 split 行为异常）
        if (args.search.trim() === "") {
          return { success: false, error: "搜索文本不能为空或仅包含空白字符" };
        }

        // 使用 replaceAll 参数
        const useReplaceAll = args.replaceAll === true;

        // 使用精确匹配（Claude Code 风格）
        const replaceResult = exactReplace(
          context.content,
          args.search,
          args.replace,
          { replaceAll: useReplaceAll }
        );

        // 替换失败
        if (!replaceResult.success) {
          let errorMessage = replaceResult.error || '替换失败';

          // 如果有多个匹配，显示位置信息
          if (replaceResult.matchPreviews && replaceResult.matchPreviews.length > 0) {
            errorMessage += `\n\n找到 ${replaceResult.matchCount} 个匹配位置：\n`;
            replaceResult.matchPreviews.forEach((preview, i) => {
              errorMessage += `\n${i + 1}. 第 ${preview.lineNumber} 行：\n${preview.preview}\n`;
            });
            errorMessage += `\n建议：\n`;
            errorMessage += `1. 提供更多上下文使搜索文本唯一\n`;
            errorMessage += `2. 使用 replaceAll: true 替换所有匹配`;
          }

          return {
            success: false,
            error: errorMessage,
          };
        }

        // 检查是否应该跳过 Diff（文件太大）
        const diffCheck = shouldSkipDiff(context.content, replaceResult.newContent!, 5 * 1024 * 1024);

        // 返回待确认的变更
        return {
          success: true,
          result: {
            message: "内容替换待确认",
            requiresConfirmation: true,
            matchCount: replaceResult.matchCount,
            warnings: replaceResult.warnings,
            skipDiff: diffCheck.shouldSkip,
            diffSkipReason: diffCheck.reason,
          },
          pendingChange: {
            id: toolCallId,
            toolCallId,
            type: "content",
            operation: "replace",
            oldValue: context.content,
            newValue: replaceResult.newContent!,
            description: useReplaceAll 
              ? `替换所有 ${replaceResult.matchCount} 处匹配` 
              : `替换匹配的内容`,
            searchText: args.search,
            replaceText: args.replace,
            replaceAll: useReplaceAll,
            skipDiff: diffCheck.shouldSkip,
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
 * 使用工具注册表进行判断，确保与工具定义保持一致
 */
export function isFrontendTool(toolName: string): boolean {
  return ToolRegistry.isFrontendTool(toolName);
}

/**
 * 批量执行工具调用
 * 返回执行结果和待确认的变更列表
 * @param requiresApprovalFn - 检查工具是否需要审核的函数（返回 true 表示需要审核）
 */
export async function executeToolCalls(
  toolCalls: ToolCallRecord[],
  context: FrontendToolContext,
  executeBackendTool: (toolCallId: string, toolName: string, args: string) => Promise<{ success: boolean; result?: any; error?: string }>,
  requiresApprovalFn?: (toolName: string) => boolean
): Promise<{ results: ToolCallRecord[]; pendingChanges: PendingChange[] }> {
  const results: ToolCallRecord[] = [];
  const pendingChanges: PendingChange[] = [];

  for (const toolCall of toolCalls) {
    const startedAt = new Date().toISOString();

    // 检查此工具是否需要审核（默认修改类工具需要审核）
    const needsApproval = requiresApprovalFn 
      ? requiresApprovalFn(toolCall.name) 
      : isModifyingTool(toolCall.name);

    let result: ToolExecutionResult;

    if (toolCall.executionLocation === "frontend") {
      // 前端执行
      result = await executeFrontendTool(
        toolCall.id,
        toolCall.name,
        toolCall.arguments,
        context
      );

      // 如果有待确认的变更（修改类工具）
      if (result.pendingChange) {
        // 如果需要审核，添加到待确认列表
        if (needsApproval) {
          pendingChanges.push(result.pendingChange);
          // 注意：不再提前更新 context.content，改为在用户接受变更时基于当前内容重新计算
          // 这避免了用户拒绝前一个替换时，后续替换结果错误的问题（镜像替换错误）

          results.push({
            ...toolCall,
            status: "awaiting_confirmation",
            result: result.result ? JSON.stringify(result.result) : undefined,
            pendingChange: result.pendingChange,
            startedAt,
          });
          continue;
        } else {
          // 不需要审核，直接应用变更
          const applyResult = applyPendingChange(result.pendingChange, context);
          
          // 更新 context.content 为新值
          if (result.pendingChange.type === 'content' && result.pendingChange.newValue) {
            context.content = result.pendingChange.newValue;
          }
          
          results.push({
            ...toolCall,
            status: applyResult.success ? "completed" : "failed",
            result: applyResult.success 
              ? JSON.stringify({ 
                  message: result.pendingChange.type === "title" ? "标题已更新" : "内容已更新",
                  autoApproved: true,
                })
              : undefined,
            error: applyResult.error,
            startedAt,
            completedAt: new Date().toISOString(),
          });
          continue;
        }
      }
      
      // 只读工具：如果需要审核，创建一个待确认的变更让用户确认
      if (needsApproval && result.success) {
        const toolDef = ToolRegistry.getByName(toolCall.name);
        const readOnlyPendingChange: PendingChange = {
          id: toolCall.id,
          toolCallId: toolCall.id,
          type: "content",
          operation: "update",
          oldValue: "",
          newValue: result.result ? JSON.stringify(result.result, null, 2) : "",
          description: `${toolDef?.displayName || toolCall.name}`,
          skipDiff: true, // 只读操作不显示 diff
          isReadOnly: true, // 标记为只读审批，确认时不会修改文章内容
        };
        
        pendingChanges.push(readOnlyPendingChange);
        
        results.push({
          ...toolCall,
          status: "awaiting_confirmation",
          result: result.result ? JSON.stringify(result.result) : undefined,
          pendingChange: readOnlyPendingChange,
          startedAt,
        });
        continue;
      }
    } else {
      // 后端执行
      // 如果需要审核，创建一个待确认的变更
      if (needsApproval) {
        // 先执行后端工具获取结果
        result = await executeBackendTool(
          toolCall.id,
          toolCall.name,
          toolCall.arguments
        );
        
        // 创建一个"只读审核"的待确认变更（用于显示结果让用户确认）
        const toolDef = ToolRegistry.getByName(toolCall.name);
        const readOnlyPendingChange: PendingChange = {
          id: toolCall.id,
          toolCallId: toolCall.id,
          type: "content",
          operation: "update",
          oldValue: "",
          newValue: result.result ? JSON.stringify(result.result, null, 2) : "",
          description: `${toolDef?.displayName || toolCall.name}`,
          skipDiff: true, // 只读操作不显示 diff
          isReadOnly: true, // 标记为只读审批，确认时不会修改文章内容
        };
        
        pendingChanges.push(readOnlyPendingChange);
        
        results.push({
          ...toolCall,
          status: "awaiting_confirmation",
          result: result.result ? JSON.stringify(result.result) : undefined,
          error: result.error,
          pendingChange: readOnlyPendingChange,
          startedAt,
        });
        continue;
      }
      
      // 不需要审核，直接执行
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
