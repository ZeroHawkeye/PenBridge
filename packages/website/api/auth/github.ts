/**
 * GitHub OAuth 登录 - 重定向到 GitHub 授权页面
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: "GitHub OAuth not configured" });
  }

  // 获取回调地址
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  // 构建 GitHub OAuth 授权 URL
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "read:user", // 只需要读取用户信息，投票通过 GraphQL API 使用服务端 token
    state: Math.random().toString(36).substring(7), // 防止 CSRF
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  res.redirect(302, authUrl);
}
