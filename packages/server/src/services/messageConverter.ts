/**
 * 消息格式转换服务
 *
 * 统一处理不同格式消息的转换:
 * - OpenAI API 格式 (tool_calls, tool_call_id)
 * - AI SDK v6 格式 (content array with type)
 */

/**
 * OpenAI 格式的消息
 */
export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

/**
 * AI SDK v6 格式的内容部分
 * 注意: tool-call 使用 `input` 字段而不是 `args`，这是 @ai-sdk/openai-compatible 的要求
 */
export type AISDKContentPart =
  | { type: "text"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, any> }
  | { type: "tool-result"; toolCallId: string; toolName: string; output: ToolResultOutput }
  | { type: "reasoning"; text: string }
  | { type: "file"; data: string; mimeType: string };

/**
 * 工具结果输出格式 (AI SDK v6 要求)
 */
export type ToolResultOutput =
  | { type: "text"; value: string }
  | { type: "json"; value: unknown }
  | { type: "error-text"; value: string };

/**
 * AI SDK v6 格式的消息
 */
export interface AISDKMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | AISDKContentPart[];
}

/**
 * 日志前缀 (用于调试)
 */
let logPrefix = "[MessageConverter]";

/**
 * 设置日志前缀
 */
export function setLogPrefix(prefix: string): void {
  logPrefix = prefix;
}

/**
 * 将值转换为 AI SDK v6 的 ToolResultOutput 格式
 */
export function toToolResultOutput(value: unknown): ToolResultOutput {
  if (typeof value === "string") {
    // 尝试解析 JSON 字符串
    try {
      const parsed = JSON.parse(value);
      return { type: "json", value: parsed };
    } catch {
      // 纯文本内容
      return { type: "text", value: value };
    }
  }

  if (value === null || value === undefined) {
    return { type: "text", value: "" };
  }

  if (typeof value === "object") {
    // 检查是否已经是正确格式
    const obj = value as Record<string, unknown>;
    if (obj.type === "text" || obj.type === "json" || obj.type === "error-text") {
      return obj as ToolResultOutput;
    }
    // 包装为 JSON 格式
    return { type: "json", value: value };
  }

  // 其他类型转为文本
  return { type: "text", value: String(value) };
}

/**
 * 从消息列表中构建 toolCallId -> toolName 的映射
 */
export function buildToolCallIdToNameMap(messages: OpenAIMessage[]): Record<string, string> {
  const toolCallIdToName: Record<string, string> = {};

  for (const msg of messages) {
    if (msg.role === "assistant") {
      // OpenAI 格式: tool_calls 数组
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.id && tc.function?.name) {
            toolCallIdToName[tc.id] = tc.function.name;
          }
        }
      }
      // AI SDK 格式: content 数组中的 tool-call 对象
      if (Array.isArray(msg.content)) {
        for (const part of msg.content as AISDKContentPart[]) {
          if (part.type === "tool-call" && part.toolCallId && part.toolName) {
            toolCallIdToName[part.toolCallId] = part.toolName;
          }
        }
      }
    }
  }

  return toolCallIdToName;
}

/**
 * 转换 tool 消息为 AI SDK v6 格式
 */
function convertToolMessage(
  msg: OpenAIMessage,
  toolCallIdToName: Record<string, string>
): AISDKMessage {
  // 检查是否已经是 AI SDK 格式（content 是数组）
  if (Array.isArray(msg.content)) {
    // 已经是数组格式，但需要确保 output 是正确格式
    const normalizedContent = (msg.content as any[]).map((part: any) => {
      if (part.type === "tool-result") {
        // 如果有 result 字段但没有 output 字段，进行转换
        if (part.result !== undefined && part.output === undefined) {
          const { result, ...rest } = part;
          return { ...rest, output: toToolResultOutput(result) };
        }
        // 确保 output 是正确格式
        if (part.output !== undefined) {
          const outputObj = part.output as Record<string, unknown>;
          if (!(outputObj.type === "text" || outputObj.type === "json" || outputObj.type === "error-text")) {
            return { ...part, output: toToolResultOutput(part.output) };
          }
        }
      }
      return part;
    });
    return { role: "tool", content: normalizedContent };
  }

  // OpenAI 格式：tool 消息的 content 是字符串
  const toolCallId = msg.tool_call_id!;
  const toolName = toolCallIdToName[toolCallId] || msg.name || "unknown";

  console.log(`${logPrefix} 转换 tool 消息: toolCallId=${toolCallId}, toolName=${toolName}`);

  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId,
        toolName,
        output: toToolResultOutput(msg.content),
      },
    ],
  };
}

