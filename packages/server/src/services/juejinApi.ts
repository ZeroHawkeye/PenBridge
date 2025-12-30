/**
 * 掘金 API 服务
 * 基于 HTTP API 直接调用
 * 
 * 主要功能：
 * 1. 创建/更新/获取草稿
 * 2. 发布文章
 * 3. 获取分类和标签
 * 4. 检查登录状态
 */

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

  constructor(cookiesJson: string) {
    this.cookies = this.parseCookies(cookiesJson);
    this.cookieHeader = this.buildCookieHeader();
    this.uuid = this.extractUuid();
    this.csrfToken = this.extractCsrfToken();
    log("初始化完成, uuid:", this.uuid, "csrfToken:", this.csrfToken ? "有" : "无");
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
   * 获取安全 Token（用于发布等敏感操作）
   */
  private async fetchSecToken(): Promise<string | null> {
    try {
      const url = `${this.baseUrl}/user_api/v1/sys/token?aid=2608&uuid=${this.uuid}`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          Cookie: this.cookieHeader,
          Origin: "https://juejin.cn",
          Referer: "https://juejin.cn/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      // 从响应头中获取 token
      const wareToken = response.headers.get("x-ware-csrf-token");
      if (wareToken) {
        // 格式：0001000000xxxx...，取后面的部分
        const parts = wareToken.split(",");
        if (parts.length > 0) {
          log("获取到安全 Token:", parts[0].substring(0, 20) + "...");
          return parts[0];
        }
      }

      log("未获取到安全 Token");
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
   * 从 Cookie 中提取 UUID
   */
  private extractUuid(): string {
    // 尝试从 __tea_cookie_tokens_2608 中解析
    const teaToken = this.cookies["__tea_cookie_tokens_2608"];
    if (teaToken) {
      try {
        const decoded = decodeURIComponent(teaToken);
        const parsed = JSON.parse(decoded);
        if (parsed.user_unique_id) {
          return parsed.user_unique_id;
        }
      } catch {
        // 忽略解析错误
      }
    }
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

    // 如果有 CSRF Token，添加到请求头
    if (this.csrfToken) {
      headers["x-secsdk-csrf-token"] = this.csrfToken;
    }

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
    let draftId: string;

    // 1. 创建或复用草稿
    if (params.existingDraftId) {
      draftId = params.existingDraftId;
      log("复用已有草稿:", draftId);
    } else {
      const draft = await this.createDraft(params.title);
      draftId = draft.id;
      log("创建新草稿:", draftId);
    }

    // 2. 更新草稿
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
    log("更新草稿成功");

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
   */
  async fetchArticleStatusCount(): Promise<{
    all: number;
    published: number;
    pending: number;
    rejected: number;
  }> {
    // 分别查询不同状态的文章数量
    const [all, published, pending, rejected] = await Promise.all([
      this.fetchUserArticles({ auditStatus: null, pageSize: 1 }),
      this.fetchUserArticles({ auditStatus: 2, pageSize: 1 }),
      this.fetchUserArticles({ auditStatus: 1, pageSize: 1 }),
      this.fetchUserArticles({ auditStatus: 3, pageSize: 1 }),
    ]);

    // 注意：掘金 API 不直接返回 total，需要通过其他方式获取
    // 这里简化处理，返回数组长度（实际可能需要调用专门的统计接口）
    return {
      all: all.length,
      published: published.length,
      pending: pending.length,
      rejected: rejected.length,
    };
  }
}

/**
 * 创建掘金 API 客户端
 */
export function createJuejinApiClient(cookiesJson: string): JuejinApiClient {
  return new JuejinApiClient(cookiesJson);
}
