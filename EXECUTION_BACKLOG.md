# CDE 系统完善执行 Backlog

来源：`SYSTEM_REVIEW.md`、`IMPLEMENTATION_ROADMAP.md`

## 优先级说明

- P0：不上线不能缺。
- P1：上线后第一批业务增强。
- P2：维护、体验、性能和长期治理。

## Epic A：工程脚手架与健康检查

### A1 新增标准 Node 工程脚本

优先级：P0  
依赖：无  
涉及文件：`package.json`、`README.md`

任务：
- 新增 `package.json`。
- 增加 `dev`、`start`、`test`、`lint` 脚本。
- 固定 Node 版本建议。
- README 增加启动方式。

验收：
- 新环境执行 `npm install` 后能启动。
- `npm run start` 等价启动当前 `server.js`。
- `npm test` 即使初期只跑 smoke test，也必须存在。

### A2 增加健康检查接口

优先级：P0  
依赖：A1  
涉及文件：`server.js`

任务：
- 增加 `GET /healthz`。
- 返回 server、data store、uploads dir、exports dir、OnlyOffice config、APS config 状态。

验收：
- 未配置 OnlyOffice/APS 时显示 degraded，不影响主服务健康。
- 返回 JSON，适合部署平台探活。

### A3 配置健康页

优先级：P2  
依赖：A2  
涉及文件：`index.html`、`app.js`、`styles.css`

任务：
- 权限中心或系统设置里增加健康状态页。
- 展示 OnlyOffice、APS、存储、导出脚本状态。

验收：
- 管理员能看到缺少哪个配置。
- 普通用户不可见敏感配置值。

## Epic B：数据持久化

### B1 设计数据库 Schema

优先级：P0  
依赖：A1  
涉及文件：新增 `db/` 或 `server/` 目录、`server.js`

任务：
- 设计表：projects、users、project_members、folders、folder_permissions。
- 设计表：documents、document_versions、annotations、annotation_replies、attachments。
- 设计表：workflow_templates、workflows、workflow_steps、workflow_actions。
- 设计表：audit_logs、jobs。

验收：
- schema 覆盖当前 `data/documents.json` 所有核心字段。
- 有 migration 文件。

### B2 JSON 数据迁移脚本

优先级：P0  
依赖：B1  
涉及文件：新增 `scripts/migrate-json-store.*`

任务：
- 从 `data/documents.json` 读取旧数据。
- 写入数据库。
- 保留原 ID，避免文件引用断裂。

验收：
- 当前 demo 数据迁移后页面数据一致。
- 重复运行不会重复插入。

### B3 Repository 层替换内存数组

优先级：P0  
依赖：B1、B2  
涉及文件：`server.js` 或拆分后的 service/repository 文件

任务：
- 替换 `projects/documents/folders/workflows/users` 全局数组读写。
- 保留现有 API 响应结构。

验收：
- 页面功能不变。
- 并发上传/审批不会互相覆盖。

### B4 事务化流程推进

优先级：P0  
依赖：B3  
涉及文件：流程 service

任务：
- 流程发起、推进、撤回、自动导出状态更新放入事务。
- 失败时回滚。

验收：
- 人为制造导出失败时，workflow/document 状态一致。

## Epic C：文件存储与大文件

### C1 抽象 StorageService

优先级：P0  
依赖：A1  
涉及文件：`server.js`、新增 storage 模块

任务：
- 定义 put/get/delete/exists/signedUrl/copy 接口。
- 实现 LocalStorage adapter。
- 预留 S3/OSS/MinIO adapter。

验收：
- 上传、附件、导出都走 StorageService。
- 本地文件行为保持一致。

### C2 对象存储接入

优先级：P0  
依赖：C1  
涉及文件：storage adapter、`.env.example`

任务：
- 增加对象存储配置。
- 支持私有桶签名下载。

验收：
- 切换配置后原始文件不落本地。
- 下载仍受权限控制。

### C3 分片/断点上传

