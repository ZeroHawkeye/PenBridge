/**
 * GitHub OAuth 回调处理
 * 交换 code 获取 access_token，然后获取用户信息
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error, error_description } = req.query;

  // 处理 GitHub 返回的错误
  if (error) {
    return res.redirect(`/survey?error=${encodeURIComponent(error_description as string || error as string)}`);
  }

  if (!code || typeof code !== "string") {
    return res.redirect("/survey?error=missing_code");
  }

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.redirect("/survey?error=oauth_not_configured");
  }

  try {
    // 交换 code 获取 access_token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData: GitHubTokenResponse = await tokenResponse.json();

    if (tokenData.error) {
      console.error("GitHub token error:", tokenData);
      return res.redirect(`/survey?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    // 获取用户信息
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      return res.redirect("/survey?error=failed_to_get_user");
    }

    const user: GitHubUser = await userResponse.json();

    // 将用户信息和 token 通过 URL 参数传递给前端
    // 注意：这里使用 fragment (#) 来传递敏感信息，不会发送到服务器
    const authData = {
      token: tokenData.access_token,
      user: {
        id: user.id,
        login: user.login,
        avatar_url: user.avatar_url,
        name: user.name,
      },
    };

    // 使用 Base64 编码传递数据
    const encodedData = Buffer.from(JSON.stringify(authData)).toString("base64");
    
    res.redirect(`/survey#auth=${encodedData}`);
  } catch (err) {
    console.error("GitHub OAuth callback error:", err);
    res.redirect("/survey?error=oauth_failed");
  }
}
