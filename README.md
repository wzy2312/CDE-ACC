# 文档协同与审批系统可行性分析 + Demo 说明

## 1. 目标

计划建设一个围绕企业文档生命周期的协同系统，覆盖以下核心能力：

- 文档上传
- 在线查看
- 在线编辑
- PDF 批注
- 提交审批
- 多角色审批流转
- 审批留痕与状态跟踪

这类系统从业务和技术上都具备较高可行性，关键不在于“能不能做”，而在于先明确第一阶段要解决的核心场景。

## 2. 可行性结论

### 业务可行性

高。绝大多数组织都有以下真实需求：

- 合同、制度、方案、公告等文档统一管理
- 避免线下邮件和聊天工具来回传文件
- 审批过程可追溯，明确谁提交、谁审核、谁批准
- 支持不同角色的协作边界

### 技术可行性

高。可以拆成三个逐步落地的层次：

1. 最小闭环
   - 支持上传文档元数据
   - 支持 PDF 预览与批注
   - 支持状态流转和审批意见
   - 支持操作历史

2. 业务化版本
   - 接入真实登录、权限、组织架构
   - 文档版本管理
   - 附件预览
   - 流程配置
   - 消息通知

3. 企业级版本
   - 接入 Office/PDF 预览和协同编辑能力
   - 审批模板引擎
   - 印章/电子签章
   - 审计报表
   - 与 OA、IM、邮箱、知识库打通

## 3. 推荐的系统边界

建议把系统拆成 4 个模块：

### 文档中心

- 上传文件
- 分类和标签
- 文档详情
- 版本记录
- 在线预览

### 编辑协作

- 富文本或结构化文本编辑
- 草稿保存
- 变更记录
- 评论/批注

### 流程审批

- 发起审批
- 审核、驳回、批准
- 审批意见
- 状态机流转
- 待办列表

### 权限与审计

- 作者、审核人、批准人权限分层
- 操作日志
- 审批历史
- 文档生命周期追踪

## 4. 技术实现建议

### 前端

- Web 应用即可承载第一阶段需求
- 文档列表 + PDF 预览区 + 审批侧栏是最合适的交互形态

### 后端

- 适合采用标准 CRUD + 工作流状态机
- 核心模型建议包括：
  - User
  - Document
  - DocumentVersion
  - WorkflowInstance
  - WorkflowAction
  - Comment / AuditLog

### 存储

- 元数据放数据库
- 原始文件放对象存储
- 版本内容按需要分离保存

### 在线预览/编辑能力

第一阶段建议分层处理：

- 文本、Markdown、HTML：原生支持在线编辑
- PDF：优先做在线预览
- DOC / DOCX / XLS / XLSX / CSV / PPT / PPTX：通过 OnlyOffice 打开独立全屏工作台，交给专业文档引擎处理
- DWG / NWD / NWC / RVT / IFC：通过 APS Viewer 打开独立全屏模型工作台，承接模型渲染与审阅

这点很重要，因为真正难的部分不是审批流，而是复杂 Office 文档与 BIM / CAD 模型的高保真渲染、编辑与版本回写，所以更适合直接接入成熟引擎。

## 5. 主要风险与应对

### 风险 1：把“文档管理”做成“Office 全家桶”

如果一开始就要求完全兼容 Word/Excel/PPT 的在线编辑，成本会明显上升。

建议：

- 第一阶段聚焦文本类文档和审批闭环
- Office 文档交给 OnlyOffice 等成熟引擎承接
- 业务系统重点负责权限、流程、版本、留痕和归档

### 风险 2：流程设计过于灵活，导致实现复杂

如果一开始就要支持任意节点、会签、加签、转签、条件路由，会大幅增加系统复杂度。

建议：

- 第一版先支持固定三段流程：作者 -> 审核人 -> 批准人
- 第二阶段再抽象流程模板

### 风险 3：权限与留痕不完整

审批系统最怕“状态改了，但不知道谁改的”。

建议：

- 所有操作都写入审计日志
- 审批意见强制落库
- 重要动作做不可逆留痕

## 6. 分阶段建设路线

### Phase 1：MVP

- 文档上传
- 文档列表
- PDF 在线预览
- 锚点批注
- 发起审批
- 提交审批
- 审核通过 / 驳回
- 批准 / 拒绝
- 全链路操作历史

### Phase 2：业务可用版

- 登录和角色权限
- 文档分类、检索
- 版本对比
- 评论批注
- 消息通知
- 待办中心

### Phase 3：企业版

- 自定义流程
- 组织架构联动
- 电子签章
- 数据报表
- API / webhook 集成

## 7. 当前版本定位

当前目录下提供的是一个可本地运行的 Node 服务 + 前端工作台，用于验证和交付以下核心问题：

- 这条业务流程是否顺手
- 页面结构是否合理
- 文档与审批动作是否能形成闭环
- 哪些能力值得进入真实开发

### 当前版本已实现

