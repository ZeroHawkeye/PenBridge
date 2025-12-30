# 掘金 API 文档

> 此文档是 PenBridge 多平台文章管理工具支持的发布渠道之一的 API 说明。

## 基础信息

**Base URL**: `https://api.juejin.cn`

**通用 URL 参数**:
- `aid`: 应用ID，固定为 `2608`
- `uuid`: 用户唯一标识，从 Cookie 中获取

**通用请求头**:
```
Content-Type: application/json
Origin: https://juejin.cn
Referer: https://juejin.cn/
x-secsdk-csrf-token: {csrf_token}
Cookie: sessionid=xxx; sessionid_ss=xxx; sid_tt=xxx; ...
```

---

## 认证方式

掘金使用 Cookie 进行身份验证，主要依赖以下 Cookie 字段：

| Cookie名 | 说明 | 是否必需 |
|---------|------|---------|
| `sessionid` | 会话ID（核心认证） | 必需 |
| `sessionid_ss` | 会话ID（安全版，SameSite=None） | 必需 |
| `sid_tt` | 会话Token | 必需 |
| `uid_tt` | 用户Token | 必需 |
| `uid_tt_ss` | 用户Token（安全版） | 必需 |
| `sid_guard` | 会话守护（包含过期信息） | 必需 |
| `sid_ucp_v1` | UCP会话Token | 必需 |
| `ssid_ucp_v1` | UCP会话Token（安全版） | 必需 |
| `csrf_session_id` | CSRF会话ID | 可选 |
| `passport_csrf_token` | Passport CSRF Token | 可选 |

**x-secsdk-csrf-token**: 从 `/user_api/v1/sys/token` 接口响应头 `x-ware-csrf-token` 中获取，格式类似：
```
0001000000012c57f3417f4e90df870a575c37d57698b18aad437b0ba9c47e1e4bc3b2d218131885e9433b218857
```

---

## Cookie 有效期与失效规则

### sid_guard 格式解析

`sid_guard` 是掘金最重要的会话信息 Cookie，包含会话有效期信息。

**格式**: `{sessionId}|{createTimestamp}|{expiresInSeconds}|{expiresDate}`

**示例**:
```
617f1167c3f940ef5d06010c91393274|1767074753|31536000|Wed,+30-Dec-2026+06:05:53+GMT
```

**字段说明**:
| 字段 | 说明 | 示例值 |
|-----|------|--------|
| sessionId | 会话ID | 617f1167c3f940ef5d06010c91393274 |
| createTimestamp | 创建时间戳（秒） | 1767074753 |
| expiresInSeconds | 有效期（秒） | 31536000 |
| expiresDate | 过期日期 | Wed, 30-Dec-2026 06:05:53 GMT |

### 有效期规则

| 项目 | 说明 |
|-----|------|
| **默认有效期** | **365 天**（31536000 秒） |
| **过期时间** | 从登录时间开始计算，一年后过期 |
| **刷新机制** | 无自动刷新，过期后需重新登录 |
| **长期登录** | 支持，一年内无需重新登录 |

### Cookie 失效场景

1. **自然过期**: Cookie 超过 365 天有效期
2. **主动登出**: 用户在掘金网站点击退出登录
3. **密码修改**: 用户修改账号密码后，旧会话失效
4. **异常检测**: 账号异常活动可能导致会话被强制失效
5. **设备清理**: 用户在账号安全设置中清理登录设备

### 长期登录建议

对于 PenBridge 应用，掘金的 **365 天有效期** 非常适合长期登录场景：

1. **首次登录**: 使用 Puppeteer 打开浏览器让用户手动登录
2. **Cookie 保存**: 登录成功后保存所有认证相关 Cookie
3. **定期检查**: 在调用 API 前检查 `sid_guard` 中的过期时间
4. **提前提醒**: 在过期前 30 天提醒用户重新登录
5. **失效处理**: API 返回未登录错误时，提示用户重新登录

### 检查登录状态

**接口**: `GET /user_api/v1/user/get?aid=2608&uuid={uuid}&not_self=0`

**判断逻辑**:
- 响应 `err_no = 0` 且返回用户信息 → 登录有效
- 响应 `err_no = 2` 或无用户信息 → 需要重新登录

