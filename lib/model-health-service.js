const DEFAULT_GATE_CONFIG = Object.freeze({
  mode: "standard",
  errorThreshold: 0,
  warningThreshold: 0,
  requireWarningDisposition: true,
  requireAiDisposition: true,
  aiEnabled: true,
});

const DEFAULT_REQUIRED_FIELDS = Object.freeze({
  "结构梁": ["Height", "Material", "Level"],
  beam: ["Height", "Material", "Level"],
  "结构柱": ["Height", "Material", "Base Level", "Top Level"],
  column: ["Height", "Material", "Base Level", "Top Level"],
  "楼板": ["Thickness", "Material", "Level"],
  slab: ["Thickness", "Material", "Level"],
  "管道": ["Diameter", "Wall Thickness", "Material", "System Name", "Pressure Rating", "Level"],
  pipe: ["Diameter", "Wall Thickness", "Material", "System Name", "Pressure Rating", "Level"],
  "设备": ["Tag Number", "Equipment Type", "Level"],
  equipment: ["Tag Number", "Equipment Type", "Level"],
  "阀门": ["Valve Type", "Nominal Diameter", "Pressure Rating"],
  valve: ["Valve Type", "Nominal Diameter", "Pressure Rating"],
  "房间": ["Room Name", "Room Number", "Level"],
  room: ["Room Name", "Room Number", "Level"],
});

const ELEMENT_TYPE_ALIASES = ["Category", "Type Name", "Type", "Family and Type", "Family", "Element Type", "Equipment Type", "Object Type", "Part Type", "Line Class", "类别", "类型", "设备类型"];
const FLOOR_ALIASES = ["Level", "Reference Level", "Base Level", "所在楼层", "楼层", "Floor", "Storey", "Building Storey", "Location", "Process Unit", "Plant Area", "Area", "Zone", "区域", "装置区"];
const DISCIPLINE_ALIASES = ["Discipline", "System Classification", "System Type", "Trade", "Design Discipline", "专业", "设计专业"];
const TAG_ALIASES = ["Tag Number", "Tag", "Equipment Tag", "设备位号", "位号"];
const SYSTEM_ALIASES = ["System", "System Name", "System Type", "系统", "系统名称"];
const FAMILY_ALIASES = ["Family", "Family Name", "族名"];
const TYPE_ALIASES = ["Type Name", "Type", "类型名"];
const WORKSET_ALIASES = ["Workset", "Layer", "图层", "工作集"];
const MATERIAL_ALIASES = ["Material", "Structural Material", "材质", "材料"];
const PLACEHOLDER_PATTERN = /(待定|暂定|见图|临时|删除|错误|勿删|TBD|TEST|TODO|dummy|temp)/i;
const FIELD_VALUE_ALIASES = Object.freeze({
  "line number": ["Line Number", "Line Number Tag", "Line No", "Line ID", "管线编号", "管线号"],
  linenumber: ["Line Number", "Line Number Tag", "Line No", "Line ID", "管线编号", "管线号"],
  "associated level": FLOOR_ALIASES,
  diameter: ["Diameter", "Nominal Diameter", "DN", "NPS", "Size", "管径", "公称直径"],
  "nominal diameter": ["Nominal Diameter", "Diameter", "DN", "NPS", "Size", "管径", "公称直径"],
  nominaldiameter: ["Nominal Diameter", "Diameter", "DN", "NPS", "Size", "管径", "公称直径"],
  "wall thickness": ["Wall Thickness", "Wall Thk", "Thickness", "Pipe Thickness", "壁厚"],
  "pressure rating": ["Pressure Rating", "Pressure Class", "Pressure Grade", "PN", "Class", "压力等级"],
  "system name": ["System Name", "System", "Service", "Service Name", "系统名称", "系统"],
  level: FLOOR_ALIASES,
  "equipment type": ["Equipment Type", "Type Name", "Type", "Part Type", "设备类型"],
  "valve type": ["Valve Type", "Type Name", "Type", "Part Type", "阀门类型"],
  "tag number": TAG_ALIASES,
});

