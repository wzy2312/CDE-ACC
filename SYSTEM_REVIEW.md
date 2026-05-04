# CDE 文档协同与审批系统 — 完整系统审查报告

生成时间：2026-04-24
审查范围：当前目录下本地 Web Demo、Node 假后端、PDF/Office/APS 工作台、导出脚本与本地数据目录。

## 1. 总体结论

当前系统已经具备较完整的产品原型能力：文档中心、目录管理、版本管理、PDF 审阅、审批流、权限中心、OnlyOffice 打开链路、APS Viewer 工作台、导出与基础审计都已经接起来。

但它仍然更接近“功能型原型 + 本地可运行后端”，距离生产可上线系统还差一层基础设施、企业集成、安全加固、测试运维和高级业务闭环。

### 量化判断

| 维度 | 当前判断 |
|---|---:|
| Demo 完整度 | 约 75% |
| 生产可用度 | 约 45% |
| 待完善项总数 | 47 项 |
| P0 上线阻塞 | 14 项 |
| P1 业务增强 | 18 项 |
| P2 维护体验 | 15 项 |

### 代码规模

| 文件 | 行数 | 说明 |
|---|---:|---|
| `server.js` | 8,549 | 本地后端、权限、流程、文件、OnlyOffice、APS、导出 |
| `app.js` | 15,626 | 主工作台前端逻辑 |
| `apsviewer.js` | 1,775 | APS Viewer 独立工作台 |
| `styles.css` | 8,683 | 主系统样式与 UI 优化 |
| `index.html` | 1,874 | 主工作台页面结构 |

## 2. 当前已实现能力校准

README 中部分“暂未实现”已经被当前代码追上，因此本报告以代码现状为准。

### 已确认实现

- 登录、登出、Session、密码哈希、项目切换。
- 项目、成员、邀请、角色、目录权限、访客策略、审计日志。
- 文件上传、目录管理、批量操作、版本管理、占用/签出、分享链接。
- PDF 预览、批注、附件、回复、备注、导出批注版 PDF。
- 流程模板、流程发起、多文件流程、审批动作、撤回、自动导出配置。
- OnlyOffice 配置与回调保存链路。
- APS Viewer 配置、自动转换调度、2D/3D 工作台、标注、视点、构件操作。
- UI 已做多轮视觉、响应式、可访问性优化。

### README 需要更新的点

README 的“Demo 暂未实现”仍写着：

- 可配置流程引擎
- 权限校验后端落地
- APS OSS 上传 / Model Derivative 自动转换流水线

但代码中已经存在这些能力的基础实现。它们现在的问题不是“没有”，而是“不够生产级”。

## 3. P0 上线阻塞项（14 项）

### P0-01 数据库替代 JSON 存储

**现状：** 核心数据保存在 `data/documents.json`，由 `persistStore()` 写入。

**影响：** 并发写入、数据恢复、迁移、查询性能、审计可信度都不满足生产要求。

**涉及文件：** `server.js`

**建议：** 引入 PostgreSQL 或 SQLite/PostgreSQL 双模式，设计 projects、documents、versions、folders、workflows、users、permissions、audit_logs 等表。

**验收标准：**
- 所有核心实体从数据库读写。
- 有初始化 migration。
- 并发发起流程/上传文件不会覆盖数据。
- 旧 JSON 数据可迁移。

### P0-02 对象存储替代本地文件

**当前进展：** 已新增 `LocalStorageService` / bucket 抽象，上传文件、附件、受保护下载、hash、删除和 APS 上传读取已通过 storage service 访问；`/healthz` 返回 storage adapter 与 uploads/exports/attachments bucket 状态；上传、附件和导出文件 URL 已带 HMAC 过期签名，未签名或过期链接会被拒绝，分享链接继续使用 share token 兼容；已补 `CDE_STORAGE_ADAPTER=s3` 的 S3/MinIO 兼容 adapter，基于 AWS SDK 支持 bucket/prefix/endpoint/region、异步流式读写、multipart 上传和指数退避重试；新增 `scripts/smoke-storage.js` 覆盖 storage 健康和受保护上传下载，`scripts/smoke-signed-storage.js` 覆盖上传/附件签名下载，`scripts/smoke-signed-export.js` 覆盖签名导出下载，`scripts/test-storage-service.js` 覆盖 local 与 S3 骨架配置。