### 解析 sid_guard 获取过期时间

```javascript
function parseSidGuard(sidGuard) {
  const decoded = decodeURIComponent(sidGuard);
  const parts = decoded.split('|');
  
  return {
    sessionId: parts[0],
    createTimestamp: parseInt(parts[1]),
    expiresInSeconds: parseInt(parts[2]),
    expiresDate: parts[3],
    // 计算剩余有效天数
    remainingDays: Math.floor(
      (parseInt(parts[1]) + parseInt(parts[2]) - Date.now() / 1000) / 86400
    )
  };
}
```

---

## 1. 获取分类列表

**接口**: `POST /tag_api/v1/query_category_list?aid=2608&uuid={uuid}`

**请求体**:
```json
{}
```

**响应**:
```json
{
  "err_no": 0,
  "err_msg": "success",
  "data": [
    {
      "category_id": "6809637769959178254",
      "category": {
        "category_id": "6809637769959178254",
        "category_name": "后端",
        "category_url": "backend",
        "rank": 1
      },
      "hot_tags": [...]
    }
  ]
}
```

**分类列表（固定值）**:

| category_id | category_name | category_url |
|------------|---------------|--------------|
| 6809637769959178254 | 后端 | backend |
| 6809637767543259144 | 前端 | frontend |
| 6809635626879549454 | Android | android |
| 6809635626661445640 | iOS | ios |
| 6809637773935378440 | 人工智能 | ai |
| 6809637771511070734 | 开发工具 | freebie |
| 6809637776263217160 | 代码人生 | career |
| 6809637772874219534 | 阅读 | article |

---

## 2. 搜索/获取标签列表

**接口**: `POST /tag_api/v1/query_tag_list?aid=2608&uuid={uuid}`

**请求体**:
```json
{
  "cursor": "0",
  "key_word": "前端",
  "limit": 10,
  "sort_type": 1
}
```

**字段说明**:
| 字段 | 类型 | 说明 |
|-----|------|------|
| cursor | string | 分页游标，首页为 "0" |
| key_word | string | 搜索关键词，为空则返回热门标签 |
| limit | number | 每页数量 |
| sort_type | number | 排序类型，1-热门 |

**响应**:
```json
{
  "err_no": 0,
  "err_msg": "success",
  "data": [
    {
      "tag_id": "6809640407484334093",
      "tag": {
        "tag_id": "6809640407484334093",
        "tag_name": "前端",
        "color": "#60ADFF",
        "icon": "https://...",
        "post_article_count": 668997,
        "concern_user_count": 725267
      }
    }
  ],
  "cursor": "10",
  "count": 725,
  "has_more": true
}
```

**常用标签（参考值）**:

| tag_id | tag_name |
|--------|----------|
| 6809640407484334093 | 前端 |
| 6809640408797167623 | 后端 |
| 6809640398105870343 | JavaScript |
| 6809640404791590919 | 面试 |
| 6809640369764958215 | Vue.js |
| 6809640375880253447 | GitHub |
| 6809640445233070094 | Java |
| 6809640501776482317 | 架构 |
| 6809640499062767624 | 算法 |
| 6809640394175971342 | CSS |
| 6809640357354012685 | React.js |
| 6809640361531539470 | Node.js |
| 6809640448827588622 | Python |
| 6809640366896054286 | MySQL |

---

## 3. 创建草稿

**接口**: `POST /content_api/v1/article_draft/create?aid=2608&uuid={uuid}`

**请求体**:
```json
{
  "category_id": "0",
  "tag_ids": [],
  "link_url": "",
  "cover_image": "",
  "is_gfw": 0,
  "title": "文章标题",
  "brief_content": "",
  "is_english": 0,
  "is_original": 1,
  "edit_type": 10,
  "html_content": "deprecated",
  "mark_content": "",
  "theme_ids": []
}
```

**响应**:
```json
{
  "err_no": 0,
  "err_msg": "success",
  "data": {
    "id": "7589214068093304851",
    "article_id": "0",
    "user_id": "0"
  }
}
```

---

## 4. 更新草稿

