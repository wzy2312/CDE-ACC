const STABLE_ID_ALIASES = {
  uniqueId: ["UniqueId", "Unique ID", "Element UniqueId", "Revit UniqueId", "GUID", "ExternalId", "externalId", "外部ID", "唯一ID"],
  elementId: ["ElementId", "Element ID", "Revit ElementId", "Revit Element ID", "Id", "元素ID", "构件ID"],
  handle: ["Handle", "PnPHandle", "Plant 3D Handle", "Object Handle", "句柄"],
  globalId: ["GlobalId", "Global ID", "IFC GlobalId", "IFC GUID", "IfcGUID", "IFC Global ID"],
};

const DIMENSION_ALIASES = {
  elementType: ["Part Type", "Equipment Type", "Category", "Type Name", "Family and Type", "Family", "Object Type", "Line Class", "类别", "对象类型", "设备类型", "构件类型"],
  floor: ["Process Unit", "System", "System Name", "Zone", "Plant Area", "Area Code", "Location", "Level", "Base Level", "工艺单元", "系统", "区域", "装置区", "楼层"],
  discipline: ["Discipline", "System Classification", "System Type", "Trade", "Design Discipline", "专业", "系统分类"],
  material: ["Material", "Structural Material", "Specification", "Spec", "Pipe Spec", "Size", "材质", "材料", "规格", "等级"],
};

const EXCLUDED_DIFF_PROPS = new Set([
  "dbid",
  "objectid",
  "externalid",
  "uniqueid",
  "uniqueid",
  "uniqueidguid",
  "elementid",
  "handle",
  "globalid",
  "ifcguid",
  "id",
]);

const DIFF_COLORS = {
  added: "#2da66f",
  deleted: "#d9473f",
  modified: "#d6a617",
  moved: "#ea7a24",
  unchanged: "#8a94a6",
  unmatched: "#697386",
};

function safeText(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }
  const text = String(value).trim();
  return text || fallback;
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-:：/\\()[\]{}]+/g, "");
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

function setProperty(target, name, value) {
  const propName = safeText(name, "");
  if (!propName) {
    return;
  }
  const resolved = value === undefined || value === null ? "" : value;
  target[propName] = resolved;
}

function flattenProperties(properties, target = {}) {
  if (!properties) {
    return target;
  }
  if (Array.isArray(properties)) {
    properties.forEach((property) => {
      if (!property || typeof property !== "object") {
        return;
      }
      const name = property.displayName || property.name || property.attributeName || property.key;
      if (name) {
        setProperty(target, name, property.displayValue ?? property.value ?? property.display_value ?? "");
      }
      if (property.properties || property.items || property.children) {
        flattenProperties(property.properties || property.items || property.children, target);
      }
    });
    return target;
  }
  if (typeof properties === "object") {
    Object.entries(properties).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if ("displayValue" in value || "value" in value || "display_value" in value) {
          setProperty(target, value.displayName || value.name || key, value.displayValue ?? value.value ?? value.display_value ?? "");
          return;
        }
        flattenProperties(value, target);
        return;
      }
      setProperty(target, key, value);
    });
  }
  return target;
}

function propertyLookup(properties, aliases, fallback = "") {
  const normalized = new Map(
    Object.entries(properties || {}).map(([key, value]) => [normalizeKey(key), value]),
  );
  for (const alias of aliases) {
    const value = normalized.get(normalizeKey(alias));
    if (value !== undefined && safeText(value, "")) {
      return safeText(value, "");
    }
  }
  return fallback;
}

function parseVector(value) {
  if (Array.isArray(value)) {
    const vector = value.slice(0, 3).map((item) => Number(item));
    return vector.every(Number.isFinite) ? vector : null;
  }
  if (value && typeof value === "object") {
    const vector = [value.x ?? value.X ?? value[0], value.y ?? value.Y ?? value[1], value.z ?? value.Z ?? value[2]].map((item) => Number(item));
    return vector.every(Number.isFinite) ? vector : null;
  }
  const raw = safeText(value, "");
  if (!raw) {
    return null;
  }
  const values = raw
    .replace(/[()[\]{}]/g, " ")
    .split(/[,\s;，]+/)
    .map((item) => Number(item))
    .filter(Number.isFinite);
  return values.length >= 3 ? values.slice(0, 3) : null;
}

