# ONLYOFFICE 运维接入说明

适用项目：`CDE文件管理系统`

适用范围：当前仓库 `/Users/zhiyuan/Desktop/docs` 的 Office 在线查看/编辑接入。

基于当前代码实现整理，供运维部署、网络放通、反向代理、联调验证使用。

## 1. 当前项目的接入方式

本项目已经完成了 ONLYOFFICE 的前后端接入骨架，链路如下：

1. 用户在前端点击 Office 文档后，浏览器打开 `/onlyoffice.html`
2. 页面向本服务请求 `GET /api/onlyoffice/documents/:docId/config`
3. 本服务返回 ONLYOFFICE Docs API 配置，其中包含：
   - `docsApiUrl = ${ONLYOFFICE_SERVER_URL}/web-apps/apps/api/documents/api.js`
   - `document.url = <当前文档下载地址>`
   - `editorConfig.callbackUrl = /api/onlyoffice/documents/:docId/callback?...`
   - `token`，当配置了 `ONLYOFFICE_JWT_SECRET` 时自动签名
4. 浏览器加载 ONLYOFFICE Document Server 的 JS，进入在线编辑器
5. 文档保存后，Document Server 通过 `callbackUrl` 回调本服务
6. 本服务收到回调后，把保存结果写成该文件的新版本

代码入口：