/**
 * 转换 assistant 消息为 AI SDK v6 格式
 */
function convertAssistantMessage(msg: OpenAIMessage): AISDKMessage {
  // 检查是否已经是 AI SDK 格式（content 是数组且包含有效的 part）
  if (Array.isArray(msg.content)) {
    const isValidAISDKFormat = (msg.content as any[]).every((part: any) =>
      part.type === "text" ||
      part.type === "tool-call" ||
      part.type === "tool-result" ||
      part.type === "reasoning" ||
      part.type === "file"
    );
    if (isValidAISDKFormat) {
      // 已经是 AI SDK 格式，直接返回
      return msg as AISDKMessage;
    }
  }

  // OpenAI 格式：检查是否有 tool_calls
  if (msg.tool_calls) {
    const parts: AISDKContentPart[] = [];

    // 如果有文本内容，添加 text part
    if (msg.content && typeof msg.content === "string") {
      parts.push({
        type: "text",
        text: msg.content,
      });
    }

    // 添加 tool-call parts
    // 注意: @ai-sdk/openai-compatible 使用 `input` 字段，不是 `args`
    for (const tc of msg.tool_calls) {
      let input = tc.function.arguments as string | Record<string, any>;
      // 安全解析 arguments
      if (typeof input === "string") {
        try {
          input = JSON.parse(input);
        } catch {
          input = {};
        }
      }
      parts.push({
        type: "tool-call",
        toolCallId: tc.id,
        toolName: tc.function.name,
        input: input as Record<string, any>,
      });
    }

    return {
      role: "assistant",
      content: parts,
    };
  }

  // 普通 assistant 消息
  return {
    role: "assistant",
    content: msg.content || "",
  };
}

/**
 * 将 OpenAI 格式消息转换为 AI SDK v6 格式
 *
 * AI SDK v6 要求:
 * - tool 消息的 content 必须是数组格式
 * - tool-result 的 output 必须是 ToolResultOutput 格式
 */
export function convertMessagesToAISDK(messages: OpenAIMessage[]): AISDKMessage[] {
  // 首先构建 toolCallId -> toolName 的映射
  const toolCallIdToName = buildToolCallIdToNameMap(messages);

  return messages.map((msg) => {
    if (msg.role === "tool") {
      return convertToolMessage(msg, toolCallIdToName);
    }

    if (msg.role === "assistant") {
      return convertAssistantMessage(msg);
    }

    // system 和 user 消息保持原样
    return {
      role: msg.role,
      content: msg.content || "",
    };
  });
}

/**
 * 调试：打印消息格式
 */
export function logMessages(messages: AISDKMessage[], prefix?: string): void {
  const p = prefix || logPrefix;
  console.log(`${p} 消息列表 (共 ${messages.length} 条):`);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const contentPreview = Array.isArray(msg.content)
      ? `[Array(${msg.content.length}): ${(msg.content as AISDKContentPart[]).map((p) => p.type).join(", ")}]`
      : typeof msg.content === "string"
        ? msg.content.substring(0, 100) + (msg.content.length > 100 ? "..." : "")
        : JSON.stringify(msg.content);
    console.log(`${p}   [${i}] role=${msg.role}, content=${contentPreview}`);

    if (msg.role === "tool" && Array.isArray(msg.content)) {
      const firstPart = msg.content[0];
      if (firstPart) {
        console.log(`${p}       tool-result details:`, JSON.stringify(firstPart, null, 2).substring(0, 500));
      }
    }
  }
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  id: string;
  name: string;
  arguments: string;
  status: "completed" | "failed" | "awaiting_confirmation";
  result?: string;
  error?: string;
}

/**
 * 将工具执行结果转换为纯文本格式
 *
 * 避免多次 JSON stringify 导致的转义字符累积问题
 */
export function formatToolResultAsText(
  toolName: string,
  result: string | undefined,
  error?: string
): string {
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
 * 构建工具结果消息（用于继续 AI Loop）
 */
export function buildToolResultMessages(
  toolResults: ToolExecutionResult[]
): OpenAIMessage[] {
  return toolResults.map((tc) => ({
    role: "tool" as const,
    content: formatToolResultAsText(tc.name, tc.result, tc.error),
    tool_call_id: tc.id,
  }));
}

/**
 * 构建 assistant 消息（带工具调用）
 */
export function buildAssistantMessageWithToolCalls(
  content: string,
  toolCalls: Array<{ id: string; name: string; arguments: string }>
): OpenAIMessage {
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