function parseBoundingBox(item, properties = {}) {
  const source = item?.bbox || item?.boundingBox || item?.box || item?.bounds || item?.BoundingBox;
  if (source && typeof source === "object") {
    const min = parseVector(source.min || source.minimum || source.Min);
    const max = parseVector(source.max || source.maximum || source.Max);
    if (min && max && min.every((coordinate, index) => coordinate <= max[index])) {
      return { min, max };
    }
  }

  const min = parseVector(
    propertyLookup(properties, ["bbox.min", "Bounding Box Min", "Min", "Minimum Point", "minPoint"], ""),
  );
  const max = parseVector(
    propertyLookup(properties, ["bbox.max", "Bounding Box Max", "Max", "Maximum Point", "maxPoint"], ""),
  );
  if (min && max && min.every((coordinate, index) => coordinate <= max[index])) {
    return { min, max };
  }
  return null;
}

function bboxCenter(bbox) {
  if (!bbox?.min || !bbox?.max) {
    return null;
  }
  return bbox.min.map((value, index) => (Number(value) + Number(bbox.max[index])) / 2);
}

function fallbackStableKey(name, center) {
  const normalizedName = normalizeKey(name);
  if (!normalizedName || !Array.isArray(center)) {
    return "";
  }
  const rounded = center.map((value) => Number(value).toFixed(3)).join(",");
  return `fallback:${normalizedName}:${rounded}`;
}

function resolveStableIdentity(properties, name, center) {
  const uniqueId = propertyLookup(properties, STABLE_ID_ALIASES.uniqueId, "");
  if (uniqueId) {
    return { stableKey: `uniqueid:${uniqueId}`, uniqueId, elementId: propertyLookup(properties, STABLE_ID_ALIASES.elementId, ""), matchMethod: "unique_id" };
  }
  const handle = propertyLookup(properties, STABLE_ID_ALIASES.handle, "");
  if (handle) {
    return { stableKey: `handle:${handle}`, uniqueId: handle, elementId: propertyLookup(properties, STABLE_ID_ALIASES.elementId, ""), matchMethod: "handle" };
  }
  const globalId = propertyLookup(properties, STABLE_ID_ALIASES.globalId, "");
  if (globalId) {
    return { stableKey: `globalid:${globalId}`, uniqueId: globalId, elementId: propertyLookup(properties, STABLE_ID_ALIASES.elementId, ""), matchMethod: "global_id" };
  }
  const elementId = propertyLookup(properties, STABLE_ID_ALIASES.elementId, "");
  if (elementId) {
    return { stableKey: `elementid:${elementId}`, uniqueId: "", elementId, matchMethod: "element_id" };
  }
  const fallback = fallbackStableKey(name, center);
  if (fallback) {
    return { stableKey: fallback, uniqueId: "", elementId: "", matchMethod: "fallback" };
  }
  return { stableKey: "", uniqueId: "", elementId: "", matchMethod: "unmatched" };
}

function elementsFromDerivativeProperties(payload, options = {}) {
  const collection = collectionFromDerivativePayload(payload);
  const geometryByDbId = new Map(
    (Array.isArray(options.geometryIndex) ? options.geometryIndex : [])
      .map((item) => [Number(item.dbId ?? item.dbid), item])
      .filter(([dbId]) => Number.isFinite(dbId)),
  );

  return collection.map((item) => {
    const properties = flattenProperties(item.properties || item.props || {});
    const dbId = Number(item.objectid ?? item.objectId ?? item.dbId ?? item.dbid ?? item.id);
    const geometry = geometryByDbId.get(dbId) || {};
    const bbox = parseBoundingBox({ ...geometry, ...item, bbox: item.bbox || item.boundingBox || geometry.bbox }, properties);
    const center = bboxCenter(bbox) || parseVector(item.center || geometry.center);
    const name = safeText(item.name || propertyLookup(properties, ["Name", "Element Name", "Object Name", "Tag Number", "位号"], ""), Number.isFinite(dbId) ? `dbId ${dbId}` : "未命名构件");
    const identity = resolveStableIdentity(properties, name, center);
    const elementType = propertyLookup(properties, DIMENSION_ALIASES.elementType, safeText(item.elementType || item.category, "未分类"));
    const floor = propertyLookup(properties, DIMENSION_ALIASES.floor, safeText(item.floor || item.systemArea || item.level, "未指定区域"));
    const discipline = propertyLookup(properties, DIMENSION_ALIASES.discipline, safeText(item.discipline || options.defaultDiscipline, "未指定专业"));
    const material = propertyLookup(properties, DIMENSION_ALIASES.material, safeText(item.material, "未指定材质/规格"));
    return {
      dbId: Number.isFinite(dbId) ? dbId : -1,
      name,
      stableKey: identity.stableKey,
      uniqueId: identity.uniqueId,
      elementId: identity.elementId,
      matchMethod: identity.matchMethod,
      elementType,
      floor,
      discipline,
      material,
      bbox,
      center,
      properties,
    };
  });
}