优先级：P0  
依赖：C2  
涉及文件：`app.js`、上传 API、storage adapter

任务：
- 前端按 chunk 上传。
- 后端合并或对象存储 multipart。
- 上传任务支持暂停/恢复/失败重试。

验收：
- 1GB 文件可上传。
- 中断后可续传。

## Epic D：安全基线

### D1 CSRF / Origin 校验

优先级：P0  
依赖：A1  
涉及文件：`server.js`、`app.js`

任务：
- 登录后发放 CSRF token。
- 所有非 GET API 校验 token 或 Origin。
- OnlyOffice callback 单独豁免并验证 callback token/JWT。

验收：
- 跨站 POST 被拒绝。
- 正常 UI 操作不受影响。

### D2 登录限流

优先级：P0  
依赖：B3 或临时内存实现  
涉及文件：`server.js`

任务：
- IP + 账号维度失败计数。
- 冷却时间。
- 审计失败登录。

验收：
- 连续失败后登录被短暂拒绝。
- 成功登录清理失败计数。

### D3 分享链接治理

优先级：P1  
依赖：B3  
涉及文件：`server.js`、`app.js`

任务：
- 增加过期时间、可选密码、访问日志。
- 撤销后立即失效。

验收：
- 过期链接不能下载。
- 审计能看到谁访问了分享链接。

### D4 审计不可篡改

优先级：P0  
依赖：B1  
涉及文件：audit service

任务：
- audit_logs append-only。
- 可选 hash chain。
- 禁止业务 API 修改/删除。

验收：
- 管理员也不能通过普通 API 删除审计记录。
- 导出审计报告包含 hash 校验字段。

## Epic E：测试体系

### E1 API 测试框架

优先级：P0  
依赖：A1  
涉及文件：`tests/`

任务：
- 选定测试框架。
- 启动测试 server。
- 提供测试数据 fixture。

验收：
- `npm test` 可跑通。

### E2 权限矩阵测试

优先级：P0  
依赖：E1  
涉及文件：`tests/permissions.*`

任务：
- 覆盖 guest/editor/reviewer/project_admin/super_admin。
- 覆盖文件夹权限 none/viewer/reviewer/editor/admin。
- 覆盖下载、预览、上传、删除、审批、导出。

验收：
- 越权 API 全部 403。
- 允许路径全部 2xx。

### E3 工作流状态机测试

优先级：P0  
依赖：E1  
涉及文件：`tests/workflows.*`

任务：
- 发起、提交、退回、批准、驳回、撤回。
- 多文件流程。
- 非审批人操作。

验收：
- document.status 与 workflow.status 始终一致。

### E4 文件与导出 smoke test

优先级：P0  
依赖：E1  
涉及文件：`tests/files.*`

任务：
- 上传 PDF。
- 新增批注。
- 导出审阅版。
- 权限下载校验。

验收：
- 生成文件可下载。
- 无权限用户无法下载。

## Epic F：企业集成

### F1 飞书/SSO 登录

优先级：P1  
依赖：B3、D1  
涉及文件：`server.js`、`app.js`、`.env.example`

任务：
- 接 OAuth redirect/callback。
- 绑定用户与项目成员。
- 前端启用飞书登录按钮。

验收：
- 飞书用户可登录。
- 未加入项目时看到申请/无权限状态。

### F2 组织架构同步

优先级：P1  
依赖：F1  
涉及文件：成员/权限/流程模板模块

任务：
- 同步部门、岗位、用户状态。
- 审批人选择支持组织结构。

验收：
- 离职/禁用用户不能再审批。
- 模板可按部门角色选人。

### F3 通知中心

优先级：P1  
依赖：F1、B3  
涉及文件：通知 service、app.js

任务：
- 流程发起、待审批、退回、批准、超期提醒。
- 站内 + 飞书/邮件。

验收：
- 审批人收到待办通知。
- 通知失败可重试。

### F4 待办中心

优先级：P1  
依赖：B3、F3  
涉及文件：`app.js`、workflow API

