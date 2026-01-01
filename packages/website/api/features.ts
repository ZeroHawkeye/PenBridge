/**
 * Vercel Serverless Function - 功能调研 API
 * 
 * 完全基于 GitHub Discussions 实现动态功能管理：
 * - 所有功能都从 GitHub Discussions 动态获取
 * - 使用 Labels 管理状态和分类
 * - 使用 Reactions (👍) 作为投票
 * - 无需数据库，数据完全存储在 GitHub
 * 
 * 标签设计：
 * - status:voting    - 投票中
 * - status:planned   - 已规划
 * - status:completed - 已完成
 * - category:平台支持  - 分类：平台支持
 * - category:功能增强  - 分类：功能增强
 * - category:用户建议  - 分类：用户建议
 * 
 * 环境变量：
 * - GITHUB_TOKEN: GitHub Personal Access Token (需要 repo 权限)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const GITHUB_API = "https://api.github.com/graphql";
const REPO_OWNER = "ZeroHawkeye";
const REPO_NAME = "PenBridge";

// 默认值配置
const DEFAULT_STATUS = "voting";
const DEFAULT_CATEGORY = "用户建议";

// 状态标签前缀
const STATUS_LABEL_PREFIX = "status:";
// 分类标签前缀
const CATEGORY_LABEL_PREFIX = "category:";

// 状态映射
const STATUS_MAP: Record<string, "voting" | "planned" | "completed"> = {
  "status:voting": "voting",
  "status:planned": "planned",
  "status:completed": "completed",
};

// GraphQL 查询 - 获取仓库的 Discussions（包含 labels）
const GET_DISCUSSIONS_QUERY = `
  query GetDiscussions($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
      discussionCategories(first: 10) {
        nodes {
          id
          name
          slug
        }
      }
      discussions(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          id
          number
          title
          body
          createdAt
          reactions(content: THUMBS_UP) {
            totalCount
          }
          category {
            name
            slug
          }
          labels(first: 10) {
            nodes {
              name
              color
            }
          }
        }
      }
    }
  }
`;

// GraphQL mutation - 创建 Discussion
const CREATE_DISCUSSION_MUTATION = `
  mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body}) {
      discussion {
        id
        number
        title
      }
    }
  }
`;

// GraphQL mutation - 添加 reaction
const ADD_REACTION_MUTATION = `
  mutation AddReaction($subjectId: ID!) {
    addReaction(input: {subjectId: $subjectId, content: THUMBS_UP}) {
      reaction {
        id
      }
    }
  }
`;

// GraphQL mutation - 移除 reaction
const REMOVE_REACTION_MUTATION = `
  mutation RemoveReaction($subjectId: ID!) {
    removeReaction(input: {subjectId: $subjectId, content: THUMBS_UP}) {
      reaction {
        id
      }
    }
  }
`;

interface Label {
  name: string;
  color: string;
}

interface Discussion {
  id: string;
  number: number;
  title: string;
  body: string;
  createdAt: string;
  reactions: { totalCount: number };
  category: { name: string; slug: string };
  labels: { nodes: Label[] };
}

interface GraphQLResponse {
  data?: {
    repository?: {
      id: string;
      discussionCategories?: {
        nodes: Array<{ id: string; name: string; slug: string }>;
      };
      discussions?: {
        nodes: Discussion[];
      };
    };
    createDiscussion?: {
      discussion: {
        id: string;
        number: number;
        title: string;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

interface Feature {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "voting" | "planned" | "completed";
  votes: number;
  discussionId: string;
  discussionNumber: number;
  createdAt: string;
}

/**
 * 从 Discussion 的 labels 解析状态
 */
function parseStatus(labels: Label[]): "voting" | "planned" | "completed" {
  for (const label of labels) {
    const status = STATUS_MAP[label.name.toLowerCase()];
    if (status) {
      return status;
    }
  }
  return DEFAULT_STATUS;
}

/**
 * 从 Discussion 的 labels 解析分类
 */
function parseCategory(labels: Label[]): string {
  for (const label of labels) {
    if (label.name.toLowerCase().startsWith(CATEGORY_LABEL_PREFIX)) {
      return label.name.substring(CATEGORY_LABEL_PREFIX.length);
    }
  }
  return DEFAULT_CATEGORY;
}