- PDF 上传
- 本地文件持久化
- 文档列表与状态统计
- 文件夹、版本、占用 / 签出、分享等基础文件管理
- PDF 分页预览
- 画圈批注
- 标记框批注
- 文字批注
- 批注列表与已处理状态
- 文件级备注
- DOC / DOCX / XLS / XLSX / CSV / PPT / PPTX 通过 OnlyOffice 独立页面打开
- OnlyOffice 编辑保存回写为新版本
- DWG / NWD / NWC / RVT / IFC 通过 APS Viewer 独立模型工作台打开
- Autodesk.ModelStructure / Autodesk.PropertiesManager / Autodesk.Section / Autodesk.Measure 组件接入
- MarkupsCore + MarkupsGui 2D 图纸标注
- 2D / 3D 联动切换、视点保存、构件隔离 / 着色、场景状态保存
- 发起者发起流程
- 初审人退回 / 提交终审
- 终审人批准 / 驳回
- 审批活动记录
- 导出带批注和备注的 PDF 版本

### Demo 暂未实现

- 真正的多用户登录
- 内置 OnlyOffice Document Server 部署
- APS OSS 上传 / Model Derivative 自动转换流水线
- 可配置流程引擎
- 权限校验后端落地
- 协同多人同时编辑/批注
- 更精细的图形工具，例如箭头、自由线、测量标记

## 8. 如何运行 Demo

推荐使用项目脚本启动本地 Node 服务：

```bash
npm run dev
```

也可以直接运行入口文件：

```bash
node server.js
```

然后打开浏览器访问：

```text
http://localhost:8080
```

健康检查接口：

```text
http://localhost:8080/healthz
```

该接口会返回本地数据目录、上传目录、导出目录、OnlyOffice 配置和 APS 配置的状态；OnlyOffice / APS 未配置时会显示为未启用，但不影响主 Demo 启动。

基础静态检查：

```bash
npm run check
```

数据库迁移 SQL 生成：

```bash
npm run db:migrate:json
```

该命令会把当前 `data/documents.json` 转成 SQLite 可执行的 `db/seed-from-json.sql`，配合 `db/schema.sql` 用于数据库化第一阶段验证；详细说明见 `DATABASE_MIGRATION.md`。

本地 SQLite store 启动验证：

```bash
CDE_STORE_ADAPTER=sqlite CDE_SQLITE_PATH=./data/documents.db npm start
```

默认仍使用 `CDE_STORE_ADAPTER=json`，SQLite adapter 当前用于迁移验证、启动 smoke test 和读写 round-trip，对生产部署仍建议接入正式数据库驱动。

对象存储 adapter 支持 S3/MinIO 兼容服务，默认仍为本地磁盘；S3 路径已使用 AWS SDK，支持异步流式读写、multipart 上传、指数退避重试和 MinIO path-style endpoint。

```bash
CDE_STORAGE_ADAPTER=s3 \
CDE_S3_BUCKET=cde-docs \
CDE_S3_PREFIX=dev \
CDE_S3_ENDPOINT=http://127.0.0.1:9000 \
CDE_S3_REGION=us-east-1 \
CDE_S3_MULTIPART_PART_SIZE=8388608 \
CDE_S3_MULTIPART_QUEUE_SIZE=4 \
CDE_S3_RETRY_ATTEMPTS=3 \
npm start
```

可选变量：`CDE_S3_PUBLIC_BASE_URL`、`CDE_S3_UPLOADS_PREFIX`、`CDE_S3_EXPORTS_PREFIX`、`CDE_S3_ATTACHMENTS_PREFIX`、`CDE_S3_FORCE_PATH_STYLE`、`CDE_S3_RETRY_BASE_DELAY_MS`。MinIO 可继续使用 `CDE_STORAGE_ADAPTER=s3`，并把 `CDE_S3_ENDPOINT` 指向 MinIO endpoint；凭证使用 AWS SDK 默认链路，例如 `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`。

生产加固能力：

- 审计日志使用 hash chain 串联，`/healthz` 会暴露审计链校验状态。
- 批注/回复附件默认启用扩展名白名单和高风险扩展名黑名单，可通过 `CDE_ATTACHMENT_ALLOWED_EXTENSIONS` / `CDE_ATTACHMENT_BLOCKED_EXTENSIONS` 配置。
- 本地 JSON + 文件存储模式提供备份/恢复脚本：`npm run backup` 和 `npm run restore -- <backup-directory>`。
- 提供 `Dockerfile`、`docker-compose.yml` 和 GitHub Actions CI，用于生产部署基线和回归测试。

完整本地验证:

```bash
npm test
```

