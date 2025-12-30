# 腾讯云开发者社区 - 草稿同步和发布文章 API 文档

## 基础信息

**Base URL**: `https://cloud.tencent.com/developer`

**通用请求头**:
```
Content-Type: application/json
Referer: https://cloud.tencent.com/developer/article/write
Cookie: qcommunity_session=xxx; uin=xxx; qcmainCSRFToken=xxx; ...
```

> ⚠️ **重要**: 不要在请求中发送 `skey` cookie，否则会导致 csrfCode 验证失败。

**URL 参数**:
- `uin`: 用户ID (如 `100024714886`)，从 Cookie 中的 `uin` 字段获取（去掉前缀 `o`）
- `csrfCode`: CSRF 校验码，见下方"csrfCode 计算说明"

---

## csrfCode 计算说明

csrfCode 是基于 `skey` cookie 使用 **djb2 哈希算法** 计算得出的值。

### 计算公式

```javascript
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & 0xffffffff; // 保持32位
  }
  return hash & 0x7fffffff; // 返回正整数
}

const csrfCode = djb2Hash(skey).toString();
```

### 重要发现

**当不发送 `skey` cookie 时，csrfCode 固定为 `5381`**（djb2 的初始值）。

腾讯云开发者社区的认证主要依赖 `qcommunity_session` cookie，而不是 `skey`。因此：
- **推荐做法**: 不发送 `skey` cookie，csrfCode 使用固定值 `5381`
- 这样可以避免 skey 过期或变化导致的 csrfCode 不匹配问题

---

## 1. 获取草稿列表

**接口**: `POST /services/ajax/column/article?action=FetchArticleDrafts&uin={uin}&csrfCode={csrfCode}`

**请求体**:
```json
{
  "action": "FetchArticleDrafts",
  "payload": {
    "pageNumber": 1,
    "pageSize": 20
  }
}
```

**响应**:
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "total": 0,
    "list": []
  }
}
```

---

## 2. 创建草稿

**接口**: `POST /services/ajax/column/article?action=CreateArticleDraft&uin={uin}&csrfCode={csrfCode}`

**请求体**:
```json
{
  "action": "CreateArticleDraft",
  "payload": {
    "articleId": 0,
    "title": "文章标题",
    "content": "Base64编码的内容",
    "plain": "Base64编码的纯文本",
    "columnIds": [],
    "tagIds": [],
    "keywords": [],
    "sourceType": 0,
    "openComment": 1,
    "focusReadTotalAfterFollowAuthor": 0,
    "closeTextLink": 0,
    "classifyIds": []
  }
}
```

**字段说明**:
| 字段 | 类型 | 说明 |
|-----|------|------|
| articleId | number | 新建为0，编辑已发布文章时为文章ID |
| title | string | 文章标题，最多80字 |
| content | string | Draft.js格式内容，经URL编码后Base64编码 |
| plain | string | 纯文本内容，经URL编码后Base64编码 |
| columnIds | number[] | 专栏ID列表 |
| tagIds | number[] | 标签ID列表 |
| keywords | string[] | 自定义关键词 |
| sourceType | number | 来源类型: 0-未选择, 1-原创, 2-转载, 3-翻译 |
| openComment | number | 开启评论: 1-是, 0-否 |
| closeTextLink | number | 关闭产品关键词自动链接: 0-否, 1-是 |

**响应**:
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "articleId": 0,
    "draftId": 252477
  }
}
```

---

## 3. 更新草稿

**接口**: `POST /services/ajax/column/article?action=UpdateArticleDraft&uin={uin}&csrfCode={csrfCode}`

**请求体**:
```json
{
  "action": "UpdateArticleDraft",
  "payload": {
    "articleId": 0,
    "draftId": 252477,
    "title": "更新后的标题",
    "content": "Base64编码的内容",
    "plain": "Base64编码的纯文本",
    "columnIds": [],
    "tagIds": [10975],
    "keywords": [],
    "sourceType": 0,
    "openComment": 1,
    "focusReadTotalAfterFollowAuthor": 0,
    "closeTextLink": 0,
    "classifyIds": []
  }
}
```