function propertyComparableKey(name) {
  return normalizeKey(name);
}

function displayValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return safeText(value, "");
}

function comparableValue(value) {
  return displayValue(value).replace(/\s+/g, " ").trim();
}

function changedProperties(before = {}, after = {}) {
  const beforeEntries = new Map(Object.entries(before).map(([name, value]) => [propertyComparableKey(name), { name, value }]));
  const afterEntries = new Map(Object.entries(after).map(([name, value]) => [propertyComparableKey(name), { name, value }]));
  const keys = [...new Set([...beforeEntries.keys(), ...afterEntries.keys()])]
    .filter((key) => key && !EXCLUDED_DIFF_PROPS.has(key))
    .sort();
  return keys.reduce((changes, key) => {
    const left = beforeEntries.get(key);
    const right = afterEntries.get(key);
    const valueA = comparableValue(left?.value);
    const valueB = comparableValue(right?.value);
    if (valueA === valueB) {
      return changes;
    }
    changes.push({
      propName: right?.name || left?.name || key,
      prop_name: right?.name || left?.name || key,
      valueA,
      value_a: valueA,
      valueB,
      value_b: valueB,
    });
    return changes;
  }, []);
}

function coordinateScaleMm(options = {}) {
  if (Number.isFinite(Number(options.coordinateUnitScaleMm)) && Number(options.coordinateUnitScaleMm) > 0) {
    return Number(options.coordinateUnitScaleMm);
  }
  const unit = safeText(options.coordinateUnit, "m").toLowerCase();
  if (unit === "mm" || unit === "millimeter" || unit === "millimeters") return 1;
  if (unit === "cm" || unit === "centimeter" || unit === "centimeters") return 10;
  if (unit === "ft" || unit === "feet" || unit === "foot") return 304.8;
  if (unit === "in" || unit === "inch" || unit === "inches") return 25.4;
  return 1000;
}

function movementDelta(before, after, options = {}) {
  if (!Array.isArray(before?.center) || !Array.isArray(after?.center)) {
    return null;
  }
  const dx = Number(after.center[0]) - Number(before.center[0]);
  const dy = Number(after.center[1]) - Number(before.center[1]);
  const dz = Number(after.center[2]) - Number(before.center[2]);
  const scaleMm = coordinateScaleMm(options);
  const distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
  const distanceMm = distance * scaleMm;
  return {
    dx,
    dy,
    dz,
    dxMm: dx * scaleMm,
    dyMm: dy * scaleMm,
    dzMm: dz * scaleMm,
    distance,
    distanceMm,
    toleranceMm: Math.max(0, Number(options.toleranceMm ?? 10) || 0),
    exceedsTolerance: distanceMm > Math.max(0, Number(options.toleranceMm ?? 10) || 0),
  };
}

function clonePlain(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  return JSON.parse(JSON.stringify(value));
}

function publicProps(element) {
  return clonePlain(element?.properties || {}, {});
}

function baseRecord(fields, before, after, options = {}) {
  const anchor = after || before || {};
  const changedProps = fields.changedProps || [];
  const bboxDelta = fields.bboxDelta || null;
  const diffTypes = fields.diffTypes || [fields.diffType].filter(Boolean);
  return {
    id: safeText(fields.id, ""),
    stableKey: safeText(anchor.stableKey || fields.stableKey, ""),
    uniqueId: safeText(anchor.uniqueId || fields.uniqueId, ""),
    elementId: safeText(anchor.elementId || fields.elementId, ""),
    diffType: safeText(fields.diffType, "unchanged"),
    diffTypes,
    matchMethod: safeText(fields.matchMethod || anchor.matchMethod, "stable"),
    dbIdBefore: Number.isFinite(Number(before?.dbId)) ? Number(before.dbId) : null,
    dbIdAfter: Number.isFinite(Number(after?.dbId)) ? Number(after.dbId) : null,
    dbIds: [after?.dbId, before?.dbId].map((item) => Number(item)).filter(Number.isFinite),
    name: safeText(anchor.name, "未命名构件"),
    nameBefore: safeText(before?.name, ""),
    nameAfter: safeText(after?.name, ""),
    elementType: safeText(anchor.elementType, "未分类"),
    floor: safeText(anchor.floor, "未指定区域"),
    discipline: safeText(anchor.discipline, "未指定专业"),
    material: safeText(anchor.material, "未指定材质/规格"),
    propsBefore: publicProps(before),
    propsAfter: publicProps(after),
    changedProps,
    changedPropCount: changedProps.length,
    bboxBefore: clonePlain(before?.bbox, null),
    bboxAfter: clonePlain(after?.bbox, null),
    bboxDelta,
    color: DIFF_COLORS[fields.diffType] || DIFF_COLORS.unchanged,
    issueId: safeText(fields.issueId, ""),
    issueStatus: safeText(fields.issueStatus, "unlinked"),
    unmatchedReason: safeText(fields.unmatchedReason, ""),
    versionA: clonePlain(options.versionA, {}),
    versionB: clonePlain(options.versionB, {}),
  };
}

