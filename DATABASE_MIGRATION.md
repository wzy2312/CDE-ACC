# CDE 数据库接入说明

更新时间：2026-04-27

本文给后端和运维使用，说明当前 CDE 文件管理系统从本地 JSON 存储迁移到数据库的接入边界、现有实现、迁移步骤和后续生产化改造点。

## 当前结论

当前系统已经具备 Repository 边界和 SQLite 验证 adapter，但生产业务仍以 `data/documents.json` 作为完整业务快照。

本次数据库接入核查结论：

- `db/schema.sql` 当前仍为 51 张表，说明中的表数量和 schema 一致。
- `scripts/migrate-json-store.js` 已覆盖工程量、模型差异、模型碰撞、施工进度、图纸预审、系统设置与项目通知相关表。
- `scripts/test-sqlite-store-repository.js` 已补充新增模型/图纸应用表的 SQLite 写入、读取、JSON 字段还原和覆盖写回验证。
- 生产数据库接入仍需补齐图纸目录、红线对比、OCR、规格书关联校验、通知读取状态，以及 P6 Calendar / TASKRSRC 资源分配明细表。

推荐后端接入策略：

1. 短期保留 JSON 作为 seed 和回滚备份。
2. 使用 `CDE_STORE_ADAPTER=sqlite` 做本地数据库回归验证。
3. 后端正式改造时，不建议继续依赖 SQLite CLI adapter，应改为 PostgreSQL 或正式 SQLite driver。
4. 先迁移核心实体，再迁移图纸应用、模型应用、通知和后台任务。
5. 流程推进、版本上传、批注保存、打印包发布等必须改为事务。

## 本地默认账号

仅用于本地验证：

```text
账号：admin@cde.local
密码：cde@123456
```

生产环境必须通过环境变量、初始化脚本或后台管理流程创建管理员账号，不允许把默认密码作为生产凭证。

## 当前存储结构

### 业务元数据

默认文件：

```text
data/documents.json
```

包含项目、用户、目录、文件、版本、批注、流程、图纸应用、模型应用、系统设置、审计日志等业务快照。

### 原始文件和导出文件

本地默认目录：

```text
data/uploads
data/exports
```

生产建议走对象存储：

```text
CDE_STORAGE_ADAPTER=s3
CDE_S3_BUCKET=<bucket>
CDE_S3_PREFIX=cde-docs
CDE_S3_ENDPOINT=<optional-minio-endpoint>
CDE_S3_REGION=us-east-1
```

对象存储中每个文件版本应独立存储，不允许覆盖原始对象。历史版本删除建议软删除，并由后台清理任务延迟清理。

### Repository 边界

已实现：

- `lib/store-repository.js`：JSON Repository。
- `lib/sqlite-store-repository.js`：SQLite CLI Repository，用于开发期迁移验证。
- `lib/store-repository-factory.js`：按环境变量选择 adapter。

统一接口：

- `ensureStore()`：初始化缺失存储。
- `read()`：读取完整业务 store。
- `write(store)`：写入完整业务 store。
- `health()`：返回存储健康状态。

当前 `server.js` 仍使用内存业务模型，Repository 负责底层快照读写。下一阶段需要把核心业务动作拆成实体级 Repository 和事务服务。

## Adapter 启动方式

默认 JSON：

```bash
CDE_STORE_ADAPTER=json npm start
```

SQLite 本地验证：

```bash
CDE_STORE_ADAPTER=sqlite CDE_SQLITE_PATH=./data/documents.db npm start
```

健康检查：

```text
GET /healthz
```

应关注返回字段：

- `store.adapter`
- `store.readable`
- `store.writable`
- `store.path`
- `storage.adapter`
- `onlyoffice.enabled`
- `aps.enabled`

## 迁移 SQL 生成

生成 seed SQL：

```bash
npm run db:migrate:json
```

默认输入：

```text
data/documents.json
```

默认输出：

```text
db/seed-from-json.sql
```

指定路径：

```bash
node scripts/migrate-json-store.js --input data/documents.json --output /tmp/cde-seed.sql
```

输出到 stdout：

```bash
npm run db:migrate:json:stdout
```

本地 SQLite 验证：

```bash
sqlite3 /tmp/cde.db < db/schema.sql
sqlite3 /tmp/cde.db < db/seed-from-json.sql
sqlite3 /tmp/cde.db "select count(*) from documents;"
```

