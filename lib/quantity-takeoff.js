const DEFAULT_FIELDS = [
  "Category",
  "Type Name",
  "Family",
  "System",
  "System Name",
  "Zone",
  "Plant Area",
  "Location",
  "Discipline",
  "Material",
  "Specification",
  "Size",
  "Diameter",
  "Area",
  "Length",
  "Line Length",
  "Volume",
  "Weight",
  "Mass",
];

const DEFAULT_GROUP_BY = ["elementType"];

const PROPERTY_ALIASES = {
  elementType: ["Category", "Type Name", "Type", "Family and Type", "Family", "Element Type", "Equipment Type", "Object Type", "Part Type", "Line Class", "对象类型", "设备类型", "管件类型", "类别"],
  floor: ["System", "System Name", "Zone", "Plant Area", "Area Code", "Location", "Process Unit", "Unit", "工艺单元", "系统", "区域", "单元", "装置区"],
  systemArea: ["System", "System Name", "Zone", "Plant Area", "Area Code", "Location", "Process Unit", "Unit", "工艺单元", "系统", "区域", "单元", "装置区"],
  discipline: ["Discipline", "System Classification", "System Type", "Trade", "Design Discipline", "系统分类", "专业", "设计专业"],
  material: ["Material", "Structural Material", "Specification", "Spec", "Pipe Spec", "Size", "材质", "材料", "规格", "等级"],
  area: ["Area", "Net Area", "Gross Area", "面积"],
  length: ["Length", "Curve Length", "Total Length", "Line Length", "管线长度", "长度"],
  volume: ["Volume", "体积"],
  diameter: ["Diameter", "Nominal Diameter", "DN", "Size", "管径", "公称直径"],
  weight: ["Weight", "Mass", "Operating Weight", "Dry Weight", "重量", "质量"],
};

const DEFAULT_METRICS = {
  count: { label: "对象数量", kind: "count", unit: "件" },
  area: { label: "面积", kind: "sum", source: "area", unit: "m²" },
  length: { label: "长度", kind: "sum", source: "length", unit: "m" },
  volume: { label: "体积", kind: "sum", source: "volume", unit: "m³" },
};

function safeText(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }
  const text = String(value).trim();
  return text || fallback;
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

function normalizeFilterSet(value) {
  return new Set(uniqueTexts(value).map((item) => item.toLowerCase()));
}

function normalizeFieldMappings(value = {}) {
  const mappings = {};
  Object.keys(PROPERTY_ALIASES).forEach((key) => {
    mappings[key] = uniqueTexts([
      ...(Array.isArray(value[key]) ? value[key] : []),
      ...PROPERTY_ALIASES[key],
    ]);
  });
  return mappings;
}

function normalizeMetricRule(key, value) {
  if (typeof value === "string") {
    if (value === "count") {
      return { label: key, kind: "count", unit: "件" };
    }
    return { label: key, kind: value, source: key, unit: "" };
  }
  const source = value && typeof value === "object" ? value : {};
  const kind = ["count", "sum"].includes(safeText(source.kind || source.type, "sum")) ? safeText(source.kind || source.type, "sum") : "sum";
  return {
    label: safeText(source.label, DEFAULT_METRICS[key]?.label || key),
    kind,
    source: kind === "count" ? safeText(source.source, "") : safeText(source.source, key),
    unit: safeText(source.unit, DEFAULT_METRICS[key]?.unit || ""),
    precision: Math.max(0, Math.min(6, Number(source.precision ?? 3) || 0)),
    appliesTo: source.appliesTo && typeof source.appliesTo === "object"
      ? {
          elementTypes: uniqueTexts(source.appliesTo.elementTypes),
          floors: uniqueTexts(source.appliesTo.floors),
          disciplines: uniqueTexts(source.appliesTo.disciplines),
          materials: uniqueTexts(source.appliesTo.materials),
        }
      : {},
  };
}

