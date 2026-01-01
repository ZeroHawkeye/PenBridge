/**
 * AI 聊天核心 Hook
 * 管理聊天状态、流式响应、工具调用和 AI Loop
 * 支持待确认变更的管理
 */

import { useState, useCallback, useRef } from "react";
import { getApiBaseUrl } from "@/utils/serverConfig";
import { getAuthToken } from "@/utils/auth";
import type { 
  ChatMessage, 
  FrontendToolContext,
  ToolCallRecord,
  UseAIChatReturn,
} from "../types";
import { executeToolCalls } from "../tools/frontendTools";
import { useChatSession } from "./useChatSession";
import { usePendingChanges } from "./usePendingChanges";
import { DEFAULT_MAX_LOOP_COUNT, ARGS_UPDATE_THROTTLE } from "./constants";

interface UseAIChatOptions {
  articleId?: number;
  toolContext: FrontendToolContext;
  // 权限检查函数：返回 true 表示需要审核
  requiresApproval?: (toolName: string) => boolean;
}

export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const { articleId, toolContext, requiresApproval } = options;
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLoopCount, setCurrentLoopCount] = useState(0);
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);
  
  // 使用会话管理 Hook
  const sessionState = useChatSession({ articleId });
  const {
    session,
    messages,
    setMessages,
    selectedModel,
    setSelectedModel,
    availableModels,
    thinkingSettings,
    setThinkingSettings,
    createNewSession,
    clearMessages: sessionClearMessages,
    addMessageMutation,
    updateMessageMutation,
  } = sessionState;
  
  // 执行后端工具
  const executeBackendTool = useCallback(async (
    toolCallId: string,
    toolName: string,
    args: string
  ): Promise<{ success: boolean; result?: any; error?: string }> => {
    try {
      const token = getAuthToken();
      if (!token) {
        return { success: false, error: "未登录" };
      }
      
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/ai/tool/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          toolCallId,
          toolName,
          arguments: args,
        }),
      });
      
      const data = await response.json();
      return {
        success: data.success,
        result: data.result,
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "后端工具执行失败",
      };
    }
  }, []);
  
  // 恢复 AI Loop（前向声明，用于 usePendingChanges）
  const resumeAILoop = useCallback(async (toolResults: Array<{ id: string; result: string }>) => {
    const pausedState = pendingChangesState.pausedStateRef.current;
    if (!pausedState || !selectedModel) {
      pendingChangesState.pausedStateRef.current = null;
      return;
    }
    
    // 更新暂存的工具调用结果
    const updatedToolCalls = pausedState.toolCalls.map(tc => {
      const result = toolResults.find(r => r.id === tc.id);
      if (result) {
        if (tc.status === "awaiting_confirmation") {
          return { ...tc, result: result.result, status: "completed" as const };
        }
        return { ...tc, result: result.result };
      }
      return tc;
    });
    
    // 构建工具结果消息（使用纯文本格式，避免嵌套 JSON 导致的转义问题）
    const toolResultMessages = updatedToolCalls.map(tc => {
      if (tc.status === "failed") {
        return {
          role: "tool" as const,
          content: `[错误] ${tc.error || "工具执行失败"}`,
          tool_call_id: tc.id,
        };
      }
      
      // 解析 JSON 结果并转换为纯文本格式
      let resultContent = "工具执行完成";
      try {
        const parsed = JSON.parse(tc.result || "{}");
        
        // 对于 read_article 工具，直接输出内容
        if (tc.name === "read_article") {
          const parts: string[] = [];
          if (parsed.title !== undefined) {
            parts.push(`标题: ${parsed.title}`);
          }
          if (parsed.totalLines !== undefined) {
            parts.push(`总行数: ${parsed.totalLines}`);
          }
          if (parsed.startLine !== undefined && parsed.endLine !== undefined) {
            parts.push(`当前范围: 第 ${parsed.startLine} 行 - 第 ${parsed.endLine} 行`);
          }
          if (parsed.hasMoreAfter) {
            parts.push(`提示: 还有更多内容未显示，可使用 startLine 参数继续读取`);
          }
          if (parsed.content !== undefined) {
            parts.push(`\n内容:\n${parsed.content}`);
          }
          resultContent = parts.join("\n");
        } else {
          // 其他工具：简单格式化输出
          resultContent = Object.entries(parsed)
            .map(([key, value]) => {
              if (typeof value === "object") {
                return `${key}: ${JSON.stringify(value)}`;
              }
              return `${key}: ${value}`;
            })
            .join("\n");
        }
      } catch {
        resultContent = tc.result || "工具执行完成";
      }
      
      return {
        role: "tool" as const,
        content: resultContent,
        tool_call_id: tc.id,
      };
    });
    
    // 继续对话
    const newHistory = [
      ...pausedState.messageHistory,
      {
        role: "assistant",
        content: pausedState.assistantContent,
        tool_calls: pausedState.toolCalls.map(tc => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      },
      ...toolResultMessages,
    ];
    
    // 清除暂存状态
    pendingChangesState.pausedStateRef.current = null;
    
    // 继续 AI Loop
    setIsLoading(true);
    await sendMessageToAPI(newHistory, pausedState.loopCount + 1);
  }, [selectedModel]);
  
  // 使用待确认变更管理 Hook
  const pendingChangesState = usePendingChanges(
    { toolContext, updateMessageMutation },
    setMessages,
    resumeAILoop
  );
  
  // 发送消息并处理流式响应
  const sendMessageToAPI = useCallback(async (
    messageHistory: Array<{ role: string; content: string }>,
    loopCount: number = 0
  ): Promise<void> => {
    console.log(`[AI Loop] sendMessageToAPI 开始, loopCount=${loopCount}`);
    
    if (!selectedModel) {
      setError("请先选择 AI 模型");
      return;
    }
    
    const maxLoopCount = selectedModel.capabilities?.aiLoop?.maxLoopCount || DEFAULT_MAX_LOOP_COUNT;
    const unlimitedLoop = selectedModel.capabilities?.aiLoop?.unlimitedLoop || false;
    
    if (!unlimitedLoop && loopCount >= maxLoopCount) {
      setError(`已达到最大推理次数 (${maxLoopCount})，任务可能过于复杂`);
      setIsLoading(false);
      setIsStreaming(false);
      return;
    }
    
    setCurrentLoopCount(loopCount);
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    try {
      const token = getAuthToken();
      if (!token) {
        setError("未登录，请先登录");
        setIsLoading(false);
        return;
      }
      
      const apiBaseUrl = getApiBaseUrl();
      
      const thinkingSupported = selectedModel.capabilities?.thinking?.supported;
      const thinkingApiFormat = selectedModel.capabilities?.thinking?.apiFormat;
      
      const response = await fetch(`${apiBaseUrl}/api/ai/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          providerId: selectedModel.providerId,
          modelId: selectedModel.modelId,
          messages: messageHistory,
          enableTools: true,
          articleContext: toolContext.articleId ? {
            articleId: toolContext.articleId,
            title: toolContext.title,
            contentLength: toolContext.content.length,
          } : undefined,
          ...(thinkingSupported && thinkingSettings.enabled ? {
            thinkingEnabled: true,
            ...(thinkingApiFormat === "openai" ? {
              reasoningEffort: thinkingSettings.reasoningEffort,
            } : {}),
          } : {}),
        }),
        signal: abortController.signal,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      if (!response.body) {
        throw new Error("响应没有 body");
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let assistantReasoning = "";
      let toolCalls: ToolCallRecord[] = [];
      let messageUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
      let messageDuration: number | undefined;
      
      const tempMessageId = `temp_${Date.now()}_loop${loopCount}`;
      currentMessageIdRef.current = tempMessageId;
      
      setMessages(prev => [...prev, {
        id: tempMessageId,
        role: "assistant" as const,
        content: "",
        status: "streaming" as const,
        createdAt: new Date().toISOString(),
      }]);
      
      setIsStreaming(true);
      
      let currentEventType = "";
      let lastArgsUpdateTime = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine.startsWith("event:")) {
            currentEventType = trimmedLine.slice(6).trim();
            continue;
          }
          
          if (!trimmedLine.startsWith("data:")) continue;
          
          try {
            const dataStr = trimmedLine.slice(5).trim();
            if (!dataStr) continue;
            
            const data = JSON.parse(dataStr);
            
            switch (currentEventType) {
              case "reasoning_start":
                setMessages(prev => prev.map(m => 
                  m.id === tempMessageId 
                    ? { ...m, reasoning: "", isReasoning: true }
                    : m
                ));
                break;
                
              case "reasoning":
                if (data.content) {
                  assistantReasoning += data.content;
                  setMessages(prev => prev.map(m => 
                    m.id === tempMessageId 
                      ? { ...m, reasoning: assistantReasoning, isReasoning: true }
                      : m
                  ));
                }
                break;
                
              case "reasoning_end":
                setMessages(prev => prev.map(m => 
                  m.id === tempMessageId 
                    ? { ...m, isReasoning: false }
                    : m
                ));
                break;
                
              case "content":
                if (data.content) {
                  assistantContent += data.content;
                  setMessages(prev => prev.map(m => 
                    m.id === tempMessageId 
                      ? { ...m, content: assistantContent }
                      : m
                  ));
                }
                break;
                
              case "tool_call_start":
                if (data.name) {
                  const newToolCall: ToolCallRecord = {
                    id: data.id || `call_${data.index}`,
                    type: "function" as const,
                    name: data.name,
                    arguments: "",
                    status: "pending" as const,
                    executionLocation: data.executionLocation,
                    isStreamingArguments: true,
                    argumentsLength: 0,
                  };
                  
                  const existingIndex = toolCalls.findIndex(tc => tc.id === newToolCall.id);
                  if (existingIndex === -1) {
                    toolCalls.push(newToolCall);
                  }
                  
                  setMessages(prev => prev.map(m => 
                    m.id === tempMessageId 
                      ? { ...m, toolCalls: [...toolCalls] }
                      : m
                  ));
                }
                break;
              
              case "tool_call_arguments":
                if (data.index !== undefined && data.index < toolCalls.length) {
                  if (data.argumentsDelta) {
                    toolCalls[data.index].arguments = (toolCalls[data.index].arguments || "") + data.argumentsDelta;
                  }
                  toolCalls[data.index].argumentsLength = data.argumentsLength || toolCalls[data.index].arguments?.length || 0;
                  
                  const now = Date.now();
                  if (now - lastArgsUpdateTime >= ARGS_UPDATE_THROTTLE) {
                    lastArgsUpdateTime = now;
                    setMessages(prev => prev.map(m => 
                      m.id === tempMessageId 
                        ? { ...m, toolCalls: [...toolCalls] }
                        : m
                    ));
                  }
                }
                break;
                
              case "tool_calls":
                if (data.toolCalls) {
                  toolCalls = data.toolCalls.map((tc: any) => ({
                    id: tc.id,
                    type: tc.type,
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                    status: "pending" as const,
                    executionLocation: tc.executionLocation,
                    isStreamingArguments: false,
                    argumentsLength: tc.function.arguments?.length || 0,
                  }));
                  
                  setMessages(prev => prev.map(m => 
                    m.id === tempMessageId 
                      ? { ...m, toolCalls }
                      : m
                  ));
                }
                break;
                
              case "done":
                messageUsage = data.usage;
                messageDuration = data.duration;
                setMessages(prev => prev.map(m => 
                  m.id === tempMessageId 
                    ? { 
                        ...m, 
                        status: "completed",
                        usage: data.usage,
                        duration: data.duration,
                        isReasoning: false,
                      }
                    : m
                ));
                break;
                
              case "error":
                if (data.error) {
                  setMessages(prev => prev.map(m => 
                    m.id === tempMessageId 
                      ? { ...m, status: "failed", error: data.error }
                      : m
                  ));
                  setError(data.error);
                }
                break;
                
              default:
                if (data.content) {
                  assistantContent += data.content;
                  setMessages(prev => prev.map(m => 
                    m.id === tempMessageId 
                      ? { ...m, content: assistantContent }
                      : m
                  ));
                }
                if (data.toolCalls) {
                  toolCalls = data.toolCalls.map((tc: any) => ({
                    id: tc.id,
                    type: tc.type,
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                    status: "pending" as const,
                    executionLocation: tc.executionLocation,
                  }));
                  setMessages(prev => prev.map(m => 
                    m.id === tempMessageId 
                      ? { ...m, toolCalls }
                      : m
                  ));
                }
                if (data.success !== undefined) {
                  setMessages(prev => prev.map(m => 
                    m.id === tempMessageId 
                      ? { ...m, status: "completed", usage: data.usage, duration: data.duration }
                      : m
                  ));
                }
                if (data.error) {
                  setMessages(prev => prev.map(m => 
                    m.id === tempMessageId 
                      ? { ...m, status: "failed", error: data.error }
                      : m
                  ));
                  setError(data.error);
                }
                break;
            }
            
            currentEventType = "";
          } catch {
            // 忽略解析错误
          }
        }
      }
      
      setIsStreaming(false);
      
      // 如果有工具调用，执行工具并继续对话
      if (toolCalls.length > 0) {
        setMessages(prev => prev.map(m => 
          m.id === tempMessageId 
            ? { ...m, toolCalls: toolCalls.map(tc => ({ ...tc, status: "running" as const })) }
            : m
        ));
        
        const { results: executedToolCalls, pendingChanges: newPendingChanges } = await executeToolCalls(
          toolCalls,
          toolContext,
          executeBackendTool,
          requiresApproval
        );
        
        setMessages(prev => prev.map(m => 
          m.id === tempMessageId 
            ? { ...m, toolCalls: executedToolCalls, status: "completed" }
            : m
        ));
        
        // 如果有待确认的变更
        if (newPendingChanges.length > 0) {
          pendingChangesState.setPendingChanges(prev => {
            const updated = [...prev, ...newPendingChanges];
            if (prev.length === 0) {
              pendingChangesState.setCurrentPendingChange(newPendingChanges[0]);
            }
            return updated;
          });
          
          pendingChangesState.pausedStateRef.current = {
            messageHistory,
            loopCount,
            assistantContent,
            toolCalls: executedToolCalls,
          };
          
          let dbMessageId: number | undefined;
          if (session) {
            try {
              const savedMessage = await addMessageMutation.mutateAsync({
                sessionId: session.id,
                role: "assistant",
                content: assistantContent,
                reasoning: assistantReasoning || undefined,
                status: "completed",
                usage: messageUsage,
                duration: messageDuration,
                toolCalls: executedToolCalls.map(tc => ({
                  id: tc.id,
                  name: tc.name,
                  arguments: tc.arguments,
                  status: tc.status,
                  result: tc.result,
                  error: tc.error,
                })),
              });
              dbMessageId = savedMessage.id;
            } catch (err) {
              console.error("保存消息失败:", err);
            }
          }
          
          if (pendingChangesState.pausedStateRef.current) {
            pendingChangesState.pausedStateRef.current.dbMessageId = dbMessageId;
          }
          
          setIsLoading(false);
          return;
        }
        
        // 保存带工具调用的消息到数据库
        if (session) {
          try {
            await addMessageMutation.mutateAsync({
              sessionId: session.id,
              role: "assistant",
              content: assistantContent,
              reasoning: assistantReasoning || undefined,
              status: "completed",
              usage: messageUsage,
              duration: messageDuration,
              toolCalls: executedToolCalls.map(tc => ({
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments,
                status: tc.status,
                result: tc.result,
                error: tc.error,
              })),
            });
          } catch (err) {
            console.error("保存消息失败:", err);
          }
        }
        
        // 构建工具结果消息
        // 重要：使用纯文本格式而非嵌套 JSON，避免多次 HTTP 传输导致转义字符累积
        // 
        // 问题分析：
        // 1. tc.result 已经是 JSON 字符串（在 executeToolCalls 中 stringify）
        // 2. 发送到服务器时整个 messages 数组被 stringify（第 2 次）
        // 3. 服务器转发给 AI API 时再次 stringify（第 3 次）
        // 4. 每次 stringify 都会转义反斜杠，但解析只能还原一层
        // 
        // 解决方案：将 tool result 解析后转换为纯文本格式
        const toolResultMessages = executedToolCalls.map(tc => {
          if (tc.status === "failed") {
            // 失败消息使用简单文本格式
            return {
              role: "tool" as const,
              content: `[错误] ${tc.error || "工具执行失败"}`,
              tool_call_id: tc.id,
            };
          }
          
          // 解析 JSON 结果并转换为纯文本格式
          let resultContent = "工具执行完成";
          try {
            const parsed = JSON.parse(tc.result || "{}");
            
            // 对于 read_article 工具，直接输出内容（避免嵌套 JSON 导致的转义问题）
            if (tc.name === "read_article") {
              const parts: string[] = [];
              if (parsed.title !== undefined) {
                parts.push(`标题: ${parsed.title}`);
              }
              if (parsed.totalLines !== undefined) {
                parts.push(`总行数: ${parsed.totalLines}`);
              }
              if (parsed.startLine !== undefined && parsed.endLine !== undefined) {
                parts.push(`当前范围: 第 ${parsed.startLine} 行 - 第 ${parsed.endLine} 行`);
              }
              if (parsed.hasMoreAfter) {
                parts.push(`提示: 还有更多内容未显示，可使用 startLine 参数继续读取`);
              }
              if (parsed.content !== undefined) {
                parts.push(`\n内容:\n${parsed.content}`);
              }
              resultContent = parts.join("\n");
            } else {
              // 其他工具：简单格式化输出
              resultContent = Object.entries(parsed)
                .map(([key, value]) => {
                  if (typeof value === "object") {
                    return `${key}: ${JSON.stringify(value)}`;
                  }
                  return `${key}: ${value}`;
                })
                .join("\n");
            }
          } catch {
            // 解析失败，使用原始值
            resultContent = tc.result || "工具执行完成";
          }
          
          return {
            role: "tool" as const,
            content: resultContent,
            tool_call_id: tc.id,
          };
        });
        
        // 继续对话
        const newHistory = [
          ...messageHistory,
          {
            role: "assistant",
            content: assistantContent,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: "function",
              function: {
                name: tc.name,
                arguments: tc.arguments,
              },
            })),
          },
          ...toolResultMessages,
        ];
        
        await sendMessageToAPI(newHistory, loopCount + 1);
      } else {
        // 没有工具调用，保存消息到数据库
        if (session) {
          try {
            await addMessageMutation.mutateAsync({
              sessionId: session.id,
              role: "assistant",
              content: assistantContent,
              reasoning: assistantReasoning || undefined,
              status: "completed",
              usage: messageUsage,
              duration: messageDuration,
            });
          } catch (err) {
            console.error("保存消息失败:", err);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages(prev => prev.map(m => 
          m.id === currentMessageIdRef.current 
            ? { ...m, status: "completed" }
            : m
        ));
      } else {
        setError(err instanceof Error ? err.message : "请求失败");
        setMessages(prev => prev.map(m => 
          m.id === currentMessageIdRef.current 
            ? { ...m, status: "failed", error: (err as Error).message }
            : m
        ));
      }
    } finally {
      setIsStreaming(false);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [selectedModel, toolContext, session, executeBackendTool, addMessageMutation, requiresApproval, thinkingSettings, setMessages, pendingChangesState]);
  
  // 发送用户消息
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || isStreaming) return;
    
    setError(null);
    setIsLoading(true);
    setCurrentLoopCount(0);
    
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: content.trim(),
      status: "completed",
      createdAt: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    if (session) {
      try {
        await addMessageMutation.mutateAsync({
          sessionId: session.id,
          role: "user",
          content: content.trim(),
          status: "completed",
        });
      } catch (err) {
        console.error("保存用户消息失败:", err);
      }
    }
    
    const messageHistory = [
      ...messages.filter(m => m.role !== "tool").map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: content.trim() },
    ];
    
    await sendMessageToAPI(messageHistory, 0);
  }, [isLoading, isStreaming, messages, session, addMessageMutation, sendMessageToAPI, setMessages]);
  
  // 停止生成
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);
  
  // 清空消息（扩展版本）
  const clearMessages = useCallback(async () => {
    await sessionClearMessages();
    pendingChangesState.resetPendingState();
    setCurrentLoopCount(0);
    setError(null);
  }, [sessionClearMessages, pendingChangesState]);
  
  return {
    session,
    messages,
    isLoading,
    isStreaming,
    error,
    selectedModel,
    availableModels,
    setSelectedModel,
    thinkingSettings,
    setThinkingSettings,
    sendMessage,
    stopGeneration,
    clearMessages,
    createNewSession,
    currentLoopCount,
    maxLoopCount: selectedModel?.capabilities?.aiLoop?.maxLoopCount || DEFAULT_MAX_LOOP_COUNT,
    unlimitedLoop: selectedModel?.capabilities?.aiLoop?.unlimitedLoop || false,
    pendingChanges: pendingChangesState.pendingChanges,
    currentPendingChange: pendingChangesState.currentPendingChange,
    acceptPendingChange: pendingChangesState.acceptPendingChange,
    rejectPendingChange: pendingChangesState.rejectPendingChange,
  };
}
