# 一签 · 前后端完整项目

进入网站，签筒轻摇，百签中落下一支；可掷筊请示（圣杯确认、笑杯再掷、阴杯重摇），再选想问的方面（综合、感情、事业、学业等 12 项）解签，得到签诗、温柔解读和今天的一小步。包含收藏、重读、删除与减少动态效果支持。

## 本地运行

需要 Node.js 24 或更新版本。应用运行没有第三方依赖。

在项目根目录执行：

```sh
node --env-file-if-exists=.env backend/server.mjs
```

打开 http://127.0.0.1:3000 。Windows 也可以双击 `start-local.cmd`。没有 `.env` 或模型密钥时，后端使用百签的内置解签；动画和收藏仍完整可用。

## 接模型

1. 将 `.env.example` 复制为 `.env`。
2. 填入 `MODEL_BASE_URL`、`MODEL_API_KEY` 和 `MODEL_NAME`。
3. 重启服务。

当前适配 OpenAI-compatible `POST /chat/completions`。API 地址填 base URL（例如 `https://api.example.com/v1`），不要重复填写 `/chat/completions`。不同厂商的请求格式可能不同，接入真实模型时仍需实测。若不支持 `response_format`，设 `MODEL_JSON_MODE=false`；若要求另一种 token 字段，设 `MODEL_TOKEN_PARAMETER=max_completion_tokens`。

密钥只在后端读取，不放在前端、不打进部署镜像。不要把真实 `.env` 放进 Git 或分享压缩包。

## 目录

| 路径 | 用途 |
| --- | --- |
| `frontend/` | HTML / CSS / JS，动画、四主题选签、浏览器收藏 |
| `backend/server.mjs` | HTTP 服务、API、限流和静态页面 |
| `backend/model.mjs` | 模型适配、中文提示词、结构校验、超时 |
| `frontend/qian.js` | 前后端共用的百签签库、12 个问事方面与内置解签 |
| `frontend/readings.js` | 问事方面名称；旧版 16 条主题签仅用于迁移旧收藏 |
| `tests/` | 后端 HTTP、模型 mock、前端 DOM 流程测试 |
| `.env.example` | 环境变量模板，无真实密钥 |
| `Dockerfile` / `compose.yaml` | VPS 容器部署 |
| `deploy/` | Caddy HTTPS / 可选 systemd 服务 |
| `docs/DEPLOY.md` | 域名、Docker 与现有反向代理部署说明 |
| `docs/API.md` | 前后端和模型接口契约 |
| `dist/` | `node scripts/build.mjs` 生成的纯前端演示，用于当前私有 Sites 链接 |

VPS 应运行 `backend/server.mjs`，它直接提供 `frontend/`。不要只上传 `dist/` 来接模型：`dist/` 是独立演示模式，故意只用内置签文；它不会调用模型接口。源码的 `frontend/config.js` 默认使用同域后端。

## 测试与构建

```sh
npm install
npm test
npm run build
```

或使用 `pnpm install && pnpm test`。只有测试需要 jsdom；线上运行无需安装它。也可单独执行 `node --test tests/backend.test.mjs`，后端测试零依赖。

## 数据与边界

- 收藏只保存在浏览器 localStorage，AI 签文也保存完整文本，重读不会再次调用模型。
- 兼容旧版收藏，首次保存时迁移到 v2；清除浏览器数据会清空收藏。
- 模型仅收到主题和日期，不接收收藏或个人生辰；本站没有账号、数据库、支付或分析追踪。
- 请求超时或模型格式不合格时默认回退内置签文，并在结果注明来源。可设 `MODEL_FALLBACK=false` 改为返回错误。
- 每 IP 限流、模型并发和每小时请求上限用于单进程部署，计数在重启时清零。多副本或较大流量应改用共享限流存储，并在模型平台设置预算。
- 每次可重新摇签；「今日签」不是每天只能一次的账号系统。

动画可用系统「减少动态效果」设置跳过，也可以点「跳过动画」。签文供娱乐与自省，不预测未来。
