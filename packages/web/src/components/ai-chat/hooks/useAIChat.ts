/**
 * AI 聊天核心 Hook
 * 管理聊天状态、流式响应、工具调用和 AI Loop
 * 支持待确认变更的管理
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/utils/trpc";
import { getApiBaseUrl } from "@/utils/serverConfig";
import { getAuthToken } from "@/utils/auth";
import type { 
  ChatMessage, 
  ChatSession, 
  FrontendToolContext,
  AIModelInfo,
  ToolCallRecord,
  PendingChange,
  UseAIChatReturn,
} from "../types";
import { executeToolCalls, applyPendingChange } from "../tools/frontendTools";

const DEFAULT_MAX_LOOP_COUNT = 20;

interface UseAIChatOptions {
  articleId?: number;
  toolContext: FrontendToolContext;
}

export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const { articleId, toolContext } = options;
  
  // 状态
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModelInfo | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModelInfo[]>([]);
  const [currentLoopCount, setCurrentLoopCount] = useState(0);
  
  // 待确认变更状态
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [currentPendingChange, setCurrentPendingChange] = useState<PendingChange | null>(null);
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);
  // 暂存的消息历史和循环计数（用于等待用户确认后恢复 AI Loop）
  const pausedStateRef = useRef<{
    messageHistory: Array<{ role: string; content: string; tool_calls?: any[] }>;
    loopCount: number;
    assistantContent: string;
    toolCalls: ToolCallRecord[];
  } | null>(null);
  
  // tRPC
  const utils = trpc.useContext();
  
  // 获取可用模型列表
  const { data: providers } = trpc.aiConfig.listProviders.useQuery();
  const { data: models } = trpc.aiConfig.listModels.useQuery({});
  const { data: defaultModel } = trpc.aiConfig.getDefaultModel.useQuery();
  
  // 会话操作
  const createSessionMutation = trpc.aiChat.createSession.useMutation();
  const getOrCreateSessionMutation = trpc.aiChat.getOrCreateArticleSession.useMutation();
  const addMessageMutation = trpc.aiChat.addMessage.useMutation();
  
  // 加载消息
  const { data: messagesData } = trpc.aiChat.getMessages.useQuery(
    { sessionId: session?.id || 0 },
    { enabled: !!session?.id }
  );
  
  // 初始化可用模型列表
  useEffect(() => {
    if (providers && models) {
      const modelList: AIModelInfo[] = models
        .filter((m: any) => m.enabled)
        .map((m: any) => {
          const provider = providers.find((p: any) => p.id === m.providerId);
          return {
            id: m.id,
            modelId: m.modelId,
            displayName: m.displayName,
            providerId: m.providerId,
            providerName: provider?.name || "未知供应商",
            capabilities: m.capabilities,
          };
        });
      setAvailableModels(modelList);
      
      // 设置默认模型
      if (!selectedModel && defaultModel) {
        const defaultModelInfo = modelList.find(
          (m: AIModelInfo) => m.modelId === defaultModel.model.modelId && 
               m.providerId === defaultModel.provider.id
        );
        if (defaultModelInfo) {
          setSelectedModel(defaultModelInfo);
        }
      }
    }
  }, [providers, models, defaultModel, selectedModel]);
  
  // 加载会话消息
  useEffect(() => {
    if (messagesData?.messages) {
      setMessages(messagesData.messages.map((m: any) => ({
        ...m,
        status: m.status as ChatMessage["status"],
        role: m.role as ChatMessage["role"],
      })));
    }
  }, [messagesData]);
  
  // 初始化或获取会话
  useEffect(() => {
    const initSession = async () => {
      if (articleId && selectedModel) {
        try {
          const sess = await getOrCreateSessionMutation.mutateAsync({
            articleId,
            modelId: selectedModel.modelId,
            providerId: selectedModel.providerId,
          });
          setSession(sess);
        } catch (err) {
          console.error("初始化会话失败:", err);
        }
      }
    };
    
    initSession();
  }, [articleId, selectedModel?.id]);
  
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
  
  // 发送消息并处理流式响应
  const sendMessageToAPI = useCallback(async (
    messageHistory: Array<{ role: string; content: string }>,
    loopCount: number = 0
  ): Promise<void> => {
    if (!selectedModel) {
      setError("请先选择 AI 模型");
      return;
    }
    
    const maxLoopCount = selectedModel.capabilities?.aiLoop?.maxLoopCount || DEFAULT_MAX_LOOP_COUNT;
    
    if (loopCount >= maxLoopCount) {
      setError(`已达到最大循环次数 (${maxLoopCount})，任务可能过于复杂`);
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
      
      // 创建临时消息 ID
      const tempMessageId = `temp_${Date.now()}`;
      currentMessageIdRef.current = tempMessageId;
      
      // 添加临时助手消息
      setMessages(prev => [...prev, {
        id: tempMessageId,
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: new Date().toISOString(),
      }]);
      
      setIsStreaming(true);
      
      // SSE 解析：需要同时解析 event: 和 data: 行
      let currentEventType = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // 解析事件类型
          if (trimmedLine.startsWith("event:")) {
            currentEventType = trimmedLine.slice(6).trim();
            continue;
          }
          
          // 解析数据
          if (!trimmedLine.startsWith("data:")) continue;
          
          try {
            const dataStr = trimmedLine.slice(5).trim();
            if (!dataStr) continue;
            
            const data = JSON.parse(dataStr);
            
            // 根据事件类型处理
            switch (currentEventType) {
              case "reasoning_start":
                // 开始思考
                setMessages(prev => prev.map(m => 
                  m.id === tempMessageId 
                    ? { ...m, reasoning: "", isReasoning: true }
                    : m
                ));
                break;
                
              case "reasoning":
                // 思考内容
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
                // 思考结束
                setMessages(prev => prev.map(m => 
                  m.id === tempMessageId 
                    ? { ...m, isReasoning: false }
                    : m
                ));
                break;
                
              case "content":
                // 正常回答内容
                if (data.content) {
                  assistantContent += data.content;
                  setMessages(prev => prev.map(m => 
                    m.id === tempMessageId 
                      ? { ...m, content: assistantContent }
                      : m
                  ));
                }
                break;
                
              case "tool_calls":
                // 工具调用
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
                break;
                
              case "done":
                // 完成事件
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
                // 错误事件
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
                // 兼容旧格式：没有 event 类型时直接处理 data
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
            
            // 处理完数据后重置事件类型
            currentEventType = "";
          } catch {
            // 忽略解析错误
          }
        }
      }
      
      setIsStreaming(false);
      
      // 如果有工具调用，执行工具并继续对话
      if (toolCalls.length > 0) {
        // 更新消息显示工具调用状态
        setMessages(prev => prev.map(m => 
          m.id === tempMessageId 
            ? { ...m, toolCalls: toolCalls.map(tc => ({ ...tc, status: "running" as const })) }
            : m
        ));
        
        // 执行工具调用
        const { results: executedToolCalls, pendingChanges: newPendingChanges } = await executeToolCalls(
          toolCalls,
          toolContext,
          executeBackendTool
        );
        
        // 更新消息中的工具调用结果
        setMessages(prev => prev.map(m => 
          m.id === tempMessageId 
            ? { ...m, toolCalls: executedToolCalls, status: "completed" }
            : m
        ));
        
        // 如果有待确认的变更，添加到待确认列表并停止 AI Loop
        if (newPendingChanges.length > 0) {
          setPendingChanges(prev => [...prev, ...newPendingChanges]);
          // 设置第一个待确认的变更为当前变更
          if (!currentPendingChange) {
            setCurrentPendingChange(newPendingChanges[0]);
          }
          
          // 保存当前状态，以便用户确认后恢复 AI Loop
          pausedStateRef.current = {
            messageHistory,
            loopCount,
            assistantContent,
            toolCalls: executedToolCalls,
          };
          
          // 保存当前消息到数据库（包含工具调用信息）
          if (session) {
            try {
              await addMessageMutation.mutateAsync({
                sessionId: session.id,
                role: "assistant",
                content: assistantContent,
                reasoning: assistantReasoning || undefined,
                status: "completed",
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
          
          // 停止 AI Loop，等待用户确认
          // 不再继续发送请求给 AI
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
        
        // 构建工具结果消息（只有非待确认的工具才继续）
        const toolResultMessages = executedToolCalls.map(tc => ({
          role: "tool" as const,
          content: tc.result || tc.error || "工具执行完成",
          tool_call_id: tc.id,
        }));
        
        // 继续对话（AI Loop）
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
        
        // 递归调用继续对话
        await sendMessageToAPI(newHistory, loopCount + 1);
      } else {
        // 保存消息到数据库
        if (session) {
          try {
            await addMessageMutation.mutateAsync({
              sessionId: session.id,
              role: "assistant",
              content: assistantContent,
              reasoning: assistantReasoning || undefined,
              status: "completed",
            });
          } catch (err) {
            console.error("保存消息失败:", err);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // 用户取消
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
  }, [selectedModel, toolContext, session, executeBackendTool, addMessageMutation]);
  
  // 发送用户消息
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || isStreaming) return;
    
    setError(null);
    setIsLoading(true);
    setCurrentLoopCount(0);
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: content.trim(),
      status: "completed",
      createdAt: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // 保存用户消息到数据库
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
    
    // 构建消息历史
    const messageHistory = [
      ...messages.filter(m => m.role !== "tool").map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: content.trim() },
    ];
    
    // 发送到 API
    await sendMessageToAPI(messageHistory, 0);
  }, [isLoading, isStreaming, messages, session, addMessageMutation, sendMessageToAPI]);
  
  // 停止生成
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);
  
  // 清空消息
  const clearMessages = useCallback(async () => {
    if (session) {
      try {
        await utils.client.aiChat.clearMessages.mutate({ sessionId: session.id });
        setMessages([]);
      } catch (err) {
        console.error("清空消息失败:", err);
      }
    } else {
      setMessages([]);
    }
  }, [session, utils]);
  
  // 创建新会话
  const createNewSession = useCallback(async () => {
    if (!selectedModel) return;
    
    try {
      const newSession = await createSessionMutation.mutateAsync({
        articleId,
        modelId: selectedModel.modelId,
        providerId: selectedModel.providerId,
      });
      setSession(newSession);
      setMessages([]);
    } catch (err) {
      console.error("创建会话失败:", err);
    }
  }, [selectedModel, articleId, createSessionMutation]);
  
  // 恢复 AI Loop（在所有待确认变更处理完后调用）
  const resumeAILoop = useCallback(async (toolResults: Array<{ id: string; result: string }>) => {
    const pausedState = pausedStateRef.current;
    if (!pausedState || !selectedModel) {
      pausedStateRef.current = null;
      return;
    }
    
    // 更新暂存的工具调用结果
    const updatedToolCalls = pausedState.toolCalls.map(tc => {
      const result = toolResults.find(r => r.id === tc.id);
      return result ? { ...tc, result: result.result, status: "completed" as const } : tc;
    });
    
    // 构建工具结果消息
    const toolResultMessages = updatedToolCalls.map(tc => ({
      role: "tool" as const,
      content: tc.result || tc.error || "工具执行完成",
      tool_call_id: tc.id,
    }));
    
    // 继续对话（AI Loop）
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
    pausedStateRef.current = null;
    
    // 继续 AI Loop
    setIsLoading(true);
    await sendMessageToAPI(newHistory, pausedState.loopCount + 1);
  }, [selectedModel, sendMessageToAPI]);
  
  // 接受待确认的变更
  const acceptPendingChange = useCallback(async (change: PendingChange) => {
    // 应用变更
    const result = applyPendingChange(change, toolContext);
    
    const toolResult = result.success
      ? JSON.stringify({ 
          message: change.type === "title" ? "标题已更新" : "内容已更新",
          accepted: true,
        })
      : JSON.stringify({ 
          message: "应用变更失败",
          error: result.error,
        });
    
    if (result.success) {
      // 更新对应工具调用的状态为已完成
      setMessages(prev => prev.map(m => ({
        ...m,
        toolCalls: m.toolCalls?.map(tc => 
          tc.id === change.toolCallId
            ? { 
                ...tc, 
                status: "completed" as const,
                result: toolResult,
                completedAt: new Date().toISOString(),
              }
            : tc
        ),
      })));
    } else {
      // 更新为失败状态
      setMessages(prev => prev.map(m => ({
        ...m,
        toolCalls: m.toolCalls?.map(tc => 
          tc.id === change.toolCallId
            ? { 
                ...tc, 
                status: "failed" as const,
                error: result.error,
                completedAt: new Date().toISOString(),
              }
            : tc
        ),
      })));
    }
    
    // 从待确认列表中移除
    const remaining = pendingChanges.filter(c => c.id !== change.id);
    setPendingChanges(remaining);
    setCurrentPendingChange(remaining[0] || null);
    
    // 如果所有待确认变更都处理完了，恢复 AI Loop
    if (remaining.length === 0 && pausedStateRef.current) {
      // 收集所有工具调用的结果
      const toolResults = pausedStateRef.current.toolCalls.map(tc => {
        if (tc.id === change.toolCallId) {
          return { id: tc.id, result: toolResult };
        }
        // 其他工具调用的结果从 messages 中获取
        return { id: tc.id, result: tc.result || "工具执行完成" };
      });
      
      await resumeAILoop(toolResults);
    }
  }, [toolContext, pendingChanges, resumeAILoop]);
  
  // 拒绝待确认的变更
  const rejectPendingChange = useCallback(async (change: PendingChange) => {
    const toolResult = JSON.stringify({ 
      message: "用户拒绝了此修改，请不要再次尝试相同的修改",
      rejected: true,
    });
    
    // 更新对应工具调用的状态为已完成（但标记为被拒绝）
    setMessages(prev => prev.map(m => ({
      ...m,
      toolCalls: m.toolCalls?.map(tc => 
        tc.id === change.toolCallId
          ? { 
              ...tc, 
              status: "completed" as const,
              result: toolResult,
              completedAt: new Date().toISOString(),
            }
          : tc
      ),
    })));
    
    // 从待确认列表中移除
    const remaining = pendingChanges.filter(c => c.id !== change.id);
    setPendingChanges(remaining);
    setCurrentPendingChange(remaining[0] || null);
    
    // 如果所有待确认变更都处理完了，恢复 AI Loop
    if (remaining.length === 0 && pausedStateRef.current) {
      // 收集所有工具调用的结果
      const toolResults = pausedStateRef.current.toolCalls.map(tc => {
        if (tc.id === change.toolCallId) {
          return { id: tc.id, result: toolResult };
        }
        // 其他工具调用的结果从 messages 中获取
        return { id: tc.id, result: tc.result || "工具执行完成" };
      });
      
      await resumeAILoop(toolResults);
    }
  }, [pendingChanges, resumeAILoop]);
  
  return {
    session,
    messages,
    isLoading,
    isStreaming,
    error,
    selectedModel,
    availableModels,
    setSelectedModel,
    sendMessage,
    stopGeneration,
    clearMessages,
    createNewSession,
    currentLoopCount,
    maxLoopCount: selectedModel?.capabilities?.aiLoop?.maxLoopCount || DEFAULT_MAX_LOOP_COUNT,
    // 待确认变更
    pendingChanges,
    currentPendingChange,
    acceptPendingChange,
    rejectPendingChange,
  };
}
