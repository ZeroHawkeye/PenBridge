/**
 * AI 聊天流式 API 路由
 * 使用 Vercel AI SDK 支持工具调用和推理
 * 
 * 重构后使用统一的 Provider 适配器和消息转换服务
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { streamText } from "ai";
import { AppDataSource } from "../db";
import { AIProvider, AIModel, defaultCapabilities, defaultAILoopConfig } from "../entities/AIProvider";
import { validateSession } from "../services/adminAuth";
import { formatToolsForAPI, getToolExecutionLocation, getAllToolDefinitions } from "../services/aiTools";
import { buildSystemPrompt } from "../services/promptTemplate";
import { 
  createProviderAdapter, 
  buildStreamTextOptions,
  type ThinkingConfig,
} from "../services/aiProviderAdapter";
import { 
  convertMessagesToAISDK, 
  setLogPrefix, 
  logMessages,
  type OpenAIMessage,
} from "../services/messageConverter";

export const aiChatStreamRouter = new Hono();

/**
 * 创建请求日志辅助函数
 */
function createLogger(requestId: string, startTime: number) {
  const logPrefix = `[AI Chat Stream ${requestId}]`;
  setLogPrefix(logPrefix);
  
  return {
    logPrefix,
    logStep: (step: string) => {
      const elapsed = Date.now() - startTime;
      console.log(`${logPrefix} ${step} (+${elapsed}ms)`);
    },
  };
}

/**
 * 文章上下文类型 (用于内部函数)
 */
interface InternalArticleContext {
  title: string;
  contentLength: number;
  articleId?: number;
}

/**
 * 构建系统消息
 */
function buildSystemMessage(
  existingSystemMessage: OpenAIMessage | undefined,
  articleContext: InternalArticleContext | undefined,
  toolInfoList: Array<{ name: string; description: string }>,
  shouldEnableTools: boolean
): OpenAIMessage {
  if (existingSystemMessage) {
    // 前端提供了自定义系统提示词，追加上下文信息
    const contextParts: string[] = [];
    
    if (articleContext) {
      contextParts.push(
        `\n\n# 当前文章上下文\n\n你正在协助用户编辑一篇文章：\n<article-context>\n  标题: ${articleContext.title}\n  字数: ${articleContext.contentLength} 字\n  文章ID: ${articleContext.articleId}\n</article-context>`
      );
    }
    
    if (shouldEnableTools && toolInfoList.length > 0) {
      contextParts.push(
        `\n\n<important>\nread_article 工具返回的内容包含行号前缀（格式："行号 | 内容"）。行号仅用于定位，在使用 replace_content 等工具时，请勿在 search 参数中包含行号前缀，只提供实际的文本内容。\n</important>`
      );
    }
    
    return {
      ...existingSystemMessage,
      content: (existingSystemMessage.content || "") + contextParts.join(""),
    };
  }
  
  // 没有自定义系统提示词，使用模板生成完整的系统提示词
  // 只有当 articleId 存在时才传递完整的 articleContext
  const fullSystemPrompt = buildSystemPrompt({
    articleContext: articleContext?.articleId 
      ? { ...articleContext, articleId: articleContext.articleId } 
      : undefined,
    tools: shouldEnableTools ? toolInfoList : undefined,
    includeEnvironment: true,
  });
  
  return {
    role: "system",
    content: fullSystemPrompt,
  };
}

/**
 * 调试：打印包含工具消息的原始消息
 */
function debugLogToolMessages(messages: OpenAIMessage[], logPrefix: string): void {
  const hasToolMessages = messages.some((m) => m.role === "tool" || m.tool_calls);
  if (!hasToolMessages) return;
  
  console.log(`${logPrefix} 收到的原始消息 (含工具调用):`);
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    console.log(`${logPrefix}   [${i}] role=${msg.role}`);
    if (msg.tool_calls) {
      console.log(`${logPrefix}       tool_calls:`, JSON.stringify(msg.tool_calls).substring(0, 200));
    }
    if (msg.tool_call_id) {
      console.log(`${logPrefix}       tool_call_id: ${msg.tool_call_id}`);
      console.log(
        `${logPrefix}       content (前200字符): ${
          typeof msg.content === "string"
            ? msg.content.substring(0, 200)
            : JSON.stringify(msg.content).substring(0, 200)
        }`
      );
    }
  }
}