function safeText(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }
  const text = String(value).trim();
  return text || fallback;
}

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function uniqueTexts(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((item) => safeText(item, ""))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function jsonClone(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function normalizeKey(value) {
  return safeText(value, "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function normalizePropertyMap(item) {
  const map = {};
  function add(name, value) {
    const key = safeText(name, "");
    if (!key || value === undefined || value === null) {
      return;
    }
    map[key] = value;
  }
  function flatten(value, prefix = "") {
    if (!value || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => flatten(entry, prefix));
      return;
    }
    const displayName = safeText(value.displayName || value.name || value.attributeName, "");
    if (displayName) {
      add(displayName, value.displayValue ?? value.display_value ?? value.value);
    }
    Object.entries(value).forEach(([key, child]) => {
      if (["displayName", "displayValue", "display_value", "name", "attributeName", "value"].includes(key)) {
        return;
      }
      if (child && typeof child === "object") {
        flatten(child, prefix ? `${prefix}.${key}` : key);
        return;
      }
      add(prefix ? `${prefix}.${key}` : key, child);
      add(key, child);
    });
  }
  flatten(item?.properties || {});
  ["externalId", "guid", "uniqueId", "elementId", "category", "discipline"].forEach((key) => {
    if (item?.[key] !== undefined) {
      add(key, item[key]);
    }
  });
  return map;
}

function propertyLookup(map, aliases, fallback = "") {
  const normalized = new Map(Object.entries(map || {}).map(([key, value]) => [normalizeKey(key), value]));
  for (const alias of Array.isArray(aliases) ? aliases : [aliases]) {
    const value = normalized.get(normalizeKey(alias));
    if (value !== undefined && safeText(value, "")) {
      return value;
    }
  }
  return fallback;
}

function collectionFromDerivativePayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data?.collection)) {
    return payload.data.collection;
  }
  if (Array.isArray(payload?.collection)) {
    return payload.collection;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
}

function normalizeBoundingBox(box) {
  const value = box && typeof box === "object" ? box : {};
  if (!Array.isArray(value.min) || !Array.isArray(value.max)) {
    return null;
  }
  const min = value.min.slice(0, 3).map(Number);
  const max = value.max.slice(0, 3).map(Number);
  if (min.length !== 3 || max.length !== 3 || !min.every(Number.isFinite) || !max.every(Number.isFinite) || min.some((item, index) => item > max[index])) {
    return null;
  }
  return { min, max };
}

function normalizeRulesetRules(value = {}) {
  return {
    requiredFields: value.requiredFields && typeof value.requiredFields === "object" ? value.requiredFields : DEFAULT_REQUIRED_FIELDS,
    requiredFieldMeta: value.requiredFieldMeta && typeof value.requiredFieldMeta === "object" ? jsonClone(value.requiredFieldMeta, {}) : {},
    fieldPatterns: value.fieldPatterns && typeof value.fieldPatterns === "object" ? jsonClone(value.fieldPatterns, {}) : {},
    namingRules: value.namingRules && typeof value.namingRules === "object" ? value.namingRules : {},
    allowedFamilies: uniqueTexts(value.allowedFamilies),
    allowedTypes: uniqueTexts(value.allowedTypes),
    allowedSystems: uniqueTexts(value.allowedSystems),
    allowedWorksets: uniqueTexts(value.allowedWorksets),
    geometryLimits: value.geometryLimits && typeof value.geometryLimits === "object" ? value.geometryLimits : {},
    geometryLimitMeta: value.geometryLimitMeta && typeof value.geometryLimitMeta === "object" ? jsonClone(value.geometryLimitMeta, {}) : {},
    uniqueFields: value.uniqueFields && typeof value.uniqueFields === "object" ? jsonClone(value.uniqueFields, {}) : {},
    levels: Array.isArray(value.levels)
      ? value.levels.map((level) => ({
          name: safeText(level.name || level.level, ""),
          min: finiteNumber(level.min ?? level.elevation ?? level.bottom, 0),
          max: finiteNumber(level.max ?? level.top, finiteNumber(level.min ?? level.elevation ?? level.bottom, 0) + 4),
        })).filter((level) => level.name && level.min <= level.max)
      : [],
    outlierParameters: value.outlierParameters && typeof value.outlierParameters === "object" ? value.outlierParameters : {
      "结构梁": ["Height", "Length"],
      beam: ["Height", "Length"],
      "管道": ["Diameter", "Wall Thickness"],
      pipe: ["Diameter", "Wall Thickness"],
      "设备": ["Power", "Capacity"],
      equipment: ["Power", "Capacity"],
    },
    templateProfile: value.templateProfile && typeof value.templateProfile === "object" ? jsonClone(value.templateProfile, {}) : {},
    templateDisciplines: Array.isArray(value.templateDisciplines) ? jsonClone(value.templateDisciplines, []) : [],
    crossDisciplineChecks: Array.isArray(value.crossDisciplineChecks) ? jsonClone(value.crossDisciplineChecks, []) : [],
    aiChecks: value.aiChecks && typeof value.aiChecks === "object" ? jsonClone(value.aiChecks, {}) : {},
    namingConventions: value.namingConventions && typeof value.namingConventions === "object" ? jsonClone(value.namingConventions, {}) : {},
    severityDefinitions: value.severityDefinitions && typeof value.severityDefinitions === "object" ? jsonClone(value.severityDefinitions, {}) : {},
    scoreCalculation: value.scoreCalculation && typeof value.scoreCalculation === "object" ? jsonClone(value.scoreCalculation, {}) : {},
    projectSpecificNotes: Array.isArray(value.projectSpecificNotes) ? value.projectSpecificNotes.map((item) => safeText(item, "")).filter(Boolean) : [],
    templateExtras: value.templateExtras && typeof value.templateExtras === "object" ? jsonClone(value.templateExtras, {}) : {},
  };
}

