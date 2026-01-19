/**
 * 掘金 API 服务
 * 基于 HTTP API 直接调用
 * 
 * 主要功能：
 * 1. 创建/更新/获取草稿
 * 2. 发布文章
 * 3. 获取分类和标签
 * 4. 检查登录状态
 * 5. 图片上传（ImageX）
 */

import * as crypto from "crypto";

// 调试日志开关
const DEBUG = true;

function log(...args: unknown[]) {
  if (DEBUG) {
    console.log("[JuejinAPI]", ...args);
  }
}

// Cookie 信息接口
export interface JuejinCookies {
  sessionid: string;
  sessionid_ss?: string;
  sid_tt?: string;
  uid_tt?: string;
  sid_guard?: string;
  [key: string]: string | undefined;
}

// 分类信息
export interface CategoryInfo {
  category_id: string;
  category_name: string;
  category_url: string;
  rank: number;
}

// 标签信息
export interface TagInfo {
  tag_id: string;
  tag_name: string;
  color?: string;
  icon?: string;
  post_article_count?: number;
  concern_user_count?: number;
}

// 草稿信息
export interface DraftInfo {
  id: string;
  article_id: string;
  user_id: string;
  category_id: string;
  tag_ids: number[];
  title: string;
  brief_content: string;
  mark_content: string;
  is_original: number;
  edit_type: number;
  status: number;
}

// 发布响应
export interface PublishResponse {
  article_id: string;
  draft_id: string;
}

// 用户信息
export interface UserInfo {
  user_id: string;
  user_name: string;
  avatar_large?: string;
  description?: string;
  level?: number;
}

// API 通用响应
interface ApiResponse<T> {
  err_no: number;
  err_msg: string;
  data: T;
}

/**
 * 掘金 API 客户端
 */
export class JuejinApiClient {
  private baseUrl = "https://api.juejin.cn";
  private cookies: JuejinCookies;
  private cookieHeader: string;
  private uuid: string = "";
  private csrfToken: string = "";
  private secToken: string | null = null; // 动态安全 token（从 API 获取）

  constructor(cookiesJson: string) {
    this.cookies = this.parseCookies(cookiesJson);
    this.cookieHeader = this.buildCookieHeader();
    this.uuid = this.extractUuid();
    this.csrfToken = this.extractCsrfToken();
    log("初始化完成, uuid:", this.uuid, "csrfToken:", this.csrfToken ? "有" : "无");
    log("sessionid:", this.cookies.sessionid);
    log("csrf_session_id:", this.cookies["csrf_session_id"] || "无");
  }

  /**
   * 从 Cookie 中提取 CSRF Token
   */
  private extractCsrfToken(): string {
    // 尝试从多个可能的 Cookie 中获取 CSRF Token
    const possibleTokens = [
      "__ac_nonce",
      "passport_csrf_token",
      "csrf_session_id",
    ];

    for (const tokenName of possibleTokens) {
      const token = this.cookies[tokenName];
      if (token) {
        return token;
      }
    }

    return "";
  }

  /**
   * 获取安全 Token（用于所有写操作）
   * 会缓存 token，避免重复请求
   */
  private async fetchSecToken(): Promise<string | null> {
    // 如果已经有缓存的 token，直接返回
    if (this.secToken) {
      return this.secToken;
    }

    try {
      // 使用 HEAD 请求获取 token（根据调研结果）
      const url = `${this.baseUrl}/user_api/v1/sys/token?aid=2608&uuid=${this.uuid}`;
      
      log("获取安全 Token, URL:", url);
      
      const response = await fetch(url, {
        method: "HEAD",
        headers: {
          Accept: "application/json, text/plain, */*",
          Cookie: this.cookieHeader,
          Origin: "https://juejin.cn",
          Referer: "https://juejin.cn/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "x-secsdk-csrf-request": "1",
          "x-secsdk-csrf-version": "1.2.10",
          "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
        },
      });

      log("获取安全 Token 响应状态:", response.status);
      
      // 打印所有响应头用于调试
      const allHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        allHeaders[key] = value;
      });
      log("响应头:", JSON.stringify(allHeaders));

