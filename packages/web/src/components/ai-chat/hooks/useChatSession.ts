/**
 * 会话管理 Hook
 * 负责初始化和管理 AI 聊天会话
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/utils/trpc";
import type { 
  ChatMessage, 
  ChatSession, 
  AIModelInfo,
  ThinkingSettings,
} from "../types";
import { SELECTED_MODEL_KEY, THINKING_SETTINGS_KEY } from "./constants";

interface UseChatSessionOptions {
  articleId?: number;
}

export interface ChatSessionState {
  session: ChatSession | null;
  setSession: React.Dispatch<React.SetStateAction<ChatSession | null>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  selectedModel: AIModelInfo | null;
  setSelectedModel: React.Dispatch<React.SetStateAction<AIModelInfo | null>>;
  availableModels: AIModelInfo[];
  thinkingSettings: ThinkingSettings;
  setThinkingSettings: React.Dispatch<React.SetStateAction<ThinkingSettings>>;
  currentSessionIdRef: React.MutableRefObject<number | null>;
  createNewSession: () => Promise<void>;
  clearMessages: () => Promise<void>;
  addMessageMutation: ReturnType<typeof trpc.aiChat.addMessage.useMutation>;
  updateMessageMutation: ReturnType<typeof trpc.aiChat.updateMessage.useMutation>;
  utils: ReturnType<typeof trpc.useContext>;
}

export function useChatSession(options: UseChatSessionOptions): ChatSessionState {
  const { articleId } = options;
  
  // 状态
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedModel, setSelectedModel] = useState<AIModelInfo | null>(null);
  
  // 深度思考设置
  const [thinkingSettings, setThinkingSettings] = useState<ThinkingSettings>(() => {
    const savedSettings = localStorage.getItem(THINKING_SETTINGS_KEY);
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch {
        // 解析失败，使用默认值
      }
    }
    return { enabled: false, reasoningEffort: "medium" as const };
  });
  
  // Refs
  const currentSessionIdRef = useRef<number | null>(null);
  const isInitializingSessionRef = useRef(false);
  const initializedArticleIdRef = useRef<number | null>(null);
  
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
  const updateMessageMutation = trpc.aiChat.updateMessage.useMutation();
  
  // 加载消息
  const { data: messagesData } = trpc.aiChat.getMessages.useQuery(
    { sessionId: session?.id || 0 },
    { 
      enabled: !!session?.id,
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    }
  );
  
  // 计算可用模型列表
  const availableModels = useMemo(() => {
    if (!providers || !models) return [];
    return models
      .filter((m: any) => m.enabled)
      .map((m: any) => {
        const provider = providers.find((p: any) => p.id === m.providerId);
        return {
          id: m.id,
          modelId: m.modelId,
          displayName: m.displayName,
          providerId: m.providerId,
          providerName: provider?.name || "未知供应商",
          contextLength: m.contextLength,
          capabilities: m.capabilities,
          aiLoopConfig: m.aiLoopConfig,
        };
      });
  }, [providers, models]);
  
  // 初始化选择的模型
  useEffect(() => {
    if (availableModels.length === 0) return;
    
    if (!selectedModel) {
      const savedModelStr = localStorage.getItem(SELECTED_MODEL_KEY);
      if (savedModelStr) {
        try {
          const savedModel = JSON.parse(savedModelStr);
          const matchedModel = availableModels.find(
            (m: AIModelInfo) => m.modelId === savedModel.modelId && 
                 m.providerId === savedModel.providerId
          );
          if (matchedModel) {
            setSelectedModel(matchedModel);
            return;
          }
        } catch {
          // 解析失败，忽略保存的值
        }
      }
      
      if (defaultModel) {
        const defaultModelInfo = availableModels.find(
          (m: AIModelInfo) => m.modelId === defaultModel.model.modelId && 
               m.providerId === defaultModel.provider.id
        );
        if (defaultModelInfo) {
          setSelectedModel(defaultModelInfo);
        }
      }
    }
  }, [availableModels, defaultModel, selectedModel]);
  
  // 保存用户选择的模型到 localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem(SELECTED_MODEL_KEY, JSON.stringify({
        modelId: selectedModel.modelId,
        providerId: selectedModel.providerId,
      }));
    }
  }, [selectedModel]);
  
  // 加载会话消息
  useEffect(() => {
    if (messagesData?.messages && session?.id) {
      if (currentSessionIdRef.current === session.id) {
        setMessages(messagesData.messages.map((m: any) => ({
          ...m,
          status: m.status as ChatMessage["status"],
          role: m.role as ChatMessage["role"],
        })));
      }
    }
  }, [messagesData, session?.id]);
  
  // 初始化或获取会话
  // 注意：会话只根据 articleId 进行关联，每个文章只有一个会话，与选择的模型无关
  useEffect(() => {
    const initSession = async () => {
      if (isInitializingSessionRef.current) return;
      if (initializedArticleIdRef.current === articleId && session) return;
      
      if (articleId) {
        isInitializingSessionRef.current = true;
        try {
          const sess = await getOrCreateSessionMutation.mutateAsync({
            articleId,
          });
          currentSessionIdRef.current = sess.id;
          initializedArticleIdRef.current = articleId;
          setSession(sess);
        } catch (err) {
          console.error("初始化会话失败:", err);
        } finally {
          isInitializingSessionRef.current = false;
        }
      }
    };
    
    initSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);
  
  // 保存深度思考设置到 localStorage
  useEffect(() => {
    localStorage.setItem(THINKING_SETTINGS_KEY, JSON.stringify(thinkingSettings));
  }, [thinkingSettings]);
  
  // 创建新会话
  // 注意：会话只根据 articleId 进行关联，不再依赖模型信息
  const createNewSession = useCallback(async () => {
    try {
      const newSession = await createSessionMutation.mutateAsync({
        articleId,
      });
      setSession(newSession);
      setMessages([]);
    } catch (err) {
      console.error("创建会话失败:", err);
    }
  }, [articleId, createSessionMutation]);
  
  // 清空消息
  const clearMessages = useCallback(async () => {
    if (session) {
      try {
        await utils.client.aiChat.clearMessages.mutate({ sessionId: session.id });
        setMessages([]);
        setSession(prev => prev ? { ...prev, totalTokens: 0, messageCount: 0 } : null);
      } catch (err) {
        console.error("清空消息失败:", err);
      }
    } else {
      setMessages([]);
    }
  }, [session, utils]);
  
  return {
    session,
    setSession,
    messages,
    setMessages,
    selectedModel,
    setSelectedModel,
    availableModels,
    thinkingSettings,
    setThinkingSettings,
    currentSessionIdRef,
    createNewSession,
    clearMessages,
    addMessageMutation,
    updateMessageMutation,
    utils,
  };
}