function normalizeMetrics(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const keys = uniqueTexts([...Object.keys(DEFAULT_METRICS), ...Object.keys(source)]);
  return Object.fromEntries(keys.map((key) => [key, normalizeMetricRule(key, source[key] ?? DEFAULT_METRICS[key])]));
}

function normalizeTakeoffTemplate(value = {}) {
  const fields = value.fields === "*" || value.fieldMode === "all"
    ? "*"
    : uniqueTexts(value.fields).length
      ? uniqueTexts(value.fields)
      : DEFAULT_FIELDS;
  const filters = value.filters && typeof value.filters === "object" ? value.filters : {};

  return {
    id: safeText(value.id, ""),
    name: safeText(value.name, "海水淡化工程量模板"),
    description: safeText(value.description, ""),
    fields,
    groupBy: uniqueTexts(value.groupBy).length ? uniqueTexts(value.groupBy) : DEFAULT_GROUP_BY,
    fieldMappings: normalizeFieldMappings(value.fieldMappings || value.propertyAliases || {}),
    filters: {
      floors: uniqueTexts(filters.floors),
      disciplines: uniqueTexts(filters.disciplines),
      elementTypes: uniqueTexts(filters.elementTypes),
      materials: uniqueTexts(filters.materials),
    },
    metrics: normalizeMetrics(value.metrics),
  };
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

function normalizePropertyMap(properties) {
  const map = {};
  (Array.isArray(properties) ? properties : []).forEach((property) => {
    const name = safeText(property.displayName || property.name || property.attributeName, "");
    if (!name) {
      return;
    }
    const value = property.displayValue ?? property.value ?? property.display_value ?? "";
    map[name] = value === undefined || value === null ? "" : value;
  });
  return map;
}

function propertyLookup(map, names, fallback = "") {
  const normalized = new Map(
    Object.entries(map || {}).map(([key, value]) => [key.trim().toLowerCase(), value]),
  );
  for (const name of names) {
    const value = normalized.get(String(name || "").trim().toLowerCase());
    if (value !== undefined && safeText(value, "")) {
      return safeText(value, "");
    }
  }
  return fallback;
}

function filterProperties(map, fields) {
  if (fields === "*") {
    return { ...map };
  }
  const wanted = new Set(fields.map((field) => field.toLowerCase()));
  return Object.entries(map).reduce((result, [key, value]) => {
    if (wanted.has(key.toLowerCase())) {
      result[key] = value;
    }
    return result;
  }, {});
}

function normalizedUnitText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/㎡/g, "m2")
    .replace(/m²/g, "m2")
    .replace(/㎥/g, "m3")
    .replace(/m³/g, "m3")
    .replace(/²/g, "2")
    .replace(/³/g, "3");
}

function parseQuantityNumber(value, dimension = "") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const raw = String(value ?? "").replace(/,/g, "");
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return 0;
  }
  const number = Number(match[0]);
  if (!Number.isFinite(number)) {
    return 0;
  }
  const unitText = normalizedUnitText(raw);
  const metric = safeText(dimension, "").toLowerCase();
  if (metric === "length") {
    if (/\bmm\b/.test(unitText)) return number / 1000;
    if (/\bcm\b/.test(unitText)) return number / 100;
    if (/\bkm\b/.test(unitText)) return number * 1000;
    if (/\bin\b|inch/.test(unitText)) return number * 0.0254;
    if (/\bft\b|feet|foot/.test(unitText)) return number * 0.3048;
  }
  if (metric === "area") {
    if (/\bmm2\b|\bmm\^2\b/.test(unitText)) return number / 1000000;
    if (/\bcm2\b|\bcm\^2\b/.test(unitText)) return number / 10000;
    if (/\bkm2\b|\bkm\^2\b/.test(unitText)) return number * 1000000;
  }
  if (metric === "volume") {
    if (/\bmm3\b|\bmm\^3\b/.test(unitText)) return number / 1000000000;
    if (/\bcm3\b|\bcm\^3\b/.test(unitText)) return number / 1000000;
    if (/\bl\b|liter|litre/.test(unitText)) return number / 1000;
  }
  if (metric === "diameter") {
    if (/\bm\b/.test(unitText) && !/\bmm\b/.test(unitText) && !/\bcm\b/.test(unitText)) return number * 1000;
    if (/\bcm\b/.test(unitText)) return number * 10;
    if (/\bin\b|inch/.test(unitText)) return number * 25.4;
  }
  if (metric === "weight") {
    if (/\btonne\b|\btons?\b|吨|公吨|\bt\b/.test(unitText)) return number * 1000;
    if (/\bg\b/.test(unitText) && !/\bkg\b/.test(unitText)) return number / 1000;
  }
  return number;
}