## 当前 schema 覆盖范围

`db/schema.sql` 当前包含 51 张表，覆盖以下领域。

### 基础治理

- `schema_migrations`
- `projects`
- `users`
- `project_members`
- `folders`
- `folder_permissions`
- `audit_logs`
- `jobs`

### 文档与审阅

- `documents`
- `document_versions`
- `document_workflows`
- `annotations`
- `annotation_replies`

关键要求：

- `annotations.version_id` 必须指向具体版本，不能只关联 `document_id`。
- PDF 批注、模型 Issue、图纸预审问题复用 `annotations`，通过 `source` 和业务外键区分来源。
- 附件建议从 JSON 字段拆成 `attachments` 表，便于权限、病毒扫描和对象存储清理。

### 流程审批

- `workflow_templates`
- `workflows`

关键要求：

- 模板步骤应支持串联、并联全签、并联任一通过。
- 审批人配置必须同时支持按人员和按角色。
- `workflows.file_refs_json` 当前仍为 JSON，生产建议拆成 `workflow_files`。
- 流程推进、退回、撤回、批准归档必须事务化更新工作流、文件状态、审计日志、通知任务。

### 模型应用

- `model_geometry_extraction_tasks`
- `model_health_rulesets`
- `model_health_tasks`
- `model_health_rule_results`
- `model_health_ai_results`
- `model_health_false_positive_records`
- `quantity_takeoff_tasks`
- `quantity_property_snapshots`
- `quantity_summaries`
- `quantity_templates`
- `model_diff_tasks`
- `model_diff_snapshots`
- `model_diff_records`
- `model_diff_prop_changes`
- `model_diff_ai_summaries`
- `model_clash_runs`
- `model_clash_records`
- `model_clash_heatmaps`
- `model_clash_heatmap_cells`
- `model_clash_hotspots`
- `construction_schedule_versions`
- `construction_schedule_wbs_nodes`
- `construction_schedule_activities`
- `construction_schedule_predecessors`
- `construction_schedule_mappings`
- `construction_progress_reports`
- `construction_schedule_snapshots`
- `construction_schedule_alerts`

关键要求：

- APS URN、2D/3D viewable GUID、几何索引状态应落在文档版本或模型转换任务上。
- 工程量、健康度、差异、碰撞、4D 进度结果都应记录任务状态，支持失败重试和报告导出。
- 模型 Issue 必须保留 `dbIds`、`viewerState`、`modelUrn`、`boundModelVersion`。
- 施工进度当前已落表计划版本、WBS、Activity、逻辑关系、构件映射、实际上报、快照和预警；P6 Calendar 工作日/节假日、TASKRSRC 资源分配暂未独立拆表。
- 差异对比同文件同版本对当前通过 `idx_model_diff_tasks_file_pair` 支撑查询；“同一组合只保留最新一次任务结果”由服务层保证，PostgreSQL 并发接入时建议增加事务锁或部分唯一约束。

### 图纸智能审查

- `drawing_precheck_tasks`
- `drawing_precheck_results`
- `drawing_extraction_snapshots`
- `drawing_rule_configs`

关键要求：

- PDF 图纸以上传时声明的图纸属性为准。
- DWG 图纸通过 APS Model Derivative 转换和提取辅助信息。
- Error 未清零时可按项目门控配置阻断流程发起。
- Warning 和 AI 疑似问题应支持人工确认后放行。

### 系统设置与通知

- `system_email_settings`
- `system_ai_settings`
- `system_aps_settings`
- `project_email_notifications`

关键要求：

- AI 配置必须先测试通过才能启用。
- 邮件通知事件需要可开关、可配置接收对象和发送频率。
- APS Client Secret、AI API Key、SMTP Password 必须加密存储或托管到 secrets manager。

## 当前 JSON store 仍多出的领域

当前 `data/documents.json` 已包含一些业务数组，但 `db/schema.sql` 还未完全拆表。后端进入生产数据库前，需要补齐以下表或明确继续 JSONB 存储策略。

### 图纸目录与打印包

建议新增：

- `drawing_entries`
- `drawing_versions`
- `drawing_format_files`
- `drawing_consistency_confirmations`
- `drawing_expected_items`
- `drawing_packages`
- `drawing_package_drawings`
- `drawing_package_recipients`
- `drawing_package_exports`

当前 JSON keys：

