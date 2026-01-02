/**
 * 工具结果格式化服务
 *
 * 统一处理工具执行结果的格式化：
 * - 将 JSON 结果转换为纯文本格式，避免多次 HTTP 传输导致的转义字符累积
 * - 提供一致的消息构建接口
 */

import type { ToolCallRecord } from "../types";

/**
 * 将工具执行结果格式化为纯文本
 *
 * 避免多次 JSON stringify 导致的转义字符累积问题：
 * 1. tc.result 已经是 JSON 字符串（在 executeToolCalls 中 stringify）
 * 2. 发送到服务器时整个 messages 数组被 stringify（第 2 次）
 * 3. 服务器转发给 AI API 时再次 stringify（第 3 次）
 */
export function formatToolResultAsText(
  toolName: string,
  result: string | undefined,
  error?: string
): string {
  // 失败消息使用简单文本格式
  if (error) {
    return `[错误] ${error}`;
  }

  if (!result) {
    return "工具执行完成";
  }

  // 尝试解析 JSON 结果
  try {
    const parsed = JSON.parse(result);

    // 对于 read_article 工具，直接输出内容
    if (toolName === "read_article") {
      const parts: string[] = [];
      if (parsed.title) {
        parts.push(`标题: ${parsed.title}`);
      }
      if (parsed.content) {
        parts.push(parsed.content);
      }
      if (parsed.totalLines !== undefined) {
        parts.push(`\n[共 ${parsed.totalLines} 行${parsed.hasMoreAfter ? `，还有 ${parsed.totalLines - parsed.endLine} 行未显示` : ""}]`);
      }
      if (parsed.note) {
        parts.push(`\n注意: ${parsed.note}`);
      }
      return parts.join("\n") || "（空文章）";
    }

    // 其他工具：简单格式化输出
    return Object.entries(parsed)
      .map(([key, value]) => {
        if (typeof value === "object") {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join("\n");
  } catch {
    // 解析失败，使用原始值
    return result;
  }
}

/**
 * 工具消息（用于发送给 AI）
 */
export interface ToolMessage {
  role: "tool";
  content: string;
  tool_call_id: string;
}

/**
 * 构建工具结果消息列表
 */
export function buildToolResultMessages(toolCalls: ToolCallRecord[]): ToolMessage[] {
  return toolCalls.map((tc) => ({
    role: "tool" as const,
    content: tc.status === "failed"
      ? formatToolResultAsText(tc.name, undefined, tc.error || "工具执行失败")
      : formatToolResultAsText(tc.name, tc.result),
    tool_call_id: tc.id,
  }));
}

/**
 * 构建 assistant 消息（带工具调用）
 */
export function buildAssistantMessageWithToolCalls(
  content: string,
  toolCalls: ToolCallRecord[]
): {
  role: "assistant";
  content: string;
  tool_calls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
} {
  return {
    role: "assistant",
    content,
    tool_calls: toolCalls.map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.name,
        arguments: tc.arguments,
      },
    })),
  };
}

/**
 * 构建继续对话的消息历史
 */
export function buildContinueMessageHistory(
  previousHistory: Array<{ role: string; content: string }>,
  assistantContent: string,
  toolCalls: ToolCallRecord[]
): Array<{ role: string; content: string; tool_calls?: any; tool_call_id?: string }> {
  const toolResultMessages = buildToolResultMessages(toolCalls);

  return [
    ...previousHistory,
    buildAssistantMessageWithToolCalls(assistantContent, toolCalls),
    ...toolResultMessages,
  ];
}