function groupByStableKey(elements) {
  const grouped = new Map();
  const unmatched = [];
  (Array.isArray(elements) ? elements : []).forEach((element) => {
    if (!safeText(element?.stableKey, "")) {
      unmatched.push(element);
      return;
    }
    const bucket = grouped.get(element.stableKey) || [];
    bucket.push(element);
    grouped.set(element.stableKey, bucket);
  });
  return { grouped, unmatched };
}

function compareModelSnapshots(beforeInput, afterInput, options = {}) {
  const beforeElements = Array.isArray(beforeInput) ? beforeInput : elementsFromDerivativeProperties(beforeInput, options);
  const afterElements = Array.isArray(afterInput) ? afterInput : elementsFromDerivativeProperties(afterInput, options);
  const before = groupByStableKey(beforeElements);
  const after = groupByStableKey(afterElements);
  const keys = [...new Set([...before.grouped.keys(), ...after.grouped.keys()])].sort();
  const records = [];

  keys.forEach((key) => {
    const beforeBucket = before.grouped.get(key) || [];
    const afterBucket = after.grouped.get(key) || [];
    if (beforeBucket.length > 1 || afterBucket.length > 1) {
      [...beforeBucket, ...afterBucket].forEach((element) => {
        records.push(baseRecord({
          stableKey: key,
          diffType: "unmatched",
          diffTypes: ["unmatched"],
          matchMethod: element.matchMethod || "stable",
          unmatchedReason: "stable_id_ambiguous",
        }, beforeBucket.includes(element) ? element : null, afterBucket.includes(element) ? element : null, options));
      });
      return;
    }
    const left = beforeBucket[0] || null;
    const right = afterBucket[0] || null;
    if (left && !right) {
      records.push(baseRecord({
        stableKey: key,
        diffType: "deleted",
        diffTypes: ["deleted"],
        matchMethod: left.matchMethod,
      }, left, null, options));
      return;
    }
    if (!left && right) {
      records.push(baseRecord({
        stableKey: key,
        diffType: "added",
        diffTypes: ["added"],
        matchMethod: right.matchMethod,
      }, null, right, options));
      return;
    }
    const propChanges = changedProperties(left.properties, right.properties);
    const delta = movementDelta(left, right, options);
    const diffTypes = [];
    if (propChanges.length) diffTypes.push("modified");
    if (delta?.exceedsTolerance) diffTypes.push("moved");
    const diffType = diffTypes[0] || "unchanged";
    records.push(baseRecord({
      stableKey: key,
      diffType,
      diffTypes: diffTypes.length ? diffTypes : ["unchanged"],
      matchMethod: right.matchMethod || left.matchMethod,
      changedProps: propChanges,
      bboxDelta: delta,
    }, left, right, options));
  });

  before.unmatched.forEach((element) => {
    records.push(baseRecord({
      diffType: "unmatched",
      diffTypes: ["unmatched"],
      matchMethod: "unmatched",
      unmatchedReason: "stable_id_missing_and_fallback_unavailable",
    }, element, null, options));
  });
  after.unmatched.forEach((element) => {
    records.push(baseRecord({
      diffType: "unmatched",
      diffTypes: ["unmatched"],
      matchMethod: "unmatched",
      unmatchedReason: "stable_id_missing_and_fallback_unavailable",
    }, null, element, options));
  });

  const stats = summarizeDiffRecords(records, {
    totalA: beforeElements.length,
    totalB: afterElements.length,
  });
  return { records, stats, options: clonePlain(options, {}) };
}