function normalizeGateConfig(value = {}) {
  const mode = ["strict", "standard", "loose"].includes(safeText(value.mode, "standard")) ? safeText(value.mode, "standard") : "standard";
  return {
    ...DEFAULT_GATE_CONFIG,
    ...value,
    mode,
    errorThreshold: Math.max(0, Number(value.errorThreshold ?? DEFAULT_GATE_CONFIG.errorThreshold) || 0),
    warningThreshold: Math.max(0, Number(value.warningThreshold ?? DEFAULT_GATE_CONFIG.warningThreshold) || 0),
    minScoreToSubmit: Math.max(0, Math.min(100, Number(value.minScoreToSubmit ?? value.min_score_to_submit ?? 0) || 0)),
    requireWarningDisposition: value.requireWarningDisposition !== undefined ? Boolean(value.requireWarningDisposition) : DEFAULT_GATE_CONFIG.requireWarningDisposition,
    requireAiDisposition: value.requireAiDisposition !== undefined ? Boolean(value.requireAiDisposition) : DEFAULT_GATE_CONFIG.requireAiDisposition,
    aiEnabled: value.aiEnabled !== false,
  };
}

function buildDefaultModelHealthRuleset(input = {}) {
  const createdAt = safeText(input.createdAt, new Date().toISOString());
  const projectId = safeText(input.projectId, "default");
  const discipline = safeText(input.discipline, "general");
  return {
    id: safeText(input.id, `${projectId}-${discipline}-model-health-ruleset`),
    projectId,
    discipline,
    name: safeText(input.name, `${discipline} 模型健康度规则集`),
    description: safeText(input.description, "审批前模型质量自动检查规则集"),
    rules: normalizeRulesetRules(input.rules || {}),
    gateConfig: normalizeGateConfig(input.gateConfig || {}),
    version: safeText(input.version, "1.0.0"),
    builtIn: Boolean(input.builtIn),
    createdAt,
    updatedAt: safeText(input.updatedAt, createdAt),
  };
}