/**
 * AI 聊天 API（支持工具调用和推理）
 * POST /api/ai/chat/stream
 */
aiChatStreamRouter.post("/", async (c) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  const { logPrefix, logStep } = createLogger(requestId, startTime);

  logStep("请求开始");

  try {
    // 验证登录状态
    const authHeader = c.req.header("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!token) {
      logStep("错误: 未提供 token");
      return c.json({ error: "未登录" }, 401);
    }

    const session = await validateSession(token);
    if (!session) {
      logStep("错误: session 无效");
      return c.json({ error: "登录已过期" }, 401);
    }

    // 解析请求体
    const body = await c.req.json();
    const {
      providerId,
      modelId,
      messages,
      enableTools = true,
      articleContext,
      // 推理设置（从 AI Chat 面板动态传递）
      reasoningEnabled,
      reasoningEffort,
    } = body;

    logStep(`请求体解析完成: providerId=${providerId}, modelId=${modelId}, messagesCount=${messages?.length || 0}`);

    // 调试：打印包含工具消息的原始消息
    debugLogToolMessages(messages, logPrefix);

    if (!providerId || !modelId || !messages) {
      logStep("错误: 缺少必要参数");
      return c.json({ error: "缺少必要参数" }, 400);
    }

    // 获取供应商配置
    const providerRepo = AppDataSource.getRepository(AIProvider);
    const provider = await providerRepo.findOne({
      where: { id: providerId, userId: 1 },
    });

    if (!provider) {
      logStep("错误: 供应商不存在");
      return c.json({ error: "供应商不存在" }, 404);
    }

    // 获取模型配置
    const modelRepo = AppDataSource.getRepository(AIModel);
    const modelConfig = await modelRepo.findOne({
      where: { providerId, modelId, userId: 1 },
    });

    const capabilities = modelConfig?.capabilities || defaultCapabilities;

    // 创建 Provider 适配器
    const adapter = createProviderAdapter(provider);
    const model = adapter.createModel(modelId);
    logStep(`使用 ${provider.sdkType} SDK 创建模型: ${modelId}`);

    // 预先计算工具是否启用
    const shouldEnableTools = enableTools !== false && adapter.supportsFunctionCalling(capabilities);
    logStep(`工具配置: enableTools=${enableTools}, functionCallingSupported=${capabilities.functionCalling}, 最终=${shouldEnableTools}`);

    // 构建系统提示
    const systemMessage = messages.find((m: OpenAIMessage) => m.role === "system");
    const userMessages = messages.filter((m: OpenAIMessage) => m.role !== "system");

    // 使用模板服务构建系统提示词
    const toolDefinitions = shouldEnableTools ? getAllToolDefinitions() : [];
    const toolInfoList = toolDefinitions.map((t) => ({
      name: t.function.name,
      description: t.function.description.split("\n")[0],
    }));

    // 构建文章上下文 (articleId 必须是 number 类型)
    const articleContextForPrompt = articleContext && articleContext.articleId
      ? {
          title: articleContext.title || "无标题",
          contentLength: articleContext.contentLength || 0,
          articleId: articleContext.articleId as number,
        }
      : undefined;

    // 构建最终的系统消息
    const finalSystemMessage = buildSystemMessage(
      systemMessage,
      articleContextForPrompt,
      toolInfoList,
      shouldEnableTools
    );

    // 转换消息格式以适配 AI SDK v6
    const convertedUserMessages = convertMessagesToAISDK(userMessages);
    const finalMessages = [finalSystemMessage, ...convertedUserMessages];

    // 调试：打印转换后的消息格式
    console.log(`${logPrefix} 转换后的消息 (共 ${finalMessages.length} 条):`);
    logMessages(finalMessages as any, logPrefix);

    // 构建工具配置（转换为 AI SDK 格式）
    const tools: Record<string, any> = {};
    if (shouldEnableTools) {
      const apiTools = formatToolsForAPI();
      for (const tool of apiTools) {
        tools[tool.function.name] = {
          description: tool.function.description,
          parameters: tool.function.parameters,
          // 不在服务端执行，返回给前端
        };
      }
      logStep(`已添加 ${apiTools.length} 个工具: ${apiTools.map((t) => t.function.name).join(", ")}`);
    }

    // 构建推理配置
    const thinkingConfig: ThinkingConfig = {
      enabled: Boolean(reasoningEnabled && capabilities.reasoning),
      reasoningEffort: reasoningEffort || "medium",
    };

    // 构建 streamText 选项
    const streamOptions = buildStreamTextOptions(adapter, modelConfig || ({} as AIModel), {
      thinkingConfig,
      temperature: modelConfig?.parameters?.temperature || 0.7,
      maxOutputTokens: modelConfig?.parameters?.maxTokens || 4096,
    });

    logStep("开始流式响应");

    // 重试配置
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    return streamSSE(c, async (stream) => {
      let fullContent = "";
      let fullReasoning = "";
      let promptTokens = 0;
      let completionTokens = 0;
      let firstChunkTime = 0;
      let isReasoning = false;
      const toolCalls: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
        executionLocation: string;
      }> = [];

      // 重试辅助函数
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      // 执行流式请求（支持重试）
      const executeStreamWithRetry = async (retryCount: number = 0): Promise<ReturnType<typeof streamText>> => {
        try {
          const result = streamText({
            model,
            messages: finalMessages as any,
            tools: shouldEnableTools && Object.keys(tools).length > 0 ? tools : undefined,
            ...streamOptions,
          });
          return result;
        } catch (err) {
          if (retryCount < MAX_RETRIES) {
            logStep(`请求失败，${RETRY_DELAY}ms 后重试 (${retryCount + 1}/${MAX_RETRIES}): ${err}`);
            await delay(RETRY_DELAY);
            return executeStreamWithRetry(retryCount + 1);
          }
          throw err;
        }
      };

      try {
        const result = await executeStreamWithRetry();

        // 处理流式输出
        for await (const part of result.fullStream) {
          if (firstChunkTime === 0) {
            firstChunkTime = Date.now() - startTime;
            logStep(`收到首个数据块 (首字节延迟: ${firstChunkTime}ms)`);
          }

          switch (part.type) {
            case "text-delta":
              // 正常文本内容
              if (isReasoning) {
                isReasoning = false;
                await stream.writeSSE({
                  event: "reasoning_end",
                  data: JSON.stringify({ message: "思考完成，开始回答..." }),
                });
              }
              fullContent += part.text;
              await stream.writeSSE({
                event: "content",
                data: JSON.stringify({ content: part.text }),
              });
              break;

            case "reasoning-start":
              // 推理开始 - 暂不发送，等待有实际内容时再发送
              isReasoning = true;
              break;

            case "reasoning-delta":
              // 推理内容增量 - 只有非空内容才发送
              if (part.text && part.text.trim()) {
                // 首次收到有效内容时发送 reasoning_start
                if (fullReasoning.length === 0) {
                  await stream.writeSSE({
                    event: "reasoning_start",
                    data: JSON.stringify({ message: "开始深度思考..." }),
                  });
                }
                fullReasoning += part.text;
                await stream.writeSSE({
                  event: "reasoning",
                  data: JSON.stringify({ content: part.text }),
                });
              }
              break;

            case "reasoning-end":
              // 推理结束 - 只有确实产生了推理内容才发送结束事件
              isReasoning = false;
              if (fullReasoning.trim()) {
                await stream.writeSSE({
                  event: "reasoning_end",
                  data: JSON.stringify({ message: "思考完成，开始回答..." }),
                });
              }
              break;

            case "tool-call":
              // 工具调用
              // 注意: AI SDK 使用 `input` 属性存储工具参数
              const toolCallInput = (part as any).args || (part as any).input || {};
              const toolCall = {
                id: part.toolCallId,
                type: "function" as const,
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(toolCallInput),
                },
                executionLocation: getToolExecutionLocation(part.toolName) || "frontend",
              };
              toolCalls.push(toolCall);

              // 发送工具调用开始事件
              await stream.writeSSE({
                event: "tool_call_start",
                data: JSON.stringify({
                  index: toolCalls.length - 1,
                  id: toolCall.id,
                  name: toolCall.function.name,
                  executionLocation: toolCall.executionLocation,
                }),
              });

              // 发送完整参数
              await stream.writeSSE({
                event: "tool_call_arguments",
                data: JSON.stringify({
                  index: toolCalls.length - 1,
                  id: toolCall.id,
                  argumentsDelta: toolCall.function.arguments,
                  argumentsLength: toolCall.function.arguments.length,
                }),
              });
              break;

            case "finish":
              // 获取 usage 信息
              if (part.totalUsage) {
                promptTokens = part.totalUsage.inputTokens || 0;
                completionTokens = part.totalUsage.outputTokens || 0;
              }
              logStep(
                `finish_reason: ${part.finishReason}, fullContent长度: ${fullContent.length}, toolCalls数量: ${toolCalls.length}`
              );

              // 检查是否是网络错误导致的空响应
              const rawFinishReason = (part as any).rawFinishReason;
              if (fullContent.length === 0 && toolCalls.length === 0) {
                console.log(`${logPrefix} 警告: AI 返回空内容且无工具调用！`);
                console.log(`${logPrefix} finish part 详情:`, JSON.stringify(part, null, 2).substring(0, 1000));
                
                // 打印更多诊断信息
                const response = (part as any).response;
                if (response) {
                  console.log(`${logPrefix} 响应详情: modelId=${response.modelId}, id=${response.id}`);
                }

                // 如果是网络错误或异常结束，发送错误事件给前端
                if (rawFinishReason === "network_error" || part.finishReason === "other") {
                  const errorMsg = `AI 响应异常 (${rawFinishReason || part.finishReason})，可能是网络问题或请求被中断，请重试`;
                  await stream.writeSSE({
                    event: "error",
                    data: JSON.stringify({
                      error: errorMsg,
                      retryable: true,
                      rawReason: rawFinishReason,
                    }),
                  });
                }
              }
              break;

            case "error":
              logStep(`流处理错误: ${part.error}`);
              console.log(`${logPrefix} 错误详情:`, part);
              await stream.writeSSE({
                event: "error",
                data: JSON.stringify({ error: String(part.error) }),
              });
              break;

            default:
              // 捕获其他未处理的事件类型
              const partType = (part as any).type;
              if (partType === "start-step") {
                const request = (part as any).request;
                if (request?.body?.messages) {
                  console.log(`${logPrefix} start-step: 发送了 ${request.body.messages.length} 条消息到 API`);
                  const totalLength = JSON.stringify(request.body.messages).length;
                  console.log(`${logPrefix} start-step: 消息体总长度: ${totalLength} 字符`);
                  // 调试：打印实际发送到 API 的消息格式
                  for (let i = 0; i < request.body.messages.length; i++) {
                    const msg = request.body.messages[i];
                    const contentType = typeof msg.content;
                    const contentLength = typeof msg.content === 'string' 
                      ? msg.content.length 
                      : JSON.stringify(msg.content).length;
                    console.log(`${logPrefix} start-step 消息[${i}]: role=${msg.role}, content类型=${contentType}, content长度=${contentLength}`);
                    if (msg.role === "tool") {
                      // 打印完整的 tool 消息（用于调试智谱 API 问题）
                      console.log(`${logPrefix} start-step 消息[${i}] tool完整内容:`, JSON.stringify(msg));
                    }
                    if (msg.role === "assistant" && msg.tool_calls) {
                      console.log(`${logPrefix} start-step 消息[${i}] assistant tool_calls:`, JSON.stringify(msg.tool_calls));
                    }
                  }
                }
              } else if (partType === "finish-step") {
                console.log(`${logPrefix} finish-step 详情:`, JSON.stringify(part).substring(0, 500));
              } else {
                console.log(`${logPrefix} 事件: ${partType}`);
              }
              break;
          }
        }

        // 发送工具调用事件（如果有）
        if (toolCalls.length > 0) {
          logStep(`检测到 ${toolCalls.length} 个工具调用`);
          await stream.writeSSE({
            event: "tool_calls",
            data: JSON.stringify({ toolCalls }),
          });
        }

        // 发送完成事件
        const duration = Date.now() - startTime;
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({
            success: true,
            duration,
            firstChunkTime,
            hasReasoning: fullReasoning.length > 0,
            hasToolCalls: toolCalls.length > 0,
            usage: {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            },
          }),
        });

        logStep(`请求完成 - 总耗时: ${duration}ms`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "流处理错误";
        logStep(`流处理错误: ${errorMsg}`);
        console.error(`${logPrefix} 流处理错误:`, error);

        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ error: errorMsg }),
        });
      }
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "请求失败";
    logStep(`请求异常: ${errorMsg}`);
    console.error(`${logPrefix} 请求异常:`, error);

    return c.json({ error: errorMsg }, 500);
  }
});