`npm test` 会先执行 JavaScript 语法检查，再临时启动本地服务并请求 `/healthz`，随后验证本地 StorageService 健康、上传/附件签名下载、导出文件签名下载 URL、上传与附件大小限额、API 写请求的同源 Origin / Referer 防护和登录失败限流 / 临时锁定，并验证流程动作持久化失败时的事务回滚、自动导出失败后的 job 重试，然后使用隔离数据目录跑 API 主链路 smoke test：登录、创建 PDF 文件、发起流程，覆盖撤回、批准归档、驳回修改三条审批分支，验证 editor / reviewer / guest 的文件夹权限边界，覆盖批注创建、附件回复、批注闭环、回复删除，验证多项目切换下的文档 / 文件夹 / 模板隔离，生成/下载带批注的审阅 PDF，模拟 OnlyOffice 回调保存新版本及重复回调幂等跳过，验证 APS 模型上传排队、手动 URN、视图状态保存和重试转换边界，并验证审批完成后的自动导出审批记录单；最后还会校验前端入口页面、核心静态资源、登录态和首屏数据接口是否可访问。后续可继续扩展为真实浏览器交互 / 视觉回归 / 性能基线测试。

如果需要启用 Office 在线编辑或 BIM / CAD 模型审阅，还需要额外准备外部服务并在启动前配置环境变量。

推荐做法是先复制一份配置模板：

```bash
cp .env.example .env.local
```

然后填写 `.env.local` 中的地址和密钥；`server.js` 会在启动时自动读取 `.env.local` / `.env`。也可以继续直接在命令行里传环境变量：

```bash
ONLYOFFICE_SERVER_URL=http://<onlyoffice-document-server>
ONLYOFFICE_PUBLIC_BASE_URL=http://<docs-app-public-origin>
CDE_PUBLIC_BASE_URL=http://<docs-app-public-origin>
ONLYOFFICE_JWT_SECRET=<optional-jwt-secret>
ONLYOFFICE_DOCUMENT_URL_TTL_MS=43200000
APS_CLIENT_ID=<your-aps-client-id>
APS_CLIENT_SECRET=<your-aps-client-secret>
APS_VIEWER_VERSION=7.*
APS_VIEWER_ENV=AutodeskProduction2
APS_VIEWER_API=streamingV2
CDE_SMTP_HOST=<smtp-host>
CDE_SMTP_PORT=587
CDE_SMTP_ENCRYPTION=starttls
CDE_SMTP_AUTH_REQUIRED=true
CDE_SMTP_USERNAME=<smtp-username>
CDE_SMTP_PASSWORD=<smtp-password>
CDE_SMTP_SENDER_NAME=CDE文件管理系统
CDE_SMTP_SENDER_EMAIL=<sender@example.com>
CDE_SMTP_REPLY_TO=<reply@example.com>
CDE_SMTP_SUBJECT_PREFIX=[CDE]
node server.js
```

说明：

- `ONLYOFFICE_SERVER_URL`：OnlyOffice Document Server 的访问地址
- `ONLYOFFICE_PUBLIC_BASE_URL`：当前文档系统对 Document Server 可见的公网或局域网地址
- `CDE_PUBLIC_BASE_URL`：邀请邮件、流程通知邮件中生成系统入口和邀请链接时使用的外部访问地址
- `APS_CLIENT_ID` / `APS_CLIENT_SECRET`：Autodesk Platform Services 的客户端凭证，用于模型查看 token
- `APS_VIEWER_VERSION`：APS Viewer CDN 版本，默认可使用 `7.*`
- `APS_VIEWER_ENV` / `APS_VIEWER_API`：APS Viewer 运行环境与 API 路由，默认使用 `AutodeskProduction2` / `streamingV2`
- `CDE_SMTP_*`：真实邮件发送通道配置。项目中的邀请、流程待办、退回、批注、版本上传、解析完成等事件会按项目邮件通知策略决定是否真正发信
- 项目根目录已提供 [.env.example](/Users/zhiyuan/Desktop/docs/.env.example) 作为模板
- 如果 Document Server 跑在 Docker、文档系统跑在宿主机，通常需要把 `ONLYOFFICE_PUBLIC_BASE_URL` 配成 `host.docker.internal` 或其他容器可访问地址
- APS Viewer 已接入自动转换流水线：上传 `DWG / NWD / NWC / RVT / IFC` 后，`server.js` 会自动走 APS OSS + Model Derivative，并在转换完成后回填当前文件的 `URN`
- 文件属性弹窗仍保留 APS 配置项：`URN` 支持人工覆盖，`2D GUID / 3D GUID` 仍可按需手工指定，未填写时默认由 Viewer 自动选择首个可用视图

## 9. 如果继续往下做

下一步建议优先确认这 3 件事：

1. 目标文档类型以文本类为主，还是必须深度支持 Office？
2. 审批流是否先固定，还是必须可配置？
3. 这个系统是独立应用，还是需要接入企业现有账号/组织/消息体系？

导出文件会落在：

```text
/Users/zhiyuan/Desktop/docs/data/exports
```

上传的原始 PDF 会落在：

```text
/Users/zhiyuan/Desktop/docs/data/uploads
```

后续可继续增强为：

- 接入数据库与对象存储
- 增加 CSRF / 登录限流 / 权限矩阵测试
- 支持飞书/SSO、组织架构和通知中心
- 将 APS / 导出任务改造成可恢复的后台队列