function filterMatches(value, filterSet) {
  if (!filterSet.size) {
    return true;
  }
  return filterSet.has(safeText(value, "").toLowerCase());
}

function snapshotMatchesFilters(snapshot, filters) {
  return (
    filterMatches(snapshot.floor, filters.floors) &&
    filterMatches(snapshot.discipline, filters.disciplines) &&
    filterMatches(snapshot.elementType, filters.elementTypes) &&
    filterMatches(snapshot.material, filters.materials)
  );
}

function aliasesFor(template, key) {
  return uniqueTexts([
    ...(template.fieldMappings?.[key] || []),
    ...(PROPERTY_ALIASES[key] || []),
  ]);
}

function snapshotsFromDerivativeProperties(payload, templateInput = {}, options = {}) {
  const template = normalizeTakeoffTemplate(templateInput);
  const filters = {
    floors: normalizeFilterSet(template.filters.floors),
    disciplines: normalizeFilterSet(template.filters.disciplines),
    elementTypes: normalizeFilterSet(template.filters.elementTypes),
    materials: normalizeFilterSet(template.filters.materials),
  };

  return collectionFromDerivativePayload(payload)
    .map((item) => {
      const dbId = Number(item.objectid ?? item.objectId ?? item.dbId ?? item.dbid);
      if (!Number.isFinite(dbId) || dbId < 0) {
        return null;
      }
      const propertyMap = normalizePropertyMap(item.properties);
      const name = safeText(item.name || propertyLookup(propertyMap, ["Name", "名称"]), `dbId ${dbId}`);
      const systemArea = propertyLookup(propertyMap, aliasesFor(template, "floor"), "未指定区域");
      const snapshot = {
        id: safeText(item.id, ""),
        taskId: safeText(options.taskId, ""),
        dbId,
        name,
        elementType: propertyLookup(propertyMap, aliasesFor(template, "elementType"), name),
        floor: systemArea,
        systemArea,
        discipline: propertyLookup(propertyMap, aliasesFor(template, "discipline"), "未指定专业"),
        material: propertyLookup(propertyMap, aliasesFor(template, "material"), "未指定材质/规格"),
        area: parseQuantityNumber(propertyLookup(propertyMap, aliasesFor(template, "area"), ""), "area"),
        length: parseQuantityNumber(propertyLookup(propertyMap, aliasesFor(template, "length"), ""), "length"),
        volume: parseQuantityNumber(propertyLookup(propertyMap, aliasesFor(template, "volume"), ""), "volume"),
        diameter: parseQuantityNumber(propertyLookup(propertyMap, aliasesFor(template, "diameter"), ""), "diameter"),
        weight: parseQuantityNumber(propertyLookup(propertyMap, aliasesFor(template, "weight"), ""), "weight"),
        properties: filterProperties(propertyMap, template.fields),
      };
      return snapshotMatchesFilters(snapshot, filters) ? snapshot : null;
    })
    .filter(Boolean);
}

function normalizedDimensionValue(value) {
  return safeText(value, "未分类");
}

function summaryKey(item, groupBy) {
  return groupBy.map((field) => normalizedDimensionValue(item[field])).join("\u001f");
}