**现状：** 默认仍使用本地磁盘 adapter；S3/MinIO adapter 已具备 SDK、流式读写、multipart 和重试基础能力，后续生产化重点转向真实对象存储环境联调、凭证轮换、生命周期策略、审计日志和跨区域备份。

**影响：** 多实例部署、备份、权限隔离、大文件、生命周期管理都受限。

**建议：** 抽象 StorageService，支持本地和 S3/OSS/MinIO。

**验收标准：**
- 上传文件、附件、导出文件可切换存储后端。
- 下载 URL 有权限校验和过期签名。
- 删除版本/附件后对象存储同步清理。

### P0-03 事务一致性

**当前进展：** 已新增内存 store 事务边界，流程发起与流程动作在事务内延迟持久化；持久化失败时会回滚 `projects/documents/folders/workflows/users/permissions/auditLogs/jobs` 快照，避免接口失败后内存状态半更新。新增 `scripts/smoke-workflow-transaction.js` 通过故障注入覆盖流程动作持久化失败回滚；新增 JSON `jobs` outbox、自动导出 job 记录和 `/api/workflows/:id/auto-export/retry` 重试入口，`scripts/smoke-auto-export-retry.js` 覆盖审批记录单导出失败后重试成功。

**现状：** 流程、文档、导出、活动记录会跨多个对象更新；当前已覆盖流程发起/推进的基础事务边界和自动导出失败重试，后续仍需数据库事务、异步 worker 和多实例 job 锁。

**影响：** 任一步失败可能造成文档状态和流程状态不一致。

**建议：** 数据库事务 + 幂等任务；对 APS/导出等外部动作使用 outbox/job 表。

**验收标准：**
- 流程推进失败不会产生半更新状态。
- 自动导出失败可重试。
- 文档状态可从 workflow 重建或校验。

### P0-04 CSRF 防护

**当前进展：** 已为所有 `/api/` 非 GET/HEAD/OPTIONS 请求增加同源 Origin / Referer 校验，OnlyOffice 服务端回调保留豁免；新增 `scripts/smoke-csrf.js` 覆盖同源允许、跨站拒绝和回调不被误拦。

**现状：** 使用 Cookie Session，当前已有严格 Origin / Referer 校验；后续如需更强防护，可继续补 CSRF token。

**影响：** 登录用户可能被跨站请求触发写操作。

**建议：** 对所有非 GET API 增加 CSRF token 或 Origin/Referer 校验。

**验收标准：**
- 无 token 的跨站 POST/PATCH/DELETE 被拒绝。
- OnlyOffice callback 等公开入口有单独白名单策略。

### P0-05 登录防爆破

**当前进展：** 已增加账号 + IP 维度的登录失败计数、时间窗口、临时锁定和 `Retry-After` 响应头；新增 `scripts/smoke-login-rate-limit.js` 覆盖连续错误密码触发锁定、锁定期正确密码仍拒绝、其他账号不受影响。

**现状：** 有密码哈希，当前已具备基础失败次数限制和临时锁定；后续生产化可接入 Redis / WAF 做多实例共享限流。

**影响：** 默认账号和弱密码容易被撞库/爆破。

**建议：** 增加账号级、IP 级限流，失败冷却，管理员解锁。

**验收标准：**
- 连续失败登录触发冷却。
- 日志记录失败来源。
- 管理员可重置锁定。

### P0-06 审计不可篡改

**当前进展：** `auditLogs` 已追加 hash chain：每条记录包含 `previousHash` 和 `hash`，`/healthz` 会校验链完整性并在被篡改时降级；新增生产加固 smoke 覆盖审计链健康。

