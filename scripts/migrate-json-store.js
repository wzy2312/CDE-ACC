const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_INPUT = path.join("data", "documents.json");
const DEFAULT_OUTPUT = path.join("db", "seed-from-json.sql");

function usage() {
  return [
    "Usage: node scripts/migrate-json-store.js [--input data/documents.json] [--output db/seed-from-json.sql] [--stdout]",
    "",
    "Creates a SQLite-compatible SQL seed file from the current JSON store.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    stdout: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--stdout") {
      args.stdout = true;
      continue;
    }
    if (arg === "--input") {
      args.input = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--output") {
      args.output = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value) {
  return value ? 1 : 0;
}

function json(value, fallback) {
  return JSON.stringify(value === undefined ? fallback : value);
}

function sqlString(value) {
  if (value === undefined || value === null) {
    return "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

function insert(table, record) {
  const columns = Object.keys(record);
  const values = columns.map((column) => {
    const value = record[column];
    return typeof value === "number" ? sqlNumber(value) : sqlString(value);
  });
  return `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")});`;
}

function migrateProjects(store, lines) {
  for (const project of arrayOf(store.projects)) {
    lines.push(insert("projects", {
      id: text(project.id),
      name: text(project.name, "未命名项目"),
      code: text(project.code),
      description: text(project.description),
      folder_policy_key: text(project.folderPolicyKey || project.defaultFolderPolicy, "cde_standard"),
      member_init_mode: text(project.memberInitMode, "creator_only"),
      member_source_project_id: text(project.memberSourceProjectId),
      template_init_mode: text(project.templateInitMode, "default_templates"),
      template_source_project_id: text(project.templateSourceProjectId),
      created_by: text(project.createdBy, "system"),
      guest_policy_json: json(project.guestPolicy, {}),
      created_at: text(project.createdAt, new Date().toISOString()),
      updated_at: text(project.updatedAt || project.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateUsers(store, lines) {
  for (const user of arrayOf(store.users)) {
    lines.push(insert("users", {
      id: text(user.id),
      name: text(user.name, "未命名用户"),
      email: text(user.email),
      avatar_url: text(user.avatarUrl),
      status: text(user.status, "active"),
      platform_role: text(user.platformRole, "user"),
      password_salt: text(user.passwordSalt),
      password_hash: text(user.passwordHash),
      must_change_password: bool(user.mustChangePassword),
      password_updated_at: text(user.passwordUpdatedAt),
      last_login_at: text(user.lastLoginAt),
      invited_at: text(user.invitedAt),
      created_at: text(user.createdAt, new Date().toISOString()),
      updated_at: text(user.updatedAt || user.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateSystemEmailSettings(store, lines) {
  const settings = store.systemEmailSettings || null;
  if (!settings) {
    return;
  }
  lines.push(insert("system_email_settings", {
    id: text(settings.id, "system-email-default"),
    enabled: bool(settings.enabled),
    provider: text(settings.provider, "smtp"),
    host: text(settings.host),
    port: number(settings.port, 587),
    encryption: text(settings.encryption, "starttls"),
    auth_required: bool(settings.authRequired !== false),
    username: text(settings.username),
    password: text(settings.password),
    sender_name: text(settings.senderName),
    sender_email: text(settings.senderEmail),
    reply_to: text(settings.replyTo),
    subject_prefix: text(settings.subjectPrefix, "[CDE]"),
    updated_by: text(settings.updatedBy, "system"),
    updated_at: text(settings.updatedAt, new Date().toISOString()),
  }));
}

function migrateSystemAiSettings(store, lines) {
  const settings = store.systemAiSettings || null;
  if (!settings) {
    return;
  }
  lines.push(insert("system_ai_settings", {
    id: text(settings.id, "system-ai-default"),
    enabled: bool(settings.enabled),
    provider: text(settings.provider, "http"),
    endpoint: text(settings.endpoint),
    api_key: text(settings.apiKey),
    model: text(settings.model),
    timeout_ms: number(settings.timeoutMs, 20000),
    batch_size: number(settings.batchSize, 100),
    updated_by: text(settings.updatedBy, "system"),
    updated_at: text(settings.updatedAt, new Date().toISOString()),
  }));
}

function migrateSystemApsSettings(store, lines) {
  const settings = store.systemApsSettings || null;
  if (!settings) {
    return;
  }
  lines.push(insert("system_aps_settings", {
    id: text(settings.id, "system-aps-default"),
    enabled: bool(settings.enabled),
    provider: text(settings.provider, "aps"),
    client_id: text(settings.clientId),
    client_secret: text(settings.clientSecret),
    bucket_key: text(settings.bucketKey),
    bucket_policy: text(settings.bucketPolicy, "persistent"),
    bucket_region: text(settings.bucketRegion, "US"),
    viewer_version: text(settings.viewerVersion, "7.*"),
    viewer_env: text(settings.viewerEnv, "AutodeskProduction2"),
    viewer_api: text(settings.viewerApi, "streamingV2"),
    updated_by: text(settings.updatedBy, "system"),
    updated_at: text(settings.updatedAt, new Date().toISOString()),
  }));
}

function migrateProjectEmailNotifications(store, lines) {
  for (const config of arrayOf(store.projectEmailNotificationSettings)) {
    lines.push(insert("project_email_notifications", {
      id: text(config.id, `project-email-${text(config.projectId)}`),
      project_id: text(config.projectId),
      enabled: bool(config.enabled),
      include_guests: bool(config.includeGuests),
      digest_mode: text(config.digestMode, "immediate"),
      recipients_json: json(config.recipients, {}),
      events_json: json(config.events, {}),
      updated_by: text(config.updatedBy, "system"),
      updated_at: text(config.updatedAt, new Date().toISOString()),
    }));
  }
}

function migrateProjectMembers(store, lines) {
  for (const member of arrayOf(store.projectMembers)) {
    lines.push(insert("project_members", {
      id: text(member.id),
      project_id: text(member.projectId),
      user_id: text(member.userId),
      role: text(member.role, "guest"),
      invited_by: text(member.invitedBy),
      invited_at: text(member.invitedAt),
      invite_token: text(member.inviteToken),
      invite_expires_at: text(member.inviteExpiresAt),
      invite_accepted_at: text(member.inviteAcceptedAt),
      joined_at: text(member.joinedAt),
      removed_at: text(member.removedAt),
      created_at: text(member.createdAt || member.joinedAt, new Date().toISOString()),
      updated_at: text(member.updatedAt || member.joinedAt, new Date().toISOString()),
    }));
  }
}

function migrateFolders(store, lines) {
  for (const folder of arrayOf(store.folders)) {
    lines.push(insert("folders", {
      id: text(folder.id),
      project_id: text(folder.projectId),
      parent_id: text(folder.parentId) || null,
      policy_key: text(folder.policyKey),
      name: text(folder.name, "未命名文件夹"),
      owner: text(folder.owner, "项目组"),
      access_level: text(folder.accessLevel, "edit"),
      created_at: text(folder.createdAt, new Date().toISOString()),
      updated_at: text(folder.updatedAt || folder.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateFolderPermissions(store, lines) {
  for (const permission of arrayOf(store.folderPermissions)) {
    lines.push(insert("folder_permissions", {
      id: text(permission.id),
      project_id: text(permission.projectId),
      folder_id: text(permission.folderId),
      user_id: text(permission.userId),
      permission: text(permission.permission, "viewer"),
      set_by: text(permission.setBy),
      created_at: text(permission.createdAt, new Date().toISOString()),
      updated_at: text(permission.updatedAt || permission.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateDocuments(store, lines) {
  for (const doc of arrayOf(store.documents)) {
    lines.push(insert("documents", {
      id: text(doc.id),
      project_id: text(doc.projectId),
      folder_id: text(doc.parentId) || null,
      name: text(doc.name, "未命名文件"),
      current_version_id: text(doc.currentVersionId),
      stored_file_name: text(doc.storedFileName),
      size: number(doc.size),
      version_label: text(doc.version, "V1"),
      status: text(doc.status, "uploaded"),
      workflow_name: text(doc.workflowName),
      initiator: text(doc.initiator),
      reviewer: text(doc.reviewer),
      approver: text(doc.approver),
      due_date: text(doc.dueDate),
      uploaded_at: text(doc.uploadedAt, new Date().toISOString()),
      updated_at: text(doc.updatedAt || doc.uploadedAt, new Date().toISOString()),
      uploader_id: text(doc.uploaderId),
      uploader: text(doc.uploader),
      owner: text(doc.owner),
      mime_type: text(doc.mimeType, "application/octet-stream"),
      is_pdf: bool(doc.isPdf),
      access_level: text(doc.accessLevel, "edit"),
      download_scope: text(doc.downloadScope, "team"),
      watermark_enabled: bool(doc.watermarkEnabled !== false),
      checked_out_by: text(doc.checkedOutBy),
      checked_out_at: text(doc.checkedOutAt),
      active_workflow_id: text(doc.activeWorkflowId),
      last_export_file_name: text(doc.lastExportFileName),
      parse_status: text(doc.parseStatus, "done"),
      parse_ready_at: text(doc.parseReadyAt),
      remarks: text(doc.remarks),
      share_json: json(doc.share, {}),
      drawing_metadata_json: json(doc.drawingMetadata, {}),
      aps_json: json(doc.aps, {}),
      activity_json: json(doc.activity, []),
    }));

    for (const version of arrayOf(doc.versionHistory)) {
      lines.push(insert("document_versions", {
        id: text(version.id),
        document_id: text(doc.id),
        version_label: text(version.version, "V1"),
        version_no: number(version.versionNo, 1),
        name: text(version.name || doc.name, "未命名文件"),
        stored_file_name: text(version.storedFileName),
        size: number(version.size),
        mime_type: text(version.mimeType || doc.mimeType, "application/octet-stream"),
        uploaded_at: text(version.uploadedAt || doc.uploadedAt, new Date().toISOString()),
        uploaded_by_id: text(version.uploadedById),
        uploaded_by: text(version.uploadedBy),
        note: text(version.note),
        parse_status: text(version.parseStatus, "done"),
        parse_ready_at: text(version.parseReadyAt),
        is_current: bool(version.isCurrent),
        deleted_at: text(version.deletedAt),
        deleted_by: text(version.deletedBy),
        share_json: json(version.share, {}),
      }));
    }

    for (const workflowId of arrayOf(doc.workflowIds)) {
      lines.push(insert("document_workflows", {
        document_id: text(doc.id),
        workflow_id: text(workflowId),
      }));
    }

    for (const annotation of arrayOf(doc.annotations)) {
      lines.push(insert("annotations", {
        id: text(annotation.id),
        document_id: text(doc.id),
        version_id: text(annotation.versionId),
        type: text(annotation.type, "note"),
        variant: text(annotation.variant),
        page: number(annotation.page, 1),
        x: number(annotation.x),
        y: number(annotation.y),
        width: number(annotation.width),
        height: number(annotation.height),
        points_json: json(annotation.points, []),
        title: text(annotation.title),
        note: text(annotation.note),
        actor: text(annotation.actor),
        color: text(annotation.color),
        status: text(annotation.status, "open"),
        resolved: bool(annotation.resolved),
        resolved_at: annotation.resolvedAt || null,
        created_at: text(annotation.createdAt, new Date().toISOString()),
        attachments_json: json(annotation.attachments, []),
        viewer_state_json: json(annotation.viewerState || annotation.viewer_state, {}),
        dbids_json: json(annotation.dbIds || annotation.dbids, []),
        model_urn: text(annotation.modelUrn || annotation.model_urn),
        sheet_guid: text(annotation.sheetGuid || annotation.sheet_guid),
        element_unique_id: text(annotation.elementUniqueId || annotation.element_unique_id),
        element_id: text(annotation.elementId || annotation.element_id),
        bound_model_version: text(annotation.boundModelVersion || annotation.bound_model_version),
        migration_status: text(annotation.migrationStatus || annotation.migration_status, "synced"),
        precheck_task_id: text(annotation.precheckTaskId || annotation.precheck_task_id),
        precheck_result_id: text(annotation.precheckResultId || annotation.precheck_result_id),
        precheck_level: text(annotation.precheckLevel || annotation.precheck_level),
        precheck_category: text(annotation.precheckCategory || annotation.precheck_category),
        source: text(annotation.source),
      }));

      for (const reply of arrayOf(annotation.replies)) {
        lines.push(insert("annotation_replies", {
          id: text(reply.id),
          annotation_id: text(annotation.id),
          actor: text(reply.actor),
          content: text(reply.content),
          created_at: text(reply.createdAt, new Date().toISOString()),
          attachments_json: json(reply.attachments, []),
        }));
      }
    }
  }
}

function migrateWorkflowTemplates(store, lines) {
  for (const template of arrayOf(store.workflowTemplates)) {
    lines.push(insert("workflow_templates", {
      id: text(template.id),
      project_id: text(template.projectId),
      project_name: text(template.projectName),
      category: text(template.category),
      name: text(template.name, "未命名模板"),
      description: text(template.description),
      enabled: bool(template.enabled !== false),
      allowed_roles_json: json(template.allowedRoles, []),
      auto_export_json: json(template.autoExport, {}),
      steps_json: json(template.steps, []),
      created_at: text(template.createdAt, new Date().toISOString()),
      updated_at: text(template.updatedAt || template.createdAt, new Date().toISOString()),
      created_by: text(template.createdBy, "system"),
    }));
  }
}

function migrateWorkflows(store, lines) {
  for (const workflow of arrayOf(store.workflows)) {
    lines.push(insert("workflows", {
      id: text(workflow.id),
      project_id: text(workflow.projectId),
      project_name: text(workflow.projectName),
      workflow_name: text(workflow.workflowName, "审批流程"),
      template_id: text(workflow.templateId),
      template_name: text(workflow.templateName),
      template_category: text(workflow.templateCategory),
      initiator: text(workflow.initiator),
      initiator_user_id: text(workflow.initiatorUserId),
      description: text(workflow.description),
      due_date: text(workflow.dueDate),
      status: text(workflow.status, "running"),
      current_step_index: number(workflow.currentStepIndex),
      steps_json: json(workflow.steps, []),
      file_refs_json: json(workflow.fileRefs, []),
      activity_json: json(workflow.activity, []),
      auto_export_json: json(workflow.autoExport, {}),
      health_gate_overrides_json: json(workflow.healthGateOverrides, []),
      created_at: text(workflow.createdAt, new Date().toISOString()),
      updated_at: text(workflow.updatedAt || workflow.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateAuditLogs(store, lines) {
  for (const log of arrayOf(store.auditLogs)) {
    lines.push(insert("audit_logs", {
      id: text(log.id),
      user_id: text(log.userId),
      project_id: text(log.projectId),
      action: text(log.action),
      resource_type: text(log.resourceType),
      resource_id: text(log.resourceId),
      detail_json: json(log.detail, {}),
      ip: text(log.ip),
      created_at: text(log.createdAt, new Date().toISOString()),
      previous_hash: text(log.previousHash),
      hash: text(log.hash),
    }));
  }
}

function migrateJobs(store, lines) {
  for (const job of arrayOf(store.jobs)) {
    lines.push(insert("jobs", {
      id: text(job.id),
      type: text(job.type),
      status: text(job.status, "queued"),
      resource_type: text(job.resourceType),
      resource_id: text(job.resourceId),
      payload_json: json(job.payload, {}),
      error: text(job.error),
      attempts: number(job.attempts),
      created_at: text(job.createdAt, new Date().toISOString()),
      updated_at: text(job.updatedAt || job.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateModelGeometryExtractionTasks(store, lines) {
  const documentIds = new Set(arrayOf(store.documents).map((doc) => text(doc.id)).filter(Boolean));
  for (const task of arrayOf(store.modelGeometryExtractionTasks)) {
    const documentId = text(task.documentId);
    if (!documentId || !documentIds.has(documentId)) {
      continue;
    }
    lines.push(insert("model_geometry_extraction_tasks", {
      id: text(task.id),
      document_id: documentId,
      project_id: text(task.projectId),
      version_id: text(task.versionId),
      model_urn: text(task.modelUrn),
      source: text(task.source, "aps-properties"),
      status: text(task.status, "queued"),
      parser_version: text(task.parserVersion),
      derivative_urn: text(task.derivativeUrn),
      indexed_count: number(task.indexedCount),
      mesh_count: number(task.meshCount),
      warnings_json: json(task.warnings, []),
      summary_json: json(task.summary, {}),
      error: text(task.error),
      created_at: text(task.createdAt, new Date().toISOString()),
      updated_at: text(task.updatedAt || task.createdAt, new Date().toISOString()),
      completed_at: text(task.completedAt),
    }));
  }
}

function migrateModelHealth(store, lines) {
  for (const ruleset of arrayOf(store.modelHealthRulesets)) {
    lines.push(insert("model_health_rulesets", {
      id: text(ruleset.id),
      project_id: text(ruleset.projectId),
      discipline: text(ruleset.discipline, "general"),
      name: text(ruleset.name),
      description: text(ruleset.description),
      rules_json: json(ruleset.rules, {}),
      gate_config_json: json(ruleset.gateConfig, {}),
      version: text(ruleset.version, "1.0.0"),
      built_in: bool(ruleset.builtIn),
      created_at: text(ruleset.createdAt, new Date().toISOString()),
      updated_at: text(ruleset.updatedAt || ruleset.createdAt, new Date().toISOString()),
    }));
  }
  for (const task of arrayOf(store.modelHealthTasks)) {
    lines.push(insert("model_health_tasks", {
      id: text(task.id),
      file_id: text(task.fileId || task.documentId),
      project_id: text(task.projectId),
      file_name: text(task.fileName),
      version_id: text(task.versionId),
      version_label: text(task.version),
      ruleset_id: text(task.rulesetId),
      status: text(task.status, "queued"),
      score: number(task.score),
      summary_json: json(task.summary, {}),
      report_json: json(task.report, {}),
      gate_json: json(task.gate, {}),
      triggered_by: text(task.triggeredBy),
      triggered_by_name: text(task.triggeredByName),
      error: text(task.error),
      override_json: json(task.override, {}),
      created_at: text(task.createdAt, new Date().toISOString()),
      updated_at: text(task.updatedAt || task.createdAt, new Date().toISOString()),
      completed_at: text(task.completedAt),
    }));
  }
  for (const result of arrayOf(store.modelHealthRuleResults)) {
    lines.push(insert("model_health_rule_results", {
      id: text(result.id),
      task_id: text(result.taskId),
      project_id: text(result.projectId),
      file_id: text(result.fileId),
      rule_id: text(result.ruleId),
      level: text(result.level, "error"),
      category: text(result.category),
      description: text(result.description),
      dbids_json: json(result.dbIds, []),
      actual_value: text(result.actualValue),
      expected_value: text(result.expectedValue),
      status: text(result.status, "open"),
      created_at: text(result.createdAt, new Date().toISOString()),
      updated_at: text(result.updatedAt || result.createdAt, new Date().toISOString()),
    }));
  }
  for (const result of arrayOf(store.modelHealthAiResults)) {
    lines.push(insert("model_health_ai_results", {
      id: text(result.id),
      task_id: text(result.taskId),
      project_id: text(result.projectId),
      file_id: text(result.fileId),
      category: text(result.category),
      description: text(result.description),
      dbids_json: json(result.dbIds, []),
      reference_dbids_json: json(result.referenceDbIds, []),
      confidence: text(result.confidence, "medium"),
      action_required: bool(result.actionRequired !== false),
      feedback_status: text(result.feedbackStatus, "open"),
      status: text(result.status, "open"),
      provider: text(result.provider),
      created_at: text(result.createdAt, new Date().toISOString()),
      updated_at: text(result.updatedAt || result.createdAt, new Date().toISOString()),
    }));
  }
  for (const record of arrayOf(store.modelHealthFalsePositiveRecords)) {
    lines.push(insert("model_health_false_positive_records", {
      id: text(record.id),
      ai_result_id: text(record.aiResultId),
      task_id: text(record.taskId),
      project_id: text(record.projectId),
      marked_by: text(record.markedBy),
      reason: text(record.reason),
      created_at: text(record.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateQuantityTakeoff(store, lines) {
  for (const task of arrayOf(store.quantityTakeoffTasks)) {
    lines.push(insert("quantity_takeoff_tasks", {
      id: text(task.id),
      document_id: text(task.documentId),
      project_id: text(task.projectId),
      model_urn: text(task.modelUrn),
      version_id: text(task.versionId),
      version_label: text(task.version),
      status: text(task.status, "queued"),
      config_json: json(task.config, {}),
      created_by: text(task.createdBy),
      error: text(task.error),
      snapshot_count: number(task.snapshotCount),
      summary_count: number(task.summaryCount),
      created_at: text(task.createdAt, new Date().toISOString()),
      updated_at: text(task.updatedAt || task.createdAt, new Date().toISOString()),
      completed_at: text(task.completedAt),
    }));
  }

  for (const snapshot of arrayOf(store.quantityPropertySnapshots)) {
    lines.push(insert("quantity_property_snapshots", {
      id: text(snapshot.id),
      task_id: text(snapshot.taskId),
      dbid: number(snapshot.dbId),
      name: text(snapshot.name),
      element_type: text(snapshot.elementType),
      properties_json: json(snapshot.properties, {}),
      floor: text(snapshot.floor),
      discipline: text(snapshot.discipline),
      material: text(snapshot.material),
      area: number(snapshot.area),
      length: number(snapshot.length),
      volume: number(snapshot.volume),
    }));
  }

  for (const summary of arrayOf(store.quantitySummaries)) {
    lines.push(insert("quantity_summaries", {
      id: text(summary.id),
      task_id: text(summary.taskId),
      element_type: text(summary.elementType),
      floor: text(summary.floor),
      discipline: text(summary.discipline),
      material: text(summary.material),
      count: number(summary.count),
      area: number(summary.area),
      length: number(summary.length),
      volume: number(summary.volume),
      dbids_json: json(summary.dbIds, []),
      dimensions_json: json(summary.dimensions, {}),
    }));
  }

  for (const template of arrayOf(store.quantityTemplates)) {
    lines.push(insert("quantity_templates", {
      id: text(template.id),
      project_id: text(template.projectId),
      name: text(template.name),
      description: text(template.description),
      config_json: json(template.config, {}),
      created_by: text(template.createdBy),
      created_at: text(template.createdAt, new Date().toISOString()),
      updated_at: text(template.updatedAt || template.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateModelDiff(store, lines) {
  for (const task of arrayOf(store.modelDiffTasks)) {
    lines.push(insert("model_diff_tasks", {
      id: text(task.id),
      document_id: text(task.documentId || task.fileId),
      file_id: text(task.fileId || task.documentId),
      project_id: text(task.projectId),
      file_name: text(task.fileName),
      version_a_id: text(task.versionAId),
      version_a_label: text(task.versionALabel || task.versionA),
      version_b_id: text(task.versionBId),
      version_b_label: text(task.versionBLabel || task.versionB),
      model_urn_a: text(task.modelUrnA),
      model_urn_b: text(task.modelUrnB),
      snapshot_a_id: text(task.snapshotAId),
      snapshot_b_id: text(task.snapshotBId),
      status: text(task.status, "queued"),
      tolerance_mm: number(task.toleranceMm, 10),
      coordinate_unit: text(task.coordinateUnit, "m"),
      summary_json: json(task.summary, {}),
      record_count: number(task.recordCount),
      created_by: text(task.createdBy),
      created_by_user_id: text(task.createdByUserId),
      error: text(task.error),
      notification_json: json(task.notification, {}),
      created_at: text(task.createdAt, new Date().toISOString()),
      updated_at: text(task.updatedAt || task.createdAt, new Date().toISOString()),
      completed_at: text(task.completedAt),
    }));
  }

  for (const snapshot of arrayOf(store.modelDiffSnapshots)) {
    lines.push(insert("model_diff_snapshots", {
      id: text(snapshot.id),
      document_id: text(snapshot.documentId || snapshot.fileId),
      project_id: text(snapshot.projectId),
      version_id: text(snapshot.versionId),
      version_label: text(snapshot.versionLabel || snapshot.version),
      model_urn: text(snapshot.modelUrn),
      payload_hash: text(snapshot.payloadHash),
      extraction_source: text(snapshot.extractionSource || snapshot.source, "model-diff"),
      object_count: number(snapshot.objectCount),
      elements_json: json(snapshot.elements, []),
      expires_at: text(snapshot.expiresAt),
      created_at: text(snapshot.createdAt, new Date().toISOString()),
      updated_at: text(snapshot.updatedAt || snapshot.createdAt, new Date().toISOString()),
    }));
  }

  for (const record of arrayOf(store.modelDiffRecords)) {
    lines.push(insert("model_diff_records", {
      id: text(record.id),
      task_id: text(record.taskId),
      project_id: text(record.projectId),
      document_id: text(record.documentId || record.fileId),
      unique_id: text(record.uniqueId || record.unique_id),
      stable_key: text(record.stableKey || record.stable_key),
      element_id: text(record.elementId || record.element_id),
      diff_type: text(record.diffType || record.diff_type, "unchanged"),
      diff_types_json: json(record.diffTypes || record.diff_types, []),
      element_type: text(record.elementType || record.element_type),
      floor: text(record.floor),
      discipline: text(record.discipline),
      material: text(record.material),
      name: text(record.name),
      dbid_before: record.dbIdBefore ?? record.dbid_before ?? null,
      dbid_after: record.dbIdAfter ?? record.dbid_after ?? null,
      dbids_json: json(record.dbIds || record.dbids, []),
      props_before_json: json(record.propsBefore || record.props_before, {}),
      props_after_json: json(record.propsAfter || record.props_after, {}),
      changed_props_json: json(record.changedProps || record.changed_props, []),
      changed_prop_count: number(record.changedPropCount ?? record.changed_prop_count),
      bbox_before_json: json(record.bboxBefore || record.bbox_before, {}),
      bbox_after_json: json(record.bboxAfter || record.bbox_after, {}),
      bbox_delta_json: json(record.bboxDelta || record.bbox_delta, {}),
      match_method: text(record.matchMethod || record.match_method, "stable"),
      issue_id: text(record.issueId || record.issue_id),
      issue_status: text(record.issueStatus || record.issue_status, "unlinked"),
      color: text(record.color),
      unmatched_reason: text(record.unmatchedReason || record.unmatched_reason),
      created_at: text(record.createdAt, new Date().toISOString()),
      updated_at: text(record.updatedAt || record.createdAt, new Date().toISOString()),
    }));
  }

  for (const change of arrayOf(store.modelDiffPropChanges)) {
    lines.push(insert("model_diff_prop_changes", {
      id: text(change.id),
      diff_id: text(change.diffId || change.diff_id),
      task_id: text(change.taskId || change.task_id),
      prop_name: text(change.propName || change.prop_name),
      value_a: text(change.valueA ?? change.value_a),
      value_b: text(change.valueB ?? change.value_b),
    }));
  }

  for (const summary of arrayOf(store.modelDiffAiSummaries)) {
    lines.push(insert("model_diff_ai_summaries", {
      id: text(summary.id),
      task_id: text(summary.taskId || summary.task_id),
      summary: text(summary.summary),
      detail_by_discipline_json: json(summary.detailByDiscipline || summary.detail_by_discipline, []),
      generated_at: text(summary.generatedAt || summary.generated_at || summary.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateConstructionSchedule(store, lines) {
  for (const schedule of arrayOf(store.constructionScheduleVersions)) {
    lines.push(insert("construction_schedule_versions", {
      id: text(schedule.id),
      project_id: text(schedule.projectId),
      document_id: text(schedule.documentId || schedule.fileId),
      model_urn: text(schedule.modelUrn),
      version_id: text(schedule.versionId),
      name: text(schedule.name),
      project_name: text(schedule.projectName),
      p6_project_id: text(schedule.p6ProjectId || schedule.p6_project_id),
      data_date: text(schedule.dataDate || schedule.data_date),
      planned_start: text(schedule.plannedStart || schedule.planned_start),
      planned_finish: text(schedule.plannedFinish || schedule.planned_finish),
      is_baseline: bool(schedule.isBaseline || schedule.is_baseline),
      is_current: bool(schedule.isCurrent ?? schedule.is_current),
      status: text(schedule.status, "imported"),
      activity_count: number(schedule.activityCount ?? schedule.activity_count),
      mapped_activity_count: number(schedule.mappedActivityCount ?? schedule.mapped_activity_count),
      import_summary_json: json(schedule.importSummary || schedule.import_summary, {}),
      xer_file_id: text(schedule.xerFileId || schedule.xer_file_id),
      imported_by: text(schedule.importedBy || schedule.imported_by),
      imported_at: text(schedule.importedAt || schedule.imported_at || schedule.createdAt, new Date().toISOString()),
      created_at: text(schedule.createdAt || schedule.created_at, new Date().toISOString()),
      updated_at: text(schedule.updatedAt || schedule.updated_at || schedule.createdAt, new Date().toISOString()),
    }));
  }

  for (const node of arrayOf(store.constructionScheduleWbsNodes)) {
    lines.push(insert("construction_schedule_wbs_nodes", {
      id: text(node.id),
      schedule_id: text(node.scheduleId || node.schedule_id),
      project_id: text(node.projectId),
      wbs_id: text(node.wbsId || node.wbs_id),
      code: text(node.code),
      name: text(node.name),
      parent_id: text(node.parentId || node.parent_id),
      level: number(node.level, 1),
      path: text(node.path),
      sequence: number(node.sequence),
    }));
  }

  for (const activity of arrayOf(store.constructionScheduleActivities)) {
    lines.push(insert("construction_schedule_activities", {
      id: text(activity.id),
      schedule_id: text(activity.scheduleId || activity.schedule_id),
      project_id: text(activity.projectId),
      activity_id: text(activity.activityId || activity.activity_id),
      internal_id: text(activity.internalId || activity.internal_id),
      name: text(activity.name),
      wbs_id: text(activity.wbsId || activity.wbs_id),
      type: text(activity.type, "Task"),
      planned_start: text(activity.plannedStart || activity.planned_start),
      planned_finish: text(activity.plannedFinish || activity.planned_finish),
      actual_start: text(activity.actualStart || activity.actual_start),
      actual_finish: text(activity.actualFinish || activity.actual_finish),
      percent_complete: number(activity.percentComplete ?? activity.percent_complete),
      status: text(activity.status, "Not Started"),
      total_float_hours: number(activity.totalFloatHours ?? activity.total_float_hours),
      calendar_id: text(activity.calendarId || activity.calendar_id),
      discipline: text(activity.discipline),
      deleted_at: text(activity.deletedAt || activity.deleted_at),
      created_at: text(activity.createdAt || activity.created_at, new Date().toISOString()),
      updated_at: text(activity.updatedAt || activity.updated_at || activity.createdAt, new Date().toISOString()),
    }));
  }

  for (const predecessor of arrayOf(store.constructionSchedulePredecessors)) {
    lines.push(insert("construction_schedule_predecessors", {
      id: text(predecessor.id),
      schedule_id: text(predecessor.scheduleId || predecessor.schedule_id),
      project_id: text(predecessor.projectId),
      predecessor_id: text(predecessor.predecessorId || predecessor.predecessor_id),
      successor_id: text(predecessor.successorId || predecessor.successor_id),
      type: text(predecessor.type, "FS"),
      lag: number(predecessor.lag),
    }));
  }

  for (const mapping of arrayOf(store.constructionScheduleMappings)) {
    lines.push(insert("construction_schedule_mappings", {
      id: text(mapping.id),
      schedule_id: text(mapping.scheduleId || mapping.schedule_id),
      project_id: text(mapping.projectId),
      document_id: text(mapping.documentId || mapping.fileId),
      activity_id: text(mapping.activityId || mapping.activity_id),
      activity_row_id: text(mapping.activityRowId || mapping.activity_row_id),
      model_urn: text(mapping.modelUrn || mapping.model_urn),
      dbid: number(mapping.dbId ?? mapping.dbid),
      unique_id: text(mapping.uniqueId || mapping.unique_id),
      match_method: text(mapping.matchMethod || mapping.match_method, "manual"),
      confidence: text(mapping.confidence, "Manual"),
      reason: text(mapping.reason),
      status: text(mapping.status, "active"),
      created_by: text(mapping.createdBy || mapping.created_by),
      created_at: text(mapping.createdAt || mapping.created_at, new Date().toISOString()),
      updated_at: text(mapping.updatedAt || mapping.updated_at || mapping.createdAt, new Date().toISOString()),
    }));
  }

  for (const report of arrayOf(store.constructionProgressReports)) {
    lines.push(insert("construction_progress_reports", {
      id: text(report.id),
      schedule_id: text(report.scheduleId || report.schedule_id),
      project_id: text(report.projectId),
      activity_id: text(report.activityId || report.activity_id),
      activity_row_id: text(report.activityRowId || report.activity_row_id),
      reported_by: text(report.reportedBy || report.reported_by),
      reported_at: text(report.reportedAt || report.reported_at, new Date().toISOString()),
      actual_start: text(report.actualStart || report.actual_start),
      actual_finish: text(report.actualFinish || report.actual_finish),
      percent_complete: number(report.percentComplete ?? report.percent_complete),
      note: text(report.note),
      attachments_json: json(report.attachments, []),
    }));
  }

  for (const snapshot of arrayOf(store.constructionScheduleSnapshots)) {
    lines.push(insert("construction_schedule_snapshots", {
      id: text(snapshot.id),
      schedule_id: text(snapshot.scheduleId || snapshot.schedule_id),
      project_id: text(snapshot.projectId),
      snapshot_date: text(snapshot.snapshotDate || snapshot.snapshot_date),
      created_by: text(snapshot.createdBy || snapshot.created_by),
      screenshot_url: text(snapshot.screenshotUrl || snapshot.screenshot_url),
      stats_json: json(snapshot.stats, {}),
      created_at: text(snapshot.createdAt || snapshot.created_at, new Date().toISOString()),
    }));
  }

  for (const alert of arrayOf(store.constructionScheduleAlerts)) {
    lines.push(insert("construction_schedule_alerts", {
      id: text(alert.id),
      schedule_id: text(alert.scheduleId || alert.schedule_id),
      project_id: text(alert.projectId),
      activity_id: text(alert.activityId || alert.activity_id),
      activity_row_id: text(alert.activityRowId || alert.activity_row_id),
      activity_code: text(alert.activityCode || alert.activity_code),
      activity_name: text(alert.activityName || alert.activity_name),
      type: text(alert.type),
      severity: text(alert.severity, "medium"),
      message: text(alert.message),
      planned_finish: text(alert.plannedFinish || alert.planned_finish),
      percent_complete: number(alert.percentComplete ?? alert.percent_complete),
      delay_days: number(alert.delayDays ?? alert.delay_days),
      dbids_json: json(alert.dbIds || alert.dbids, []),
      unique_ids_json: json(alert.uniqueIds || alert.unique_ids, []),
      status: text(alert.status, "open"),
      issue_id: text(alert.issueId || alert.issue_id),
      triggered_at: text(alert.triggeredAt || alert.triggered_at),
      resolved_at: text(alert.resolvedAt || alert.resolved_at),
      created_at: text(alert.createdAt || alert.created_at, new Date().toISOString()),
      updated_at: text(alert.updatedAt || alert.updated_at || alert.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateModelClashRuns(store, lines) {
  for (const run of arrayOf(store.modelClashRuns)) {
    lines.push(insert("model_clash_runs", {
      id: text(run.id),
      project_id: text(run.projectId),
      document_ids_json: json(run.documentIds, []),
      status: text(run.status, "succeeded"),
      rule_json: json(run.rule, {}),
      summary_json: json(run.summary, {}),
      record_ids_json: json(run.recordIds, []),
      issue_ids_json: json(run.issueIds, []),
      actor: text(run.actor),
      error: text(run.error),
      created_at: text(run.createdAt, new Date().toISOString()),
      updated_at: text(run.updatedAt || run.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateModelClashRecords(store, lines) {
  for (const record of arrayOf(store.modelClashRecords)) {
    lines.push(insert("model_clash_records", {
      id: text(record.id),
      run_id: text(record.runId),
      project_id: text(record.projectId),
      document_id_a: text(record.documentIdA),
      model_urn_a: text(record.modelUrnA || record.model_urn_a),
      dbid_a: number(record.dbIdA ?? record.dbid_a),
      element_name_a: text(record.elementNameA),
      discipline_a: text(record.disciplineA),
      document_id_b: text(record.documentIdB),
      model_urn_b: text(record.modelUrnB || record.model_urn_b),
      dbid_b: number(record.dbIdB ?? record.dbid_b),
      element_name_b: text(record.elementNameB),
      discipline_b: text(record.disciplineB),
      clash_volume: number(record.clashVolume ?? record.clash_volume),
      status: text(record.status, "open"),
      issue_id: text(record.issueId || record.issue_id),
      responsibility_discipline: text(record.responsibilityDiscipline),
      center_json: json(record.center, [0, 0, 0]),
      intersection_box_json: json(record.intersectionBox, {}),
      created_at: text(record.createdAt, new Date().toISOString()),
      updated_at: text(record.updatedAt || record.createdAt, new Date().toISOString()),
    }));
  }
}

function migrateModelClashHeatmaps(store, lines) {
  for (const task of arrayOf(store.modelClashHeatmaps)) {
    lines.push(insert("model_clash_heatmaps", {
      id: text(task.id),
      clash_task_id: text(task.clashTaskId || task.clash_task_id || task.runId),
      project_id: text(task.projectId),
      grid_size: number(task.gridSize ?? task.grid_size, 1),
      status: text(task.status, "succeeded"),
      summary_json: json(task.summary, {}),
      created_at: text(task.createdAt, new Date().toISOString()),
      updated_at: text(task.updatedAt || task.createdAt, new Date().toISOString()),
    }));
  }

  for (const cell of arrayOf(store.modelClashHeatmapCells)) {
    lines.push(insert("model_clash_heatmap_cells", {
      id: text(cell.id),
      heatmap_id: text(cell.heatmapId || cell.heatmap_id),
      x: number(cell.x),
      y: number(cell.y),
      z: number(cell.z),
      grid_size: number(cell.gridSize ?? cell.grid_size, 1),
      density: number(cell.density),
      discipline_pair: text(cell.disciplinePair || cell.discipline_pair),
      record_ids_json: json(cell.recordIds || cell.record_ids, []),
      bbox_json: json(cell.bbox, {}),
      color: text(cell.color),
      intensity: number(cell.intensity),
    }));
  }

  for (const hotspot of arrayOf(store.modelClashHotspots)) {
    lines.push(insert("model_clash_hotspots", {
      id: text(hotspot.id),
      heatmap_id: text(hotspot.heatmapId || hotspot.heatmap_id),
      bbox_json: json(hotspot.bbox, {}),
      center_json: json(hotspot.center, [0, 0, 0]),
      clash_count: number(hotspot.clashCount ?? hotspot.clash_count),
      disciplines_json: json(hotspot.disciplines, []),
      discipline_pairs_json: json(hotspot.disciplinePairs || hotspot.discipline_pairs, []),
      open_issue_count: number(hotspot.openIssueCount ?? hotspot.open_issue_count),
      record_ids_json: json(hotspot.recordIds || hotspot.record_ids, []),
    }));
  }
}

function migrateDrawingPrecheck(store, lines) {
  for (const task of arrayOf(store.drawingPrecheckTasks)) {
    lines.push(insert("drawing_precheck_tasks", {
      id: text(task.id),
      project_id: text(task.projectId),
      file_id: text(task.fileId),
      file_name: text(task.fileName),
      version_id: text(task.versionId),
      version_label: text(task.version, "V1"),
      status: text(task.status, "completed"),
      checks_json: json(task.checks, {}),
      gate_json: json(task.gate, {}),
      summary_json: json(task.summary, {}),
      report_json: json(task.report, {}),
      result_ids_json: json(task.resultIds, []),
      triggered_by: text(task.triggeredBy),
      triggered_by_name: text(task.triggeredByName),
      error: text(task.error),
      created_at: text(task.createdAt, new Date().toISOString()),
      updated_at: text(task.updatedAt || task.createdAt, new Date().toISOString()),
      completed_at: text(task.completedAt),
    }));
  }

  for (const result of arrayOf(store.drawingPrecheckResults)) {
    lines.push(insert("drawing_precheck_results", {
      id: text(result.id),
      task_id: text(result.taskId),
      project_id: text(result.projectId),
      file_id: text(result.fileId),
      file_name: text(result.fileName),
      version_id: text(result.versionId),
      version_label: text(result.version, "V1"),
      check_type: text(result.checkType, "rule"),
      source: text(result.source || result.checkType, "rule"),
      level: text(result.level, "info"),
      category: text(result.category),
      title: text(result.title),
      description: text(result.description),
      page: number(result.page, 1),
      position_json: json(result.position, {}),
      confidence: text(result.confidence),
      status: text(result.status, "open"),
      disposition: text(result.disposition),
      annotation_id: text(result.annotationId),
      created_at: text(result.createdAt, new Date().toISOString()),
      updated_at: text(result.updatedAt || result.createdAt, new Date().toISOString()),
    }));
  }

  for (const snapshot of arrayOf(store.drawingExtractionSnapshots)) {
    lines.push(insert("drawing_extraction_snapshots", {
      id: text(snapshot.id),
      project_id: text(snapshot.projectId),
      file_id: text(snapshot.fileId),
      file_name: text(snapshot.fileName),
      version_id: text(snapshot.versionId),
      version_label: text(snapshot.version, "V1"),
      text_content_json: json(snapshot.textContent, {}),
      metadata_json: json(snapshot.metadata, {}),
      diff_json: json(snapshot.diff, {}),
      created_at: text(snapshot.createdAt, new Date().toISOString()),
      updated_at: text(snapshot.updatedAt || snapshot.createdAt, new Date().toISOString()),
    }));
  }

  for (const config of arrayOf(store.drawingRuleConfigs)) {
    lines.push(insert("drawing_rule_configs", {
      id: text(config.id),
      project_id: text(config.projectId),
      rules_json: json(config.rules, {}),
      created_at: text(config.createdAt, new Date().toISOString()),
      updated_at: text(config.updatedAt || config.createdAt, new Date().toISOString()),
    }));
  }
}

function buildSeedSql(store) {
  const lines = [
    "PRAGMA foreign_keys = ON;",
    "BEGIN TRANSACTION;",
    "DELETE FROM drawing_rule_configs;",
    "DELETE FROM drawing_extraction_snapshots;",
    "DELETE FROM drawing_precheck_results;",
    "DELETE FROM drawing_precheck_tasks;",
    "DELETE FROM model_clash_hotspots;",
    "DELETE FROM model_clash_heatmap_cells;",
    "DELETE FROM model_clash_heatmaps;",
    "DELETE FROM model_clash_records;",
    "DELETE FROM model_clash_runs;",
    "DELETE FROM model_diff_ai_summaries;",
    "DELETE FROM model_diff_prop_changes;",
    "DELETE FROM model_diff_records;",
    "DELETE FROM model_diff_snapshots;",
    "DELETE FROM model_diff_tasks;",
    "DELETE FROM construction_schedule_alerts;",
    "DELETE FROM construction_schedule_snapshots;",
    "DELETE FROM construction_progress_reports;",
    "DELETE FROM construction_schedule_mappings;",
    "DELETE FROM construction_schedule_predecessors;",
    "DELETE FROM construction_schedule_activities;",
    "DELETE FROM construction_schedule_wbs_nodes;",
    "DELETE FROM construction_schedule_versions;",
    "DELETE FROM model_health_false_positive_records;",
    "DELETE FROM model_health_ai_results;",
    "DELETE FROM model_health_rule_results;",
    "DELETE FROM model_health_tasks;",
    "DELETE FROM model_health_rulesets;",
    "DELETE FROM model_geometry_extraction_tasks;",
    "DELETE FROM quantity_summaries;",
    "DELETE FROM quantity_property_snapshots;",
    "DELETE FROM quantity_takeoff_tasks;",
    "DELETE FROM quantity_templates;",
    "DELETE FROM audit_logs;",
    "DELETE FROM jobs;",
    "DELETE FROM system_email_settings;",
    "DELETE FROM system_ai_settings;",
    "DELETE FROM system_aps_settings;",
    "DELETE FROM project_email_notifications;",
    "DELETE FROM workflows;",
    "DELETE FROM workflow_templates;",
    "DELETE FROM annotation_replies;",
    "DELETE FROM annotations;",
    "DELETE FROM document_workflows;",
    "DELETE FROM document_versions;",
    "DELETE FROM documents;",
    "DELETE FROM folder_permissions;",
    "DELETE FROM folders;",
    "DELETE FROM project_members;",
    "DELETE FROM users;",
    "DELETE FROM projects;",
  ];

  migrateProjects(store, lines);
  migrateUsers(store, lines);
  migrateSystemEmailSettings(store, lines);
  migrateSystemAiSettings(store, lines);
  migrateSystemApsSettings(store, lines);
  migrateProjectEmailNotifications(store, lines);
  migrateProjectMembers(store, lines);
  migrateFolders(store, lines);
  migrateFolderPermissions(store, lines);
  migrateDocuments(store, lines);
  migrateWorkflowTemplates(store, lines);
  migrateWorkflows(store, lines);
  migrateModelGeometryExtractionTasks(store, lines);
  migrateModelHealth(store, lines);
  migrateQuantityTakeoff(store, lines);
  migrateModelDiff(store, lines);
  migrateConstructionSchedule(store, lines);
  migrateAuditLogs(store, lines);
  migrateJobs(store, lines);
  migrateModelClashRuns(store, lines);
  migrateModelClashRecords(store, lines);
  migrateModelClashHeatmaps(store, lines);
  migrateDrawingPrecheck(store, lines);

  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const store = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const sql = buildSeedSql(store);

  if (args.stdout) {
    process.stdout.write(sql);
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, sql, "utf8");
  console.log(`Wrote ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildSeedSql,
  parseArgs,
};