function roundQuantity(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 1000000) / 1000000;
}

function setMatches(value, expectedValues) {
  const expected = normalizeFilterSet(expectedValues);
  return !expected.size || expected.has(safeText(value, "").toLowerCase());
}

function metricAppliesToSnapshot(snapshot, appliesTo = {}) {
  return (
    setMatches(snapshot.elementType, appliesTo.elementTypes) &&
    setMatches(snapshot.floor, appliesTo.floors) &&
    setMatches(snapshot.discipline, appliesTo.disciplines) &&
    setMatches(snapshot.material, appliesTo.materials)
  );
}

function metricValueForSnapshot(snapshot, rule) {
  if (!metricAppliesToSnapshot(snapshot, rule.appliesTo || {})) {
    return 0;
  }
  if (rule.kind === "count") {
    return 1;
  }
  return Number(snapshot[rule.source] || 0) || 0;
}

function createMetricAccumulator(template) {
  return Object.fromEntries(
    Object.entries(template.metrics || {}).map(([key, rule]) => [
      key,
      {
        key,
        label: rule.label || key,
        unit: rule.unit || "",
        kind: rule.kind || "sum",
        value: 0,
      },
    ]),
  );
}

function aggregateQuantitySummaries(snapshots, templateInput = {}, options = {}) {
  const template = normalizeTakeoffTemplate(templateInput);
  const groupBy = template.groupBy.length ? template.groupBy : DEFAULT_GROUP_BY;
  const groups = new Map();

  (Array.isArray(snapshots) ? snapshots : []).forEach((snapshot) => {
    const key = summaryKey(snapshot, groupBy);
    const current = groups.get(key) || {
      id: "",
      taskId: safeText(options.taskId, snapshot.taskId || ""),
      elementType: groupBy.includes("elementType") ? normalizedDimensionValue(snapshot.elementType) : "全部类型",
      floor: groupBy.includes("floor") ? normalizedDimensionValue(snapshot.floor) : "全部区域",
      discipline: groupBy.includes("discipline") ? normalizedDimensionValue(snapshot.discipline) : "全部专业",
      material: groupBy.includes("material") ? normalizedDimensionValue(snapshot.material) : "全部材质/规格",
      count: 0,
      area: 0,
      length: 0,
      volume: 0,
      diameter: 0,
      weight: 0,
      metrics: createMetricAccumulator(template),
      dbIds: [],
      dimensions: Object.fromEntries(groupBy.map((field) => [field, normalizedDimensionValue(snapshot[field])])),
    };
    current.count += 1;
    current.area += Number(snapshot.area || 0);
    current.length += Number(snapshot.length || 0);
    current.volume += Number(snapshot.volume || 0);
    current.weight += Number(snapshot.weight || 0);
    Object.entries(template.metrics || {}).forEach(([key, rule]) => {
      current.metrics[key].value += metricValueForSnapshot(snapshot, rule);
    });
    current.dbIds.push(snapshot.dbId);
    groups.set(key, current);
  });

  return Array.from(groups.values()).map((item) => ({
    ...item,
    area: roundQuantity(item.area),
    length: roundQuantity(item.length),
    volume: roundQuantity(item.volume),
    weight: roundQuantity(item.weight),
    metrics: Object.fromEntries(
      Object.entries(item.metrics || {}).map(([key, metric]) => [
        key,
        {
          ...metric,
          value: roundQuantity(metric.value),
        },
      ]),
    ),
  }));
}