**接口**: `POST /content_api/v1/article_draft/update?aid=2608&uuid={uuid}`

**请求体**:
```json
{
  "id": "7589214068093304851",
  "category_id": "6809637767543259144",
  "tag_ids": ["6809640407484334093"],
  "link_url": "",
  "cover_image": "",
  "is_gfw": 0,
  "title": "文章标题",
  "brief_content": "文章摘要（必填，最多100字）",
  "is_english": 0,
  "is_original": 1,
  "edit_type": 10,
  "html_content": "deprecated",
  "mark_content": "# Markdown 正文内容\n\n这里是文章正文...",
  "theme_ids": [],
  "pics": []
}
```

**字段说明**:
| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| id | string | 是 | 草稿ID |
| category_id | string | 是* | 分类ID（发布时必填） |
| tag_ids | string[] | 是* | 标签ID列表（发布时必填，最多3个） |
| title | string | 是 | 文章标题 |
| brief_content | string | 是* | 文章摘要（发布时必填，最多100字） |
| mark_content | string | 是 | Markdown 格式正文 |
| cover_image | string | 否 | 封面图片URL |
| is_original | number | 是 | 是否原创：1-原创，0-非原创 |
| edit_type | number | 是 | 编辑类型：10-Markdown |
| theme_ids | string[] | 否 | 创作话题ID列表（最多1个） |
| link_url | string | 否 | 外链URL |
| is_gfw | number | 否 | 是否GFW内容 |
| is_english | number | 否 | 是否英文：0-中文，1-英文 |

**响应**:
```json
{
  "err_no": 0,
  "err_msg": "success",
  "data": {
    "id": "7589214068093304851",
    "article_id": "0",
    "user_id": "0",
    "category_id": "6809637767543259144",
    "tag_ids": [6809640407484334093],
    "title": "文章标题",
    "brief_content": "文章摘要",
    "mark_content": "# Markdown 正文内容..."
  }
}
```

---

## 5. 获取草稿详情

**接口**: `POST /content_api/v1/article_draft/detail?aid=2608&uuid={uuid}`

**请求体**:
```json
{
  "draft_id": "7589214068093304851"
}
```

**响应**:
```json
{
  "err_no": 0,
  "err_msg": "success",
  "data": {
    "draft_id": "7589214068093304851",
    "article_draft": {
      "id": "7589214068093304851",
      "article_id": "0",
      "user_id": "3936688253970536",
      "category_id": "6809637767543259144",
      "tag_ids": [6809640407484334093],
      "title": "文章标题",
      "brief_content": "文章摘要",
      "mark_content": "# Markdown 正文内容...",
      "is_original": 1,
      "edit_type": 10,
      "status": 0
    }
  }
}
```

---

## 6. 发布文章

**接口**: `POST /content_api/v1/article/publish?aid=2608&uuid={uuid}`

**请求体**:
```json
{
  "draft_id": "7589214068093304851",
  "sync_to_org": false,
  "column_ids": [],
  "theme_ids": []
}
```

**字段说明**:
| 字段 | 类型 | 说明 |
|-----|------|------|
| draft_id | string | 草稿ID（必填） |
| sync_to_org | boolean | 是否同步到组织 |
| column_ids | string[] | 专栏ID列表 |
| theme_ids | string[] | 话题ID列表 |

**响应**:
```json
{
  "err_no": 0,
  "err_msg": "success",
  "data": {
    "article_id": "7351581179017543714",
    "draft_id": "7589214068093304851"
  }
}
```

---

## 7. 获取用户文章列表

**接口**: `POST /content_api/v1/article/list_by_user?aid=2608&uuid={uuid}`

**请求体**:
```json
{
  "audit_status": null,
  "keyword": "",
  "page_size": 10,
  "page_no": 1
}
```

**audit_status 筛选**:
- `null`: 全部
- `2`: 已发布
- `1`: 审核中
- `3`: 未通过