**响应**:
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "articleId": 0,
    "draftId": 252477
  }
}
```

---

## 4. 获取草稿详情

**接口**: `POST /api/article/getDraftDetail`

**请求体**:
```json
{
  "draftId": 252477
}
```

**响应**:
```json
{
  "articleId": 0,
  "classifyIds": [],
  "closeTextLink": 0,
  "columnId": 0,
  "columnIds": [],
  "content": "Draft.js格式内容",
  "createTime": 1766908956,
  "draftId": 252477,
  "focusReadTotalAfterFollowAuthor": 0,
  "isRelease": 0,
  "longtailTag": [],
  "openComment": 1,
  "pic": "",
  "plain": "纯文本内容",
  "sourceDetail": {"author":"","link":""},
  "sourceType": 0,
  "summary": "",
  "tagIds": [],
  "title": "文章标题",
  "uid": 11971894,
  "updateTime": 1766908956,
  "userSummary": "",
  "isNewArticle": false
}
```

---

## 5. 删除草稿

**接口**: `POST /services/ajax/column/article?action=DeleteArticleDraft&uin={uin}&csrfCode={csrfCode}`

**请求体**:
```json
{
  "action": "DeleteArticleDraft",
  "payload": {
    "draftId": 252477
  }
}
```

---

## 6. 搜索标签

**接口**: `POST /developer/api/tag/search`

> ⚠️ **注意**: 此接口**不需要** `uin` 和 `csrfCode` 参数，只需要 Cookie 中的 `qcommunity_session`。

**请求体**:
```json
{
  "keyword": "测试",
  "limit": 20
}
```

**响应**:
```json
[
  {
    "synonym": [],
    "tagId": 10975,
    "tagName": "测试策略"
  },
  {
    "synonym": ["wetest","ceshifuwu"],
    "tagId": 11345,
    "tagName": "测试服务"
  }
]
```

---

## 7. 发布文章

**接口**: `POST /services/ajax/column/article?action=CreateArticle&uin={uin}&csrfCode={csrfCode}`

**请求体**:
```json
{
  "action": "CreateArticle",
  "payload": {
    "columnIds": [],
    "draftId": 252477,
    "title": "文章标题",
    "content": "Base64编码的内容",
    "plain": "Base64编码的纯文本",
    "sourceType": 1,
    "sourceDetail": {},
    "tagIds": [10975],
    "picture": "",
    "keywords": []
  }
}
```

**字段说明**:
| 字段 | 类型 | 说明 |
|-----|------|------|
| draftId | number | 草稿ID（必填） |
| sourceType | number | 1-原创, 2-转载, 3-翻译（必填） |
| sourceDetail | object | 转载时需填写 `{author: "", link: ""}` |
| tagIds | number[] | 标签ID列表（至少1个） |
| picture | string | 封面图片URL（可选） |

**响应**:
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "articleId": 2609363,
    "draftId": 252477,
    "status": 0
  }
}
```

**status 状态说明**:
- `0`: 审核中
- `1`: 已发布
- `2`: 未通过

---

## 8. 设置文章（发布后调用）

**接口**: `POST /services/ajax/column/article?action=SettingArticle&uin={uin}&csrfCode={csrfCode}`

**请求体**:
```json
{
  "action": "SettingArticle",
  "payload": {
    "articleId": 2609363,
    "articleFocusRead": 0,
    "closeArticleTextLink": 0,
    "banComment": 0
  }
}
```

**字段说明**:
| 字段 | 类型 | 说明 |
|-----|------|------|
| articleFocusRead | number | 关注后阅读: 0-否, 1-是 |
| closeArticleTextLink | number | 关闭产品链接: 0-否, 1-是 |
| banComment | number | 禁止评论: 0-否, 1-是 |

---

## 9. 获取用户加入的专栏

**接口**: `POST /services/ajax/column/column?action=FetchJoinedColumns&uin={uin}&csrfCode={csrfCode}`

**请求体**:
```json
{
  "action": "FetchJoinedColumns",
  "payload": {}
}
```

---

## 10. 获取文章列表

**接口**: `POST /services/ajax/column/article?action=FetchArticles&uin={uin}&csrfCode={csrfCode}`

**请求体**:
```json
{
  "action": "FetchArticles",
  "payload": {
    "pageNumber": 1,
    "pageSize": 20,
    "status": -1
  }
}
```

**status 筛选**:
- `-1`: 全部
- `0`: 审核中
- `1`: 已发布
- `2`: 未通过
- `3`: 回收站