任务：
- 我的待办。
- 我发起的。
- 我处理过的。
- 超期/即将到期。

验收：
- 当前审批人进入系统即可看到待处理列表。

## Epic G：流程增强

### G1 模板版本化

优先级：P1  
依赖：B1  
涉及文件：workflow template service

任务：
- 模板修改生成新版本。
- 流程实例保存模板快照。

验收：
- 历史流程不受模板后续修改影响。

### G2 会签 / 或签

优先级：P1  
依赖：G1  
涉及文件：workflow engine、app.js

任务：
- step.mode 支持 all/any。
- UI 展示多人处理进度。

验收：
- 会签全部通过才进入下一步。
- 或签任一通过即可进入下一步。

### G3 加签 / 转签

优先级：P1  
依赖：G1  
涉及文件：workflow engine、audit

任务：
- 当前审批人可加签。
- 管理员或当前审批人可转签。

验收：
- 审计记录加签/转签来源和原因。

### G4 条件路由

优先级：P1  
依赖：G1  
涉及文件：workflow engine、template editor

任务：
- 根据文件类型、金额/字段、目录、角色进入不同节点。

验收：
- 同一模板可按条件进入不同审批路径。

## Epic H：文档能力增强

### H1 全文搜索

优先级：P1  
依赖：B3  
涉及文件：搜索 service、解析 job

任务：
- PDF 文本提取。
- Office 文本提取。
- 标签/目录/状态组合搜索。

验收：
- 搜索关键词能找到正文命中的文件。

### H2 版本对比增强

优先级：P1  
依赖：C1  
涉及文件：version compare module

任务：
- PDF 对比。
- Office 对比入口。
- APS 历史版本对比/切换。

验收：
- 用户能清楚看到两个版本差异或并排视图。

### H3 附件安全治理

优先级：P1  
依赖：C2  
涉及文件：attachment service

任务：
- 类型白名单。
- 病毒扫描接口预留。
- 敏感类型下载限制。

验收：
- 非允许类型被拒绝。
- 扫描失败文件不可下载。

### H4 报表中心

优先级：P1  
依赖：B3  
涉及文件：report service、app.js

任务：
- 流程数量。
- 平均审批时长。
- 超期率。
- 问题闭环率。

验收：
- 项目管理员能查看项目统计。

## Epic I：工程治理

### I1 拆分 `server.js`

优先级：P2  
依赖：测试体系 E1  
涉及文件：`server.js`

建议拆分：
- auth service
- project service
- document service
- workflow service
- permission service
- aps service
- onlyoffice service
- export service

验收：
- 拆分前后 API 测试全部通过。

### I2 拆分 `app.js`

优先级：P2  
依赖：测试体系 E1  
涉及文件：`app.js`

建议拆分：
- auth state/render
- file manager
- workflow board
- review workspace
- access center
- upload/task panel

验收：
- 文件显著变小，功能不回归。

### I3 拆分 `styles.css`

优先级：P2  
依赖：视觉回归截图  
涉及文件：`styles.css`

建议拆分：
- tokens
- base
- layout
- components
- views/files
- views/workflow
- views/review
- views/access

验收：
- 视觉不回归。
- 样式职责清晰。

### I4 README 与 API 文档

优先级：P2  
依赖：A1  
涉及文件：`README.md`、新增 `API.md`

任务：
- 更新已实现/未实现。
- 记录 API 路由、权限、请求/响应。

验收：
- 新人能根据文档理解系统能力和启动方式。

## 推荐执行顺序

1. A1 标准工程脚本
2. A2 健康检查接口
3. E1 API 测试框架
4. E2 权限矩阵测试
5. B1 数据库 Schema
6. B2 JSON 迁移脚本
7. B3 Repository 层替换
8. C1 StorageService
9. D1 CSRF / Origin 校验
10. D2 登录限流
11. E3 工作流状态机测试
12. C2 对象存储接入
13. P1 企业集成和流程增强
14. P2 工程拆分