function compareQuantitySummaries(previousSummaries, currentSummaries) {
  const groupBy = ["elementType", "floor", "discipline", "material"];
  const previousByKey = new Map((Array.isArray(previousSummaries) ? previousSummaries : []).map((item) => [summaryKey(item, groupBy), item]));
  const currentByKey = new Map((Array.isArray(currentSummaries) ? currentSummaries : []).map((item) => [summaryKey(item, groupBy), item]));
  const keys = new Set([...previousByKey.keys(), ...currentByKey.keys()]);

  return Array.from(keys).map((key) => {
    const previous = previousByKey.get(key) || null;
    const current = currentByKey.get(key) || null;
    const base = current || previous || {};
    const countDelta = Number(current?.count || 0) - Number(previous?.count || 0);
    const areaDelta = roundQuantity(Number(current?.area || 0) - Number(previous?.area || 0));
    const lengthDelta = roundQuantity(Number(current?.length || 0) - Number(previous?.length || 0));
    const volumeDelta = roundQuantity(Number(current?.volume || 0) - Number(previous?.volume || 0));
    const metricKeys = new Set([...Object.keys(previous?.metrics || {}), ...Object.keys(current?.metrics || {})]);
    const metricsDelta = Object.fromEntries([...metricKeys].map((metricKey) => {
      const previousMetric = previous?.metrics?.[metricKey] || {};
      const currentMetric = current?.metrics?.[metricKey] || {};
      return [metricKey, {
        key: metricKey,
        label: currentMetric.label || previousMetric.label || metricKey,
        unit: currentMetric.unit || previousMetric.unit || "",
        previous: Number(previousMetric.value || 0) || 0,
        current: Number(currentMetric.value || 0) || 0,
        delta: roundQuantity(Number(currentMetric.value || 0) - Number(previousMetric.value || 0)),
      }];
    }));
    const status = !previous
      ? "added"
      : !current
        ? "removed"
        : countDelta || areaDelta || lengthDelta || volumeDelta || Object.values(metricsDelta).some((metric) => metric.delta)
          ? "changed"
          : "unchanged";

    return {
      elementType: normalizedDimensionValue(base.elementType),
      floor: normalizedDimensionValue(base.floor),
      discipline: normalizedDimensionValue(base.discipline),
      material: normalizedDimensionValue(base.material),
      previous,
      current,
      status,
      countDelta,
      areaDelta,
      lengthDelta,
      volumeDelta,
      metricsDelta,
    };
  });
}

function buildQuantityPropertyDictionary(payload, templateInput = {}) {
  const template = normalizeTakeoffTemplate(templateInput);
  const collection = collectionFromDerivativePayload(payload);
  const fieldMap = new Map();
  const coverageKeys = ["elementType", "floor", "discipline", "material", "area", "length", "volume", "diameter", "weight"];
  const coverage = Object.fromEntries(coverageKeys.map((key) => [
    key,
    {
      label: key === "floor" ? "系统/区域" : key,
      aliases: aliasesFor(template, key),
      matched: 0,
      total: collection.length,
      rate: 0,
    },
  ]));

  collection.forEach((item) => {
    const propertyMap = normalizePropertyMap(item.properties);
    Object.entries(propertyMap).forEach(([name, value]) => {
      const normalized = name.toLowerCase();
      const current = fieldMap.get(normalized) || { name, count: 0, samples: [] };
      current.count += 1;
      const textValue = safeText(value, "");
      if (textValue && current.samples.length < 3 && !current.samples.includes(textValue)) {
        current.samples.push(textValue);
      }
      fieldMap.set(normalized, current);
    });
    coverageKeys.forEach((key) => {
      const value = propertyLookup(propertyMap, aliasesFor(template, key), "");
      if (safeText(value, "")) {
        coverage[key].matched += 1;
      }
    });
  });

  Object.values(coverage).forEach((item) => {
    item.rate = item.total ? roundQuantity(item.matched / item.total) : 0;
  });

  return {
    objectCount: collection.length,
    fields: [...fieldMap.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN")),
    coverage,
  };
}

module.exports = {
  normalizeTakeoffTemplate,
  snapshotsFromDerivativeProperties,
  aggregateQuantitySummaries,
  compareQuantitySummaries,
  buildQuantityPropertyDictionary,
  parseQuantityNumber,
};
