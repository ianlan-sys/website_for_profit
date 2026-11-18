# VPS 与域名部署

本包已准备好部署文件。当前尚未连接你的 VPS，未修改你的 DNS，也没有配置真实模型密钥。

## 路线 A：Docker Compose + Caddy

适合一台能使用 80/443 端口的 Linux VPS。需要安装 Docker Engine 和 Compose 插件，域名已解析到 VPS。

1. 上传并解压代码到 `/opt/yiqian`（也可使用自己的目录）。压缩包根目录就是项目文件。
2. 进入目录，将 `.env.example` 复制为 `.env`。
3. 编辑 `.env`，把 `DOMAIN=your-domain.com` 改成你的实际域名，不写协议或路径。模型配置可暂时留空。
4. 在域名 DNS 添加 A 记录指向 VPS 公网 IPv4；只有 VPS 确实支持 IPv6 时才配置 AAAA。开放 TCP 80/443；UDP 443 用于可选 HTTP/3。
5. 确认已有 Nginx、Caddy、宝塔等没有占用这些端口。若已占用，使用下面路线 B，不要直接停止现有站点。
6. 在项目根目录执行：

```sh
cp .env.example .env
# 先编辑 .env，填 DOMAIN 等配置，再执行下面命令。
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app caddy
```

**已有 `.env` 时不要再运行复制命令覆盖配置。** Caddy 会根据配置域名申请 HTTPS 证书；DNS 和端口必须可达。应用端口 3000 仅在容器网络内暴露，浏览器通过同一 HTTPS 域名调用 `/api/fortune`。

访问 `https://你的域名/`；健康检查为 `https://你的域名/api/health`。

后续改模型参数后执行 `docker compose up -d --force-recreate app`。改代码后执行 `docker compose up -d --build`。查看日志不会输出密钥或模型原始响应。

Caddy 证书存在 `caddy_data` 卷中；更新时保留该卷。项目没有服务端用户数据库，收藏在访客自己的浏览器中。

## 路线 B：已有 Nginx / Caddy / 宝塔

1. 在 VPS 安装 Node.js 24 或更新版。
2. 将源码放在 `/opt/yiqian`，设置 `.env`：

```dotenv
HOST=127.0.0.1
PORT=3000
PUBLIC_ORIGIN=https://你的域名
TRUST_PROXY=true
```

3. 用专门的 `yiqian` 系统用户运行服务。`deploy/yiqian.service` 是 systemd 模板，使用前确认 Node 路径（`command -v node`）、目录和用户存在，然后安装到 `/etc/systemd/system/yiqian.service`。
4. 执行 `sudo systemctl daemon-reload` 和 `sudo systemctl enable --now yiqian`。服务由 systemd 读取 `.env`。
5. 在现有站点配置中，把该域名的整个站点（包含 `/api/`）反向代理到 `127.0.0.1:3000`。不要把 `.env`、backend 或整个项目目录设为静态根目录。

Nginx 已有 HTTPS server 中的 location 示例：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 40s;
    client_max_body_size 2k;
}
```

Caddy 已有配置示例：

```caddyfile
你的域名 {
    reverse_proxy 127.0.0.1:3000
}
```

`TRUST_PROXY=true` 只用于后端无法被公网直接访问、请求必经你控制的代理的配置。代理应覆盖或正确追加真实来源 IP。直接运行服务时保持 `TRUST_PROXY=false`。

## 路线 C：VPS 已有系统 Caddy（占用 80/443）

```sh
cp deploy/compose.host-proxy.yaml compose.override.yaml
docker compose up -d --build app          # 只启动 app，不要启动自带的 caddy
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%Y%m%d%H%M%S)
sed 's/YIQIAN_DOMAIN/你的域名/' deploy/host-caddy.caddy > /etc/caddy/yiqian.caddy
grep -q 'import /etc/caddy/yiqian.caddy' /etc/caddy/Caddyfile || echo 'import /etc/caddy/yiqian.caddy' >> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy
```

不要在此路线下执行不带 `app` 的 `docker compose up`，否则自带 caddy 会去抢 80/443。

## 域名走 Cloudflare 代理（橙色云朵）时

`deploy/Caddyfile` 已只信任 Cloudflare 官方 IP 段，并从 `CF-Connecting-IP` 取访客真实 IP，否则所有访客会共用 Cloudflare 节点 IP，触发同一个限流。

1. 首次部署时，先把 DNS 记录设为「仅 DNS」（灰色云朵），等 Caddy 签好 HTTPS 证书，`https://你的域名/api/health` 能打开。
2. 再切回「已代理」（橙色云朵），并在 Cloudflare 的 SSL/TLS 中把加密模式设为 **Full (strict)**。不要用 Flexible，否则会出现重定向循环。
3. Cloudflare IP 段偶尔更新，可对照 https://www.cloudflare.com/ips/ 检查 Caddyfile。

## 分享预览与流量统计

- 分享预览：`index.html` 的 Open Graph 标签中 `__ORIGIN__` 由服务器替换为 `PUBLIC_ORIGIN`（Docker 部署会按 DOMAIN 自动设置），配图为 `frontend/og-image.jpg`（1200×630）。WhatsApp、Telegram、Facebook、LINE 等会显示标题、简介和配图；微信普通聊天不读取这些标签，只显示链接（自定义卡片需公众号 JS-SDK）。社交平台会缓存预览，改图后可用各平台的调试工具刷新。
- 流量统计：在 Cloudflare 后台为该域名开启 Web Analytics（自动注入），CSP 已放行 `static.cloudflareinsights.com` 与 `cloudflareinsights.com`。它不使用 cookie，只统计访问量、来源和页面性能。

## 接入模型后的检查

- `/api/health` 返回 `mode: ai` 只表示已填写模型配置，不代表供应商已经连通。
- 实际点击四种主题，确认结果显示「AI 为这一刻写下的解读」。回退时会明确标记。
- 错误排查：401/403 通常需检查 API 密钥权限；404 检查 base URL；格式不支持时调整 JSON_MODE 或 TOKEN_PARAMETER。接口会隐藏供应商原始错误以免泄露配置，可临时禁用回退观察标准错误码。
- 后端最多等待 25 秒，可通过 MODEL_TIMEOUT_MS 调整（前端等待 35 秒，建议后端不要超过 30 秒）。

## 参考文档

- [Caddy 自动 HTTPS 条件](https://caddyserver.com/docs/quick-starts/https)
- [Node 环境文件参数](https://nodejs.org/api/cli.html#--env-filefile)
- [Chat Completions 接口](https://developers.openai.com/api/reference/resources/chat)

当前开发机未安装 Docker，因此容器和域名证书签发需要在你的 VPS 上验证；本地 Node 服务和模拟模型接口另有自动测试。
