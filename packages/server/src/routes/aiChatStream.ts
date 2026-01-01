/**
 * AI 聊天流式 API 路由
 * 支持工具调用和 AI Loop
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { AppDataSource } from "../db";
import { AIProvider, AIModel } from "../entities/AIProvider";
import { validateSession } from "../services/adminAuth";
import { formatToolsForAPI, getToolExecutionLocation } from "../services/aiTools";

export const aiChatStreamRouter = new Hono();

/**
 * AI 聊天 API（支持工具调用和 AI Loop）
 * POST /api/ai/chat/stream
 * 
 * 完整的 AI 聊天功能，支持：
 * - 流式输出
 * - 工具调用
 * - 深度思考
 * - 视觉模型
 */
aiChatStreamRouter.post("/", async (c) => {
  const requestId = Math.random().toString(36).substring(7);
  const logPrefix = `[AI Chat Stream ${requestId}]`;
  const startTime = Date.now();

  const logStep = (step: string) => {
    const elapsed = Date.now() - startTime;
    console.log(`${logPrefix} ${step} (+${elapsed}ms)`);
  };

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
      // 深度思考设置（从 AI Chat 面板动态传递）
      thinkingEnabled,
      reasoningEffort,
    } = body;

    logStep(`请求体解析完成: providerId=${providerId}, modelId=${modelId}, messagesCount=${messages?.length || 0}`);

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

    const apiUrl = `${provider.baseUrl}/chat/completions`;
    const capabilities = modelConfig?.capabilities;
    const thinkingConfig = capabilities?.thinking;
    const streamingConfig = capabilities?.streaming;
    const functionCallingSupported = capabilities?.functionCalling?.supported;
    const visionSupported = capabilities?.vision?.supported;

    // 视觉模型消息格式转换函数
    // OpenAI 和智谱 AI 的视觉模型需要将 user 消息的 content 从字符串转换为数组格式
    // 格式: content: [{ type: "text", text: "消息内容" }, { type: "image_url", image_url: { url: "..." } }]
    // 注意：system 消息的 content 应保持字符串格式，不需要转换
    const convertToVisionFormat = (msg: any) => {
      // system 消息不转换，保持字符串格式
      if (msg.role === "system") {
        return msg;
      }
      // 如果已经是数组格式，直接返回
      if (Array.isArray(msg.content)) {
        return msg;
      }
      // 如果是字符串，转换为视觉模型格式（仅 user/assistant 消息）
      if (typeof msg.content === "string") {
        return {
          ...msg,
          content: [{ type: "text", text: msg.content }],
        };
      }
      // 其他情况（如 null/undefined），保持原样
      return msg;
    };

    // 预先计算工具是否启用（用于系统提示词构建）
    const functionCallingEnabled = capabilities?.functionCalling?.supported !== false;
    const shouldEnableTools = enableTools !== false && functionCallingEnabled;

    // 构建系统提示
    let systemMessage = messages.find((m: any) => m.role === "system");
    const userMessages = messages.filter((m: any) => m.role !== "system");

    // 如果有文章上下文，添加到系统提示中
    if (articleContext) {
      // 基础文章信息
      let contextInfo = `\n\n当前用户正在编辑一篇文章：
- 文章标题: ${articleContext.title || "无标题"}
- 文章字数: ${articleContext.contentLength || 0} 字
- 文章ID: ${articleContext.articleId}`;

      // 只有在工具调用启用时才提及工具
      if (shouldEnableTools) {
        contextInfo += `

你可以使用工具来读取和修改文章内容。

**重要提示**：read_article 工具返回的内容包含行号前缀（格式："行号 | 内容"）。行号仅用于定位，在使用 replace_content 等工具时，请勿在 search 参数中包含行号前缀，只提供实际的文本内容。`;
      }

      if (systemMessage) {
        systemMessage = {
          ...systemMessage,
          content: systemMessage.content + contextInfo,
        };
      } else {
        systemMessage = {
          role: "system",
          content: `你是一个智能写作助手，可以帮助用户改进文章、回答问题、执行各种任务。${contextInfo}`,
        };
      }
    }

    // 组装最终消息
    let finalMessages = systemMessage
      ? [systemMessage, ...userMessages]
      : userMessages;

    // 如果是视觉模型，转换消息格式
    // 视觉模型（OpenAI gpt-4-vision, 智谱 glm-4v 等）需要将 content 转换为数组格式
    if (visionSupported) {
      finalMessages = finalMessages.map(convertToVisionFormat);
      logStep(`视觉模型检测: 已转换 ${finalMessages.length} 条消息为视觉格式`);
    }

    // 构建请求体
    const requestBody: Record<string, any> = {
      model: modelId,
      messages: finalMessages,
      max_tokens: modelConfig?.parameters?.maxTokens || 4096,
      temperature: modelConfig?.parameters?.temperature || 0.7,
      stream: streamingConfig?.supported !== false && streamingConfig?.enabled !== false,
    };

    // 添加工具定义
    // 注意：OpenAI/智谱/DeepSeek 等主流平台都不需要特殊配置来启用工具调用
    // 只要在请求中传递 tools 参数，模型就会自动识别并使用
    // 工具启用条件：
    // 1. 请求中 enableTools !== false（默认启用）
    // 2. 模型配置中 functionCalling.supported !== false（默认支持）
    // 注：某些视觉模型（如 glm-4.6v-flash）不支持工具调用，需要在模型配置中设置 functionCalling.supported = false
    // （functionCallingEnabled 和 shouldEnableTools 已在前面计算）
    logStep(`工具配置: enableTools=${enableTools}, functionCallingSupported=${functionCallingEnabled}, 最终=${shouldEnableTools}`);

    if (shouldEnableTools) {
      const tools = formatToolsForAPI();
      if (tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = "auto";

        // 智谱 AI 特殊支持：启用工具调用流式输出
        // 根据供应商配置的 apiType 来判断是否启用 tool_stream
        // 智谱 AI 使用特殊的 tool_stream 格式，参数通过 argumentsDelta 增量传输
        const isZhipuAI = provider.apiType === "zhipu";
        if (isZhipuAI && requestBody.stream) {
          requestBody.tool_stream = true;
          logStep(`智谱 AI 检测: 已启用 tool_stream`);
        }

        logStep(`已添加 ${tools.length} 个工具: ${tools.map(t => t.function.name).join(', ')}`);
      }
    } else {
      logStep(`工具调用已禁用`);
    }

    // 添加深度思考配置
    // 深度思考是否启用现在由请求参数 thinkingEnabled 控制（从 AI Chat 面板动态传递）
    // 而不再从模型配置中读取 thinking.enabled
    //
    // 重要：当模型支持深度思考时，无论用户是否启用，都需要显式设置配置
    // 因为某些模型可能默认开启深度思考，需要显式禁用
    if (thinkingConfig?.supported) {
      const apiFormat = thinkingConfig.apiFormat || "standard";

      if (thinkingEnabled) {
        // 用户启用了深度思考
        if (apiFormat === "openai") {
          // OpenAI 格式：使用请求中传递的 reasoningEffort，默认为 medium
          requestBody.reasoning = {
            effort: reasoningEffort || "medium",
          };
          if (thinkingConfig.reasoningSummary && thinkingConfig.reasoningSummary !== "disabled") {
            requestBody.reasoning.summary = thinkingConfig.reasoningSummary;
          }
        } else {
          // 标准格式（智谱/DeepSeek）
          requestBody.thinking = { type: "enabled" };
        }
      } else {
        // 用户未启用深度思考，显式禁用（防止模型默认开启）
        if (apiFormat === "openai") {
          // OpenAI 格式：不发送 reasoning 参数即可禁用，
          // 但为了明确性，可以设置 reasoning 为 undefined 或不设置
          // OpenAI 推理模型在不传递 reasoning 参数时应该使用默认行为
          // 目前 OpenAI 没有明确的禁用参数，不传递 reasoning 即可
          logStep("深度思考未启用（OpenAI 格式）: 不发送 reasoning 参数");
        } else {
          // 标准格式（智谱/DeepSeek）：显式设置 disabled
          requestBody.thinking = { type: "disabled" };
          logStep("深度思考未启用（标准格式）: 已设置 thinking.type = disabled");
        }
      }
    }

    logStep("开始发起流式 API 请求");
    logStep(`请求体: tools=${requestBody.tools?.length || 0}个, tool_choice=${requestBody.tool_choice || '无'}`);
    // 调试：打印完整请求体（仅在开发时使用）
    console.log(`${logPrefix} 完整请求体:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    logStep(`API 响应返回: status=${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as any).error?.message ||
                          `HTTP ${response.status}: ${response.statusText}`;
      logStep(`错误: ${errorMessage}`);
      return c.json({ error: errorMessage }, 400);
    }

    const contentType = response.headers.get("content-type") || "";
    const isStream = contentType.includes("text/event-stream") ||
                     contentType.includes("application/octet-stream") ||
                     (response.ok && response.body);

    if (isStream && response.body) {
      logStep("开始处理 SSE 流式响应");

      return streamSSE(c, async (stream) => {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let fullReasoning = "";
        let toolCalls: Array<{
          id: string;
          type: "function";
          function: {
            name: string;
            arguments: string;
          };
        }> = [];
        let currentToolCallIndex = -1;
        let promptTokens = 0;
        let completionTokens = 0;
        let chunkCount = 0;
        let firstChunkTime = 0;
        let isReasoning = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              logStep(`流式读取完成: 共 ${chunkCount} 个数据块`);
              break;
            }

            chunkCount++;
            if (chunkCount === 1) {
              firstChunkTime = Date.now() - startTime;
              logStep(`收到首个数据块 (首字节延迟: ${firstChunkTime}ms)`);
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
              if (!trimmedLine.startsWith("data: ")) continue;

              try {
                const jsonStr = trimmedLine.slice(6);
                const data = JSON.parse(jsonStr);
                const delta = data.choices?.[0]?.delta || {};
                const content = delta.content || "";
                const reasoningContent = delta.reasoning_content || "";

                // 处理工具调用
                if (delta.tool_calls) {
                  for (const toolCall of delta.tool_calls) {
                    const index = toolCall.index;

                    // 智谱 AI tool_stream 格式检测
                    // 智谱格式: {"index":0,"id":"call_xxx","argumentsDelta":"增量","argumentsLength":369}
                    // 标准格式: {"index":0,"function":{"name":"xxx","arguments":"增量"}}
                    const isZhipuFormat = toolCall.argumentsDelta !== undefined;

                    if (isZhipuFormat) {
                      // 智谱 AI tool_stream 格式处理
                      // 智谱格式可能包含: id, argumentsDelta, argumentsLength, function.name
                      if (index !== undefined && index >= toolCalls.length) {
                        // 新的工具调用：创建对象并发送 tool_call_start 事件
                        const newToolCall = {
                          id: toolCall.id || `call_${index}`,
                          type: "function" as const,
                          function: {
                            name: toolCall.function?.name || "",
                            arguments: toolCall.argumentsDelta || "",
                          },
                        };
                        toolCalls.push(newToolCall);
                        currentToolCallIndex = index;

                        // 立即发送工具调用开始事件（如果有名称）
                        if (newToolCall.function.name) {
                          await stream.writeSSE({
                            event: "tool_call_start",
                            data: JSON.stringify({
                              index,
                              id: newToolCall.id,
                              name: newToolCall.function.name,
                              executionLocation: getToolExecutionLocation(newToolCall.function.name) || "frontend",
                            }),
                          });
                        }

                        // 发送参数增量事件
                        if (toolCall.argumentsDelta) {
                          await stream.writeSSE({
                            event: "tool_call_arguments",
                            data: JSON.stringify({
                              index,
                              id: newToolCall.id,
                              argumentsDelta: toolCall.argumentsDelta,
                              argumentsLength: toolCall.argumentsLength || newToolCall.function.arguments.length,
                            }),
                          });
                        }
                      } else if (index !== undefined && index < toolCalls.length) {
                        // 追加参数增量到现有工具调用
                        toolCalls[index].function.arguments += toolCall.argumentsDelta || "";

                        // 更新工具调用 ID（如果有）
                        if (toolCall.id) {
                          toolCalls[index].id = toolCall.id;
                        }

                        // 如果工具名称之前为空，现在有了，发送 tool_call_start 事件
                        if (toolCall.function?.name && !toolCalls[index].function.name) {
                          toolCalls[index].function.name = toolCall.function.name;
                          await stream.writeSSE({
                            event: "tool_call_start",
                            data: JSON.stringify({
                              index,
                              id: toolCalls[index].id,
                              name: toolCall.function.name,
                              executionLocation: getToolExecutionLocation(toolCall.function.name) || "frontend",
                            }),
                          });
                        }

                        // 发送参数增量事件
                        if (toolCall.argumentsDelta) {
                          await stream.writeSSE({
                            event: "tool_call_arguments",
                            data: JSON.stringify({
                              index,
                              id: toolCalls[index].id,
                              argumentsDelta: toolCall.argumentsDelta,
                              argumentsLength: toolCall.argumentsLength || toolCalls[index].function.arguments.length,
                            }),
                          });
                        }
                      }
                    } else {
                      // 标准 OpenAI 格式处理
                      // 新的工具调用
                      if (index !== undefined && index >= toolCalls.length) {
                        const newToolCall = {
                          id: toolCall.id || `call_${index}`,
                          type: "function" as const,
                          function: {
                            name: toolCall.function?.name || "",
                            arguments: toolCall.function?.arguments || "",
                          },
                        };
                        toolCalls.push(newToolCall);
                        currentToolCallIndex = index;

                        // 立即发送工具调用开始事件（让前端尽早显示）
                        if (newToolCall.function.name) {
                          await stream.writeSSE({
                            event: "tool_call_start",
                            data: JSON.stringify({
                              index,
                              id: newToolCall.id,
                              name: newToolCall.function.name,
                              executionLocation: getToolExecutionLocation(newToolCall.function.name) || "frontend",
                            }),
                          });
                        }
                      } else if (currentToolCallIndex >= 0 && toolCall.function?.arguments) {
                        // 追加参数
                        toolCalls[currentToolCallIndex].function.arguments += toolCall.function.arguments;

                        // 实时发送工具参数增量（让前端可以实时显示进度）
                        await stream.writeSSE({
                          event: "tool_call_arguments",
                          data: JSON.stringify({
                            index: currentToolCallIndex,
                            id: toolCalls[currentToolCallIndex].id,
                            argumentsDelta: toolCall.function.arguments,
                            argumentsLength: toolCalls[currentToolCallIndex].function.arguments.length,
                          }),
                        });
                      }

                      // 更新工具调用 ID
                      if (toolCall.id && currentToolCallIndex >= 0) {
                        toolCalls[currentToolCallIndex].id = toolCall.id;
                      }
                      // 更新工具名称（如果是新获取到的名称，也发送事件）
                      if (toolCall.function?.name && currentToolCallIndex >= 0) {
                        const prevName = toolCalls[currentToolCallIndex].function.name;
                        toolCalls[currentToolCallIndex].function.name = toolCall.function.name;

                        // 如果之前没有名称，现在有了，发送工具调用开始事件
                        if (!prevName && toolCall.function.name) {
                          await stream.writeSSE({
                            event: "tool_call_start",
                            data: JSON.stringify({
                              index: currentToolCallIndex,
                              id: toolCalls[currentToolCallIndex].id,
                              name: toolCall.function.name,
                              executionLocation: getToolExecutionLocation(toolCall.function.name) || "frontend",
                            }),
                          });
                        }
                      }
                    }
                  }
                }

                // 处理思维链（标准格式）
                if (reasoningContent) {
                  if (!isReasoning) {
                    isReasoning = true;
                    await stream.writeSSE({
                      event: "reasoning_start",
                      data: JSON.stringify({ message: "开始深度思考..." }),
                    });
                  }

                  fullReasoning += reasoningContent;
                  await stream.writeSSE({
                    event: "reasoning",
                    data: JSON.stringify({ content: reasoningContent }),
                  });
                }

                // 处理正常内容
                if (content) {
                  if (isReasoning) {
                    isReasoning = false;
                    await stream.writeSSE({
                      event: "reasoning_end",
                      data: JSON.stringify({ message: "思考完成，开始回答..." }),
                    });
                  }

                  fullContent += content;
                  await stream.writeSSE({
                    event: "content",
                    data: JSON.stringify({ content }),
                  });
                }

                // 获取 usage 信息
                if (data.usage) {
                  promptTokens = data.usage.prompt_tokens || 0;
                  completionTokens = data.usage.completion_tokens || 0;
                }

                // 检查 finish_reason
                const finishReason = data.choices?.[0]?.finish_reason;
                if (finishReason) {
                  logStep(`finish_reason: ${finishReason}`);
                  if (finishReason === "tool_calls") {
                    logStep("AI 请求调用工具");
                  }
                }
              } catch {
                // 忽略解析错误
              }
            }
          }

          // 发送工具调用事件（如果有）
          if (toolCalls.length > 0) {
            logStep(`检测到 ${toolCalls.length} 个工具调用`);

            // 为每个工具调用添加执行位置信息
            const toolCallsWithLocation = toolCalls.map(tc => ({
              ...tc,
              executionLocation: getToolExecutionLocation(tc.function.name) || "frontend",
            }));

            await stream.writeSSE({
              event: "tool_calls",
              data: JSON.stringify({ toolCalls: toolCallsWithLocation }),
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

          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({ error: errorMsg }),
          });
        }
      });
    }

    // 非流式响应处理
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const responseToolCalls = data.choices?.[0]?.message?.tool_calls || [];

    return c.json({
      success: true,
      content,
      toolCalls: responseToolCalls.map((tc: any) => ({
        ...tc,
        executionLocation: getToolExecutionLocation(tc.function.name) || "frontend",
      })),
      usage: data.usage,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "请求失败";
    logStep(`请求异常: ${errorMsg}`);
    console.error(`${logPrefix} 请求异常:`, error);

    return c.json({ error: errorMsg }, 500);
  }
});