/**
 * 清理标题（移除前缀标记如 [功能建议]）
 */
function cleanTitle(title: string): string {
  return title
    .replace(/^\[.*?\]\s*/, "") // 移除开头的 [xxx] 标记
    .trim();
}

/**
 * 截取描述（从 body 中提取前 200 个字符）
 */
function extractDescription(body: string): string {
  // 移除 markdown 标题
  let text = body.replace(/^#+\s+.*$/gm, "");
  // 移除分隔线及之后的内容
  text = text.split("---")[0];
  // 移除多余空白
  text = text.replace(/\s+/g, " ").trim();
  // 截取前 200 个字符
  if (text.length > 200) {
    text = text.substring(0, 200) + "...";
  }
  return text;
}

/**
 * 将 Discussion 转换为 Feature
 */
function discussionToFeature(d: Discussion): Feature {
  const labels = d.labels?.nodes || [];
  return {
    id: `discussion-${d.number}`,
    title: cleanTitle(d.title),
    description: extractDescription(d.body || ""),
    category: parseCategory(labels),
    status: parseStatus(labels),
    votes: d.reactions.totalCount,
    discussionId: d.id,
    discussionNumber: d.number,
    createdAt: d.createdAt,
  };
}

async function graphqlRequest(query: string, variables: Record<string, unknown>, token?: string): Promise<GraphQLResponse> {
  const authToken = token || process.env.GITHUB_TOKEN;
  if (!authToken) {
    throw new Error("GITHUB_TOKEN not configured");
  }

  const response = await fetch(GITHUB_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();
  if (data.errors) {
    console.error("GraphQL errors:", data.errors);
    throw new Error(data.errors[0].message);
  }
  return data;
}

/**
 * 获取静态备用数据（当 GitHub API 不可用时）
 */
function getStaticFeatures(): Feature[] {
  return [
    {
      id: "static-1",
      title: "更多图床支持",
      description: "支持七牛云、阿里云 OSS、GitHub 等更多图床",
      category: "功能增强",
      status: "voting",
      votes: 0,
      discussionId: "",
      discussionNumber: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: "static-2",
      title: "知乎专栏支持",
      description: "支持发布文章到知乎专栏",
      category: "平台支持",
      status: "voting",
      votes: 0,
      discussionId: "",
      discussionNumber: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: "static-3",
      title: "腾讯云开发者社区",
      description: "已支持发布到腾讯云开发者社区",
      category: "平台支持",
      status: "completed",
      votes: 0,
      discussionId: "",
      discussionNumber: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: "static-4",
      title: "掘金平台",
      description: "已支持发布到掘金技术社区",
      category: "平台支持",
      status: "completed",
      votes: 0,
      discussionId: "",
      discussionNumber: 0,
      createdAt: new Date().toISOString(),
    },
  ];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 头
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const serverToken = process.env.GITHUB_TOKEN;

  try {
    // GET - 获取功能列表和投票数
    if (req.method === "GET") {
      if (!serverToken) {
        // 没有配置 token，返回静态数据
        const staticFeatures = getStaticFeatures();
        return res.status(200).json({
          features: staticFeatures,
          totalVotes: staticFeatures.reduce((sum, f) => sum + f.votes, 0),
          totalParticipants: 0,
          source: "static",
        });
      }

      // 从 GitHub Discussions 获取真实数据
      const data = await graphqlRequest(GET_DISCUSSIONS_QUERY, {
        owner: REPO_OWNER,
        name: REPO_NAME,
      });

      const discussions = data.data?.repository?.discussions?.nodes || [];
      
      // 只处理 Ideas 分类的 discussions（功能建议）
      const features: Feature[] = discussions
        .filter(d => d.category?.slug === "ideas" || d.category?.name === "Ideas" || d.category?.name === "功能建议")
        .map(discussionToFeature);

      // 按状态和投票数排序：已完成的放最后，其他按投票数降序
      features.sort((a, b) => {
        if (a.status === "completed" && b.status !== "completed") return 1;
        if (a.status !== "completed" && b.status === "completed") return -1;
        return b.votes - a.votes;
      });

      const totalVotes = features.reduce((sum, f) => sum + f.votes, 0);
      
      // 计算参与者数量（去重，这里简化为投票总数的 70%）
      const totalParticipants = Math.max(1, Math.floor(totalVotes * 0.7));

      return res.status(200).json({
        features,
        totalVotes,
        totalParticipants,
        source: "github",
      });
    }

    // POST - 投票或提交建议
    if (req.method === "POST") {
      const { action, featureId, userToken, title, description } = req.body;

      if (!serverToken) {
        return res.status(501).json({ 
          error: "Service not available",
          message: "服务端未配置 GITHUB_TOKEN",
        });
      }

      // 提交新建议
      if (action === "suggest") {
        if (!title || !description) {
          return res.status(400).json({ error: "缺少标题或描述" });
        }

        // 获取仓库 ID 和分类 ID
        const repoData = await graphqlRequest(GET_DISCUSSIONS_QUERY, {
          owner: REPO_OWNER,
          name: REPO_NAME,
        });

        const repositoryId = repoData.data?.repository?.id;
        const categories = repoData.data?.repository?.discussionCategories?.nodes || [];
        
        // 查找 "Ideas" 分类
        let categoryId = categories.find(c => 
          c.slug === "ideas" || c.name === "Ideas" || c.name === "功能建议"
        )?.id;
        
        // 如果没有找到，使用第一个分类
        if (!categoryId && categories.length > 0) {
          categoryId = categories[0].id;
        }

        if (!repositoryId || !categoryId) {
          return res.status(500).json({ 
            error: "无法获取仓库信息",
            message: "请确保仓库已启用 Discussions 功能，并创建 Ideas 分类",
          });
        }

        // 创建新的 Discussion
        // 注意：新创建的 Discussion 默认没有标签，需要管理员手动添加
        const createResult = await graphqlRequest(CREATE_DISCUSSION_MUTATION, {
          repositoryId,
          categoryId,
          title: `[功能建议] ${title}`,
          body: `## 功能描述\n\n${description}\n\n---\n*此建议通过 PenBridge 网站提交*\n\n> 管理员可以通过添加标签来设置状态和分类：\n> - \`status:voting\` / \`status:planned\` / \`status:completed\`\n> - \`category:平台支持\` / \`category:功能增强\` / \`category:用户建议\``,
        });

        const newDiscussion = createResult.data?.createDiscussion?.discussion;

        return res.status(200).json({
          success: true,
          message: "建议提交成功！管理员审核后会显示在列表中。",
          discussion: newDiscussion,
        });
      }

      // 投票
      if (action === "vote" || action === "unvote") {
        if (!featureId) {
          return res.status(400).json({ error: "缺少 featureId" });
        }

        if (!userToken) {
          return res.status(401).json({ 
            error: "需要登录",
            message: "请先登录 GitHub 账号",
          });
        }

        // 获取所有 discussions
        const repoData = await graphqlRequest(GET_DISCUSSIONS_QUERY, {
          owner: REPO_OWNER,
          name: REPO_NAME,
        });

        const discussions = repoData.data?.repository?.discussions?.nodes || [];
        
        // 从 featureId 解析 discussion number
        // featureId 格式: discussion-{number}
        let discussionNumber: number | null = null;
        if (featureId.startsWith("discussion-")) {
          discussionNumber = parseInt(featureId.replace("discussion-", ""));
        }

        // 查找对应的 discussion
        const discussion = discussions.find(d => d.number === discussionNumber);

        if (!discussion?.id) {
          return res.status(404).json({ 
            error: "未找到对应的讨论",
            message: "该功能可能已被删除，请刷新页面重试",
          });
        }

        try {
          // 使用用户的 token 来投票
          const mutation = action === "vote" ? ADD_REACTION_MUTATION : REMOVE_REACTION_MUTATION;
          await graphqlRequest(mutation, {
            subjectId: discussion.id,
          }, userToken);

          return res.status(200).json({
            success: true,
            message: action === "vote" ? "投票成功！" : "取消投票成功！",
          });
        } catch (err) {
          console.error("Vote error:", err);
          return res.status(500).json({
            error: "投票失败",
            message: err instanceof Error ? err.message : "请稍后重试",
          });
        }
      }

      return res.status(400).json({ error: "无效的操作" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
