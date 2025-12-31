/**
 * AI 工具定义和执行器
 * 
 * 工具分为两类：
 * 1. 前端工具：需要在浏览器执行的工具（如修改编辑器内容）
 * 2. 后端工具：在服务端执行的工具（如 Web 搜索、数据库查询）
 */

import { AppDataSource } from "../db";
import { Article } from "../entities/Article";

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
      description: "读取当前正在编辑的文章内容。可以选择读取标题、正文或全部内容。",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            description: "要读取的部分",
            enum: ["title", "content", "all"],
          },
        },
        required: ["section"],
      },
    },
    executionLocation: "frontend",
  },
  {
    type: "function",
    function: {
      name: "read_article_chunk",
      description: "分段读取长文章，避免超出 token 限制。适用于处理大型文章。",
      parameters: {
        type: "object",
        properties: {
          chunkIndex: {
            type: "number",
            description: "段落索引（从 0 开始）",
          },
          chunkSize: {
            type: "number",
            description: "每段字数",
            default: 2000,
          },
        },
        required: ["chunkIndex"],
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
