const MIGRATION_STATUSES = new Set(["synced", "deleted", "pending"]);

function safeText(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }
  const text = String(value).trim();
  return text || fallback;
}

function cloneJson(value, fallback = null) {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function pickField(value, camelKey, snakeKey, fallback = undefined) {
  if (value && Object.prototype.hasOwnProperty.call(value, camelKey)) {
    return value[camelKey];
  }
  if (value && Object.prototype.hasOwnProperty.call(value, snakeKey)) {
    return value[snakeKey];
  }
  return fallback;
}

function normalizeDbIds(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const dbIds = [];
  source.forEach((item) => {
    const dbId = Number(item);
    if (!Number.isFinite(dbId) || dbId < 0 || seen.has(dbId)) {
      return;
    }
    seen.add(dbId);
    dbIds.push(dbId);
  });
  return dbIds;
}

function normalizeMigrationStatus(value, fallback = "synced") {
  const status = safeText(value, "").toLowerCase();
  return MIGRATION_STATUSES.has(status) ? status : fallback;
}

function normalizeIssueLocationFields(value = {}, defaults = {}) {
  const viewerState = cloneJson(
    pickField(value, "viewerState", "viewer_state", pickField(defaults, "viewerState", "viewer_state", null)),
    null,
  );
  const dbIds = normalizeDbIds(pickField(value, "dbIds", "dbids", pickField(defaults, "dbIds", "dbids", [])));
  const modelUrn = safeText(
    pickField(value, "modelUrn", "model_urn", pickField(defaults, "modelUrn", "model_urn", "")),
    "",
  );
  const sheetGuid = safeText(
    pickField(value, "sheetGuid", "sheet_guid", pickField(defaults, "sheetGuid", "sheet_guid", "")),
    "",
  );
  const elementUniqueId = safeText(
    pickField(value, "elementUniqueId", "element_unique_id", pickField(defaults, "elementUniqueId", "element_unique_id", "")),
    "",
  );
  const elementId = safeText(
    pickField(value, "elementId", "element_id", pickField(defaults, "elementId", "element_id", "")),
    "",
  );
  const boundModelVersion = safeText(
    pickField(value, "boundModelVersion", "bound_model_version", pickField(defaults, "boundModelVersion", "bound_model_version", "")),
    "",
  );
  const migrationStatus = normalizeMigrationStatus(
    pickField(value, "migrationStatus", "migration_status", pickField(defaults, "migrationStatus", "migration_status", "synced")),
    "synced",
  );

  return {
    viewerState,
    dbIds,
    modelUrn,
    sheetGuid,
    elementUniqueId,
    elementId,
    boundModelVersion,
    migrationStatus,
  };
}

function hasObjectKeys(value) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length);
}

function hasIssueLocation(annotation = {}) {
  const fields = normalizeIssueLocationFields(annotation);
  return Boolean(
    hasObjectKeys(fields.viewerState) ||
    fields.dbIds.length ||
    fields.modelUrn ||
    fields.sheetGuid ||
    fields.elementUniqueId ||
    fields.elementId,
  );
}

function normalizeIndexRecord(record = {}) {
  const dbId = Number(pickField(record, "dbId", "dbid", record.objectId));
  if (!Number.isFinite(dbId) || dbId < 0) {
    return null;
  }

  const elementUniqueId = safeText(
    pickField(record, "elementUniqueId", "element_unique_id", record.uniqueId || record.UniqueId || record.externalId || record.handle || record.Handle),
    "",
  );
  const elementId = safeText(
    pickField(record, "elementId", "element_id", record.ElementId),
    "",
  );

  if (!elementUniqueId && !elementId) {
    return null;
  }

  return {
    dbId,
    elementUniqueId,
    elementId,
  };
}

function normalizeElementIndex(elementIndex) {
  if (Array.isArray(elementIndex)) {
    return elementIndex.map(normalizeIndexRecord).filter(Boolean);
  }
  if (!elementIndex || typeof elementIndex !== "object") {
    return [];
  }
  return Object.entries(elementIndex)
    .map(([key, value]) => {
      if (value && typeof value === "object") {
        return normalizeIndexRecord({ ...value, dbId: value.dbId ?? value.dbid ?? key });
      }
      return normalizeIndexRecord({ dbId: value, elementUniqueId: key });
    })
    .filter(Boolean);
}

function matchesAnnotation(record, annotation) {
  const fields = normalizeIssueLocationFields(annotation);
  if (fields.elementUniqueId && record.elementUniqueId === fields.elementUniqueId) {
    return true;
  }
  return Boolean(!fields.elementUniqueId && fields.elementId && record.elementId === fields.elementId);
}

function syncRegionIssue(annotation, options) {
  annotation.modelUrn = safeText(options.modelUrn, annotation.modelUrn || "");
  annotation.boundModelVersion = safeText(options.boundModelVersion, annotation.boundModelVersion || "");
  if (options.versionId) {
    annotation.versionId = safeText(options.versionId, annotation.versionId || "");
  }
  annotation.migrationStatus = "synced";
}

function migrateIssueBindings(annotations, options = {}) {
  const index = normalizeElementIndex(options.elementIndex);
  const stats = {
    synced: 0,
    deleted: 0,
    pending: 0,
    skipped: 0,
  };

  if (!Array.isArray(annotations)) {
    return stats;
  }

  annotations.forEach((annotation) => {
    if (!annotation || annotation.status !== "open" || !hasIssueLocation(annotation)) {
      stats.skipped += 1;
      return;
    }

    const fields = normalizeIssueLocationFields(annotation);
    const hasStableId = Boolean(fields.elementUniqueId || fields.elementId);
    if (!hasStableId) {
      if (!fields.dbIds.length) {
        syncRegionIssue(annotation, options);
        stats.synced += 1;
        return;
      }
      annotation.migrationStatus = "pending";
      annotation.dbIds = [];
      stats.pending += 1;
      return;
    }

    if (!index.length) {
      stats.skipped += 1;
      return;
    }

    const matches = index.filter((record) => matchesAnnotation(record, annotation));
    if (matches.length === 1) {
      const [match] = matches;
      annotation.dbIds = [match.dbId];
      annotation.modelUrn = safeText(options.modelUrn, annotation.modelUrn || "");
      annotation.boundModelVersion = safeText(options.boundModelVersion, annotation.boundModelVersion || "");
      annotation.elementUniqueId = safeText(match.elementUniqueId, annotation.elementUniqueId || "");
      annotation.elementId = safeText(match.elementId, annotation.elementId || "");
      annotation.migrationStatus = "synced";
      if (options.versionId) {
        annotation.versionId = safeText(options.versionId, annotation.versionId || "");
      }
      stats.synced += 1;
      return;
    }

    annotation.dbIds = [];
    annotation.migrationStatus = matches.length ? "pending" : "deleted";
    if (options.versionId) {
      annotation.versionId = safeText(options.versionId, annotation.versionId || "");
    }
    annotation.modelUrn = safeText(options.modelUrn, annotation.modelUrn || "");
    annotation.boundModelVersion = safeText(options.boundModelVersion, annotation.boundModelVersion || "");
    stats[matches.length ? "pending" : "deleted"] += 1;
  });

  return stats;
}

module.exports = {
  normalizeIssueLocationFields,
  normalizeDbIds,
  normalizeMigrationStatus,
  hasIssueLocation,
  normalizeElementIndex,
  migrateIssueBindings,
};
