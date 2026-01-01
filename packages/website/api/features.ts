/**
 * Vercel Serverless Function - 功能调研 API
 * 
 * 使用 GitHub Discussions API 来实现投票功能：
 * - 每个功能对应一个 Discussion
 * - 使用 Reactions (👍) 作为投票
 * - 无需数据库，数据存储在 GitHub
 * 
 * 环境变量：
 * - GITHUB_TOKEN: GitHub Personal Access Token (需要 repo 和 discussion 权限)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const GITHUB_API = "https://api.github.com/graphql";
const REPO_OWNER = "ZeroHawkeye";
const REPO_NAME = "PenBridge";

// 功能配置 - 对应 GitHub Discussions
interface FeatureConfig {
  id: string;
  title: string;
  description: string;
  category: string;
  discussionNumber?: number; // GitHub Discussion 编号
  status: "voting" | "planned" | "completed";
}

// 预定义的功能列表
const featuresConfig: FeatureConfig[] = [
  {
    id: "csdn",
    title: "CSDN 平台支持",
    description: "支持一键发布文章到 CSDN 博客平台",
    category: "平台支持",
    status: "voting",
  },
  {
    id: "segmentfault",
    title: "思否平台支持",
    description: "支持一键发布文章到思否社区",
    category: "平台支持",
    status: "voting",
  },
  {
    id: "zhihu",
    title: "知乎专栏支持",
    description: "支持发布文章到知乎专栏",
    category: "平台支持",
    status: "voting",
  },
  {
    id: "cnblogs",
    title: "博客园支持",
    description: "支持发布文章到博客园",
    category: "平台支持",
    status: "voting",
  },
  {
    id: "wechat",
    title: "微信公众号支持",
    description: "支持发布文章到微信公众号",
    category: "平台支持",
    status: "planned",
  },
  {
    id: "image-hosting",
    title: "更多图床支持",
    description: "支持七牛云、阿里云 OSS、GitHub 等更多图床",
    category: "功能增强",
    status: "voting",
  },
  {
    id: "templates",
    title: "文章模板",
    description: "预设多种文章模板，快速开始写作",
    category: "功能增强",
    status: "voting",
  },
  {
    id: "statistics",
    title: "数据统计",
    description: "统计各平台文章阅读量、点赞数等数据",
    category: "功能增强",
    status: "voting",
  },
  {
    id: "sync",
    title: "云同步",
    description: "支持多设备数据同步（可选功能）",
    category: "功能增强",
    status: "voting",
  },
  {
    id: "export",
    title: "批量导出",
    description: "支持批量导出文章为 PDF、Word 等格式",
    category: "功能增强",
    status: "voting",
  },
  {
    id: "tencent-cloud",
    title: "腾讯云开发者社区",
    description: "已支持发布到腾讯云开发者社区",
    category: "平台支持",
    status: "completed",
  },
  {
    id: "juejin",
    title: "掘金平台",
    description: "已支持发布到掘金技术社区",
    category: "平台支持",
    status: "completed",
  },
];

// GraphQL 查询 - 获取仓库的 Discussions
const GET_DISCUSSIONS_QUERY = `
  query GetDiscussions($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      discussions(first: 50, categoryId: null) {
        nodes {
          id
          number
          title
          reactions(content: THUMBS_UP) {
            totalCount
          }
        }
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

async function graphqlRequest(query: string, variables: Record<string, unknown>) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN not configured");
  }

  const response = await fetch(GITHUB_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 头
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // GET - 获取功能列表和投票数
    if (req.method === "GET") {
      // 如果没有配置 GitHub Token，返回静态数据（用于开发/演示）
      if (!process.env.GITHUB_TOKEN) {
        const staticFeatures = featuresConfig.map((f) => ({
          ...f,
          votes: Math.floor(Math.random() * 200), // 随机投票数用于演示
        }));
        return res.status(200).json({
          features: staticFeatures,
          totalVotes: staticFeatures.reduce((sum, f) => sum + f.votes, 0),
          totalParticipants: Math.floor(Math.random() * 500),
          source: "static", // 标记数据来源
        });
      }

      // 从 GitHub Discussions 获取真实数据
      const data = await graphqlRequest(GET_DISCUSSIONS_QUERY, {
        owner: REPO_OWNER,
        name: REPO_NAME,
      });

      const discussions = data.data?.repository?.discussions?.nodes || [];
      
      // 将 discussions 的投票数映射到功能
      const features = featuresConfig.map((f) => {
        const discussion = discussions.find(
          (d: { title: string }) => d.title.toLowerCase().includes(f.id.toLowerCase())
        );
        return {
          ...f,
          votes: discussion?.reactions?.totalCount || 0,
          discussionId: discussion?.id,
        };
      });

      const totalVotes = features.reduce((sum, f) => sum + f.votes, 0);

      return res.status(200).json({
        features,
        totalVotes,
        totalParticipants: Math.floor(totalVotes * 0.7), // 估算参与者数
        source: "github",
      });
    }

    // POST - 投票（需要用户认证）
    if (req.method === "POST") {
      const { featureId, action } = req.body;

      if (!featureId || !action) {
        return res.status(400).json({ error: "Missing featureId or action" });
      }

      if (!process.env.GITHUB_TOKEN) {
        return res.status(501).json({ 
          error: "Voting not available",
          message: "GitHub Token not configured. Please vote on GitHub Discussions directly.",
          discussionsUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/discussions`,
        });
      }

      // 这里需要用户的 GitHub 认证来投票
      // 暂时返回引导用户去 GitHub 投票
      return res.status(200).json({
        success: false,
        message: "Please vote on GitHub Discussions",
        discussionsUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/discussions`,
      });
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