function elementTypeMatches(elementType, configuredType) {
  const left = normalizeKey(elementType);
  const right = normalizeKey(configuredType);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function configForElementType(map, elementType) {
  const entries = Object.entries(map || {});
  const matched = entries.find(([key]) => elementTypeMatches(elementType, key));
  return matched ? matched[1] : null;
}

function modelElementsFromDerivativeProperties(payload, options = {}) {
  const geometryByDbId = new Map((Array.isArray(options.geometryIndex) ? options.geometryIndex : []).map((item) => [Number(item.dbId ?? item.dbid), item]));
  return collectionFromDerivativePayload(payload).map((item) => {
    const dbId = Number(item.objectid ?? item.objectId ?? item.dbId ?? item.dbid);
    if (!Number.isInteger(dbId) || dbId < 0) {
      return null;
    }
    const properties = normalizePropertyMap(item);
    const geometry = geometryByDbId.get(dbId) || {};
    const elementType = safeText(propertyLookup(properties, ELEMENT_TYPE_ALIASES, item.category || item.name), "未分类");
    const name = safeText(item.name || propertyLookup(properties, ["Name", "名称"]), `dbId ${dbId}`);
    const boundingBox = normalizeBoundingBox(item.boundingBox || item.bbox || geometry.boundingBox || geometry.bbox);
    return {
      dbId,
      name,
      elementType,
      family: safeText(propertyLookup(properties, FAMILY_ALIASES, "")),
      typeName: safeText(propertyLookup(properties, TYPE_ALIASES, "")),
      discipline: safeText(propertyLookup(properties, DISCIPLINE_ALIASES, item.discipline || options.defaultDiscipline || "general")),
      floor: safeText(propertyLookup(properties, FLOOR_ALIASES, "")),
      tag: safeText(propertyLookup(properties, TAG_ALIASES, "")),
      systemName: safeText(propertyLookup(properties, SYSTEM_ALIASES, "")),
      workset: safeText(propertyLookup(properties, WORKSET_ALIASES, "")),
      material: safeText(propertyLookup(properties, MATERIAL_ALIASES, "")),
      properties,
      boundingBox,
    };
  }).filter(Boolean);
}

function createRuleResult(base) {
  return {
    id: safeText(base.id, ""),
    taskId: safeText(base.taskId, ""),
    ruleId: safeText(base.ruleId, ""),
    level: ["error", "warning", "info"].includes(safeText(base.level, "error")) ? safeText(base.level, "error") : "error",
    category: safeText(base.category, "general"),
    description: safeText(base.description, ""),
    dbIds: Array.isArray(base.dbIds) ? base.dbIds.map(Number).filter(Number.isFinite) : [],
    actualValue: safeText(base.actualValue, ""),
    expectedValue: safeText(base.expectedValue, ""),
    status: safeText(base.status, "open"),
    createdAt: safeText(base.createdAt, ""),
    updatedAt: safeText(base.updatedAt, ""),
  };
}

function bboxSignature(box) {
  const normalized = normalizeBoundingBox(box);
  if (!normalized) {
    return "";
  }
  return [...normalized.min, ...normalized.max].map((value) => Number(value).toFixed(4)).join(",");
}

function bboxCenterZ(box) {
  const normalized = normalizeBoundingBox(box);
  return normalized ? (normalized.min[2] + normalized.max[2]) / 2 : NaN;
}

function isBlankValue(value) {
  return !safeText(value, "") || ["-", "--", "n/a", "na", "none", "null", "未设置", "无"].includes(safeText(value, "").toLowerCase());
}

function allowedListContains(list, value) {
  if (!Array.isArray(list) || !list.length || !safeText(value, "")) {
    return true;
  }
  const key = safeText(value, "").toLowerCase();
  return list.some((item) => safeText(item, "").toLowerCase() === key);
}

function regexMatches(pattern, value) {
  if (!safeText(pattern, "")) {
    return true;
  }
  try {
    return new RegExp(pattern).test(safeText(value, ""));
  } catch {
    return true;
  }
}

function fieldValue(element, fieldName) {
  const fieldKey = safeText(fieldName, "").toLowerCase();
  const direct = {
    name: element.name,
    family: element.family,
    typeName: element.typeName,
    tag: element.tag,
    systemName: element.systemName,
    floor: element.floor,
    material: element.material,
    workset: element.workset,
  }[fieldName] ?? {
    system: element.systemName,
    systemName: element.systemName,
    level: element.floor,
    floor: element.floor,
    material: element.material,
  }[fieldKey];
  return direct !== undefined ? direct : propertyLookup(element.properties, FIELD_VALUE_ALIASES[fieldKey] || [fieldName], "");
}

function runModelHealthRuleChecks(elements, rulesetInput = {}) {
  const ruleset = buildDefaultModelHealthRuleset(rulesetInput);
  const rules = ruleset.rules;
  const results = [];
  const tagMap = new Map();
  const uniqueFieldMap = new Map();
  const duplicateMap = new Map();

  elements.forEach((element) => {
    const requiredFields = configForElementType(rules.requiredFields, element.elementType) || [];
    const requiredMeta = configForElementType(rules.requiredFieldMeta, element.elementType) || {};
    const fieldPatterns = configForElementType(rules.fieldPatterns, element.elementType) || {};
    requiredFields.forEach((field) => {
      const actual = fieldValue(element, field);
      const meta = requiredMeta[field] || {};
      const severity = ["error", "warning", "info"].includes(safeText(meta.severity, "error")) ? safeText(meta.severity, "error") : "error";
      if (isBlankValue(actual)) {
        results.push(createRuleResult({
          ruleId: `required:${element.elementType}:${field}`,
          level: severity,
          category: "required",
          description: `${element.name} 缺少必填属性 ${field}。`,
          dbIds: [element.dbId],
          actualValue: actual,
          expectedValue: meta.note ? `${field} · ${meta.note}` : field,
        }));
        return;
      }
      const pattern = safeText(meta.pattern || fieldPatterns[field]?.pattern || fieldPatterns[field], "");
      if (pattern && !regexMatches(pattern, actual)) {
        results.push(createRuleResult({
          ruleId: `pattern:${element.elementType}:${field}`,
          level: severity,
          category: "naming",
          description: `${element.name} 的 ${field} 不符合模板格式。`,
          dbIds: [element.dbId],
          actualValue: actual,
          expectedValue: meta.note ? `${pattern} · ${meta.note}` : pattern,
        }));
      }
    });

    Object.entries(rules.namingRules || {}).forEach(([field, pattern]) => {
      const actual = fieldValue(element, field);
      if (safeText(actual, "") && !regexMatches(pattern, actual)) {
        results.push(createRuleResult({
          ruleId: `naming:${field}`,
          level: field === "tag" ? "error" : "warning",
          category: "naming",
          description: `${element.name} 的 ${field} 不符合命名规则。`,
          dbIds: [element.dbId],
          actualValue: actual,
          expectedValue: pattern,
        }));
      }
    });

    if (!allowedListContains(rules.allowedFamilies, element.family)) {
      results.push(createRuleResult({ ruleId: "family:allowlist", level: "warning", category: "naming", description: `${element.name} 的族名不在项目允许清单内。`, dbIds: [element.dbId], actualValue: element.family, expectedValue: rules.allowedFamilies.join(", ") }));
    }
    if (!allowedListContains(rules.allowedTypes, element.typeName)) {
      results.push(createRuleResult({ ruleId: "type:allowlist", level: "warning", category: "naming", description: `${element.name} 的类型名不在项目允许清单内。`, dbIds: [element.dbId], actualValue: element.typeName, expectedValue: rules.allowedTypes.join(", ") }));
    }
    if (!allowedListContains(rules.allowedSystems, element.systemName)) {
      results.push(createRuleResult({ ruleId: "system:allowlist", level: "warning", category: "naming", description: `${element.name} 的系统名称不在项目允许清单内。`, dbIds: [element.dbId], actualValue: element.systemName, expectedValue: rules.allowedSystems.join(", ") }));
    }
    if (!allowedListContains(rules.allowedWorksets, element.workset)) {
      results.push(createRuleResult({ ruleId: "workset:allowlist", level: "warning", category: "workset", description: `${element.name} 所在图层 / 工作集不符合项目规范。`, dbIds: [element.dbId], actualValue: element.workset, expectedValue: rules.allowedWorksets.join(", ") }));
    }

    const level = rules.levels.find((item) => safeText(item.name, "").toLowerCase() === safeText(element.floor, "").toLowerCase());
    if (!element.floor) {
      results.push(createRuleResult({ ruleId: "floor:missing", level: "error", category: "floor", description: `${element.name} 未关联楼层。`, dbIds: [element.dbId], actualValue: "", expectedValue: "Level" }));
    } else if (!level && rules.levels.length) {
      results.push(createRuleResult({ ruleId: "floor:unknown", level: "error", category: "floor", description: `${element.name} 的楼层 ${element.floor} 不在规则集楼层范围内。`, dbIds: [element.dbId], actualValue: element.floor, expectedValue: rules.levels.map((item) => item.name).join(", ") }));
    } else if (level && element.boundingBox) {
      const z = bboxCenterZ(element.boundingBox);
      if (Number.isFinite(z) && (z < level.min || z > level.max)) {
        results.push(createRuleResult({ ruleId: "floor:z-range", level: "error", category: "floor", description: `${element.name} 的实际位置不在所属楼层标高范围内。`, dbIds: [element.dbId], actualValue: `z=${z}`, expectedValue: `${level.name}: ${level.min}-${level.max}` }));
      }
    }

    const limits = configForElementType(rules.geometryLimits, element.elementType) || {};
    const limitMeta = configForElementType(rules.geometryLimitMeta, element.elementType) || {};
    Object.entries(limits).forEach(([field, limit]) => {
      const numeric = parseNumber(fieldValue(element, field));
      if (!Number.isFinite(numeric)) {
        return;
      }
      const min = Number(limit.min);
      const max = Number(limit.max);
      const meta = limitMeta[field] || {};
      const level = ["error", "warning", "info"].includes(safeText(meta.severity, "error")) ? safeText(meta.severity, "error") : "error";
      if ((Number.isFinite(min) && numeric < min) || (Number.isFinite(max) && numeric > max)) {
        results.push(createRuleResult({
          ruleId: `geometry:${element.elementType}:${field}`,
          level,
          category: "geometry",
          description: `${element.name} 的 ${field}=${numeric} 超出合理范围。`,
          dbIds: [element.dbId],
          actualValue: `${numeric}`,
          expectedValue: meta.note ? `${Number.isFinite(min) ? min : "-∞"}-${Number.isFinite(max) ? max : "+∞"} · ${meta.note}` : `${Number.isFinite(min) ? min : "-∞"}-${Number.isFinite(max) ? max : "+∞"}`,
        }));
      }
    });
    const volume = parseNumber(fieldValue(element, "Volume"));
    const length = parseNumber(fieldValue(element, "Length"));
    if (Number.isFinite(volume) && volume === 0) {
      results.push(createRuleResult({ ruleId: "geometry:zero-volume", level: "error", category: "geometry", description: `${element.name} 的体积为 0，疑似建模错误。`, dbIds: [element.dbId], actualValue: "0", expectedValue: "> 0" }));
    }
    if (Number.isFinite(length) && length === 0) {
      results.push(createRuleResult({ ruleId: "geometry:zero-length", level: "error", category: "geometry", description: `${element.name} 的长度为 0，疑似线性构件建模错误。`, dbIds: [element.dbId], actualValue: "0", expectedValue: "> 0" }));
    }

    if (element.tag) {
      const list = tagMap.get(element.tag.toLowerCase()) || [];
      list.push(element);
      tagMap.set(element.tag.toLowerCase(), list);
    }
    const uniqueFields = configForElementType(rules.uniqueFields, element.elementType) || [];
    uniqueFields.forEach((fieldRule) => {
      const field = safeText(fieldRule.field || fieldRule, "");
      const actual = fieldValue(element, field);
      if (!field || !safeText(actual, "")) {
        return;
      }
      const key = `${normalizeKey(element.elementType)}|${normalizeKey(field)}|${safeText(actual, "").toLowerCase()}`;
      const list = uniqueFieldMap.get(key) || [];
      list.push({ element, field, rule: fieldRule, actual });
      uniqueFieldMap.set(key, list);
    });
    const duplicateKey = [normalizeKey(element.elementType), bboxSignature(element.boundingBox), normalizeKey(element.family), normalizeKey(element.typeName)].join("|");
    if (bboxSignature(element.boundingBox)) {
      const list = duplicateMap.get(duplicateKey) || [];
      list.push(element);
      duplicateMap.set(duplicateKey, list);
    }
  });

  tagMap.forEach((group, tag) => {
    if (group.length > 1) {
      results.push(createRuleResult({ ruleId: "duplicate:tag", level: "error", category: "duplicate", description: `设备位号 ${tag} 出现在多个构件上，位号应唯一。`, dbIds: group.map((item) => item.dbId), actualValue: tag, expectedValue: "唯一" }));
    }
  });
  uniqueFieldMap.forEach((group) => {
    if (group.length > 1) {
      const first = group[0];
      const severity = ["error", "warning", "info"].includes(safeText(first.rule?.severity, "error")) ? safeText(first.rule?.severity, "error") : "error";
      results.push(createRuleResult({
        ruleId: `duplicate:${normalizeKey(first.field)}`,
        level: severity,
        category: "duplicate",
        description: `${first.field} ${first.actual} 出现在多个构件上，应保持唯一。`,
        dbIds: group.map((item) => item.element.dbId),
        actualValue: safeText(first.actual, ""),
        expectedValue: first.rule?.note ? `唯一 · ${first.rule.note}` : "唯一",
      }));
    }
  });
  duplicateMap.forEach((group) => {
    if (group.length > 1) {
      results.push(createRuleResult({ ruleId: "duplicate:bbox", level: "warning", category: "duplicate", description: `发现同位置同类型重复构件：${group.map((item) => item.name).join(" / ")}。`, dbIds: group.map((item) => item.dbId), actualValue: group.map((item) => item.dbId).join(", "), expectedValue: "无完全重叠重复构件" }));
    }
  });
  return results;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function standardDeviation(values, avg = mean(values)) {
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(1, values.length));
}

function confidenceFromZScore(zScore) {
  if (Math.abs(zScore) >= 3) return "high";
  if (Math.abs(zScore) >= 2.5) return "medium";
  return "low";
}

function createAiResult(base) {
  return {
    id: safeText(base.id, ""),
    taskId: safeText(base.taskId, ""),
    category: safeText(base.category, "semantic"),
    description: safeText(base.description, ""),
    dbIds: Array.isArray(base.dbIds) ? base.dbIds.map(Number).filter(Number.isFinite) : [],
    referenceDbIds: Array.isArray(base.referenceDbIds) ? base.referenceDbIds.map(Number).filter(Number.isFinite) : [],
    confidence: ["high", "medium", "low"].includes(safeText(base.confidence, "medium")) ? safeText(base.confidence, "medium") : "medium",
    actionRequired: base.actionRequired !== false,
    feedbackStatus: safeText(base.feedbackStatus, "open"),
    status: safeText(base.status, "open"),
    provider: safeText(base.provider, "heuristic"),
    createdAt: safeText(base.createdAt, ""),
    updatedAt: safeText(base.updatedAt, ""),
  };
}

async function runModelHealthAiChecks(elements, ruleResults = [], rulesetInput = {}, options = {}) {
  const ruleset = buildDefaultModelHealthRuleset(rulesetInput);
  if (!ruleset.gateConfig.aiEnabled) {
    return [];
  }
  const maxCalls = Math.max(1, Number(options.maxCalls || 5) || 5);
  const results = [];
  const groups = new Map();

  elements.forEach((element) => {
    const groupKey = [normalizeKey(element.elementType), normalizeKey(element.floor || "all")].join("|");
    const group = groups.get(groupKey) || [];
    group.push(element);
    groups.set(groupKey, group);
  });

  groups.forEach((group) => {
    const type = group[0]?.elementType || "构件";
    const parameters = configForElementType(ruleset.rules.outlierParameters, type) || [];
    parameters.forEach((field) => {
      const samples = group.map((element) => ({ element, value: parseNumber(fieldValue(element, field)) })).filter((item) => Number.isFinite(item.value));
      if (samples.length < 2) {
        return;
      }
      const avg = mean(samples.map((item) => item.value));
      const deviation = standardDeviation(samples.map((item) => item.value), avg);
      if (deviation === 0) {
        return;
      }
      samples.forEach((sample) => {
        const z = (sample.value - avg) / deviation;
        const threshold = samples.length < 4 ? 0.95 : 2;
        if (Math.abs(z) >= threshold) {
          results.push(createAiResult({
            category: "outlier",
            description: `${sample.element.name} 的 ${field}=${sample.value} 明显偏离同类构件均值 ${avg.toFixed(2)}，需确认是否符合设计意图。`,
            dbIds: [sample.element.dbId],
            referenceDbIds: samples.filter((item) => item.element.dbId !== sample.element.dbId).slice(0, 6).map((item) => item.element.dbId),
            confidence: confidenceFromZScore(z),
            actionRequired: true,
          }));
        }
      });
    });
  });

  elements.forEach((element) => {
    const semanticFields = [
      ["Material", element.material],
      ["System Name", element.systemName],
      ["Comments", propertyLookup(element.properties, ["Comments", "Comment", "备注", "注释"], "")],
      ["Description", propertyLookup(element.properties, ["Description", "设备描述", "说明"], "")],
      ["Wall Thickness", fieldValue(element, "Wall Thickness")],
    ];
    const matched = semanticFields.find(([, value]) => PLACEHOLDER_PATTERN.test(safeText(value, "")));
    if (matched) {
      results.push(createAiResult({
        category: "semantic",
        description: `${element.name} 的 ${matched[0]} 包含占位或临时语义：${matched[1]}。`,
        dbIds: [element.dbId],
        confidence: /待定|TBD|错误|TEST/i.test(safeText(matched[1], "")) ? "high" : "medium",
        actionRequired: true,
      }));
    }
    if (/管|pipe/i.test(element.elementType) && /结构|建筑|arch|struct/i.test(element.systemName)) {
      results.push(createAiResult({
        category: "semantic",
        description: `${element.name} 的系统名称与管道构件类型明显不匹配：${element.systemName}。`,
        dbIds: [element.dbId],
        confidence: "high",
        actionRequired: true,
      }));
    }
  });

  if (typeof options.externalAiInvoker === "function" && results.length) {
    try {
      const external = await options.externalAiInvoker({
        task: "model_health_ai_review",
        candidates: results.slice(0, 80),
        ruleFindings: ruleResults.slice(0, 80),
        batchPolicy: { maxCalls },
      });
      if (Array.isArray(external?.results)) {
        return external.results.slice(0, Math.max(maxCalls, results.length)).map(createAiResult);
      }
    } catch {
      // Keep deterministic advisory results when external AI is unavailable.
    }
  }

  return results.slice(0, Math.max(maxCalls, results.length));
}

function resultSignature(result) {
  return [
    safeText(result.category, ""),
    safeText(result.ruleId, ""),
    safeText(result.description, "").slice(0, 160),
    (result.dbIds || []).map(Number).sort((a, b) => a - b).join(","),
  ].join("|");
}

function summarizeResults(ruleResults = [], aiResults = []) {
  const summary = {
    total: ruleResults.length + aiResults.length,
    errorCount: ruleResults.filter((item) => item.level === "error").length,
    warningCount: ruleResults.filter((item) => item.level === "warning").length,
    infoCount: ruleResults.filter((item) => item.level === "info").length,
    aiCount: aiResults.length,
    openRuleCount: ruleResults.filter((item) => item.status === "open").length,
    openAiCount: aiResults.filter((item) => ["open", ""].includes(item.feedbackStatus || item.status)).length,
    falsePositiveCount: aiResults.filter((item) => item.feedbackStatus === "false_positive").length,
  };
  summary.score = Math.max(0, Math.min(100, 100 - summary.errorCount * 5 - summary.warningCount * 2 - summary.aiCount));
  return summary;
}

function groupCounts(items, field, fallback = "未分类") {
  const counts = new Map();
  items.forEach((item) => {
    const key = safeText(item[field], fallback);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count);
}

function buildModelHealthReport({ task = {}, ruleset = {}, ruleResults = [], aiResults = [], previousReport = null } = {}) {
  const summary = summarizeResults(ruleResults, aiResults);
  const signatures = [...ruleResults, ...aiResults].map(resultSignature);
  const previousSignatures = new Set(Array.isArray(previousReport?.signatures) ? previousReport.signatures : []);
  const newIssues = [...ruleResults, ...aiResults].filter((item) => !previousSignatures.has(resultSignature(item)));
  return {
    title: "模型健康度检查报告",
    generatedAt: safeText(task.completedAt || task.updatedAt, new Date().toISOString()),
    task: {
      id: safeText(task.id, ""),
      fileName: safeText(task.fileName, ""),
      version: safeText(task.version, ""),
      rulesetId: safeText(task.rulesetId, ruleset.id),
      rulesetVersion: safeText(ruleset.version, "1.0.0"),
    },
    score: summary.score,
    summary,
    signatures,
    sections: [
      { key: "basic", title: "基本信息", items: [`模型：${safeText(task.fileName, "")}`, `版本：${safeText(task.version, "")}`, `规则集版本：${safeText(ruleset.version, "1.0.0")}`] },
      { key: "rule", title: "规则引擎结果", items: [`Error ${summary.errorCount} 项`, `Warning ${summary.warningCount} 项`, `Info ${summary.infoCount} 项`] },
      { key: "ai", title: "AI 异常识别结果", items: [`疑似异常 ${summary.aiCount} 项`, `误报标记 ${summary.falsePositiveCount} 项`] },
      { key: "category", title: "按问题类别汇总", items: groupCounts([...ruleResults, ...aiResults], "category").map((item) => `${item.name}: ${item.count}`) },
    ],
    comparison: previousReport
      ? {
          previous: {
            score: Number(previousReport.task?.score ?? previousReport.score ?? 0),
            errorCount: Number(previousReport.summary?.errorCount || 0),
            warningCount: Number(previousReport.summary?.warningCount || 0),
            aiCount: Number(previousReport.summary?.aiCount || 0),
            total: Number(previousReport.summary?.total || 0),
          },
          current: summary,
          delta: {
            score: summary.score - Number(previousReport.task?.score ?? previousReport.score ?? 0),
            errorCount: summary.errorCount - Number(previousReport.summary?.errorCount || 0),
            warningCount: summary.warningCount - Number(previousReport.summary?.warningCount || 0),
            aiCount: summary.aiCount - Number(previousReport.summary?.aiCount || 0),
            total: summary.total - Number(previousReport.summary?.total || 0),
            newIssues: newIssues.length,
          },
          newIssues: newIssues.map((item) => ({ category: item.category, description: item.description, dbIds: item.dbIds || [] })),
        }
      : null,
  };
}

function normalizeRuleResult(result) {
  return createRuleResult(result);
}

function normalizeAiResult(result) {
  return createAiResult(result);
}

module.exports = {
  buildDefaultModelHealthRuleset,
  buildModelHealthReport,
  collectionFromDerivativePayload,
  modelElementsFromDerivativeProperties,
  normalizeAiResult,
  normalizeGateConfig,
  normalizeRuleResult,
  runModelHealthAiChecks,
  runModelHealthRuleChecks,
  summarizeResults,
};