- 前端打开入口：[app.js](/Users/zhiyuan/Desktop/docs/app.js#L10342)
- ONLYOFFICE 页面：[onlyoffice.html](/Users/zhiyuan/Desktop/docs/onlyoffice.html)
- 配置接口：[server.js](/Users/zhiyuan/Desktop/docs/server.js#L568)
- 回调接口：[server.js](/Users/zhiyuan/Desktop/docs/server.js#L590)
- ONLYOFFICE 配置生成：[server.js](/Users/zhiyuan/Desktop/docs/server.js#L6927)
- ONLYOFFICE 回调处理：[server.js](/Users/zhiyuan/Desktop/docs/server.js#L8709)

## 2. 环境变量

本项目需要以下环境变量：

```bash
ONLYOFFICE_SERVER_URL=http://<onlyoffice-document-server>
ONLYOFFICE_PUBLIC_BASE_URL=http://<cde-app-public-origin>
ONLYOFFICE_JWT_SECRET=<your-jwt-secret>
ONLYOFFICE_DOCUMENT_URL_TTL_MS=43200000
```

说明：

- `ONLYOFFICE_SERVER_URL`
  - ONLYOFFICE Document Server 的访问地址
  - 示例：`http://10.0.10.21:8081` 或 `https://office.example.com`
- `ONLYOFFICE_PUBLIC_BASE_URL`
  - 当前 CDE 服务对 Document Server 可达的地址
  - 用于生成 `document.url` 和 `callbackUrl`
  - 示例：`http://10.0.10.20:8080` 或 `https://cde.example.com`
- `ONLYOFFICE_JWT_SECRET`
  - 如果 ONLYOFFICE 开启 JWT，这里必须和 Document Server 的 `JWT_SECRET` 保持一致
- `ONLYOFFICE_DOCUMENT_URL_TTL_MS`
  - CDE 生成给 Document Server 拉取原文件的临时签名 URL 有效期
  - 默认 `43200000`，即 12 小时；超大文件或长时间编辑场景可适当调大

代码读取位置：

- [server.js](/Users/zhiyuan/Desktop/docs/server.js#L26)
- [.env.example](/Users/zhiyuan/Desktop/docs/.env.example)

## 3. 推荐部署拓扑

推荐拓扑如下：

- `cde-app`
  - 本项目服务
  - 默认监听 `8080`
- `onlyoffice-documentserver`
  - ONLYOFFICE Document Server
  - 容器内默认监听 `80`
- `nginx / ingress`
  - 对外暴露 HTTPS
  - 同时代理 `cde-app` 和 `onlyoffice-documentserver`

建议关系：

- 浏览器可以访问 `cde-app` 和 `ONLYOFFICE_SERVER_URL`
- Document Server 必须可以访问 `ONLYOFFICE_PUBLIC_BASE_URL`
- Document Server 必须可以回调 `ONLYOFFICE_PUBLIC_BASE_URL/api/onlyoffice/.../callback`

如果 Document Server 运行在 Docker、CDE 运行在宿主机，通常可把：

```bash
ONLYOFFICE_PUBLIC_BASE_URL=http://host.docker.internal:8080
```

这也是当前代码和页面提示里已经写死的推荐方式之一。

## 4. ONLYOFFICE Document Server 部署建议

官方文档说明 Community Docker 版最低建议：

- CPU：双核 2 GHz 或更高
- RAM：4 GB 或以上
- 磁盘：40 GB 可用空间以上

参考官方 Docker 部署方式，可以先用最小命令启动：

```bash
docker run -d \
  --name onlyoffice-documentserver \
  --restart=always \
  -p 8081:80 \
  -e JWT_SECRET=<your-jwt-secret> \
  onlyoffice/documentserver
```

如果明确不启用 JWT，官方文档支持：

```bash
-e JWT_ENABLED=false
```

但当前项目建议启用 JWT，并显式指定固定的 `JWT_SECRET`，不要依赖随机生成值。

推荐把数据卷挂到宿主机：

```bash
docker run -d \
  --name onlyoffice-documentserver \
  --restart=always \
  -p 8081:80 \
  -e JWT_SECRET=<your-jwt-secret> \
  -v /data/onlyoffice/logs:/var/log/onlyoffice \
  -v /data/onlyoffice/data:/var/www/onlyoffice/Data \
  -v /data/onlyoffice/lib:/var/lib/onlyoffice \
  -v /data/onlyoffice/db:/var/lib/postgresql \
  onlyoffice/documentserver
```

原因：

- 便于升级
- 便于保留日志
- 便于排查 TLS/缓存/数据库问题

## 5. CDE 服务配置

在本项目目录创建 `.env.local`：

```bash
cp .env.example .env.local
```

填写：

```bash
ONLYOFFICE_SERVER_URL=https://office.example.com
ONLYOFFICE_PUBLIC_BASE_URL=https://cde.example.com
ONLYOFFICE_JWT_SECRET=<your-jwt-secret>
```

然后启动：

```bash
node server.js
```

默认端口：

```bash
PORT=8080
```

本项目启动时会自动读取：

- `.env.local`
- `.env`

## 6. 反向代理要求

如果前面有 Nginx / LB / Ingress，必须保证以下几点：

### 6.1 对 CDE 服务

需要保留：

- `Host`
- `X-Forwarded-Proto`
- `X-Forwarded-Host`

原因：

- 本项目在未显式配置 `ONLYOFFICE_PUBLIC_BASE_URL` 时，会使用 `X-Forwarded-Proto` 和 `X-Forwarded-Host` 推导对外地址
- 即使已经配置了 `ONLYOFFICE_PUBLIC_BASE_URL`，保留这两个头也仍然是推荐做法

当前代码位置：

- [server.js](/Users/zhiyuan/Desktop/docs/server.js#L6898)

Nginx 示例：

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### 6.2 对 ONLYOFFICE

官方明确建议在代理场景下保留：

- `X-Forwarded-Proto`
- `X-Forwarded-Host`

Nginx 示例：

```nginx
location / {
    proxy_pass http://127.0.0.1:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## 7. 当前支持的文件类型

后端识别类型：

- 文档类：`doc` `docx` `txt` `rtf` `odt` `md`
- 表格类：`xls` `xlsx` `csv` `ods`
- 演示类：`ppt` `pptx` `odp`

当前前端入口已开放的主要类型：

- `doc`
- `docx`
- `xls`
- `xlsx`
- `csv`
- `ppt`
- `pptx`

前端判断位置：

- [app.js](/Users/zhiyuan/Desktop/docs/app.js#L333)

后端判断位置：

- [server.js](/Users/zhiyuan/Desktop/docs/server.js#L6904)

## 8. 编辑权限生效规则

用户能否在 ONLYOFFICE 中进入编辑态，不只是看文档类型，还取决于当前文件权限：

- 文件必须可预览
- 文件必须是当前版本
- 用户必须具备 `onlyOfficeEdit` 权限
- 文件不能处于审批锁定状态
- 文件如果已被其他人占用，当前用户不能编辑

如果不满足，页面会自动降级为只读查看。

权限判断代码：

- [server.js](/Users/zhiyuan/Desktop/docs/server.js#L3543)
- [server.js](/Users/zhiyuan/Desktop/docs/server.js#L7769)
- [app.js](/Users/zhiyuan/Desktop/docs/app.js#L10350)

## 9. 回调保存规则

当前项目对 ONLYOFFICE 回调的处理逻辑如下：

- 仅处理 `status=2` 和 `status=6`
- 收到回调后，服务端会下载 `body.url` 指向的最新文件
- 下载成功后，把当前文档追加为新版本
- `status=2` 版本说明写为：`OnlyOffice 在线编辑保存`
- `status=6` 版本说明写为：`OnlyOffice 强制保存`
- 对重复回调做了幂等处理，避免同一内容重复生成多个版本

回调处理代码：

- [server.js](/Users/zhiyuan/Desktop/docs/server.js#L8709)

## 10. 运维联调检查项

### 10.1 基础连通

浏览器访问：

- `https://office.example.com/`
- `https://office.example.com/web-apps/apps/api/documents/api.js`

本项目健康检查：

```bash
curl http://127.0.0.1:8080/healthz
```

重点看：

- `checks.onlyOffice.configured`
- `checks.onlyOffice.serverUrlConfigured`
- `checks.onlyOffice.publicBaseUrlConfigured`
- `checks.onlyOffice.jwtConfigured`

健康检查代码：

- [server.js](/Users/zhiyuan/Desktop/docs/server.js#L8496)

### 10.2 网络方向

需要验证三条链路：

1. 浏览器 -> `ONLYOFFICE_SERVER_URL`
2. Document Server -> `ONLYOFFICE_PUBLIC_BASE_URL`
3. Document Server -> `ONLYOFFICE_PUBLIC_BASE_URL/api/onlyoffice/documents/:docId/callback`

### 10.3 功能联调

建议按以下顺序验证：

1. 登录 CDE
2. 上传一个 `xlsx` 或 `docx`
3. 点击“打开文档”
4. 编辑并保存
5. 回到文件属性，确认版本从 `V1` 变成 `V2`
6. 再保存一次相同内容，确认不会重复创建新版本

## 11. 当前版本必须让运维知道的两个前提

这部分非常重要，建议直接同步给运维和实施方。

### 11.1 原文件拉取地址使用 OnlyOffice 专用临时签名

当前代码给 ONLYOFFICE 的 `document.url` 是专用临时签名 URL：

```text
/uploads/<storedFileName>?expires=<timestamp>&signature=<hmac>&onlyoffice=1
```

该 URL 仅用于 Document Server 服务端回源拉取原文件，不复用普通用户下载链接；普通文件列表中的下载/预览签名链接仍要求 CDE 登录态。

当前代码位置：

- 文档地址生成：[server.js](/Users/zhiyuan/Desktop/docs/server.js)
- 上传文件访问控制：[server.js](/Users/zhiyuan/Desktop/docs/server.js)

这意味着：

- Document Server 不需要携带浏览器登录态即可拉取该临时签名 URL
- 运维必须保证 Document Server 所在容器/主机可以访问 `ONLYOFFICE_PUBLIC_BASE_URL`
- 若签名过期，重新打开文档会重新生成新 URL；长时间会话可调大 `ONLYOFFICE_DOCUMENT_URL_TTL_MS`

联调时建议在 Document Server 容器中执行：

```bash
curl -I "https://<cde-domain>/uploads/<storedFileName>?expires=...&signature=...&onlyoffice=1"
```

预期返回 `200`。如果返回 `403/401/timeout`，优先检查 `ONLYOFFICE_PUBLIC_BASE_URL`、反向代理和容器网络。

### 11.2 回调接口当前是公开接口，未做 JWT 回调验签

当前回调接口：

```text
POST /api/onlyoffice/documents/:docId/callback
```

它被列为公开接口，当前实现没有对回调请求额外校验 JWT 签名。

代码位置：

- 公共接口放行：[server.js](/Users/zhiyuan/Desktop/docs/server.js#L2243)
- 回调入口：[server.js](/Users/zhiyuan/Desktop/docs/server.js#L590)

这意味着：

- 当前更适合放在内网或受控网段中使用
- 生产环境建议至少增加一层保护

建议做法：

1. 仅允许 Document Server 源地址访问回调接口
2. 在 WAF / Nginx / 网关层增加 IP 白名单
3. 后续代码层补充 ONLYOFFICE 回调 JWT 验签

## 12. 推荐给运维的落地方案

如果先追求稳定可落地，建议按下面的顺序做：

1. 先部署 ONLYOFFICE Document Server，固定 `JWT_SECRET`
2. 给 CDE 配置 `ONLYOFFICE_SERVER_URL` 和 `ONLYOFFICE_PUBLIC_BASE_URL`
3. 在代理层保留 `Host`、`X-Forwarded-Proto`、`X-Forwarded-Host`
4. 放通 `Document Server -> CDE` 的回源访问，确保容器内可访问 OnlyOffice 专用临时签名 URL
5. 对 `/api/onlyoffice/.../callback` 做 Document Server 源地址白名单或网关保护
6. 完成联调后，再安排代码层补充 ONLYOFFICE 回调 JWT 验签

## 13. 官方参考文档

以下是本说明对应的官方文档：

- ONLYOFFICE Docker 安装：
  - https://helpcenter.onlyoffice.com/docs/installation/docs-community-install-docker.aspx
- ONLYOFFICE Docker 目录总览：
  - https://helpcenter.onlyoffice.com/docs/installation/community/docker
- ONLYOFFICE JWT 配置：
  - https://helpcenter.onlyoffice.com/docs/installation/docs-configure-jwt.aspx
- ONLYOFFICE 代理部署：
  - https://helpcenter.onlyoffice.com/docs/installation/docs-community-proxy.aspx
- ONLYOFFICE Docs API Config：
  - https://api.onlyoffice.com/docs/docs-api/usage-api/config/
- ONLYOFFICE Callback Handler：
  - https://api.onlyoffice.com/docs/docs-api/usage-api/callback-handler/

## 14. 交付建议

这份文档可以直接发给运维。

如果需要，我下一步可以继续补两份配套材料：

1. Nginx 完整配置样例
2. Docker Compose 版本的 ONLYOFFICE 部署文件