**现状：** 本地 JSON 模式已具备篡改检测；生产数据库仍建议把审计表设为 append-only，并同步外部日志系统/WORM 存储。

**建议：** 审计日志独立表、append-only、hash chain 或外部日志系统。

**验收标准：**
- 审计记录不可通过普通业务 API 修改/删除。
- 关键动作都有 actor、resource、before/after、IP、时间。
- 可导出审计报告。

### P0-07 部署方案

**当前进展：** 已新增 `Dockerfile`、`docker-compose.yml`（app + MinIO）、容器 `HEALTHCHECK`、`.env.example` 基线和 GitHub Actions CI。

**现状：** 已具备本地容器化部署基线；生产仍需按实际域名/TLS/反向代理/密钥管理替换默认配置。

**建议：** Dockerfile、docker-compose、健康检查、环境变量模板、反向代理示例。

**验收标准：**
- 一条命令可启动 app + DB + object storage。
- `/healthz` 返回关键依赖状态。
- README 有生产部署步骤。

### P0-08 测试体系

**当前进展：** 已建立 `npm test`，覆盖语法检查、storage、SQLite store、CSRF、登录限流、事务回滚、自动导出重试、上传限额、生产加固、权限边界、批注附件、项目隔离、导出、OnlyOffice、APS 和前端静态烟测；已新增 GitHub Actions CI。

**现状：** P0 API 已有 smoke/单元覆盖；后续仍可增加真实浏览器 E2E、视觉回归和性能基线。

**建议：** 最少补 API 权限测试、工作流状态机测试、文件上传测试、前端烟测。

**验收标准：**
- `npm test` 或等效命令可运行。
- 覆盖 P0 API。
- CI 可阻止破坏性变更。

### P0-09 大文件上传能力

**当前进展：** 已新增显式上传保护：`CDE_MAX_UPLOAD_BYTES` 控制文档/新版本最大字节数，`CDE_MAX_ATTACHMENT_BYTES` 控制批注/回复附件最大字节数，超限请求返回 `413`；`scripts/smoke-upload-limits.js` 覆盖超大文档、正常小文件和超大附件三条路径。

**现状：** 当前具备明确服务端大小边界，避免无限制 base64 落盘；但目标 2GB 仍未实现，受 JSON body/base64 和本地 adapter 限制，不适合作为大文件生产上传方案。

**建议：** 分片上传、断点续传、后端流式处理、对象存储 multipart。

**验收标准：**
- 1GB 文件可上传。
- 网络中断后可续传。
- 进度和失败原因清晰。

### P0-10 OnlyOffice 生产部署

**现状：** 链路已接，依赖外部 Document Server 配置。

**建议：** 提供 OnlyOffice Compose 示例、JWT 校验、回调地址健康检查。

**验收标准：**
- 新环境按文档可打开 DOCX/XLSX/PPTX。
- 编辑保存回写为新版本。
- JWT 开启后回调仍正常。

### P0-11 APS 生产凭证与任务恢复

**现状：** APS 上传和转换调度存在，但依赖凭证、bucket 和网络稳定性。

**建议：** Job 表持久化、失败重试、manifest poll 恢复、凭证健康检查。

**验收标准：**
- 服务重启后 queued/running APS 任务可恢复。
- 转换失败显示可读错误并可重试。
- bucket 初始化可观测。

### P0-12 备份恢复策略

**当前进展：** 已新增 `npm run backup` / `npm run restore -- <backup-directory>`，可备份/恢复 JSON store 与本地 uploads/exports/attachments；生产加固 smoke 已覆盖备份脚本。

**现状：** 本地模式具备基础备份恢复；S3/MinIO 生产部署仍需开启 bucket versioning/lifecycle，数据库模式需补 PITR/快照策略。

**建议：** 数据库定时备份、对象存储版本化、项目级导出包。

**验收标准：**
- 可恢复到指定时间点。
- 可恢复单个误删文件/版本。

