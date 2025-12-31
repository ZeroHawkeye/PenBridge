/**
 * AI 工具定义和执行器
 * 
 * 工具分为两类：
 * 1. 前端工具：需要在浏览器执行的工具（如修改编辑器内容）
 * 2. 后端工具：在服务端执行的工具（如 Web 搜索、数据库查询）
 */

import { AppDataSource } from "../db";
import { Article } from "../entities/Article";
import { AIProvider, AIModel } from "../entities/AIProvider";

/**
 * 工具定义接口
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
        default?: any;
      }>;
      required?: string[];
    };
  };
  // 标记工具执行位置
  executionLocation: "frontend" | "backend";
}

/**
 * 前端工具定义（发送给 AI，但实际在前端执行）
 */
export const frontendToolDefinitions: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_article",
      description: `读取当前正在编辑的文章内容。支持多种读取模式：
1. 读取标题：section="title"
2. 读取全文：section="all" 或 section="content"（不指定行范围时）
3. 按行读取：指定 startLine 和 endLine 参数，读取指定行范围的内容

返回结果会包含行号信息，格式为 "行号 | 内容"，便于定位和后续编辑。
对于长文章，建议分段读取以避免超出上下文限制。`,
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            description: "要读取的部分：title（仅标题）、content（仅正文）、all（标题+正文）",
            enum: ["title", "content", "all"],
            default: "all",
          },
          startLine: {
            type: "number",
            description: "起始行号（从 1 开始，包含）。指定后将按行读取内容。",
          },
          endLine: {
            type: "number",
            description: "结束行号（包含）。如果不指定，默认读取从 startLine 开始的 200 行。",
          },
        },
      },
    },
    executionLocation: "frontend",
  },
  {
    type: "function",
    function: {
      name: "update_title",
      description: "更新文章标题",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "新的文章标题",
          },
        },
        required: ["title"],
      },
    },
    executionLocation: "frontend",
  },
  {
    type: "function",
    function: {
      name: "insert_content",
      description: "在文章指定位置插入内容",
      parameters: {
        type: "object",
        properties: {
          position: {
            type: "string",
            description: "插入位置",
            enum: ["start", "end"],
          },
          content: {
            type: "string",
            description: "要插入的 Markdown 内容",
          },
        },
        required: ["position", "content"],
      },
    },
    executionLocation: "frontend",
  },
  {
    type: "function",
    function: {
      name: "replace_content",
      description: "替换文章中的指定内容",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "要查找的文本",
          },
          replace: {
            type: "string",
            description: "替换为的文本",
          },
        },
        required: ["search", "replace"],
      },
    },
    executionLocation: "frontend",
  },
  {
    type: "function",
    function: {
      name: "replace_all_content",
      description: "替换整篇文章内容（用于重写场景）",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "新的文章内容（Markdown 格式）",
          },
        },
        required: ["content"],
      },
    },
    executionLocation: "frontend",
  },
];

/**
 * 后端工具定义
 */
export const backendToolDefinitions: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "query_articles",
      description: "查询数据库中的其他文章，可以按关键词搜索",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "搜索关键词（可选）",
          },
          limit: {
            type: "number",
            description: "返回结果数量限制",
            default: 10,
          },
        },
      },
    },
    executionLocation: "backend",
  },
  {
    type: "function",
    function: {
      name: "get_article_by_id",
      description: "根据 ID 获取指定文章的详细内容",
      parameters: {
        type: "object",
        properties: {
          articleId: {
            type: "number",
            description: "文章 ID",
          },
        },
        required: ["articleId"],
      },
    },
    executionLocation: "backend",
  },
  {
    type: "function",
    function: {
      name: "view_image",
      description: "查看并分析图片内容。支持通过 URL 或 Base64 编码的图片。可以描述图片内容、提取文字、分析图表等。",
      parameters: {
        type: "object",
        properties: {
          imageSource: {
            type: "string",
            description: "图片来源：URL 地址或 Base64 编码的图片数据（需要包含 data:image/xxx;base64, 前缀）",
          },
          question: {
            type: "string",
            description: "关于图片的问题或分析要求（可选，默认描述图片内容）",
          },
        },
        required: ["imageSource"],
      },
    },
    executionLocation: "backend",
  },
  // 预留：Web 搜索工具（需要配置 API Key）
  // {
  //   type: "function",
  //   function: {
  //     name: "web_search",
  //     description: "搜索互联网获取最新信息",
  //     parameters: {
  //       type: "object",
  //       properties: {
  //         query: {
  //           type: "string",
  //           description: "搜索关键词",
  //         },
  //         maxResults: {
  //           type: "number",
  //           description: "最大结果数",
  //           default: 5,
  //         },
  //       },
  //       required: ["query"],
  //     },
  //   },
  //   executionLocation: "backend",
  // },
];

/**
 * 获取所有工具定义（用于发送给 AI）
 */
export function getAllToolDefinitions(): ToolDefinition[] {
  return [...frontendToolDefinitions, ...backendToolDefinitions];
}

/**
 * 获取工具执行位置
 */
export function getToolExecutionLocation(toolName: string): "frontend" | "backend" | null {
  const allTools = getAllToolDefinitions();
  const tool = allTools.find(t => t.function.name === toolName);
  return tool?.executionLocation || null;
}

/**
 * 后端工具执行器
 */
