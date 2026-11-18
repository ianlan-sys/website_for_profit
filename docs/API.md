# API 契约

## GET /api/health

返回 `{"ok":true,"mode":"curated","version":"2.0.0"}`。mode 为 `ai` 表示服务器配置了模型，不代表已验证模型连通。此接口不返回密钥、模型名或 API 地址。

## POST /api/fortune

同域调用，Content-Type 为 application/json，body 最大 2048 字节。字段恰好为 qian 与 aspect：

```json
{"qian":37,"aspect":"work"}
```

qian 为 1–100 的整数，对应 `frontend/qian.js` 的百签签库（签名、签诗、签等、签意）。aspect 为问事方面：general（综合）、love（感情）、work（事业）、study（学业）、wealth（财富）、people（人际）、family（家庭）、wellbeing（身心）、travel（出行）、decision（抉择）、lost（迷茫）、growth（成长）。旧页面发送的 `{"topic":"love"}` 仍被接受，服务器会随机抽一支签。服务端不接收用户传入的模型地址、提示词、密钥或其他字段。

签名、签诗、签等、印由签库决定，模型只写 title、body、action、time；未配置模型或模型失败时，用签意加该方面的内置视角组成解签。

成功 200：

```json
{
  "source": "ai",
  "generatedAt": "2026-11-15T10:00:00.000Z",
  "reading": {
    "id": "ai-unique-id",
    "topic": "work",
    "qian": 37,
    "level": "上签",
    "number": "三十七",
    "name": "花开有时",
    "title": "你值得被爱，\n也值得慢慢来。",
    "poem": ["不催花开早", "自有清风来"],
    "body": ["第一段：接住感受。", "第二段：提供可选择的视角。"],
    "action": "写下一个你希望被理解的需要。",
    "time": "3 分钟",
    "seal": "心安"
  }
}
```

source 为 ai、curated（未配置模型或静态演示）、fallback（模型失败回退）。fallback 还包含 notice。reading.id、topic、number 由服务器控制，其余生成字段经过长度和结构校验。前端使用 textContent 渲染模型文字，不执行 HTML。

错误响应统一结构：

```json
{"error":{"code":"RATE_LIMITED","message":"先让这一签陪你一会儿，稍后再来。"}}
```

状态码：400 非法 JSON/主题，403 非同域请求，405 方法错误，413 body 太大，415 非 JSON，429 限流/模型繁忙，502 模型异常且关闭回退，500 内部错误。429 响应包含 Retry-After。前端不自动重试生成请求，避免重复计费。

## 模型适配

`backend/model.mjs` 的 `generateReading()` 负责调用 OpenAI-compatible API：

- 地址：MODEL_BASE_URL + `/chat/completions`
- Header：Authorization: Bearer 后端密钥
- Body：model、messages、stream:false、token 上限；可选 response_format:{type:json_object}
- 返回：choices[0].message.content 内的 JSON 字符串
- 超时、非 2xx、非法 JSON、字段不完整或超过 64 KiB 的上游返回均进入标准错误路径。
- 不把供应商原始响应或密钥发送到浏览器；不自动跟随模型 API 重定向。

若你的供应商使用 Anthropic / Gemini 原生协议或 Responses API，应替换适配器内部请求/响应转换，保持网站的 `/api/fortune` 契约不变。当前版本不声称已经兼容这些不同协议。

## 测试调用

本地服务运行后：

```sh
curl http://127.0.0.1:3000/api/health
curl -X POST http://127.0.0.1:3000/api/fortune -H 'Content-Type: application/json' -d '{"topic":"growth"}'
```
