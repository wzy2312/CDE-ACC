# CDE 系统完善路线图

基于 `SYSTEM_REVIEW.md`，这里给出更适合执行的阶段计划。

## Milestone 1：生产底座最小闭环

目标：把本地 Demo 变成可部署、可恢复、可测试的服务。

### M1-1 标准工程脚本

- 新增 `package.json`
- 增加 `dev` / `start` / `test` / `lint` 脚本
- 明确 Node 版本

验收：新成员 clone 后能按 README 一次启动。

### M1-2 数据库 Schema

- 设计 projects/users/project_members/folders/documents/document_versions/workflows/workflow_templates/audit_logs
- 写 migration
- 写 JSON 数据迁移脚本

验收：不再依赖 `data/documents.json` 作为主存储。

### M1-3 StorageService

- 抽象本地存储接口
- 预留 S3/OSS/MinIO 实现
- 上传、附件、导出统一走 StorageService

验收：本地和对象存储可通过配置切换。

### M1-4 安全基线

- CSRF / Origin 校验
- 登录限流
- Session 安全配置
- 分享链接过期时间

验收：常见跨站写操作和爆破场景被阻断。

### M1-5 测试骨架

- API 测试框架
- 权限矩阵测试
- 工作流状态机测试
- 上传/导出 smoke test

验收：核心 API 有自动化回归。

## Milestone 2：企业集成闭环

目标：让真实组织成员能进来、收到通知、处理待办。

### M2-1 飞书/SSO

- 接 OAuth / SSO
- 用户绑定项目成员
- 首次登录自动创建/关联用户

### M2-2 组织架构

- 部门、岗位、直属上级
- 成员选择器支持组织结构
- 审批人可按角色/部门配置

### M2-3 通知中心

- 流程发起通知
- 审批待办提醒
- 退回/批准/驳回通知
- 超期提醒

### M2-4 待办中心

- 我的待办
- 我发起的
- 我处理过的
- 超期/即将到期

## Milestone 3：流程能力增强

目标：覆盖真实企业审批复杂度。

- 会签 / 或签
- 加签 / 转签
- 条件路由
- 流程模板版本化
- 自动导出任务队列
- 审批归档包

## Milestone 4：文档能力增强

目标：提升文档管理产品竞争力。

- 全文搜索
- OCR / Office 文本提取
- 版本对比增强
- APS 历史版本联动
- 附件安全扫描
- 分享链接治理
- 报表中心

## Milestone 5：工程治理

目标：降低长期维护成本。

- 拆分 `server.js`
- 拆分 `app.js`
- 拆分 `styles.css`
- API 文档
- 性能压测
- 浏览器兼容测试
- 无障碍实测

## 推荐先做的 10 个任务

1. 建 `package.json` 和脚本。
2. 增加 `/healthz`。
3. 引入数据库 schema。
4. 写 JSON 迁移脚本。
5. 抽象 StorageService。
6. 增加 CSRF/Origin 校验。
7. 增加登录限流。
8. 建 API 测试框架。
9. 建权限矩阵测试。
10. 更新 README 当前实现状态。
