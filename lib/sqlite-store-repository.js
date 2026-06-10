const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { buildSeedSql } = require("../scripts/migrate-json-store");

const DEFAULT_SCHEMA_PATH = path.join(__dirname, "..", "db", "schema.sql");

function sqliteValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function boolFromSqlite(value) {
  return Number(value || 0) ? true : false;
}

function runSqliteJsonQuery(dbPath, sql) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-sqlite-json-"));
  const outputPath = path.join(tempDir, "output.json");
  let fd;

  try {
    fd = fs.openSync(outputPath, "w");
    const result = spawnSync("sqlite3", ["-json", dbPath, sql], {
      stdio: ["ignore", fd, "pipe"],
      encoding: "utf8",
    });
    fs.closeSync(fd);
    fd = null;

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const stderr = sqliteValue(result.stderr).trim();
      throw new Error(`sqlite3 query failed with status ${result.status}${stderr ? `: ${stderr}` : ""}`);
    }

    const output = fs.readFileSync(outputPath, "utf8").trim();
    return output ? JSON.parse(output) : [];
  } finally {
    if (fd !== null && fd !== undefined) {
      fs.closeSync(fd);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function readTable(dbPath, tableName) {
  return runSqliteJsonQuery(dbPath, `SELECT * FROM ${tableName};`);
}

function readTableColumns(dbPath, tableName) {
  return runSqliteJsonQuery(dbPath, `PRAGMA table_info(${tableName});`).map((row) => sqliteValue(row.name));
}

class SQLiteStoreRepository {
  constructor({ dbPath, schemaPath = DEFAULT_SCHEMA_PATH, seedStore }) {
    if (!dbPath) {
      throw new Error("dbPath is required");
    }
    if (typeof seedStore !== "function") {
      throw new Error("seedStore function is required");
    }
    this.dbPath = dbPath;
    this.schemaPath = schemaPath;
    this.seedStore = seedStore;
  }

  ensureStore() {
    if (!this.sqliteAvailable()) {
      throw new Error("sqlite3 CLI is required for SQLiteStoreRepository");
    }

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const created = !fs.existsSync(this.dbPath);
    execFileSync("sqlite3", [this.dbPath], {
      input: fs.readFileSync(this.schemaPath, "utf8"),
      encoding: "utf8",
    });
    this.ensureSchemaCompatibility();

    if (created) {
      this.write(this.seedStore());
    }

    return created;
  }

  sqliteAvailable() {
    try {
      execFileSync("sqlite3", ["--version"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  ensureSchemaCompatibility() {
    this.ensureColumns("documents", {
      drawing_metadata_json: "TEXT NOT NULL DEFAULT '{}'",
    });
    this.ensureColumns("annotations", {
      viewer_state_json: "TEXT NOT NULL DEFAULT '{}'",
      dbids_json: "TEXT NOT NULL DEFAULT '[]'",
      model_urn: "TEXT NOT NULL DEFAULT ''",
      sheet_guid: "TEXT NOT NULL DEFAULT ''",
      element_unique_id: "TEXT NOT NULL DEFAULT ''",
      element_id: "TEXT NOT NULL DEFAULT ''",
      bound_model_version: "TEXT NOT NULL DEFAULT ''",
      migration_status: "TEXT NOT NULL DEFAULT 'synced'",
      precheck_task_id: "TEXT NOT NULL DEFAULT ''",
      precheck_result_id: "TEXT NOT NULL DEFAULT ''",
      precheck_level: "TEXT NOT NULL DEFAULT ''",
      precheck_category: "TEXT NOT NULL DEFAULT ''",
      source: "TEXT NOT NULL DEFAULT ''",
    });
    this.ensureColumns("workflows", {
      health_gate_overrides_json: "TEXT NOT NULL DEFAULT '[]'",
    });
    this.ensureColumns("audit_logs", {
      previous_hash: "TEXT NOT NULL DEFAULT ''",
      hash: "TEXT NOT NULL DEFAULT ''",
    });
  }

  ensureColumns(tableName, columns) {
    const existing = new Set(readTableColumns(this.dbPath, tableName));
    Object.entries(columns).forEach(([columnName, definition]) => {
      if (existing.has(columnName)) {
        return;
      }
      execFileSync("sqlite3", [this.dbPath, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`], {
        encoding: "utf8",
      });
    });
  }

  read() {
    this.ensureStore();
    const projects = readTable(this.dbPath, "projects").map((row) => ({
      id: sqliteValue(row.id),
      name: sqliteValue(row.name),
      code: sqliteValue(row.code),
      description: sqliteValue(row.description),
      folderPolicyKey: sqliteValue(row.folder_policy_key),
      memberInitMode: sqliteValue(row.member_init_mode),
      memberSourceProjectId: sqliteValue(row.member_source_project_id),
      templateInitMode: sqliteValue(row.template_init_mode),
      templateSourceProjectId: sqliteValue(row.template_source_project_id),
      createdBy: sqliteValue(row.created_by),
      guestPolicy: parseJson(row.guest_policy_json, {}),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const users = readTable(this.dbPath, "users").map((row) => ({
      id: sqliteValue(row.id),
      name: sqliteValue(row.name),
      email: sqliteValue(row.email),
      avatarUrl: sqliteValue(row.avatar_url),
      status: sqliteValue(row.status),
      platformRole: sqliteValue(row.platform_role),
      passwordSalt: sqliteValue(row.password_salt),
      passwordHash: sqliteValue(row.password_hash),
      mustChangePassword: boolFromSqlite(row.must_change_password),
      passwordUpdatedAt: sqliteValue(row.password_updated_at),
      lastLoginAt: sqliteValue(row.last_login_at),
      invitedAt: sqliteValue(row.invited_at),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const projectMembers = readTable(this.dbPath, "project_members").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      userId: sqliteValue(row.user_id),
      role: sqliteValue(row.role),
      invitedBy: sqliteValue(row.invited_by),
      invitedAt: sqliteValue(row.invited_at),
      inviteToken: sqliteValue(row.invite_token),
      inviteExpiresAt: sqliteValue(row.invite_expires_at),
      inviteAcceptedAt: sqliteValue(row.invite_accepted_at),
      joinedAt: sqliteValue(row.joined_at),
      removedAt: sqliteValue(row.removed_at),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const folders = readTable(this.dbPath, "folders").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      parentId: sqliteValue(row.parent_id) || null,
      policyKey: sqliteValue(row.policy_key),
      name: sqliteValue(row.name),
      owner: sqliteValue(row.owner),
      accessLevel: sqliteValue(row.access_level),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const folderPermissions = readTable(this.dbPath, "folder_permissions").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      folderId: sqliteValue(row.folder_id),
      userId: sqliteValue(row.user_id),
      permission: sqliteValue(row.permission),
      setBy: sqliteValue(row.set_by),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const versionsByDocument = new Map();
    readTable(this.dbPath, "document_versions").forEach((row) => {
      const documentId = sqliteValue(row.document_id);
      const versions = versionsByDocument.get(documentId) || [];
      versions.push({
        id: sqliteValue(row.id),
        version: sqliteValue(row.version_label),
        versionNo: Number(row.version_no || 0),
        name: sqliteValue(row.name),
        storedFileName: sqliteValue(row.stored_file_name),
        size: Number(row.size || 0),
        mimeType: sqliteValue(row.mime_type),
        uploadedAt: sqliteValue(row.uploaded_at),
        uploadedById: sqliteValue(row.uploaded_by_id),
        uploadedBy: sqliteValue(row.uploaded_by),
        note: sqliteValue(row.note),
        parseStatus: sqliteValue(row.parse_status),
        parseReadyAt: sqliteValue(row.parse_ready_at),
        isCurrent: boolFromSqlite(row.is_current),
        deletedAt: sqliteValue(row.deleted_at),
        deletedBy: sqliteValue(row.deleted_by),
        share: parseJson(row.share_json, {}),
      });
      versionsByDocument.set(documentId, versions);
    });

    const workflowIdsByDocument = new Map();
    readTable(this.dbPath, "document_workflows").forEach((row) => {
      const documentId = sqliteValue(row.document_id);
      const workflowIds = workflowIdsByDocument.get(documentId) || [];
      workflowIds.push(sqliteValue(row.workflow_id));
      workflowIdsByDocument.set(documentId, workflowIds);
    });

    const repliesByAnnotation = new Map();
    readTable(this.dbPath, "annotation_replies").forEach((row) => {
      const annotationId = sqliteValue(row.annotation_id);
      const replies = repliesByAnnotation.get(annotationId) || [];
      replies.push({
        id: sqliteValue(row.id),
        actor: sqliteValue(row.actor),
        content: sqliteValue(row.content),
        createdAt: sqliteValue(row.created_at),
        attachments: parseJson(row.attachments_json, []),
      });
      repliesByAnnotation.set(annotationId, replies);
    });

    const annotationsByDocument = new Map();
    readTable(this.dbPath, "annotations").forEach((row) => {
      const documentId = sqliteValue(row.document_id);
      const annotations = annotationsByDocument.get(documentId) || [];
      annotations.push({
        id: sqliteValue(row.id),
        versionId: sqliteValue(row.version_id),
        type: sqliteValue(row.type),
        variant: sqliteValue(row.variant),
        page: Number(row.page || 1),
        x: Number(row.x || 0),
        y: Number(row.y || 0),
        width: Number(row.width || 0),
        height: Number(row.height || 0),
        points: parseJson(row.points_json, []),
        title: sqliteValue(row.title),
        note: sqliteValue(row.note),
        actor: sqliteValue(row.actor),
        color: sqliteValue(row.color),
        status: sqliteValue(row.status),
        resolved: boolFromSqlite(row.resolved),
        resolvedAt: row.resolved_at || null,
        createdAt: sqliteValue(row.created_at),
        replies: repliesByAnnotation.get(sqliteValue(row.id)) || [],
        attachments: parseJson(row.attachments_json, []),
        viewerState: parseJson(row.viewer_state_json, null),
        dbIds: parseJson(row.dbids_json, []),
        modelUrn: sqliteValue(row.model_urn),
        sheetGuid: sqliteValue(row.sheet_guid),
        elementUniqueId: sqliteValue(row.element_unique_id),
        elementId: sqliteValue(row.element_id),
        boundModelVersion: sqliteValue(row.bound_model_version),
        migrationStatus: sqliteValue(row.migration_status),
        precheckTaskId: sqliteValue(row.precheck_task_id),
        precheckResultId: sqliteValue(row.precheck_result_id),
        precheckLevel: sqliteValue(row.precheck_level),
        precheckCategory: sqliteValue(row.precheck_category),
        source: sqliteValue(row.source),
      });
      annotationsByDocument.set(documentId, annotations);
    });

    const documents = readTable(this.dbPath, "documents").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      name: sqliteValue(row.name),
      parentId: sqliteValue(row.folder_id) || null,
      currentVersionId: sqliteValue(row.current_version_id),
      parseStatus: sqliteValue(row.parse_status),
      parseReadyAt: sqliteValue(row.parse_ready_at),
      storedFileName: sqliteValue(row.stored_file_name),
      size: Number(row.size || 0),
      version: sqliteValue(row.version_label),
      status: sqliteValue(row.status),
      workflowName: sqliteValue(row.workflow_name),
      initiator: sqliteValue(row.initiator),
      reviewer: sqliteValue(row.reviewer),
      approver: sqliteValue(row.approver),
      dueDate: sqliteValue(row.due_date),
      uploadedAt: sqliteValue(row.uploaded_at),
      updatedAt: sqliteValue(row.updated_at),
      uploaderId: sqliteValue(row.uploader_id),
      uploader: sqliteValue(row.uploader),
      owner: sqliteValue(row.owner),
      mimeType: sqliteValue(row.mime_type),
      isPdf: boolFromSqlite(row.is_pdf),
      accessLevel: sqliteValue(row.access_level),
      downloadScope: sqliteValue(row.download_scope),
      watermarkEnabled: boolFromSqlite(row.watermark_enabled),
      checkedOutBy: sqliteValue(row.checked_out_by),
      checkedOutAt: sqliteValue(row.checked_out_at),
      checkedOut: Boolean(sqliteValue(row.checked_out_by)),
      locked: Boolean(sqliteValue(row.checked_out_by)),
      activeWorkflowId: sqliteValue(row.active_workflow_id),
      workflowIds: workflowIdsByDocument.get(sqliteValue(row.id)) || [],
      share: parseJson(row.share_json, {}),
      drawingMetadata: parseJson(row.drawing_metadata_json, {}),
      versionHistory: versionsByDocument.get(sqliteValue(row.id)) || [],
      aps: parseJson(row.aps_json, {}),
      remarks: sqliteValue(row.remarks),
      annotations: annotationsByDocument.get(sqliteValue(row.id)) || [],
      activity: parseJson(row.activity_json, []),
      lastExportFileName: sqliteValue(row.last_export_file_name),
    }));

    const workflowTemplates = readTable(this.dbPath, "workflow_templates").map((row) => ({
      id: sqliteValue(row.id),
      category: sqliteValue(row.category),
      projectId: sqliteValue(row.project_id),
      projectName: sqliteValue(row.project_name),
      name: sqliteValue(row.name),
      description: sqliteValue(row.description),
      enabled: boolFromSqlite(row.enabled),
      allowedRoles: parseJson(row.allowed_roles_json, []),
      autoExport: parseJson(row.auto_export_json, {}),
      steps: parseJson(row.steps_json, []),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
      createdBy: sqliteValue(row.created_by),
    }));

    const workflows = readTable(this.dbPath, "workflows").map((row) => ({
      id: sqliteValue(row.id),
      workflowName: sqliteValue(row.workflow_name),
      templateId: sqliteValue(row.template_id),
      templateName: sqliteValue(row.template_name),
      templateCategory: sqliteValue(row.template_category),
      projectId: sqliteValue(row.project_id),
      projectName: sqliteValue(row.project_name),
      initiator: sqliteValue(row.initiator),
      initiatorUserId: sqliteValue(row.initiator_user_id),
      description: sqliteValue(row.description),
      dueDate: sqliteValue(row.due_date),
      status: sqliteValue(row.status),
      currentStepIndex: Number(row.current_step_index || 0),
      steps: parseJson(row.steps_json, []),
      fileRefs: parseJson(row.file_refs_json, []),
      activity: parseJson(row.activity_json, []),
      autoExport: parseJson(row.auto_export_json, {}),
      healthGateOverrides: parseJson(row.health_gate_overrides_json, []),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const auditLogs = readTable(this.dbPath, "audit_logs").map((row) => ({
      id: sqliteValue(row.id),
      userId: sqliteValue(row.user_id),
      projectId: sqliteValue(row.project_id),
      action: sqliteValue(row.action),
      resourceType: sqliteValue(row.resource_type),
      resourceId: sqliteValue(row.resource_id),
      detail: parseJson(row.detail_json, {}),
      ip: sqliteValue(row.ip),
      createdAt: sqliteValue(row.created_at),
      previousHash: sqliteValue(row.previous_hash),
      hash: sqliteValue(row.hash),
    }));

    const jobs = readTable(this.dbPath, "jobs").map((row) => ({
      id: sqliteValue(row.id),
      type: sqliteValue(row.type),
      status: sqliteValue(row.status),
      resourceType: sqliteValue(row.resource_type),
      resourceId: sqliteValue(row.resource_id),
      payload: parseJson(row.payload_json, {}),
      error: sqliteValue(row.error),
      attempts: Number(row.attempts || 0),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const quantityTakeoffTasks = readTable(this.dbPath, "quantity_takeoff_tasks").map((row) => ({
      id: sqliteValue(row.id),
      documentId: sqliteValue(row.document_id),
      projectId: sqliteValue(row.project_id),
      modelUrn: sqliteValue(row.model_urn),
      versionId: sqliteValue(row.version_id),
      version: sqliteValue(row.version_label),
      status: sqliteValue(row.status),
      config: parseJson(row.config_json, {}),
      createdBy: sqliteValue(row.created_by),
      error: sqliteValue(row.error),
      snapshotCount: Number(row.snapshot_count || 0),
      summaryCount: Number(row.summary_count || 0),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
      completedAt: sqliteValue(row.completed_at),
    }));

    const modelGeometryExtractionTasks = readTable(this.dbPath, "model_geometry_extraction_tasks").map((row) => ({
      id: sqliteValue(row.id),
      documentId: sqliteValue(row.document_id),
      projectId: sqliteValue(row.project_id),
      versionId: sqliteValue(row.version_id),
      modelUrn: sqliteValue(row.model_urn),
      source: sqliteValue(row.source),
      status: sqliteValue(row.status),
      parserVersion: sqliteValue(row.parser_version),
      derivativeUrn: sqliteValue(row.derivative_urn),
      indexedCount: Number(row.indexed_count || 0),
      meshCount: Number(row.mesh_count || 0),
      warnings: parseJson(row.warnings_json, []),
      summary: parseJson(row.summary_json, {}),
      error: sqliteValue(row.error),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
      completedAt: sqliteValue(row.completed_at),
    }));

    const modelHealthRulesets = readTable(this.dbPath, "model_health_rulesets").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      discipline: sqliteValue(row.discipline),
      name: sqliteValue(row.name),
      description: sqliteValue(row.description),
      rules: parseJson(row.rules_json, {}),
      gateConfig: parseJson(row.gate_config_json, {}),
      version: sqliteValue(row.version),
      builtIn: boolFromSqlite(row.built_in),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const modelHealthTasks = readTable(this.dbPath, "model_health_tasks").map((row) => ({
      id: sqliteValue(row.id),
      fileId: sqliteValue(row.file_id),
      projectId: sqliteValue(row.project_id),
      fileName: sqliteValue(row.file_name),
      versionId: sqliteValue(row.version_id),
      version: sqliteValue(row.version_label),
      rulesetId: sqliteValue(row.ruleset_id),
      status: sqliteValue(row.status),
      score: Number(row.score || 0),
      summary: parseJson(row.summary_json, {}),
      report: parseJson(row.report_json, null),
      gate: parseJson(row.gate_json, {}),
      triggeredBy: sqliteValue(row.triggered_by),
      triggeredByName: sqliteValue(row.triggered_by_name),
      error: sqliteValue(row.error),
      override: parseJson(row.override_json, null),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
      completedAt: sqliteValue(row.completed_at),
    }));

    const modelHealthRuleResults = readTable(this.dbPath, "model_health_rule_results").map((row) => ({
      id: sqliteValue(row.id),
      taskId: sqliteValue(row.task_id),
      projectId: sqliteValue(row.project_id),
      fileId: sqliteValue(row.file_id),
      ruleId: sqliteValue(row.rule_id),
      level: sqliteValue(row.level),
      category: sqliteValue(row.category),
      description: sqliteValue(row.description),
      dbIds: parseJson(row.dbids_json, []),
      actualValue: sqliteValue(row.actual_value),
      expectedValue: sqliteValue(row.expected_value),
      status: sqliteValue(row.status),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const modelHealthAiResults = readTable(this.dbPath, "model_health_ai_results").map((row) => ({
      id: sqliteValue(row.id),
      taskId: sqliteValue(row.task_id),
      projectId: sqliteValue(row.project_id),
      fileId: sqliteValue(row.file_id),
      category: sqliteValue(row.category),
      description: sqliteValue(row.description),
      dbIds: parseJson(row.dbids_json, []),
      referenceDbIds: parseJson(row.reference_dbids_json, []),
      confidence: sqliteValue(row.confidence),
      actionRequired: boolFromSqlite(row.action_required),
      feedbackStatus: sqliteValue(row.feedback_status),
      status: sqliteValue(row.status),
      provider: sqliteValue(row.provider),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const modelHealthFalsePositiveRecords = readTable(this.dbPath, "model_health_false_positive_records").map((row) => ({
      id: sqliteValue(row.id),
      aiResultId: sqliteValue(row.ai_result_id),
      taskId: sqliteValue(row.task_id),
      projectId: sqliteValue(row.project_id),
      markedBy: sqliteValue(row.marked_by),
      reason: sqliteValue(row.reason),
      createdAt: sqliteValue(row.created_at),
    }));

    const quantityPropertySnapshots = readTable(this.dbPath, "quantity_property_snapshots").map((row) => ({
      id: sqliteValue(row.id),
      taskId: sqliteValue(row.task_id),
      dbId: Number(row.dbid || 0),
      name: sqliteValue(row.name),
      elementType: sqliteValue(row.element_type),
      properties: parseJson(row.properties_json, {}),
      floor: sqliteValue(row.floor),
      discipline: sqliteValue(row.discipline),
      material: sqliteValue(row.material),
      area: Number(row.area || 0),
      length: Number(row.length || 0),
      volume: Number(row.volume || 0),
    }));

    const quantitySummaries = readTable(this.dbPath, "quantity_summaries").map((row) => ({
      id: sqliteValue(row.id),
      taskId: sqliteValue(row.task_id),
      elementType: sqliteValue(row.element_type),
      floor: sqliteValue(row.floor),
      discipline: sqliteValue(row.discipline),
      material: sqliteValue(row.material),
      count: Number(row.count || 0),
      area: Number(row.area || 0),
      length: Number(row.length || 0),
      volume: Number(row.volume || 0),
      dbIds: parseJson(row.dbids_json, []),
      dimensions: parseJson(row.dimensions_json, {}),
    }));

    const quantityTemplates = readTable(this.dbPath, "quantity_templates").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      name: sqliteValue(row.name),
      description: sqliteValue(row.description),
      config: parseJson(row.config_json, {}),
      createdBy: sqliteValue(row.created_by),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const modelDiffTasks = readTable(this.dbPath, "model_diff_tasks").map((row) => ({
      id: sqliteValue(row.id),
      documentId: sqliteValue(row.document_id),
      fileId: sqliteValue(row.file_id),
      projectId: sqliteValue(row.project_id),
      fileName: sqliteValue(row.file_name),
      versionAId: sqliteValue(row.version_a_id),
      versionALabel: sqliteValue(row.version_a_label),
      versionBId: sqliteValue(row.version_b_id),
      versionBLabel: sqliteValue(row.version_b_label),
      modelUrnA: sqliteValue(row.model_urn_a),
      modelUrnB: sqliteValue(row.model_urn_b),
      snapshotAId: sqliteValue(row.snapshot_a_id),
      snapshotBId: sqliteValue(row.snapshot_b_id),
      status: sqliteValue(row.status),
      toleranceMm: Number(row.tolerance_mm || 10),
      coordinateUnit: sqliteValue(row.coordinate_unit),
      summary: parseJson(row.summary_json, {}),
      recordCount: Number(row.record_count || 0),
      createdBy: sqliteValue(row.created_by),
      createdByUserId: sqliteValue(row.created_by_user_id),
      error: sqliteValue(row.error),
      notification: parseJson(row.notification_json, {}),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
      completedAt: sqliteValue(row.completed_at),
    }));

    const modelDiffSnapshots = readTable(this.dbPath, "model_diff_snapshots").map((row) => ({
      id: sqliteValue(row.id),
      documentId: sqliteValue(row.document_id),
      projectId: sqliteValue(row.project_id),
      versionId: sqliteValue(row.version_id),
      versionLabel: sqliteValue(row.version_label),
      modelUrn: sqliteValue(row.model_urn),
      payloadHash: sqliteValue(row.payload_hash),
      extractionSource: sqliteValue(row.extraction_source),
      objectCount: Number(row.object_count || 0),
      elements: parseJson(row.elements_json, []),
      expiresAt: sqliteValue(row.expires_at),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const modelDiffRecords = readTable(this.dbPath, "model_diff_records").map((row) => ({
      id: sqliteValue(row.id),
      taskId: sqliteValue(row.task_id),
      projectId: sqliteValue(row.project_id),
      documentId: sqliteValue(row.document_id),
      uniqueId: sqliteValue(row.unique_id),
      stableKey: sqliteValue(row.stable_key),
      elementId: sqliteValue(row.element_id),
      diffType: sqliteValue(row.diff_type),
      diffTypes: parseJson(row.diff_types_json, []),
      elementType: sqliteValue(row.element_type),
      floor: sqliteValue(row.floor),
      discipline: sqliteValue(row.discipline),
      material: sqliteValue(row.material),
      name: sqliteValue(row.name),
      dbIdBefore: row.dbid_before === null || row.dbid_before === undefined ? null : Number(row.dbid_before),
      dbIdAfter: row.dbid_after === null || row.dbid_after === undefined ? null : Number(row.dbid_after),
      dbIds: parseJson(row.dbids_json, []),
      propsBefore: parseJson(row.props_before_json, {}),
      propsAfter: parseJson(row.props_after_json, {}),
      changedProps: parseJson(row.changed_props_json, []),
      changedPropCount: Number(row.changed_prop_count || 0),
      bboxBefore: parseJson(row.bbox_before_json, null),
      bboxAfter: parseJson(row.bbox_after_json, null),
      bboxDelta: parseJson(row.bbox_delta_json, null),
      matchMethod: sqliteValue(row.match_method),
      issueId: sqliteValue(row.issue_id),
      issueStatus: sqliteValue(row.issue_status),
      color: sqliteValue(row.color),
      unmatchedReason: sqliteValue(row.unmatched_reason),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const modelDiffPropChanges = readTable(this.dbPath, "model_diff_prop_changes").map((row) => ({
      id: sqliteValue(row.id),
      diffId: sqliteValue(row.diff_id),
      taskId: sqliteValue(row.task_id),
      propName: sqliteValue(row.prop_name),
      valueA: sqliteValue(row.value_a),
      valueB: sqliteValue(row.value_b),
    }));

    const modelDiffAiSummaries = readTable(this.dbPath, "model_diff_ai_summaries").map((row) => ({
      id: sqliteValue(row.id),
      taskId: sqliteValue(row.task_id),
      summary: sqliteValue(row.summary),
      detailByDiscipline: parseJson(row.detail_by_discipline_json, []),
      generatedAt: sqliteValue(row.generated_at),
    }));

    const constructionScheduleVersions = readTable(this.dbPath, "construction_schedule_versions").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      documentId: sqliteValue(row.document_id),
      modelUrn: sqliteValue(row.model_urn),
      versionId: sqliteValue(row.version_id),
      name: sqliteValue(row.name),
      projectName: sqliteValue(row.project_name),
      p6ProjectId: sqliteValue(row.p6_project_id),
      dataDate: sqliteValue(row.data_date),
      plannedStart: sqliteValue(row.planned_start),
      plannedFinish: sqliteValue(row.planned_finish),
      isBaseline: boolFromSqlite(row.is_baseline),
      isCurrent: boolFromSqlite(row.is_current),
      status: sqliteValue(row.status),
      activityCount: Number(row.activity_count || 0),
      mappedActivityCount: Number(row.mapped_activity_count || 0),
      importSummary: parseJson(row.import_summary_json, {}),
      xerFileId: sqliteValue(row.xer_file_id),
      importedBy: sqliteValue(row.imported_by),
      importedAt: sqliteValue(row.imported_at),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const constructionScheduleWbsNodes = readTable(this.dbPath, "construction_schedule_wbs_nodes").map((row) => ({
      id: sqliteValue(row.id),
      scheduleId: sqliteValue(row.schedule_id),
      projectId: sqliteValue(row.project_id),
      wbsId: sqliteValue(row.wbs_id),
      code: sqliteValue(row.code),
      name: sqliteValue(row.name),
      parentId: sqliteValue(row.parent_id),
      level: Number(row.level || 1),
      path: sqliteValue(row.path),
      sequence: Number(row.sequence || 0),
    }));

    const constructionScheduleActivities = readTable(this.dbPath, "construction_schedule_activities").map((row) => ({
      id: sqliteValue(row.id),
      scheduleId: sqliteValue(row.schedule_id),
      projectId: sqliteValue(row.project_id),
      activityId: sqliteValue(row.activity_id),
      internalId: sqliteValue(row.internal_id),
      name: sqliteValue(row.name),
      wbsId: sqliteValue(row.wbs_id),
      type: sqliteValue(row.type),
      plannedStart: sqliteValue(row.planned_start),
      plannedFinish: sqliteValue(row.planned_finish),
      actualStart: sqliteValue(row.actual_start),
      actualFinish: sqliteValue(row.actual_finish),
      percentComplete: Number(row.percent_complete || 0),
      status: sqliteValue(row.status),
      totalFloatHours: Number(row.total_float_hours || 0),
      calendarId: sqliteValue(row.calendar_id),
      discipline: sqliteValue(row.discipline),
      deletedAt: sqliteValue(row.deleted_at),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const constructionSchedulePredecessors = readTable(this.dbPath, "construction_schedule_predecessors").map((row) => ({
      id: sqliteValue(row.id),
      scheduleId: sqliteValue(row.schedule_id),
      projectId: sqliteValue(row.project_id),
      predecessorId: sqliteValue(row.predecessor_id),
      successorId: sqliteValue(row.successor_id),
      type: sqliteValue(row.type),
      lag: Number(row.lag || 0),
    }));

    const constructionScheduleMappings = readTable(this.dbPath, "construction_schedule_mappings").map((row) => ({
      id: sqliteValue(row.id),
      scheduleId: sqliteValue(row.schedule_id),
      projectId: sqliteValue(row.project_id),
      documentId: sqliteValue(row.document_id),
      activityId: sqliteValue(row.activity_id),
      activityRowId: sqliteValue(row.activity_row_id),
      modelUrn: sqliteValue(row.model_urn),
      dbId: Number(row.dbid || 0),
      uniqueId: sqliteValue(row.unique_id),
      matchMethod: sqliteValue(row.match_method),
      confidence: sqliteValue(row.confidence),
      reason: sqliteValue(row.reason),
      status: sqliteValue(row.status),
      createdBy: sqliteValue(row.created_by),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const constructionProgressReports = readTable(this.dbPath, "construction_progress_reports").map((row) => ({
      id: sqliteValue(row.id),
      scheduleId: sqliteValue(row.schedule_id),
      projectId: sqliteValue(row.project_id),
      activityId: sqliteValue(row.activity_id),
      activityRowId: sqliteValue(row.activity_row_id),
      reportedBy: sqliteValue(row.reported_by),
      reportedAt: sqliteValue(row.reported_at),
      actualStart: sqliteValue(row.actual_start),
      actualFinish: sqliteValue(row.actual_finish),
      percentComplete: Number(row.percent_complete || 0),
      note: sqliteValue(row.note),
      attachments: parseJson(row.attachments_json, []),
    }));

    const constructionScheduleSnapshots = readTable(this.dbPath, "construction_schedule_snapshots").map((row) => ({
      id: sqliteValue(row.id),
      scheduleId: sqliteValue(row.schedule_id),
      projectId: sqliteValue(row.project_id),
      snapshotDate: sqliteValue(row.snapshot_date),
      createdBy: sqliteValue(row.created_by),
      screenshotUrl: sqliteValue(row.screenshot_url),
      stats: parseJson(row.stats_json, {}),
      createdAt: sqliteValue(row.created_at),
    }));

    const constructionScheduleAlerts = readTable(this.dbPath, "construction_schedule_alerts").map((row) => ({
      id: sqliteValue(row.id),
      scheduleId: sqliteValue(row.schedule_id),
      projectId: sqliteValue(row.project_id),
      activityId: sqliteValue(row.activity_id),
      activityRowId: sqliteValue(row.activity_row_id),
      activityCode: sqliteValue(row.activity_code),
      activityName: sqliteValue(row.activity_name),
      type: sqliteValue(row.type),
      severity: sqliteValue(row.severity),
      message: sqliteValue(row.message),
      plannedFinish: sqliteValue(row.planned_finish),
      percentComplete: Number(row.percent_complete || 0),
      delayDays: Number(row.delay_days || 0),
      dbIds: parseJson(row.dbids_json, []),
      uniqueIds: parseJson(row.unique_ids_json, []),
      status: sqliteValue(row.status),
      issueId: sqliteValue(row.issue_id),
      triggeredAt: sqliteValue(row.triggered_at),
      resolvedAt: sqliteValue(row.resolved_at),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const modelClashRuns = readTable(this.dbPath, "model_clash_runs").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      documentIds: parseJson(row.document_ids_json, []),
      status: sqliteValue(row.status),
      rule: parseJson(row.rule_json, {}),
      summary: parseJson(row.summary_json, {}),
      recordIds: parseJson(row.record_ids_json, []),
      issueIds: parseJson(row.issue_ids_json, []),
      actor: sqliteValue(row.actor),
      error: sqliteValue(row.error),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const modelClashRecords = readTable(this.dbPath, "model_clash_records").map((row) => ({
      id: sqliteValue(row.id),
      runId: sqliteValue(row.run_id),
      projectId: sqliteValue(row.project_id),
      documentIdA: sqliteValue(row.document_id_a),
      modelUrnA: sqliteValue(row.model_urn_a),
      dbIdA: Number(row.dbid_a || 0),
      elementNameA: sqliteValue(row.element_name_a),
      disciplineA: sqliteValue(row.discipline_a),
      documentIdB: sqliteValue(row.document_id_b),
      modelUrnB: sqliteValue(row.model_urn_b),
      dbIdB: Number(row.dbid_b || 0),
      elementNameB: sqliteValue(row.element_name_b),
      disciplineB: sqliteValue(row.discipline_b),
      clashVolume: Number(row.clash_volume || 0),
      status: sqliteValue(row.status),
      issueId: sqliteValue(row.issue_id),
      responsibilityDiscipline: sqliteValue(row.responsibility_discipline),
      center: parseJson(row.center_json, [0, 0, 0]),
      intersectionBox: parseJson(row.intersection_box_json, null),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const modelClashHeatmaps = readTable(this.dbPath, "model_clash_heatmaps").map((row) => ({
      id: sqliteValue(row.id),
      clashTaskId: sqliteValue(row.clash_task_id),
      projectId: sqliteValue(row.project_id),
      gridSize: Number(row.grid_size || 1),
      status: sqliteValue(row.status),
      summary: parseJson(row.summary_json, {}),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const modelClashHeatmapCells = readTable(this.dbPath, "model_clash_heatmap_cells").map((row) => ({
      id: sqliteValue(row.id),
      heatmapId: sqliteValue(row.heatmap_id),
      x: Number(row.x || 0),
      y: Number(row.y || 0),
      z: Number(row.z || 0),
      gridSize: Number(row.grid_size || 1),
      density: Number(row.density || 0),
      disciplinePair: sqliteValue(row.discipline_pair),
      recordIds: parseJson(row.record_ids_json, []),
      bbox: parseJson(row.bbox_json, null),
      color: sqliteValue(row.color),
      intensity: Number(row.intensity || 0),
    }));

    const modelClashHotspots = readTable(this.dbPath, "model_clash_hotspots").map((row) => ({
      id: sqliteValue(row.id),
      heatmapId: sqliteValue(row.heatmap_id),
      bbox: parseJson(row.bbox_json, null),
      center: parseJson(row.center_json, [0, 0, 0]),
      clashCount: Number(row.clash_count || 0),
      disciplines: parseJson(row.disciplines_json, []),
      disciplinePairs: parseJson(row.discipline_pairs_json, []),
      openIssueCount: Number(row.open_issue_count || 0),
      recordIds: parseJson(row.record_ids_json, []),
    }));

    const drawingPrecheckTasks = readTable(this.dbPath, "drawing_precheck_tasks").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      fileId: sqliteValue(row.file_id),
      fileName: sqliteValue(row.file_name),
      versionId: sqliteValue(row.version_id),
      version: sqliteValue(row.version_label),
      status: sqliteValue(row.status),
      checks: parseJson(row.checks_json, {}),
      gate: parseJson(row.gate_json, {}),
      summary: parseJson(row.summary_json, {}),
      report: parseJson(row.report_json, {}),
      resultIds: parseJson(row.result_ids_json, []),
      triggeredBy: sqliteValue(row.triggered_by),
      triggeredByName: sqliteValue(row.triggered_by_name),
      error: sqliteValue(row.error),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
      completedAt: sqliteValue(row.completed_at),
    }));

    const drawingPrecheckResults = readTable(this.dbPath, "drawing_precheck_results").map((row) => ({
      id: sqliteValue(row.id),
      taskId: sqliteValue(row.task_id),
      projectId: sqliteValue(row.project_id),
      fileId: sqliteValue(row.file_id),
      fileName: sqliteValue(row.file_name),
      versionId: sqliteValue(row.version_id),
      version: sqliteValue(row.version_label),
      checkType: sqliteValue(row.check_type),
      source: sqliteValue(row.source),
      level: sqliteValue(row.level),
      category: sqliteValue(row.category),
      title: sqliteValue(row.title),
      description: sqliteValue(row.description),
      page: Number(row.page || 1),
      position: parseJson(row.position_json, {}),
      confidence: sqliteValue(row.confidence),
      status: sqliteValue(row.status),
      disposition: sqliteValue(row.disposition),
      annotationId: sqliteValue(row.annotation_id),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const drawingExtractionSnapshots = readTable(this.dbPath, "drawing_extraction_snapshots").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      fileId: sqliteValue(row.file_id),
      fileName: sqliteValue(row.file_name),
      versionId: sqliteValue(row.version_id),
      version: sqliteValue(row.version_label),
      textContent: parseJson(row.text_content_json, {}),
      metadata: parseJson(row.metadata_json, {}),
      diff: parseJson(row.diff_json, {}),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const drawingRuleConfigs = readTable(this.dbPath, "drawing_rule_configs").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      rules: parseJson(row.rules_json, {}),
      createdAt: sqliteValue(row.created_at),
      updatedAt: sqliteValue(row.updated_at),
    }));

    const systemEmailSettingsRow = readTable(this.dbPath, "system_email_settings")[0] || null;
    const systemEmailSettings = systemEmailSettingsRow
      ? {
        id: sqliteValue(systemEmailSettingsRow.id),
        enabled: boolFromSqlite(systemEmailSettingsRow.enabled),
        provider: sqliteValue(systemEmailSettingsRow.provider),
        host: sqliteValue(systemEmailSettingsRow.host),
        port: Number(systemEmailSettingsRow.port || 587),
        encryption: sqliteValue(systemEmailSettingsRow.encryption),
        authRequired: boolFromSqlite(systemEmailSettingsRow.auth_required),
        username: sqliteValue(systemEmailSettingsRow.username),
        password: sqliteValue(systemEmailSettingsRow.password),
        senderName: sqliteValue(systemEmailSettingsRow.sender_name),
        senderEmail: sqliteValue(systemEmailSettingsRow.sender_email),
        replyTo: sqliteValue(systemEmailSettingsRow.reply_to),
        subjectPrefix: sqliteValue(systemEmailSettingsRow.subject_prefix),
        updatedBy: sqliteValue(systemEmailSettingsRow.updated_by),
        updatedAt: sqliteValue(systemEmailSettingsRow.updated_at),
      }
      : null;

    const systemAiSettingsRow = readTable(this.dbPath, "system_ai_settings")[0] || null;
    const systemAiSettings = systemAiSettingsRow
      ? {
        id: sqliteValue(systemAiSettingsRow.id),
        enabled: boolFromSqlite(systemAiSettingsRow.enabled),
        provider: sqliteValue(systemAiSettingsRow.provider),
        endpoint: sqliteValue(systemAiSettingsRow.endpoint),
        apiKey: sqliteValue(systemAiSettingsRow.api_key),
        model: sqliteValue(systemAiSettingsRow.model),
        timeoutMs: Number(systemAiSettingsRow.timeout_ms || 20000),
        batchSize: Number(systemAiSettingsRow.batch_size || 100),
        updatedBy: sqliteValue(systemAiSettingsRow.updated_by),
        updatedAt: sqliteValue(systemAiSettingsRow.updated_at),
      }
      : null;

    const systemApsSettingsRow = readTable(this.dbPath, "system_aps_settings")[0] || null;
    const systemApsSettings = systemApsSettingsRow
      ? {
        id: sqliteValue(systemApsSettingsRow.id),
        enabled: boolFromSqlite(systemApsSettingsRow.enabled),
        provider: sqliteValue(systemApsSettingsRow.provider),
        clientId: sqliteValue(systemApsSettingsRow.client_id),
        clientSecret: sqliteValue(systemApsSettingsRow.client_secret),
        bucketKey: sqliteValue(systemApsSettingsRow.bucket_key),
        bucketPolicy: sqliteValue(systemApsSettingsRow.bucket_policy),
        bucketRegion: sqliteValue(systemApsSettingsRow.bucket_region),
        viewerVersion: sqliteValue(systemApsSettingsRow.viewer_version),
        viewerEnv: sqliteValue(systemApsSettingsRow.viewer_env),
        viewerApi: sqliteValue(systemApsSettingsRow.viewer_api),
        updatedBy: sqliteValue(systemApsSettingsRow.updated_by),
        updatedAt: sqliteValue(systemApsSettingsRow.updated_at),
      }
      : null;

    const projectEmailNotificationSettings = readTable(this.dbPath, "project_email_notifications").map((row) => ({
      id: sqliteValue(row.id),
      projectId: sqliteValue(row.project_id),
      enabled: boolFromSqlite(row.enabled),
      includeGuests: boolFromSqlite(row.include_guests),
      digestMode: sqliteValue(row.digest_mode),
      recipients: parseJson(row.recipients_json, {}),
      events: parseJson(row.events_json, {}),
      updatedBy: sqliteValue(row.updated_by),
      updatedAt: sqliteValue(row.updated_at),
    }));

    return {
      projects,
      documents,
      folders,
      workflowTemplates,
      workflows,
      users,
      projectMembers,
      folderPermissions,
      auditLogs,
      jobs,
      modelGeometryExtractionTasks,
      modelHealthTasks,
      modelHealthRuleResults,
      modelHealthAiResults,
      modelHealthRulesets,
      modelHealthFalsePositiveRecords,
      quantityTakeoffTasks,
      quantityPropertySnapshots,
      quantitySummaries,
      quantityTemplates,
      modelDiffTasks,
      modelDiffSnapshots,
      modelDiffRecords,
      modelDiffPropChanges,
      modelDiffAiSummaries,
      constructionScheduleVersions,
      constructionScheduleWbsNodes,
      constructionScheduleActivities,
      constructionSchedulePredecessors,
      constructionScheduleMappings,
      constructionProgressReports,
      constructionScheduleSnapshots,
      constructionScheduleAlerts,
      modelClashRuns,
      modelClashRecords,
      modelClashHeatmaps,
      modelClashHeatmapCells,
      modelClashHotspots,
      drawingPrecheckTasks,
      drawingPrecheckResults,
      drawingExtractionSnapshots,
      drawingRuleConfigs,
      systemEmailSettings,
      systemAiSettings,
      systemApsSettings,
      projectEmailNotificationSettings,
    };
  }

  write(store) {
    this.ensureStore();
    const sql = buildSeedSql(store);
    execFileSync("sqlite3", [this.dbPath], { input: sql, encoding: "utf8" });
  }

  health() {
    const result = {
      configured: Boolean(this.dbPath),
      exists: false,
      readable: false,
      writable: false,
      path: this.dbPath,
      adapter: "sqlite",
    };

    try {
      this.ensureStore();
      fs.accessSync(this.dbPath, fs.constants.R_OK);
      result.exists = fs.statSync(this.dbPath).isFile();
      result.readable = true;
      fs.accessSync(path.dirname(this.dbPath), fs.constants.W_OK);
      result.writable = true;
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }
}

function createSQLiteStoreRepository(options) {
  return new SQLiteStoreRepository(options);
}

function sqliteCliAvailable() {
  try {
    execFileSync("sqlite3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  SQLiteStoreRepository,
  createSQLiteStoreRepository,
  sqliteCliAvailable,
};