      // 处理 set-cookie 响应头，更新 csrf_session_id
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        const csrfMatch = setCookie.match(/csrf_session_id=([^;]+)/);
        if (csrfMatch && csrfMatch[1]) {
          const newCsrfSessionId = csrfMatch[1];
          log("更新 csrf_session_id:", newCsrfSessionId);
          this.cookies["csrf_session_id"] = newCsrfSessionId;
          // 重建 cookie header
          this.cookieHeader = this.buildCookieHeader();
        }
      }

      // 从响应头中获取 token
      // 格式: "0,token,expiry,status,session_id"
      // 示例: "0,00010000000137f41ae0...,86370000,success,c051f74dad1245c0ef01c6da320449c0"
      const wareToken = response.headers.get("x-ware-csrf-token");
      if (wareToken) {
        const parts = wareToken.split(",");
        // 第二部分（index 1）才是真正的 token
        if (parts.length >= 2 && parts[1]) {
          const token = parts[1].trim();
          log("获取到安全 Token:", token.substring(0, 30) + "...");
          this.secToken = token; // 缓存 token
          return token;
        }
        // 如果只有一个部分，直接使用
        const token = parts[0].trim();
        log("获取到安全 Token (单值):", token.substring(0, 30) + "...");
        this.secToken = token;
        return token;
      }

      log("未获取到安全 Token (x-ware-csrf-token 头不存在)");
      return null;
    } catch (error) {
      log("获取安全 Token 失败:", error);
      return null;
    }
  }

  /**
   * 解析 cookies JSON 字符串
   */
  private parseCookies(cookiesJson: string): JuejinCookies {
    try {
      const cookiesArray = JSON.parse(cookiesJson);
      const cookies: JuejinCookies = {
        sessionid: "",
      };

      for (const cookie of cookiesArray) {
        if (cookie.name && cookie.value) {
          cookies[cookie.name] = cookie.value;
        }
      }

      return cookies;
    } catch {
      throw new Error("无效的 cookies 格式");
    }
  }

  /**
   * 构建 cookie 字符串用于请求头
   */
  private buildCookieHeader(): string {
    return Object.entries(this.cookies)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  /**
   * 完全解码 URL 编码的字符串（处理多重编码）
   */
  private fullyDecodeURIComponent(str: string): string {
    let decoded = str;
    let prevDecoded = "";
    // 循环解码直到不再变化（处理多重编码）
    while (decoded !== prevDecoded && decoded.includes("%")) {
      prevDecoded = decoded;
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        break;
      }
    }
    return decoded;
  }

  /**
   * 从 Cookie 中提取 UUID
   */
  private extractUuid(): string {
    // 尝试从 __tea_cookie_tokens_2608 中解析
    const teaToken = this.cookies["__tea_cookie_tokens_2608"];
    if (teaToken) {
      try {
        // Cookie 值可能被多重 URL 编码
        const decoded = this.fullyDecodeURIComponent(teaToken);
        log("解码后的 __tea_cookie_tokens_2608:", decoded.substring(0, 100));
        const parsed = JSON.parse(decoded);
        if (parsed.user_unique_id) {
          log("从 __tea_cookie_tokens_2608 提取到 UUID:", parsed.user_unique_id);
          return parsed.user_unique_id;
        }
        if (parsed.web_id) {
          log("从 __tea_cookie_tokens_2608 提取到 web_id:", parsed.web_id);
          return parsed.web_id;
        }
      } catch (e) {
        log("解析 __tea_cookie_tokens_2608 失败:", e);
      }
    }

    // 尝试从其他 Cookie 获取
    for (const [key, value] of Object.entries(this.cookies)) {
      if (key.includes("tea") && value) {
        try {
          const decoded = this.fullyDecodeURIComponent(value);
          // 尝试解析为 JSON
          if (decoded.startsWith("{")) {
            const parsed = JSON.parse(decoded);
            if (parsed.user_unique_id) {
              log(`从 ${key} 提取到 UUID:`, parsed.user_unique_id);
              return parsed.user_unique_id;
            }
            if (parsed.web_id) {
              log(`从 ${key} 提取到 web_id:`, parsed.web_id);
              return parsed.web_id;
            }
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 打印所有 Cookie 名称用于调试
    log("未能提取 UUID，可用的 Cookie:", Object.keys(this.cookies).join(", "));
    
    // 返回一个默认值
    return "7000000000000000000";
  }

  /**
   * 解析 sid_guard 获取会话信息
   */
  public parseSidGuard(): {
    sessionId: string;
    createTimestamp: number;
    expiresInSeconds: number;
    expiresDate: string;
    remainingDays: number;
  } | null {
    const sidGuard = this.cookies.sid_guard;
    if (!sidGuard) return null;

    try {
      const decoded = decodeURIComponent(sidGuard);
      const parts = decoded.split("|");
      if (parts.length < 4) return null;

      const createTimestamp = parseInt(parts[1]);
      const expiresInSeconds = parseInt(parts[2]);
      const remainingDays = Math.floor(
        (createTimestamp + expiresInSeconds - Date.now() / 1000) / 86400
      );

      return {
        sessionId: parts[0],
        createTimestamp,
        expiresInSeconds,
        expiresDate: parts[3],
        remainingDays,
      };
    } catch {
      return null;
    }
  }

  /**
   * 发送 API 请求
   * 对于 POST 请求，会自动获取安全 token
   */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: object
  ): Promise<T> {
    const url = `${this.baseUrl}${path}${path.includes("?") ? "&" : "?"}aid=2608&uuid=${this.uuid}`;

    log("发送请求:", { method, url });
    if (body) {
      log("请求体:", JSON.stringify(body).substring(0, 500));
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      Cookie: this.cookieHeader,
      Origin: "https://juejin.cn",
      Referer: "https://juejin.cn/editor/drafts/new?v=2",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
    };

    // 对于 POST 请求，获取并使用安全 token
    if (method === "POST") {
      const secToken = await this.fetchSecToken();
      if (secToken) {
        headers["x-secsdk-csrf-token"] = secToken;
      }
    }

    // 调试：打印完整请求头
    log("请求头:", JSON.stringify(headers, null, 2));
    log("Cookie 长度:", this.cookieHeader.length, "Cookie 包含 csrf_session_id:", this.cookieHeader.includes("csrf_session_id"));

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();

    let result: ApiResponse<T>;
    try {
      result = JSON.parse(text);
    } catch {
      log("请求失败（非JSON响应）:", {
        status: response.status,
        body: text.substring(0, 500),
      });
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    log("响应:", result);

    if (result.err_no !== 0) {
      throw new Error(`${result.err_msg} (err_no: ${result.err_no})`);
    }

    return result.data;
  }

  // ==================== 用户相关 API ====================

  /**
   * 获取当前用户信息
   */
  async getUserInfo(): Promise<UserInfo | null> {
    try {
      const result = await this.request<UserInfo>(
        "GET",
        "/user_api/v1/user/get?not_self=0"
      );
      return result;
    } catch (error) {
      log("获取用户信息失败:", error);
      return null;
    }
  }

  /**
   * 验证登录状态
   */
  async checkLoginStatus(): Promise<boolean> {
    try {
      const user = await this.getUserInfo();
      return user !== null && !!user.user_id;
    } catch {
      return false;
    }
  }

  // ==================== 分类和标签 API ====================

  /**
   * 获取分类列表
   */
  async fetchCategories(): Promise<CategoryInfo[]> {
    const result = await this.request<
      Array<{ category_id: string; category: CategoryInfo }>
    >("POST", "/tag_api/v1/query_category_list", {});

    return result.map((item) => item.category);
  }

  /**
   * 搜索标签
   */
  async searchTags(keyword: string, limit = 20): Promise<TagInfo[]> {
    const result = await this.request<Array<{ tag_id: string; tag: TagInfo }>>(
      "POST",
      "/tag_api/v1/query_tag_list",
      {
        cursor: "0",
        key_word: keyword,
        limit,
        sort_type: 1,
      }
    );

    return result.map((item) => ({
      tag_id: item.tag.tag_id,
      tag_name: item.tag.tag_name,
      color: item.tag.color,
      icon: item.tag.icon,
      post_article_count: item.tag.post_article_count,
      concern_user_count: item.tag.concern_user_count,
    }));
  }

  // ==================== 草稿相关 API ====================

  /**
   * 创建草稿
   */
  async createDraft(title: string): Promise<{ id: string }> {
    const result = await this.request<{ id: string; article_id: string }>(
      "POST",
      "/content_api/v1/article_draft/create",
      {
        category_id: "0",
        tag_ids: [],
        link_url: "",
        cover_image: "",
        is_gfw: 0,
        title,
        brief_content: "",
        is_english: 0,
        is_original: 1,
        edit_type: 10,
        html_content: "deprecated",
        mark_content: "",
        theme_ids: [],
      }
    );

    return { id: result.id };
  }

  /**
   * 更新草稿
   */
  async updateDraft(params: {
    id: string;
    title: string;
    markContent: string;
    briefContent: string;
    categoryId: string;
    tagIds: string[];
    coverImage?: string;
    isOriginal?: number;
    themeIds?: string[];
  }): Promise<DraftInfo> {
    // 验证必填字段
    if (!params.categoryId || params.categoryId === "0") {
      throw new Error("分类ID不能为空");
    }
    if (!params.tagIds || params.tagIds.length === 0) {
      throw new Error("至少需要选择一个标签");
    }
    if (!params.briefContent || params.briefContent.trim().length === 0) {
      throw new Error("摘要不能为空");
    }

    log("更新草稿参数:", {
      id: params.id,
      categoryId: params.categoryId,
      tagIds: params.tagIds,
      briefContent: params.briefContent.substring(0, 50),
      titleLength: params.title.length,
      contentLength: params.markContent.length,
    });

    const result = await this.request<DraftInfo>(
      "POST",
      "/content_api/v1/article_draft/update",
      {
        id: params.id,
        category_id: params.categoryId,
        tag_ids: params.tagIds,
        link_url: "",
        cover_image: params.coverImage || "",
        is_gfw: 0,
        title: params.title,
        brief_content: params.briefContent,
        is_english: 0,
        is_original: params.isOriginal ?? 1,
        edit_type: 10,
        html_content: "deprecated",
        mark_content: params.markContent,
        theme_ids: params.themeIds || [],
        pics: [],
      }
    );

    return result;
  }

  /**
   * 获取草稿详情
   */
  async getDraftDetail(draftId: string): Promise<DraftInfo> {
    const result = await this.request<{ draft_id: string; article_draft: DraftInfo }>(
      "POST",
      "/content_api/v1/article_draft/detail",
      { draft_id: draftId }
    );

    return result.article_draft;
  }

  // ==================== 发布相关 API ====================

  /**
   * 发布文章（带安全 token）
   */
  async publishArticle(params: {
    draftId: string;
    syncToOrg?: boolean;
    columnIds?: string[];
    themeIds?: string[];
  }): Promise<PublishResponse> {
    // 先获取安全 token
    const secToken = await this.fetchSecToken();
    
    const url = `${this.baseUrl}/content_api/v1/article/publish?aid=2608&uuid=${this.uuid}`;
    const body = {
      draft_id: params.draftId,
      sync_to_org: params.syncToOrg ?? false,
      column_ids: params.columnIds || [],
      theme_ids: params.themeIds || [],
    };

    log("发送发布请求:", { url });
    log("请求体:", JSON.stringify(body));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      Cookie: this.cookieHeader,
      Origin: "https://juejin.cn",
      Referer: "https://juejin.cn/editor/drafts/new?v=2",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
    };

    // 添加安全 token
    if (secToken) {
      headers["x-secsdk-csrf-token"] = secToken;
    }
    if (this.csrfToken) {
      headers["x-secsdk-csrf-request"] = "1";
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let result: ApiResponse<PublishResponse>;
    try {
      result = JSON.parse(text);
    } catch {
      log("发布请求失败（非JSON响应）:", { status: response.status, body: text.substring(0, 500) });
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    log("发布响应:", result);

    if (result.err_no !== 0) {
      throw new Error(`${result.err_msg} (err_no: ${result.err_no})`);
    }

    return result.data;
  }

  /**
   * 一键发布文章（创建/复用草稿 -> 更新草稿 -> 发布）
   */
  async publishArticleOneClick(params: {
    title: string;
    markContent: string;
    briefContent: string;
    categoryId: string;
    tagIds: string[];
    coverImage?: string;
    isOriginal?: number;
    existingDraftId?: string; // 已有的草稿ID，如果有则复用
  }): Promise<PublishResponse & { draft_id: string }> {
    let draftId: string = "";
    let draftUpdated = false;

    // 1. 尝试复用已有草稿，如果失败则创建新草稿
    if (params.existingDraftId) {
      draftId = params.existingDraftId;
      log("尝试复用已有草稿:", draftId);
      
      // 尝试更新草稿，如果失败（403 权限错误）则创建新草稿
      try {
        await this.updateDraft({
          id: draftId,
          title: params.title,
          markContent: params.markContent,
          briefContent: params.briefContent,
          categoryId: params.categoryId,
          tagIds: params.tagIds,
          coverImage: params.coverImage,
          isOriginal: params.isOriginal,
        });
        log("复用草稿更新成功");
        draftUpdated = true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("403") || errorMsg.includes("权限")) {
          log("复用草稿失败（权限错误），将创建新草稿");
          // 继续执行，创建新草稿
        } else {
          throw error;
        }
      }
    }

    // 2. 如果需要创建新草稿（没有旧草稿或旧草稿更新失败）
    if (!draftUpdated) {
      const draft = await this.createDraft(params.title);
      draftId = draft.id;
      log("创建新草稿:", draftId);

      // 更新新草稿
      await this.updateDraft({
        id: draftId,
        title: params.title,
        markContent: params.markContent,
        briefContent: params.briefContent,
        categoryId: params.categoryId,
        tagIds: params.tagIds,
        coverImage: params.coverImage,
        isOriginal: params.isOriginal,
      });
      log("新草稿更新成功");
    }

    // 3. 发布文章
    const result = await this.publishArticle({ draftId });
    log("发布文章成功:", result.article_id);

    return { ...result, draft_id: draftId };
  }

  // ==================== 文章管理 API ====================

  /**
   * 文章信息接口
   */
  // 定义在类外部

  /**
   * 获取用户文章列表
   */
  async fetchUserArticles(params: {
    auditStatus?: number | null; // null-全部, 2-已发布, 1-审核中, 3-未通过
    keyword?: string;
    pageNo?: number;
    pageSize?: number;
  }): Promise<Array<{
    article_id: string;
    article_info: {
      article_id: string;
      title: string;
      brief_content: string;
      cover_image: string;
      view_count: number;
      digg_count: number;
      comment_count: number;
      collect_count: number;
      status: number;
      audit_status: number;
      verify_status: number;
      ctime: string;
      mtime: string;
      rtime: string;
      draft_id: string;
    };
    category: {
      category_id: string;
      category_name: string;
    };
    tags: Array<{
      tag_id: string;
      tag_name: string;
    }>;
  }>> {
    const result = await this.request<Array<{
      article_id: string;
      article_info: {
        article_id: string;
        title: string;
        brief_content: string;
        cover_image: string;
        view_count: number;
        digg_count: number;
        comment_count: number;
        collect_count: number;
        status: number;
        audit_status: number;
        verify_status: number;
        ctime: string;
        mtime: string;
        rtime: string;
        draft_id: string;
      };
      category: {
        category_id: string;
        category_name: string;
      };
      tags: Array<{
        tag_id: string;
        tag_name: string;
      }>;
    }>>("POST", "/content_api/v1/article/list_by_user", {
      audit_status: params.auditStatus ?? null,
      keyword: params.keyword || "",
      page_size: params.pageSize ?? 10,
      page_no: params.pageNo ?? 1,
    });

    return result;
  }

  /**
   * 获取用户草稿列表
   */
  async fetchUserDrafts(params: {
    keyword?: string;
    pageNo?: number;
    pageSize?: number;
  }): Promise<Array<{
    id: string;
    title: string;
    brief_content: string;
    category_id: string;
    ctime: string;
    mtime: string;
  }>> {
    const result = await this.request<Array<{
      id: string;
      title: string;
      brief_content: string;
      category_id: string;
      ctime: string;
      mtime: string;
    }>>("POST", "/content_api/v1/article_draft/query_list", {
      keyword: params.keyword || "",
      page_size: params.pageSize ?? 10,
      page_no: params.pageNo ?? 1,
    });

    return result;
  }

  /**
   * 获取文章状态统计
   * 通过遍历获取完整的文章数量统计
   */
  async fetchArticleStatusCount(): Promise<{
    all: number;
    published: number;  // 已发布 (audit_status = 2)
    pending: number;    // 审核中 (audit_status = 1)
    rejected: number;   // 未通过 (audit_status = 3)
    draft: number;      // 草稿数量
  }> {
    // 获取所有文章（分页遍历以获取完整数量）
    const allArticles: Array<{ article_info: { audit_status: number } }> = [];
    let pageNo = 1;
    const pageSize = 100;

    while (true) {
      const articles = await this.fetchUserArticles({
        auditStatus: null,
        pageNo,
        pageSize,
      });
      if (articles.length === 0) break;
      allArticles.push(...articles);
      if (articles.length < pageSize) break;
      pageNo++;
      // 防止无限循环，最多获取1000篇
      if (pageNo > 10) break;
    }

    // 获取草稿数量
    let draftCount = 0;
    let draftPageNo = 1;
    while (true) {
      const drafts = await this.fetchUserDrafts({
        pageNo: draftPageNo,
        pageSize: 100,
      });
      draftCount += drafts.length;
      if (drafts.length < 100) break;
      draftPageNo++;
      if (draftPageNo > 10) break;
    }

    // 统计各状态数量
    const stats = allArticles.reduce(
      (acc, item) => {
        switch (item.article_info.audit_status) {
          case 2:
            acc.published++;
            break;
          case 1:
            acc.pending++;
            break;
          case 3:
            acc.rejected++;
            break;
        }
        return acc;
      },
      { published: 0, pending: 0, rejected: 0 }
    );

    return {
      all: allArticles.length,
      published: stats.published,
      pending: stats.pending,
      rejected: stats.rejected,
      draft: draftCount,
    };
  }

  // ==================== 图片上传 API (ImageX) ====================

  /**
   * ImageX STS Token 信息
   */
  private stsToken: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiredTime: Date;
  } | null = null;

  /**
   * 获取 ImageX STS Token
   */
  private async getImagexToken(): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  }> {
    // 检查缓存的 token 是否有效（提前 5 分钟刷新）
    if (this.stsToken && this.stsToken.expiredTime > new Date(Date.now() + 5 * 60 * 1000)) {
      return this.stsToken;
    }

    const url = `${this.baseUrl}/imagex/v2/gen_token?aid=2608&uuid=${this.uuid}&client=web`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        Cookie: this.cookieHeader,
        Origin: "https://juejin.cn",
        Referer: "https://juejin.cn/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const result = await response.json() as ApiResponse<{
      token: {
        AccessKeyId: string;
        SecretAccessKey: string;
        SessionToken: string;
        ExpiredTime: string;
      };
    }>;

    if (result.err_no !== 0) {
      throw new Error(`获取上传凭证失败: ${result.err_msg}`);
    }

    this.stsToken = {
      accessKeyId: result.data.token.AccessKeyId,
      secretAccessKey: result.data.token.SecretAccessKey,
      sessionToken: result.data.token.SessionToken,
      expiredTime: new Date(result.data.token.ExpiredTime),
    };

    log("获取 ImageX Token 成功，过期时间:", result.data.token.ExpiredTime);
    return this.stsToken;
  }

  /**
   * AWS4 签名算法
   */
  private signAws4(
    method: string,
    url: string,
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken: string,
    date: Date
  ): { authorization: string; amzDate: string } {
    const region = "cn-north-1";
    const service = "imagex";
    const algorithm = "AWS4-HMAC-SHA256";

    // 格式化日期 - ISO8601 格式无分隔符
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    // 解析 URL
    const urlObj = new URL(url);
    const canonicalUri = urlObj.pathname || "/";
    
    // 规范化查询字符串（按字母顺序排序）
    const queryParams = new URLSearchParams(urlObj.search);
    const sortedParams = Array.from(queryParams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const canonicalQuerystring = sortedParams.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

    // 规范请求头 - 按照掘金文档，不包含 host
    const signedHeaders = "x-amz-date;x-amz-security-token";
    const canonicalHeaders = `x-amz-date:${amzDate}\nx-amz-security-token:${sessionToken}\n`;

    // 空 body 的 hash
    const payloadHash = crypto.createHash("sha256").update("").digest("hex");

    // 创建规范请求
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    log("AWS4 规范请求:", {
      method,
      canonicalUri,
      querystring: canonicalQuerystring.substring(0, 100),
      signedHeaders,
      amzDate,
    });

    // 创建待签名字符串
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    // 计算签名密钥
    const kDate = crypto.createHmac("sha256", "AWS4" + secretAccessKey).update(dateStamp).digest();
    const kRegion = crypto.createHmac("sha256", new Uint8Array(kDate)).update(region).digest();
    const kService = crypto.createHmac("sha256", new Uint8Array(kRegion)).update(service).digest();
    const kSigning = crypto.createHmac("sha256", new Uint8Array(kService)).update("aws4_request").digest();

    // 计算签名
    const signature = crypto.createHmac("sha256", new Uint8Array(kSigning)).update(stringToSign).digest("hex");

    // 构建 Authorization 头
    const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    log("AWS4 签名结果:", authorization.substring(0, 80) + "...");
    
    return { authorization, amzDate };
  }

  /**
   * 申请上传地址
   */
  private async applyImageUpload(token: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  }): Promise<{
    storeUri: string;
    auth: string;
    uploadHost: string;
    sessionKey: string;
  }> {
    const serviceId = "73owjymdk6";
    const url = `https://imagex.bytedanceapi.com/?Action=ApplyImageUpload&Version=2018-08-01&ServiceId=${serviceId}`;
    const date = new Date();

    const { authorization, amzDate } = this.signAws4(
      "GET",
      url,
      token.accessKeyId,
      token.secretAccessKey,
      token.sessionToken,
      date
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authorization,
        "X-Amz-Date": amzDate,
        "X-Amz-Security-Token": token.sessionToken,
        Origin: "https://juejin.cn",
        Referer: "https://juejin.cn/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const text = await response.text();
    log("ApplyImageUpload 响应状态:", response.status);
    log("ApplyImageUpload 响应:", text.substring(0, 800));
    
    let result: {
      ResponseMetadata: { RequestId: string; Error?: { Code: string; Message: string } };
      Result?: {
        UploadAddress: {
          StoreInfos: Array<{ StoreUri: string; Auth: string }>;
          UploadHosts: string[];
          SessionKey: string;
        };
      };
    };
    
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`申请上传地址失败: 响应解析错误 - ${text.substring(0, 200)}`);
    }

    // 检查错误响应
    if (result.ResponseMetadata?.Error) {
      throw new Error(`申请上传地址失败: ${result.ResponseMetadata.Error.Code} - ${result.ResponseMetadata.Error.Message}`);
    }

    if (!result.Result?.UploadAddress?.StoreInfos?.[0]) {
      throw new Error(`申请上传地址失败: 响应结构异常 - ${JSON.stringify(result).substring(0, 300)}`);
    }

    const storeInfo = result.Result.UploadAddress.StoreInfos[0];
    return {
      storeUri: storeInfo.StoreUri,
      auth: storeInfo.Auth,
      uploadHost: result.Result.UploadAddress.UploadHosts[0],
      sessionKey: result.Result.UploadAddress.SessionKey,
    };
  }

  /**
   * 上传图片到 TOS
   */
  private async uploadToTos(
    imageBuffer: Buffer,
    uploadInfo: {
      storeUri: string;
      auth: string;
      uploadHost: string;
    }
  ): Promise<void> {
    const url = `https://${uploadInfo.uploadHost}/${uploadInfo.storeUri}`;

    // 计算 CRC32
    const crc32 = this.calculateCrc32(imageBuffer);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: uploadInfo.auth,
        "Content-Type": "application/octet-stream",
        "Content-CRC32": crc32,
        "Content-Disposition": 'attachment; filename="image"',
        "X-Storage-U": "",
        Origin: "https://juejin.cn",
        Referer: "https://juejin.cn/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: new Uint8Array(imageBuffer),
    });

    const result = await response.json() as {
      success: number;
      error: { code: number; message: string };
    };

    // 注意：success: 0 表示成功
    if (result.error?.code !== 200 && result.error?.message) {
      throw new Error(`上传图片失败: ${result.error.message}`);
    }

    log("图片上传到 TOS 成功");
  }

  /**
   * 计算 CRC32 校验值
   */
  private calculateCrc32(buffer: Buffer): string {
    // CRC32 查找表
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }

    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) {
      crc = table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    }
    crc = (crc ^ 0xffffffff) >>> 0;

    return crc.toString(16);
  }

  /**
   * 提交上传结果
   */
  private async commitImageUpload(
    token: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken: string;
    },
    sessionKey: string
  ): Promise<string> {
    const serviceId = "73owjymdk6";
    const url = `https://imagex.bytedanceapi.com/?Action=CommitImageUpload&Version=2018-08-01&SessionKey=${encodeURIComponent(sessionKey)}&ServiceId=${serviceId}`;
    const date = new Date();

    const { authorization, amzDate } = this.signAws4(
      "POST",
      url,
      token.accessKeyId,
      token.secretAccessKey,
      token.sessionToken,
      date
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "X-Amz-Date": amzDate,
        "X-Amz-Security-Token": token.sessionToken,
        "Content-Length": "0",
        Origin: "https://juejin.cn",
        Referer: "https://juejin.cn/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const result = await response.json() as {
      ResponseMetadata: { RequestId: string };
      Result: {
        Results: Array<{ Uri: string; UriStatus: number }>;
        PluginResult: Array<{ ImageUri: string }>;
      };
    };

    if (!result.Result?.Results?.[0] || result.Result.Results[0].UriStatus !== 2000) {
      throw new Error("提交上传结果失败");
    }

    log("提交上传结果成功");
    return result.Result.Results[0].Uri;
  }

  /**
   * 获取图片访问 URL
   */
  private async getImageUrl(uri: string, imgType: "private" | "public" = "private"): Promise<string> {
    const url = `${this.baseUrl}/imagex/v2/get_img_url?aid=2608&uuid=${this.uuid}&uri=${encodeURIComponent(uri)}&img_type=${imgType}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        Cookie: this.cookieHeader,
        Origin: "https://juejin.cn",
        Referer: "https://juejin.cn/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const result = await response.json() as ApiResponse<{
      main_url: string;
      backup_url: string;
    }>;

    if (result.err_no !== 0) {
      throw new Error(`获取图片 URL 失败: ${result.err_msg}`);
    }

    return result.data.main_url;
  }

  /**
   * 延时函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 上传图片到掘金（完整 5 步流程）
   * 包含重试逻辑以处理并发限制
   * @param imageBuffer 图片二进制数据
   * @param extension 图片扩展名（如 png, jpg）
   * @returns 图片访问 URL
   */
  async uploadImage(imageBuffer: Buffer, extension: string): Promise<string> {
    log(`开始上传图片，大小: ${imageBuffer.length} bytes, 扩展名: ${extension}`);

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Step 1: 获取 STS Token
        const token = await this.getImagexToken();

        // Step 2: 申请上传地址（带重试延时）
        if (attempt > 1) {
          log(`重试第 ${attempt} 次，等待 ${attempt * 500}ms...`);
          await this.delay(attempt * 500);
        }
        
        const uploadInfo = await this.applyImageUpload(token);
        log("获取上传地址:", uploadInfo.storeUri);

        // Step 3: 上传图片到 TOS
        await this.uploadToTos(imageBuffer, uploadInfo);

        // Step 4: 提交上传结果
        const imageUri = await this.commitImageUpload(token, uploadInfo.sessionKey);

        // Step 5: 获取图片 URL
        const imageUrl = await this.getImageUrl(imageUri);
        log("图片上传成功:", imageUrl.substring(0, 100) + "...");

        return imageUrl;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log(`上传失败 (尝试 ${attempt}/${maxRetries}):`, lastError.message);
        
        // 如果是最后一次尝试，不再重试
        if (attempt === maxRetries) {
          break;
        }
        
        // 如果错误是认证相关的，清除缓存的 token
        if (lastError.message.includes("认证") || lastError.message.includes("token") || lastError.message.includes("Token")) {
          this.stsToken = null;
        }
      }
    }

    throw lastError || new Error("图片上传失败：未知错误");
  }
}

/**
 * 创建掘金 API 客户端
 */
export function createJuejinApiClient(cookiesJson: string): JuejinApiClient {
  return new JuejinApiClient(cookiesJson);
}
