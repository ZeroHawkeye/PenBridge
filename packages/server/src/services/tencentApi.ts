/**
 * 腾讯云开发者社区 API 服务
 * 基于 HTTP API 直接调用，无需浏览器自动化
 * 使用新版 API（/developer/api/...）
 * 
 * 支持两种编辑器格式：
 * 1. Markdown 编辑器：内容用 <!--markdown-->...<!--/markdown--> 包裹
 * 2. 富文本编辑器：内容使用 ProseMirror JSON 格式
 */

// 调试日志开关
const DEBUG = true;

function log(...args: unknown[]) {
  if (DEBUG) {
    console.log("[TencentAPI]", ...args);
  }
}

// Cookie 信息接口
export interface TencentCookies {
  uin: string; // 用户ID，格式 o{数字}
  skey: string; // 登录密钥
  qcmainCSRFToken: string; // CSRF Token
  qcommunity_session: string; // 社区会话
  [key: string]: string; // 其他 cookie
}

// 草稿信息接口
export interface DraftInfo {
  draftId: number;
  articleId: number;
  title: string;
  content: string;
  plain: string;
  createTime: number;
  updateTime: number;
  tagIds: number[];
  columnIds: number[];
  sourceType: number;
  openComment: number;
}

// 草稿列表响应
export interface DraftListResponse {
  total: number;
  list: DraftInfo[];
}

// 标签信息
export interface TagInfo {
  tagId: number;
  tagName: string;
  synonym: string[];
}

// 发布文章响应
export interface PublishResponse {
  articleId: number;
  draftId: number;
  status: number; // 0-审核中, 1-已发布, 2-未通过
}

// 文章拒绝信息
export interface ArticleRejectInfo {
  auditTime: string; // 审核时间
  createTime: string; // 提交时间
  reason: string; // 拒绝原因
}

// 创作中心文章信息（包含审核状态）
export interface CreatorArticleInfo {
  articleId: number;
  title: string;
  summary: string;
  hostStatus: number; // 1-已发布(旧), 2-已提交发布, 3-未通过, 4-回收站
  status: number; // 当 hostStatus=2 时: 2-发布成功, 其他-审核中
  createTime: number;
  updateTime: number;
  publishTime?: number;
  rejectInfo?: ArticleRejectInfo; // 审核失败时包含拒绝原因
  tagIds: number[];
  tags: Array<{ tagId: number; tagName: string }>;
  commentNum: number;
  favNum: number;
  likeNum: number;
  showReadNum: number;
  sourceType: number;
  pic: string;
  userSummary: string;
  uid: number;
}

// 创作中心文章列表响应
export interface CreatorArticleListResponse {
  list: CreatorArticleInfo[];
  total: number;
}

// 文章状态统计
export interface ArticleStatusCount {
  delete: number; // 已删除
  draft: number; // 草稿
  pass: number; // 已发布
  pending: number; // 审核中
  recycle: number; // 回收站
  reject: number; // 未通过
}

// 图片上传信息
export interface ImageUploadInfo {
  bucket: string; // COS 存储桶名称
  isPrivateBucket: boolean; // 是否私有桶
  objectKey: string; // 对象存储路径
  region: string; // 地域
}

// COS 临时密钥
export interface CosTmpSecret {
  credentials: {
    TmpSecretId: string;
    TmpSecretKey: string;
    Token: string;
  };
  expiredTime: number;
  startTime: number;
}

/**
 * 腾讯云开发者社区 API 客户端（新版）
 */
export class TencentApiClient {
  private baseUrl = "https://cloud.tencent.com/developer";
  private cookies: TencentCookies;
  private cookieHeader: string;

  constructor(cookiesJson: string) {
    this.cookies = this.parseCookies(cookiesJson);
    this.cookieHeader = this.buildCookieHeader();
    log("初始化完成");
  }