function summarizeDiffRecords(records, totals = {}) {
  const stats = {
    totalA: Math.max(0, Number(totals.totalA || 0) || 0),
    totalB: Math.max(0, Number(totals.totalB || 0) || 0),
    added: 0,
    deleted: 0,
    modified: 0,
    moved: 0,
    unchanged: 0,
    unmatched: 0,
    totalDiffs: 0,
    issueLinked: 0,
    issueOpen: 0,
  };
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (record.diffType === "added") stats.added += 1;
    if (record.diffType === "deleted") stats.deleted += 1;
    if ((record.diffTypes || []).includes("modified")) stats.modified += 1;
    if ((record.diffTypes || []).includes("moved")) stats.moved += 1;
    if (record.diffType === "unchanged") stats.unchanged += 1;
    if (record.diffType === "unmatched") stats.unmatched += 1;
    if (record.issueId) stats.issueLinked += 1;
    if (record.issueId && record.issueStatus !== "resolved") stats.issueOpen += 1;
  });
  stats.totalDiffs = stats.added + stats.deleted + stats.modified + stats.moved;
  return stats;
}

function versionLabel(value, fallback) {
  return safeText(value?.label || value?.version || value?.versionLabel || value, fallback);
}

function diffTypeLabel(type) {
  return {
    added: "新增",
    deleted: "删除",
    modified: "属性变更",
    moved: "位置移动",
    unchanged: "未变更",
    unmatched: "无法比对",
  }[type] || type;
}

function isDiameterChange(change) {
  const name = safeText(change?.propName || change?.prop_name, "").toLowerCase();
  return /diameter|nominal|dn|管径|公称直径/.test(name);
}

function groupRecordsByDiscipline(records) {
  const groups = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (record.diffType === "unchanged" || record.diffType === "unmatched") {
      return;
    }
    const discipline = safeText(record.discipline, "未指定专业");
    const group = groups.get(discipline) || [];
    group.push(record);
    groups.set(discipline, group);
  });
  return [...groups.entries()].sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0], "zh-CN"));
}

function describeDisciplineChange(discipline, records) {
  const counts = summarizeDiffRecords(records);
  const clauses = [];
  if (counts.added) clauses.push(`新增 ${counts.added} 个对象`);
  if (counts.deleted) clauses.push(`删除 ${counts.deleted} 个对象`);
  if (counts.modified) clauses.push(`${counts.modified} 个对象属性变更`);
  if (counts.moved) clauses.push(`${counts.moved} 个对象位置移动`);
  const diameterChanges = records
    .flatMap((record) => record.changedProps || [])
    .filter(isDiameterChange)
    .slice(0, 3);
  const areas = [...new Set(records.map((record) => record.floor).filter(Boolean))].slice(0, 3);
  const areaText = areas.length ? `，主要位于 ${areas.join("、")}` : "";
  const diameterText = diameterChanges.length
    ? `，其中管径变化包括 ${diameterChanges.map((item) => `${item.valueA || "空"} → ${item.valueB || "空"}`).join("、")}`
    : "";
  return `${discipline}：${clauses.join("，") || "无显著变化"}${areaText}${diameterText}。`;
}

function generateModelDiffNarrative(diff, context = {}) {
  const records = Array.isArray(diff?.records) ? diff.records : [];
  const stats = diff?.stats || summarizeDiffRecords(records);
  const left = versionLabel(context.versionA || diff?.options?.versionA, "版本 A");
  const right = versionLabel(context.versionB || diff?.options?.versionB, "版本 B");
  const total = stats.totalDiffs || 0;
  const groups = groupRecordsByDiscipline(records);
  const topAreas = [...new Set(records
    .filter((record) => record.diffType !== "unchanged" && record.diffType !== "unmatched")
    .map((record) => record.floor)
    .filter(Boolean))]
    .slice(0, 3);
  const topDisciplines = groups.slice(0, 2).map(([discipline]) => discipline);
  const focus = [
    topDisciplines.length ? `主要集中在 ${topDisciplines.join("、")} 专业` : "",
    topAreas.length ? `涉及 ${topAreas.join("、")} 等系统/区域` : "",
  ].filter(Boolean).join("，");
  const summary = `本次更新（${left} → ${right}）共涉及 ${total} 个构件差异：新增 ${stats.added || 0} 个、删除 ${stats.deleted || 0} 个、属性变更 ${stats.modified || 0} 个、位置移动 ${stats.moved || 0} 个${focus ? `，${focus}` : ""}。`;
  const detailByDiscipline = groups.map(([discipline, groupRecords]) => ({
    discipline,
    counts: summarizeDiffRecords(groupRecords),
    text: describeDisciplineChange(discipline, groupRecords),
  }));
  return {
    summary,
    detailByDiscipline,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  DIFF_COLORS,
  elementsFromDerivativeProperties,
  compareModelSnapshots,
  generateModelDiffNarrative,
  summarizeDiffRecords,
};