- `drawingConsistencyConfirmations`
- `drawingExpectedItems`
- `drawingPackages`

### 图纸红线对比

建议新增：

- `drawing_redline_tasks`
- `drawing_redline_records`
- `drawing_redline_title_block_changes`
- `drawing_redline_ai_results`
- `drawing_redline_annotation_links`

当前 JSON keys：

- `drawingRedlineTasks`
- `drawingRedlineRecords`
- `drawingRedlineTitleBlockChanges`
- `drawingRedlineAiResults`
- `drawingRedlineAnnotationLinks`

### 图纸 OCR 全文检索

建议新增：

- `drawing_ocr_tasks`
- `drawing_ocr_pages`
- `drawing_ocr_blocks`
- `drawing_ocr_index_versions`
- `drawing_ocr_search_sessions`

说明：

- 精确检索建议由 PostgreSQL full text、Elasticsearch、OpenSearch 或 SQLite FTS 承接。
- 语义检索建议另建向量索引，不建议塞进普通业务表。

### 图纸与规格书关联校验

建议新增：

- `spec_entries`
- `spec_versions`
- `spec_parameters`
- `spec_dictionaries`
- `spec_drawing_links`
- `spec_check_tasks`
- `spec_check_results`
- `drawing_spec_parameters`

当前 JSON keys：

- `specEntries`
- `specVersions`
- `specParameters`
- `specDictionaries`
- `specDrawingLinks`
- `specCheckTasks`
- `specCheckResults`
- `drawingSpecParameters`

### 通知读取状态

建议新增：

- `notification_reads`

当前 JSON key：

- `notificationReads`

用于右上角通知、流程待办已读状态和用户维度消息确认。

## 生产数据库建议

### 推荐选型

优先 PostgreSQL：

- 事务能力强。
- JSONB 适合承接复杂配置。
- Full Text Search 可覆盖一部分 OCR 检索。
- 后续可通过 pgvector 承接语义检索。

本地开发可继续 SQLite：

- 适合单机验证。
- 不建议在生产承载多人并发和大文件任务。

### 建议事务边界

以下动作必须事务化：

- 用户邀请接受：用户、项目成员、审计日志、通知。
- 新建项目：项目、根目录、默认目录、成员复制、模板初始化。
- 上传新版本：版本、当前版本切换、解析任务、审阅状态重置、通知。
- 签出/签入：文件占用状态、审计日志。
- 发起流程：workflow、workflow_files、document_workflows、document status、文件锁定、通知。
- 审批推进：workflow step、document status、activity、audit、邮件/待办。
- PDF 批注保存：annotation、attachments、issue 状态、activity。
- 图纸预审生成 Issue：precheck result、annotation/issue、workflow gate override。
- 打印包发布：package、recipients、版本锁定、发布状态、受控链接。
- OnlyOffice 保存：版本、回调记录、审计日志。
- APS 转换完成：版本 APS 状态、URN、viewable GUID、几何索引任务。

### Repository 拆分建议

建议从当前完整 store Repository 拆为：

- `UserRepository`
- `ProjectRepository`
- `FolderRepository`
- `DocumentRepository`
- `VersionRepository`
- `AnnotationRepository`
- `WorkflowRepository`
- `WorkflowTemplateRepository`
- `DrawingRegisterRepository`
- `DrawingReviewRepository`
- `ModelAppRepository`
- `NotificationRepository`
- `SettingsRepository`
- `AuditLogRepository`
- `JobRepository`

业务服务层建议：

- `AuthService`
- `PermissionService`
- `DocumentService`
- `VersionService`
- `ReviewService`
- `WorkflowService`
- `DrawingAppService`
- `ModelAppService`
- `NotificationService`
- `ExportService`
- `IntegrationService`

## 环境变量

### Store

```text
CDE_STORE_ADAPTER=json | sqlite
CDE_SQLITE_PATH=./data/documents.db
```

### Storage

```text
CDE_STORAGE_ADAPTER=local | s3
CDE_S3_BUCKET=
CDE_S3_PREFIX=cde-docs
CDE_S3_ENDPOINT=
CDE_S3_REGION=us-east-1
CDE_S3_FORCE_PATH_STYLE=true
```

### Upload

```text
CDE_MAX_UPLOAD_BYTES=104857600
CDE_MAX_ATTACHMENT_BYTES=26214400
CDE_ATTACHMENT_ALLOWED_EXTENSIONS=.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.zip
CDE_ATTACHMENT_BLOCKED_EXTENSIONS=.exe,.dll,.bat,.cmd,.sh,.ps1,.js,.mjs,.vbs,.jar,.app,.dmg
```