export async function executeBackendTool(
  toolName: string,
  args: Record<string, any>
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    switch (toolName) {
      case "query_articles": {
        const articleRepo = AppDataSource.getRepository(Article);
        const limit = args.limit || 10;
        
        let query = articleRepo.createQueryBuilder("article")
          .select(["article.id", "article.title", "article.summary", "article.createdAt", "article.updatedAt"])
          .where("article.userId = :userId", { userId: 1 })
          .orderBy("article.updatedAt", "DESC")
          .take(limit);
        
        if (args.keyword) {
          query = query.andWhere(
            "(article.title LIKE :keyword OR article.content LIKE :keyword)",
            { keyword: `%${args.keyword}%` }
          );
        }
        
        const articles = await query.getMany();
        
        return {
          success: true,
          result: {
            articles: articles.map(a => ({
              id: a.id,
              title: a.title,
              summary: a.summary || "无摘要",
              updatedAt: a.updatedAt,
            })),
            total: articles.length,
          },
        };
      }
      
      case "get_article_by_id": {
        const articleRepo = AppDataSource.getRepository(Article);
        const article = await articleRepo.findOne({
          where: { id: args.articleId, userId: 1 },
        });
        
        if (!article) {
          return {
            success: false,
            error: "文章不存在",
          };
        }
        
        return {
          success: true,
          result: {
            id: article.id,
            title: article.title,
            content: article.content,
            summary: article.summary,
            createdAt: article.createdAt,
            updatedAt: article.updatedAt,
          },
        };
      }
      
      case "view_image": {
        const { imageSource, question } = args;
        if (!imageSource) {
          return { success: false, error: "缺少 imageSource 参数" };
        }
        
        // 调用视觉模型分析图片
        const result = await analyzeImage(imageSource, question);
        return result;
      }
      
      // 预留：Web 搜索
      // case "web_search": {
      //   // 需要实现搜索 API 调用
      //   return { success: false, error: "Web 搜索功能暂未配置" };
      // }
      
      default:
        return {
          success: false,
          error: `未知的后端工具: ${toolName}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "工具执行失败",
    };
  }
}

/**
 * 格式化工具定义为 OpenAI API 格式
 */
export function formatToolsForAPI(): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}> {
  return getAllToolDefinitions().map(tool => ({
    type: tool.type,
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    },
  }));
}

/**
 * 查找支持视觉能力的模型
 */
async function findVisionModel(): Promise<{
  provider: AIProvider;
  model: AIModel;
} | null> {
  const providerRepo = AppDataSource.getRepository(AIProvider);
  const modelRepo = AppDataSource.getRepository(AIModel);
  
  // 查找所有启用的模型
  const models = await modelRepo.find({
    where: { userId: 1, enabled: true },
  });
  
  // 查找支持视觉的模型
  for (const model of models) {
    const capabilities = model.capabilities as any;
    if (capabilities?.vision?.supported) {
      const provider = await providerRepo.findOne({
        where: { id: model.providerId, userId: 1, enabled: true },
      });
      if (provider) {
        return { provider, model };
      }
    }
  }
  
  return null;
}

/**
 * 分析图片内容
 * 支持 URL 和 Base64 两种格式
 */
async function analyzeImage(
  imageSource: string,
  question?: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    // 查找支持视觉的模型
    const visionConfig = await findVisionModel();
    if (!visionConfig) {
      return { 
        success: false, 
        error: "未配置支持视觉能力的模型。请在 AI 设置中添加一个支持视觉的模型（如 GLM-4V）并启用视觉能力。" 
      };
    }
    
    const { provider, model } = visionConfig;
    
    // 判断图片来源类型
    let imageUrl: string;
    if (imageSource.startsWith("data:image/")) {
      // Base64 格式，直接使用
      imageUrl = imageSource;
    } else if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
      // URL 格式，直接使用
      imageUrl = imageSource;
    } else {
      // 可能是相对路径，尝试转换为本地 base64
      // 这里暂时只支持 URL 和 Base64
      return { 
        success: false, 
        error: "不支持的图片格式。请提供图片 URL（http/https 开头）或 Base64 编码（data:image/ 开头）" 
      };
    }
    
    // 构建请求消息（OpenAI Vision API 格式，智谱 GLM-4V 完全兼容）
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: question || "请详细描述这张图片的内容，包括主要元素、文字、颜色、布局等信息。",
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ];
    
    // 发送请求到视觉模型
    const apiUrl = `${provider.baseUrl}/chat/completions`;
    console.log(`[AI Tool] view_image 调用视觉模型: ${model.modelId} @ ${provider.name}`);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages,
        max_tokens: 2048,
        temperature: 0.3, // 使用较低温度以获得更准确的描述
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as any).error?.message || 
                          `HTTP ${response.status}: ${response.statusText}`;
      console.error(`[AI Tool] view_image 请求失败:`, errorMessage);
      return { success: false, error: `视觉分析失败: ${errorMessage}` };
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "无法解析图片内容";
    const usage = data.usage || {};
    
    console.log(`[AI Tool] view_image 分析完成, tokens: ${usage.total_tokens || 0}`);
    
    return {
      success: true,
      result: {
        analysis: content,
        model: model.modelId,
        provider: provider.name,
        usage: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        },
      },
    };
  } catch (error) {
    console.error(`[AI Tool] view_image 异常:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "图片分析失败",
    };
  }
}
