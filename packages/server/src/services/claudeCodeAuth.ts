import * as crypto from "crypto";

export const CLAUDE_CODE_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
export const CLAUDE_CODE_REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";
export const CLAUDE_CODE_SCOPES = "org:create_api_key user:profile user:inference";

export const CLAUDE_CODE_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
export const CLAUDE_CODE_AUTHORIZE_URL_MAX = "https://claude.ai/oauth/authorize";
export const CLAUDE_CODE_AUTHORIZE_URL_CONSOLE = "https://console.anthropic.com/oauth/authorize";

export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const ANTHROPIC_BETA = "oauth-2025-04-20,interleaved-thinking-2025-05-14";

export const CLAUDE_CODE_SYSTEM_PREFIX = "You are Claude Code, Anthropic's official CLI for Claude.";

export const DEFAULT_CLAUDE_CODE_MODEL = "claude-sonnet-4-20250514";

export const TOKEN_REFRESH_BUFFER = 60;

export interface ClaudeCodeAuthInfo {
  authType: "oauth" | "api_key";
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  subscriptionType?: "max" | "pro";
  email?: string;
}

export interface PkceCodes {
  verifier: string;
  challenge: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePKCE(): PkceCodes {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(
    crypto.createHash("sha256").update(verifier).digest()
  );
  return { verifier, challenge };
}

export function buildAuthorizeUrl(
  challenge: string,
  verifier: string,
  useClaudeMax: boolean = true
): string {
  const base = useClaudeMax ? CLAUDE_CODE_AUTHORIZE_URL_MAX : CLAUDE_CODE_AUTHORIZE_URL_CONSOLE;
  const params = new URLSearchParams({
    code: "true",
    client_id: CLAUDE_CODE_CLIENT_ID,
    response_type: "code",
    redirect_uri: CLAUDE_CODE_REDIRECT_URI,
    scope: CLAUDE_CODE_SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: verifier,
  });
  return `${base}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  verifier: string
): Promise<TokenResponse> {
  const parts = code.split("#");
  const authCode = parts[0];
  const state = parts[1] || verifier;

  console.log(`[Claude Code Auth] 交换授权码获取 Token...`);

  const response = await fetch(CLAUDE_CODE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CLAUDE_CODE_CLIENT_ID,
      code: authCode,
      state: state,
      redirect_uri: CLAUDE_CODE_REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Claude Code Auth] Token 交换失败: ${response.status} - ${errorText}`);
    throw new Error(`Token 交换失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[Claude Code Auth] Token 交换成功`);
  return data;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  console.log(`[Claude Code Auth] 刷新 Access Token...`);

  const response = await fetch(CLAUDE_CODE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLAUDE_CODE_CLIENT_ID,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Claude Code Auth] Token 刷新失败: ${response.status} - ${errorText}`);
    throw new Error(`Token 刷新失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[Claude Code Auth] Token 刷新成功`);
  return data;
}

export function isTokenExpired(expiresAt: number, bufferSeconds: number = TOKEN_REFRESH_BUFFER): boolean {
  return Date.now() >= (expiresAt - bufferSeconds * 1000);
}

export async function refreshTokenIfNeeded(
  auth: ClaudeCodeAuthInfo
): Promise<ClaudeCodeAuthInfo> {
  if (auth.authType === "api_key") {
    return auth;
  }

  if (!isTokenExpired(auth.expiresAt)) {
    return auth;
  }

  if (!auth.refreshToken) {
    throw new Error("无法刷新 Token: refresh_token 不存在");
  }

  const newTokens = await refreshAccessToken(auth.refreshToken);

  return {
    ...auth,
    accessToken: newTokens.access_token,
    refreshToken: newTokens.refresh_token || auth.refreshToken,
    expiresAt: Date.now() + newTokens.expires_in * 1000,
  };
}