### OnlyOffice

```text
ONLYOFFICE_SERVER_URL=
ONLYOFFICE_PUBLIC_BASE_URL=
ONLYOFFICE_JWT_SECRET=
```

### APS

```text
APS_CLIENT_ID=
APS_CLIENT_SECRET=
APS_BUCKET_KEY=
APS_BUCKET_POLICY=persistent
APS_BUCKET_REGION=US
APS_VIEWER_VERSION=7.*
APS_VIEWER_ENV=AutodeskProduction2
APS_VIEWER_API=streamingV2
```

### AI

```text
CDE_CRS_AI_ENDPOINT=
CDE_CRS_AI_API_KEY=
CDE_CRS_AI_MODEL=
CDE_CRS_AI_TIMEOUT_MS=20000
CDE_CRS_AI_BATCH_SIZE=100
```

### Email

```text
CDE_SMTP_HOST=
CDE_SMTP_PORT=587
CDE_SMTP_ENCRYPTION=starttls
CDE_SMTP_AUTH_REQUIRED=true
CDE_SMTP_USERNAME=
CDE_SMTP_PASSWORD=
CDE_SMTP_SENDER_NAME=CDE文件管理系统
CDE_SMTP_SENDER_EMAIL=system@example.com
CDE_SMTP_REPLY_TO=
CDE_SMTP_SUBJECT_PREFIX=[CDE]
```

## 自动化验证

语法检查：

```bash
npm run check
```

单元测试：

```bash
npm run test:unit
```

完整测试：

```bash
npm test
```

数据库相关重点脚本：

- `scripts/test-store-repository.js`
- `scripts/test-sqlite-store-repository.js`：覆盖核心实体、Issue 三维定位、工程量、模型差异、模型碰撞、施工进度、图纸预审、系统设置的 SQLite 往返验证。
- `scripts/test-store-dual-write.js`
- `scripts/smoke-sqlite-store.js`
- `scripts/migrate-json-store.js`

存储相关重点脚本：

- `scripts/smoke-storage.js`
- `scripts/smoke-signed-storage.js`
- `scripts/smoke-signed-export.js`

业务 smoke：

- `scripts/smoke-healthz.js`
- `scripts/smoke-api.js`
- `scripts/smoke-workflow-transaction.js`
- `scripts/smoke-auto-export-retry.js`
- `scripts/smoke-production-hardening.js`

模型/图纸应用测试：

- `scripts/test-issue-location.js`
- `scripts/test-quantity-takeoff.js`
- `scripts/test-model-clash-api.js`
- `scripts/test-model-clash-service.js`
- `scripts/test-model-health-api.js`
- `scripts/test-model-health-service.js`
- `scripts/test-quantity-takeoff-api.js`
- `scripts/test-model-diff-api.js`
- `scripts/test-model-diff-service.js`
- `scripts/test-construction-schedule-api.js`
- `scripts/test-construction-schedule-service.js`
- `scripts/test-drawing-spec-check-api.js`

## 后端落地顺序建议

1. 建 PostgreSQL schema，先覆盖当前 `db/schema.sql` 中 51 张表。
2. 补齐图纸目录、红线、OCR、规格书、通知读取状态，以及 P6 Calendar / TASKRSRC 资源分配相关表。
3. 实现实体级 Repository，不再一次性读写完整 store。
4. 将登录、项目、用户、目录、文档、版本、批注、流程迁入事务服务。
5. 将上传文件、附件和导出文件统一走 StorageService。
6. 将 APS、OCR、PDF 导出、OnlyOffice 回调全部改为 `jobs` 驱动。
7. 上线前运行 JSON 导入、双写对比、数据库 smoke、权限测试和回滚演练。

## 回滚策略

生产切换前必须保留：

- JSON 原始快照备份。
- 数据库 dump。
- 对象存储版本或备份。
- 迁移批次号。
- 数据校验报告。

建议回滚标准：

- 登录不可用。
- 文档列表数量不一致。
- 文件版本数量不一致。
- 批注/回复数量不一致。
- 流程状态不一致。
- 对象存储文件无法下载。

任何一项触发时，应停止写入新库，回滚到迁移前快照或切回只读模式排查。