  /**
   * 解析 cookies JSON 字符串
   */
  private parseCookies(cookiesJson: string): TencentCookies {
    try {
      const cookiesArray = JSON.parse(cookiesJson);
      const cookies: TencentCookies = {
        uin: "",
        skey: "",
        qcmainCSRFToken: "",
        qcommunity_session: "",
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
      .filter(([, value]) => value) // 只包含有值的 cookie
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  /**
   * 将 Markdown 内容包装为腾讯云格式
   * Markdown 编辑器使用 <!--markdown-->...<!--/markdown--> 标记
   */
  private wrapMarkdownContent(markdown: string): string {
    return `<!--markdown-->\n${markdown}\n<!--/markdown-->`;
  }

  /**
   * 提取纯文本（用于 plain 字段）
   * 移除 Markdown 语法，保留纯文本
   */
  private extractPlainText(markdown: string): string {
    return markdown
      // 移除标题标记
      .replace(/^#{1,6}\s+/gm, "")
      // 移除加粗和斜体
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // 移除链接，保留文本
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // 移除图片
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      // 移除代码块
      .replace(/```[\s\S]*?```/g, "")
      // 移除行内代码
      .replace(/`([^`]+)`/g, "$1")
      // 移除列表标记
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      // 移除引用标记
      .replace(/^>\s+/gm, "")
      // 移除分隔线
      .replace(/^[-*_]{3,}$/gm, "")
      // 移除多余空白
      .replace(/\n+/g, "")
      .replace(/\s+/g, "")
      .trim();
  }

  /**
   * 发送新版 API 请求
   */
  private async requestV2<T>(path: string, body: object): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    log("发送请求:", { url });
    log("请求体:", JSON.stringify(body).substring(0, 500));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        Cookie: this.cookieHeader,
        Referer: "https://cloud.tencent.com/developer/article/write-new",
        Origin: "https://cloud.tencent.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    
    // 尝试解析 JSON 响应
    let result: any;
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

    // 检查 HTTP 状态码或响应中的错误码
    if (!response.ok || (result.code && result.code !== 0)) {
      const errorMsg = result.msg || "未知错误";
      const errorCode = result.code || response.status;
      log("API 错误:", { errorMsg, errorCode });
      throw new Error(`${errorMsg} (code: ${errorCode})`);
    }

    return result;
  }

  // ==================== 草稿相关 API（新版）====================

  /**
   * 获取草稿列表（新版 API）
   */
  async fetchDrafts(page = 1, pageSize = 20): Promise<DraftListResponse> {
    const result = await this.requestV2<DraftListResponse>(
      "/api/article/getUserArticleDrafts",
      {
        page,
        pageSize,
        contentType: "markdown", // 使用 markdown 格式
      }
    );
    return result;
  }

  /**
   * 创建草稿（新版 API）- 使用 Markdown 格式
   */
  async createDraft(params: {
    title: string;
    content: string; // Markdown 内容
    tagIds?: number[];
    columnIds?: number[];
    sourceType?: number; // 0-未选择, 1-原创, 2-转载, 3-翻译
    openComment?: number; // 1-开启评论, 0-关闭
  }): Promise<{ articleId: number; draftId: number }> {
    const wrappedContent = this.wrapMarkdownContent(params.content);
    const plainText = this.extractPlainText(params.content);

    const result = await this.requestV2<{ draftId: number }>(
      "/api/article/addArticleDraft",
      {
        articleId: 0,
        title: params.title,
        content: wrappedContent,
        plain: plainText,
        sourceType: params.sourceType ?? 0,
        classifyIds: [],
        tagIds: params.tagIds || [],
        longtailTag: [],
        columnIds: params.columnIds || [],
        openComment: params.openComment ?? 1,
        closeTextLink: 0,
        userSummary: "",
        pic: "",
        sourceDetail: {},
        zoneName: "",
        summary: "",
      }
    );

    return { articleId: 0, draftId: result.draftId };
  }

  /**
   * 更新草稿（新版 API）- 使用 Markdown 格式
   */
  async updateDraft(params: {
    draftId: number;
    articleId?: number;
    title: string;
    content: string; // Markdown 内容
    tagIds?: number[];
    columnIds?: number[];
    sourceType?: number;
    openComment?: number;
  }): Promise<{ articleId: number; draftId: number }> {
    const wrappedContent = this.wrapMarkdownContent(params.content);
    const plainText = this.extractPlainText(params.content);

    await this.requestV2<Record<string, never>>(
      "/api/article/editArticleDraft",
      {
        draftId: params.draftId,
        articleId: params.articleId || 0,
        title: params.title,
        content: wrappedContent,
        plain: plainText,
        sourceType: params.sourceType ?? 0,
        classifyIds: [],
        tagIds: params.tagIds || [],
        longtailTag: [],
        columnIds: params.columnIds || [],
        openComment: params.openComment ?? 1,
        closeTextLink: 0,
        userSummary: "",
        pic: "",
        sourceDetail: {},
        zoneName: "",
        summary: "",
      }
    );

    return { articleId: params.articleId || 0, draftId: params.draftId };
  }

  /**
   * 删除草稿
   */
  async deleteDraft(draftId: number): Promise<void> {
    await this.requestV2("/api/article/deleteArticleDraft", { draftId });
  }

  // ==================== 标签相关 API ====================

  /**
   * 搜索标签
   */
  async searchTags(keyword: string, limit = 20): Promise<TagInfo[]> {
    // 注意：这个 API 直接返回数组，而不是 { list: [...] } 格式
    const result = await this.requestV2<TagInfo[]>(
      "/api/tag/search",
      {
        keyword,
        limit,
      }
    );
    return Array.isArray(result) ? result : [];
  }

  // ==================== 发布相关 API ====================

  /**
   * 发布文章（新版 API）- 使用 Markdown 格式
   * 注意：实际 API 路径是 /api/article/addArticle（不是 publishArticle）
   */
  async publishArticle(params: {
    draftId: number;
    title: string;
    content: string; // Markdown 内容
    sourceType: number; // 1-原创, 2-转载, 3-翻译（必填）
    tagIds: number[]; // 至少一个标签
    columnIds?: number[];
    picture?: string; // 封面图片 URL
    userSummary?: string; // 用户自定义摘要
    sourceDetail?: { author: string; link: string }; // 转载时必填
  }): Promise<PublishResponse> {
    const wrappedContent = this.wrapMarkdownContent(params.content);
    const plainText = this.extractPlainText(params.content);
    // 自动摘要：取纯文本前 200 字
    const autoSummary = plainText.substring(0, 200);

    const result = await this.requestV2<PublishResponse>(
      "/api/article/addArticle",
      {
        title: params.title,
        content: wrappedContent,
        plain: plainText,
        sourceType: params.sourceType,
        classifyIds: [],
        tagIds: params.tagIds,
        longtailTag: [],
        columnIds: params.columnIds || [],
        banComment: 0, // 0-开启评论, 1-关闭评论
        closeArticleTextLink: 0, // 0-开启产品关键词链接
        userSummary: params.userSummary || "",
        pic: params.picture || "",
        zoneName: "",
        vlogIds: [],
        summary: autoSummary,
        draftId: params.draftId,
      }
    );

    return result;
  }

  /**
   * 编辑已发布的文章（更新文章）
   * 用于更新已经发布到腾讯云的文章，避免重复发布
   */
  async editArticle(params: {
    articleId: number; // 已发布文章的ID（必填）
    draftId?: number;
    title: string;
    content: string; // Markdown 内容
    sourceType: number; // 1-原创, 2-转载, 3-翻译（必填）
    tagIds: number[]; // 至少一个标签
    columnIds?: number[];
    picture?: string; // 封面图片 URL
    userSummary?: string; // 用户自定义摘要
  }): Promise<PublishResponse> {
    const wrappedContent = this.wrapMarkdownContent(params.content);
    const plainText = this.extractPlainText(params.content);
    // 自动摘要：取纯文本前 200 字
    const autoSummary = plainText.substring(0, 200);

    const result = await this.requestV2<PublishResponse>(
      "/api/article/editArticle",
      {
        articleId: params.articleId,
        title: params.title,
        content: wrappedContent,
        plain: plainText,
        sourceType: params.sourceType,
        classifyIds: [],
        tagIds: params.tagIds,
        longtailTag: [],
        columnIds: params.columnIds || [],
        banComment: 0,
        closeArticleTextLink: 0,
        userSummary: params.userSummary || autoSummary,
        pic: params.picture || "",
        zoneName: "",
        vlogIds: [],
        summary: autoSummary,
        draftId: params.draftId || 0,
      }
    );

    return result;
  }

  // ==================== 专栏相关 API ====================

  /**
   * 获取用户加入的专栏
   */
  async fetchJoinedColumns(): Promise<
    Array<{ columnId: number; columnName: string }>
  > {
    const result = await this.requestV2<{
      list: Array<{ columnId: number; columnName: string }>;
    }>("/api/column/getJoinedColumns", {});
    return result.list || [];
  }

  // ==================== 文章管理 API ====================

  /**
   * 获取文章列表（旧版API）
   */
  async fetchArticles(params: {
    pageNumber?: number;
    pageSize?: number;
    status?: number; // -1全部, 0审核中, 1已发布, 2未通过, 3回收站
  }): Promise<{
    total: number;
    list: Array<{
      articleId: number;
      title: string;
      status: number;
      createTime: number;
      publishTime: number;
    }>;
  }> {
    const result = await this.requestV2<{
      total: number;
      list: Array<{
        articleId: number;
        title: string;
        status: number;
        createTime: number;
        publishTime: number;
      }>;
    }>("/api/article/getUserArticles", {
      page: params.pageNumber ?? 1,
      pageSize: params.pageSize ?? 20,
      status: params.status ?? -1,
    });
    return result;
  }

  /**
   * 获取创作中心文章列表（新版API，包含审核失败原因）
   * 这是创作中心使用的API，返回更详细的信息包括拒绝原因
   * 
   * hostStatus 参数说明：
   * - 作为查询参数时: 0-全部, 1-已发布, 2-审核中, 3-未通过, 4-回收站
   * - 返回数据中的 hostStatus: 0-审核中, 1-已发布, 3-未通过, 4-回收站
   */
  async fetchCreatorArticles(params: {
    hostStatus?: number; // 查询参数: 0-全部, 1-已发布, 2-审核中, 3-未通过, 4-回收站
    sortType?: string; // 排序方式: "create" | "update"
    page?: number;
    pageSize?: number;
  }): Promise<CreatorArticleListResponse> {
    const result = await this.requestV2<CreatorArticleListResponse>(
      "/api/creator/articleList",
      {
        hostStatus: params.hostStatus ?? 0,
        sortType: params.sortType ?? "create",
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      }
    );
    return result;
  }

  /**
   * 获取文章状态统计数量
   */
  async fetchArticleStatusCount(): Promise<ArticleStatusCount> {
    const result = await this.requestV2<ArticleStatusCount>(
      "/api/creator/articleListNum",
      {}
    );
    return result;
  }

  /**
   * 验证登录状态
   */
  async checkLoginStatus(): Promise<boolean> {
    try {
      // 尝试获取草稿列表来验证登录状态
      await this.fetchDrafts(1, 1);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前登录用户信息
   * 通过创作中心文章列表接口获取用户uid，再调用用户详情接口获取完整信息
   */
  async getUserSession(): Promise<{
    isLogined: boolean;
    userInfo?: {
      uid: number;
      nickname: string;
      avatarUrl: string;
      mail?: string;
      tel?: string;
      uin: string;
    };
  }> {
    log("获取用户会话信息...");
    
    try {
      // 方法1：尝试通过创作中心文章列表获取用户uid
      const articleList = await this.fetchCreatorArticles({ page: 1, pageSize: 1 });
      log("创作中心文章列表响应:", articleList);
      
      // 如果有文章，可以从文章中获取uid
      if (articleList.list && articleList.list.length > 0) {
        const uid = articleList.list[0].uid;
        if (uid) {
          // 调用用户详情接口获取完整信息
          const userDetail = await this.getUserDetail(uid);
          if (userDetail) {
            return {
              isLogined: true,
              userInfo: {
                uid: userDetail.uid,
                nickname: userDetail.nickname,
                avatarUrl: userDetail.avatarUrl,
                uin: userDetail.qcloudUin || "",
              },
            };
          }
        }
      }
      
      // 方法2：如果没有文章，则只验证登录状态（通过获取草稿列表）
      await this.fetchDrafts(1, 1);
      // 如果没有抛出异常，说明已登录，但无法获取详细用户信息
      return { isLogined: true };
    } catch (error) {
      log("获取用户会话失败:", error);
      return { isLogined: false };
    }
  }

  /**
   * 获取用户详细信息
   */
  async getUserDetail(uid: number): Promise<{
    uid: number;
    nickname: string;
    avatarUrl: string;
    qcloudUin?: string;
  } | null> {
    try {
      const result = await this.requestV2<{
        uid: number;
        nickname: string;
        avatarUrl: string;
        qcloudUin?: string;
      }>("/api/user/detail", { uid });
      return result;
    } catch (error) {
      log("获取用户详情失败:", error);
      return null;
    }
  }

  // ==================== 图片上传相关 API ====================

  /**
   * 获取图片上传信息
   * @param extension 图片扩展名，如 jpg, png, gif
   */
  async getUploadInfo(extension: string): Promise<ImageUploadInfo> {
    const result = await this.requestV2<ImageUploadInfo>(
      "/api/common/cos/upload-info",
      {
        scene: "column.article",
        extension: extension.toLowerCase().replace(".", ""),
      }
    );
    return result;
  }

  /**
   * 获取 COS 临时密钥
   * @param objectKey 对象存储路径
   * @param durationSeconds 密钥有效期（秒），默认 5400
   */
  async getTmpSecret(
    objectKey: string,
    durationSeconds = 5400
  ): Promise<CosTmpSecret> {
    const result = await this.requestV2<CosTmpSecret>(
      "/api/common/cos/tmp-secret",
      {
        objectKey,
        durationSeconds,
      }
    );
    return result;
  }

  /**
   * 上传图片到腾讯云 COS
   * @param imageBuffer 图片二进制数据
   * @param extension 图片扩展名
   * @returns 上传后的图片 URL
   */
  async uploadImage(imageBuffer: Buffer, extension: string): Promise<string> {
    // 1. 获取上传信息
    const uploadInfo = await this.getUploadInfo(extension);
    log("上传信息:", uploadInfo);

    // 2. 获取临时密钥
    const tmpSecret = await this.getTmpSecret(uploadInfo.objectKey);
    log("临时密钥获取成功");

    // 3. 生成签名并上传到 COS
    const cosUrl = `https://${uploadInfo.bucket}.cos.${uploadInfo.region}.myqcloud.com${uploadInfo.objectKey}`;

    // 生成签名
    const signTime = `${tmpSecret.startTime};${tmpSecret.expiredTime}`;
    const signature = this.generateCosSignature(
      tmpSecret.credentials.TmpSecretKey,
      "put",
      uploadInfo.objectKey,
      signTime,
      imageBuffer.length,
      uploadInfo.bucket
    );

    const authorization = `q-sign-algorithm=sha1&q-ak=${tmpSecret.credentials.TmpSecretId}&q-sign-time=${signTime}&q-key-time=${signTime}&q-header-list=content-length;host&q-url-param-list=&q-signature=${signature}`;

    // 确定 content-type
    const contentType = this.getContentType(extension);

    log("开始上传图片到 COS:", cosUrl);

    const response = await fetch(cosUrl, {
      method: "PUT",
      headers: {
        Authorization: authorization,
        "x-cos-security-token": tmpSecret.credentials.Token,
        "Content-Type": contentType,
        "Content-Length": imageBuffer.length.toString(),
        Host: `${uploadInfo.bucket}.cos.${uploadInfo.region}.myqcloud.com`,
      },
      body: new Uint8Array(imageBuffer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("COS 上传失败:", response.status, errorText);
      throw new Error(`图片上传失败: ${response.status} ${response.statusText}`);
    }

    log("图片上传成功");

    // 4. 生成访问 URL（带签名）
    const accessUrl = await this.generateSignedUrl(
      uploadInfo,
      tmpSecret
    );

    return accessUrl;
  }

  /**
   * 生成 COS 签名
   */
  private generateCosSignature(
    secretKey: string,
    method: string,
    pathname: string,
    signTime: string,
    contentLength: number,
    bucket: string
  ): string {
    const crypto = require("crypto");

    // 1. 生成 SignKey
    const signKey = crypto
      .createHmac("sha1", secretKey)
      .update(signTime)
      .digest("hex");

    // 2. 生成 HttpString
    const httpString = `${method}\n${pathname}\n\ncontent-length=${contentLength}&host=${bucket}.cos.ap-guangzhou.myqcloud.com\n`;

    // 3. 生成 StringToSign
    const sha1HttpString = crypto
      .createHash("sha1")
      .update(httpString)
      .digest("hex");
    const stringToSign = `sha1\n${signTime}\n${sha1HttpString}\n`;

    // 4. 生成 Signature
    const signature = crypto
      .createHmac("sha1", signKey)
      .update(stringToSign)
      .digest("hex");

    return signature;
  }

  /**
   * 生成带签名的访问 URL
   */
  private async generateSignedUrl(
    uploadInfo: ImageUploadInfo,
    tmpSecret: CosTmpSecret
  ): Promise<string> {
    const crypto = require("crypto");

    const signTime = `${tmpSecret.startTime};${tmpSecret.expiredTime}`;

    // 生成签名（用于 GET 访问）
    const signKey = crypto
      .createHmac("sha1", tmpSecret.credentials.TmpSecretKey)
      .update(signTime)
      .digest("hex");

    const httpString = `get\n${uploadInfo.objectKey}\n\nhost=${uploadInfo.bucket}.cos.${uploadInfo.region}.myqcloud.com\n`;

    const sha1HttpString = crypto
      .createHash("sha1")
      .update(httpString)
      .digest("hex");

    const stringToSign = `sha1\n${signTime}\n${sha1HttpString}\n`;

    const signature = crypto
      .createHmac("sha1", signKey)
      .update(stringToSign)
      .digest("hex");

    const signedUrl = `https://${uploadInfo.bucket}.cos.${uploadInfo.region}.myqcloud.com${uploadInfo.objectKey}?q-sign-algorithm=sha1&q-ak=${tmpSecret.credentials.TmpSecretId}&q-sign-time=${signTime}&q-key-time=${signTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}&x-cos-security-token=${encodeURIComponent(tmpSecret.credentials.Token)}`;

    return signedUrl;
  }

  /**
   * 根据扩展名获取 Content-Type
   */
  private getContentType(extension: string): string {
    const ext = extension.toLowerCase().replace(".", "");
    const contentTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
    };
    return contentTypes[ext] || "application/octet-stream";
  }
}

/**
 * 创建腾讯云 API 客户端
 */
export function createTencentApiClient(cookiesJson: string): TencentApiClient {
  return new TencentApiClient(cookiesJson);
}