---

## 内容编码说明

文章内容 `content` 和 `plain` 字段需要经过以下编码:

### 编码流程
1. 内容使用 Draft.js 格式组织
2. 对内容进行 URL 编码 (`encodeURIComponent`)
3. 对 URL 编码后的内容进行 Base64 编码

### 解码流程
1. Base64 解码
2. URL 解码 (`decodeURIComponent`)
3. 解析 Draft.js 格式

### Draft.js 格式示例

**编码前**:
```
blocks|key|8marh|text|文章内容...|type|unstyled|depth|inlineStyleRanges|entityRanges|data|entityMap^0^^$0|@$1|2|3|4|5|6|7|C|8|@]|9|@]|A|$]]]|B|$]]
```

**JavaScript 编码示例**:
```javascript
function encodeContent(text) {
  // 构建 Draft.js 格式
  const draftContent = `blocks|key|${generateKey()}|text|${text}|type|unstyled|depth|inlineStyleRanges|entityRanges|data|entityMap^0^^$0|@$1|2|3|4|5|6|7|C|8|@]|9|@]|A|$]]]|B|$]]`;
  
  // URL 编码
  const urlEncoded = encodeURIComponent(draftContent);
  
  // Base64 编码
  return btoa(urlEncoded);
}

function encodePlainText(text) {
  const urlEncoded = encodeURIComponent(`"${text}"`);
  return btoa(urlEncoded);
}
```

---

## 发布流程

```
┌─────────────────┐
│  1. 创建草稿     │  CreateArticleDraft
│  获取 draftId   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. 编辑草稿     │  UpdateArticleDraft (可多次调用)
│  更新内容/标签   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. 搜索标签     │  /api/tag/search
│  获取 tagIds    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. 发布文章     │  CreateArticle
│  获取 articleId │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. 设置文章     │  SettingArticle
│  配置文章选项    │
└─────────────────┘
```

---

## 重要的 Cookie 字段

| Cookie名 | 说明 | 是否必需 | 示例 |
|---------|------|---------|------|
| `qcommunity_session` | 社区会话（**核心认证**） | ✅ 必需 | `e879b92874f2f1709d170b02281587a2a3bc3188cda2b22a9af5e8428a04f2e8` |
| `uin` | 用户ID，格式 `o{数字}` | ✅ 必需 | `o100024714886` |
| `qcmainCSRFToken` | CSRF Token | 可选 | `r1juNWDAXbl` |
| `tinyid` | 用户tinyid | 可选 | `144115352330609695` |
| `lusername` | 登录用户名（URL编码） | 可选 | `166997982%40qq.com` |
| `loginType` | 登录类型 | 可选 | `email` |
| `nick` | 用户昵称（URL编码） | 可选 | `166997982%40qq.com` |

> ⚠️ **重要**: `skey` cookie 不应发送！发送 skey 会导致服务器期望一个基于 skey 计算的 csrfCode，而不是固定值 5381。

---

## 错误码说明

| code | 说明 |
|------|------|
| 0 | 成功 |
| 1001 | 未登录 |
| 1002 | 参数错误 |
| 1003 | 权限不足 |
| 2001 | 内容不符合规范 |
| 2002 | 标题过长 |
| 2003 | 内容过短（少于140字） |

---

## 发布限制

1. **标题**: 最多80个字符
2. **内容**: 至少140个字符，最多50000个字符
3. **标签**: 至少选择1个标签，最多5个
4. **关键词**: 最多5个，每个最多20个字符
5. **封面图片**: JPG/PNG格式
6. **文章来源**: 必须选择（原创/转载/翻译）

---

## 注意事项

1. **必需 Cookie**: `qcommunity_session` 和 `uin`
2. **不要发送 `skey` Cookie**: 发送 skey 会导致 csrfCode 验证失败
3. **csrfCode 固定为 `5381`**: 当不发送 skey 时，使用 djb2 哈希的初始值
4. `uin` 参数需要去掉 Cookie 中 `uin` 字段的 `o` 前缀
5. 发布后文章会进入审核状态，审核通过后才能公开显示
6. 草稿会自动保存，可随时恢复编辑
7. 标签搜索 API (`/api/tag/search`) 不需要 uin 和 csrfCode 参数