**响应**:
```json
{
  "err_no": 0,
  "err_msg": "success",
  "data": [
    {
      "article_id": "7351581179017543714",
      "article_info": {
        "article_id": "7351581179017543714",
        "title": "文章标题",
        "brief_content": "摘要",
        "view_count": 63,
        "digg_count": 0,
        "comment_count": 0,
        "collect_count": 0,
        "status": 1,
        "audit_status": 2,
        "ctime": "1711702580",
        "mtime": "1711702631"
      }
    }
  ]
}
```

---

## 8. 获取文章详情

**接口**: `POST /content_api/v1/article/detail?aid=2608&uuid={uuid}`

**请求体**:
```json
{
  "article_id": "7351581179017543714"
}
```

---

## 9. 获取创作话题列表

**接口**: `POST /tag_api/v1/theme/list_by_hot?aid=2608&uuid={uuid}`

**请求体**:
```json
{
  "cursor": "0",
  "limit": 20
}
```

---

## 10. 获取用户专栏列表

**接口**: `POST /content_api/v1/column/self_center_list?aid=2608&uuid={uuid}`

**请求体**:
```json
{
  "audit_status": 2,
  "cursor": "0",
  "keyword": "",
  "limit": 20
}
```

---

## 11. 图片上传

**接口**: `POST /content_api/v1/upload/article_pic?aid=2608&uuid={uuid}`

**请求类型**: `multipart/form-data`

**请求体**:
- `file`: 图片文件

**响应**:
```json
{
  "err_no": 0,
  "err_msg": "success",
  "data": {
    "url": "https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/xxx.png"
  }
}
```

---

## 发布流程

```
┌─────────────────┐
│  1. 创建草稿     │  article_draft/create
│  获取 draft_id  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. 获取分类     │  query_category_list
│  选择 category  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. 搜索标签     │  query_tag_list
│  选择 tag_ids   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. 更新草稿     │  article_draft/update
│  填写必填信息    │
│  - category_id  │
│  - tag_ids      │
│  - brief_content│
│  - mark_content │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. 发布文章     │  article/publish
│  获取 article_id│
└─────────────────┘
```

---

## 发布必填项

发布文章时，以下字段必须填写：

| 字段 | 说明 | 限制 |
|-----|------|------|
| title | 文章标题 | 不能为空 |
| category_id | 分类ID | 必须从分类列表中选择 |
| tag_ids | 标签ID列表 | 至少1个，最多3个 |
| brief_content | 文章摘要 | 不能为空，最多100字 |
| mark_content | 文章正文 | 不能为空，建议至少400字 |

---

## 文章状态说明

**status 状态**:
- `0`: 草稿
- `1`: 已发布

**audit_status 审核状态**:
- `1`: 审核中
- `2`: 审核通过（已发布）
- `3`: 审核未通过

---

## 错误码说明

| err_no | 说明 |
|--------|------|
| 0 | 成功 |
| 1 | 参数错误 |
| 2 | 未登录 |
| 403 | 权限不足 |

---

## 注意事项

1. **认证 Cookie**: 登录后获取的 `sessionid`、`sessionid_ss`、`sid_tt`、`sid_guard` 等是核心认证凭证
2. **Cookie 有效期**: 默认 **365 天**，适合长期登录场景，无需频繁重新登录
3. **CSRF Token**: 请求头需要携带 `x-secsdk-csrf-token`，可从 `/user_api/v1/sys/token` 获取
4. **UUID**: 从 Cookie 中的 `__tea_cookie_tokens_2608` 解析获取 `user_unique_id`
5. **内容格式**: 文章正文使用 Markdown 格式
6. **分类和标签**: 发布时必须选择分类和至少一个标签
7. **摘要**: 发布时必须填写摘要，最多100字
8. **审核**: 发布后文章会进入审核状态，审核通过后才能公开显示
9. **字数限制**: 建议文章正文至少400字以获得更好的推荐
10. **登录状态检查**: 建议在调用 API 前先检查 `sid_guard` 的过期时间，提前提醒用户续期

---

## 编辑器页面 URL

- **新建文章**: `https://juejin.cn/editor/drafts/new?v=2`
- **编辑草稿**: `https://juejin.cn/editor/drafts/{draft_id}`
- **文章详情**: `https://juejin.cn/post/{article_id}`
- **创作者中心**: `https://juejin.cn/creator/home`