### P0-13 错误监控与任务告警

**当前进展：** `/healthz` 已纳入 store/storage/audit/脚本依赖状态；自动导出失败已落 job 并可重试；生产加固 smoke 覆盖审计和备份。

**现状：** 已具备本地可观测基础；生产仍建议接入 Sentry/OpenTelemetry、集中日志、告警渠道和 job dashboard。

**建议：** JSON log、request id、job id、Sentry/OpenTelemetry 可选接入。

**验收标准：**
- 任一失败导出/APS/上传有可追踪 id。
- 后台任务失败可在 UI 或日志中定位。

### P0-14 权限回归测试

**现状：** 权限模型已实现，但缺少系统性测试。

**建议：** 建立角色 x 文件夹权限 x 文档状态 x API 的测试矩阵。

**验收标准：**
- guest/editor/reviewer/project_admin/super_admin 的 API 权限有自动化覆盖。
- 分享链接、导出链接、附件链接不能越权访问。

## 4. P1 业务增强项（18 项）

1. 飞书 / 企业 SSO 接入。
2. 组织架构同步：部门、岗位、上级、角色组。
3. 待办中心深化：我的待办、我发起、我处理、抄送我、超期。
4. 邮件/飞书/站内通知推送。
5. 高级流程：会签、或签、加签、转签、条件路由。
6. 流程模板版本化。
7. 自动导出队列化和失败重试。
8. 版本对比增强：Office、CAD/BIM、PDF 差异。
9. APS 历史版本联动。
10. Office 协同冲突策略。
11. 分享链接治理：过期、密码、访问日志、撤销即时失效。
12. 全文搜索：PDF/Office/OCR/标签组合。
13. 附件安全治理：白名单、病毒扫描、敏感文件控制。
14. 报表中心：流程效率、逾期、问题闭环、导出统计。
15. 项目模板包：目录、流程、权限、导出规则。
16. 权限可视化预览。
17. 移动端能力边界定义。
18. 国际化全量审核。

## 5. P2 维护与体验项（15 项）

1. 拆分 `app.js`。
2. 拆分 `server.js`。
3. 拆分 `styles.css`。
4. 更新 README，修正过期“暂未实现”。
5. 生成 API 文档。
6. 配置健康页。
7. 后台任务中心。
8. 批量操作失败明细。
9. PDF 大文件性能优化。
10. APS 大模型性能压测。
11. 导出异步化。
12. 无障碍实测。
13. 浏览器兼容测试。
14. 数据清理策略。
15. 标准开发脚本：`package.json`、dev/test/lint。

## 6. 建议实施路线

### 阶段 1：生产底座

目标：让系统具备可部署、可恢复、可测试、可观测的基础。

建议包含：数据库、对象存储、部署、CSRF、防爆破、日志、测试骨架。

### 阶段 2：企业集成

目标：让真实组织能用。

建议包含：SSO、组织架构、通知、权限回归测试、审计导出。

### 阶段 3：流程增强

目标：让审批适配真实企业流程。

建议包含：高级流程、待办中心、模板版本化、自动导出队列。

### 阶段 4：文档能力增强

目标：提升文档管理竞争力。

建议包含：全文搜索、版本对比、分享治理、附件安全、报表中心。

### 阶段 5：工程治理

目标：降低长期维护成本。

建议包含：拆文件、拆样式、API 文档、性能压测、兼容测试。

## 7. 第一批推荐任务（最小生产化闭环）

如果只做第一批，建议先做下面 10 个任务：

1. 建立 `package.json` 和标准 dev/test/lint 脚本。
2. 引入数据库 schema 和 migration。
3. 抽象 StorageService。
4. 增加 CSRF / Origin 校验。
5. 增加登录限流。
6. 增加 API 权限测试矩阵。
7. 增加 `/healthz` 配置健康接口。
8. 把 APS/导出改为持久化 job。
9. 更新 README 当前实现状态。
10. 给 OnlyOffice + APS 写本地部署说明。
