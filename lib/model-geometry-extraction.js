const DISCIPLINE_ALIASES = [
  { key: "structure", patterns: [/struct/i, /结构/, /土建/, /civil/i, /framing/i, /concrete/i, /steel/i] },
  { key: "architecture", patterns: [/arch/i, /建筑/, /wall/i, /door/i, /window/i, /floor/i, /ceiling/i] },
  { key: "electrical", patterns: [/electrical/i, /electric/i, /power/i, /cable/i, /tray/i, /电气/, /强电/, /弱电/] },
  { key: "mep", patterns: [/mep/i, /mechanical/i, /hvac/i, /duct/i, /pipe/i, /piping/i, /plumbing/i, /暖通/, /机电/, /管道/, /给排水/, /消防/] },
];

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

function normalizedKey(value) {
  return safeText(value, "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
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

function addProperty(map, name, value) {
  const key = safeText(name, "");
  if (!key || value === undefined || value === null) {
    return;
  }
  map[key] = value;
}

function flattenPropertyObject(map, source, prefix = "") {
  if (!source || typeof source !== "object") {
    return;
  }
  if (Array.isArray(source)) {
    source.forEach((item) => flattenPropertyObject(map, item, prefix));
    return;
  }
  const displayName = safeText(source.displayName || source.name || source.attributeName, "");
  if (displayName) {
    addProperty(map, displayName, source.displayValue ?? source.value ?? source.display_value);
  }
  Object.entries(source).forEach(([key, value]) => {
    if (["displayName", "name", "attributeName", "displayValue", "display_value", "value"].includes(key)) {
      return;
    }
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      flattenPropertyObject(map, value, nextKey);
      return;
    }
    addProperty(map, nextKey, value);
    addProperty(map, key, value);
  });
}

function normalizePropertyMap(item) {
  const map = {};
  flattenPropertyObject(map, item?.properties || {});
  ["externalId", "guid", "uniqueId", "elementId", "category", "discipline"].forEach((key) => {
    if (item?.[key] !== undefined) {
      addProperty(map, key, item[key]);
    }
  });
  return map;
}

function lookupProperty(map, aliases, fallback = "") {
  const normalized = new Map(
    Object.entries(map || {}).map(([key, value]) => [normalizedKey(key), value]),
  );
  for (const alias of aliases) {
    const value = normalized.get(normalizedKey(alias));
    if (value !== undefined && safeText(value, "")) {
      return value;
    }
  }
  return fallback;
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function parseVector(value) {
  if (Array.isArray(value)) {
    const vector = value.slice(0, 3).map((item) => Number(item));
    return vector.length === 3 && vector.every(Number.isFinite) ? vector : null;
  }
  if (value && typeof value === "object") {
    const vector = [value.x ?? value.X, value.y ?? value.Y, value.z ?? value.Z].map((item) => Number(item));
    return vector.every(Number.isFinite) ? vector : null;
  }
  const numbers = String(value ?? "").match(/-?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 3) {
    return null;
  }
  const vector = numbers.slice(0, 3).map(Number);
  return vector.every(Number.isFinite) ? vector : null;
}

function normalizeBoundingBox(box) {
  const min = parseVector(box?.min || box?.Min || box?.minimum);
  const max = parseVector(box?.max || box?.Max || box?.maximum);
  if (!min || !max || min.some((coordinate, index) => coordinate > max[index])) {
    return null;
  }
  return { min, max };
}

function boundingBoxFromProperties(map) {
  const directMin = parseVector(lookupProperty(map, ["Bounding Box Min", "BBox Min", "BoundingBoxMin", "Min Point", "Minimum Point"]));
  const directMax = parseVector(lookupProperty(map, ["Bounding Box Max", "BBox Max", "BoundingBoxMax", "Max Point", "Maximum Point"]));
  if (directMin && directMax && !directMin.some((coordinate, index) => coordinate > directMax[index])) {
    return { min: directMin, max: directMax };
  }

  const min = [
    parseNumber(lookupProperty(map, ["Min X", "BBox Min X", "Bounding Box Min X", "BoundingBox.Min.X", "min.x"])),
    parseNumber(lookupProperty(map, ["Min Y", "BBox Min Y", "Bounding Box Min Y", "BoundingBox.Min.Y", "min.y"])),
    parseNumber(lookupProperty(map, ["Min Z", "BBox Min Z", "Bounding Box Min Z", "BoundingBox.Min.Z", "min.z"])),
  ];
  const max = [
    parseNumber(lookupProperty(map, ["Max X", "BBox Max X", "Bounding Box Max X", "BoundingBox.Max.X", "max.x"])),
    parseNumber(lookupProperty(map, ["Max Y", "BBox Max Y", "Bounding Box Max Y", "BoundingBox.Max.Y", "max.y"])),
    parseNumber(lookupProperty(map, ["Max Z", "BBox Max Z", "Bounding Box Max Z", "BoundingBox.Max.Z", "max.z"])),
  ];
  if (min.every(Number.isFinite) && max.every(Number.isFinite) && !min.some((coordinate, index) => coordinate > max[index])) {
    return { min, max };
  }

  const center = [
    parseNumber(lookupProperty(map, ["Location X", "Center X", "Origin X", "Centroid X", "X"])),
    parseNumber(lookupProperty(map, ["Location Y", "Center Y", "Origin Y", "Centroid Y", "Y"])),
    parseNumber(lookupProperty(map, ["Location Z", "Center Z", "Origin Z", "Centroid Z", "Z"])),
  ];
  const diameter = parseNumber(lookupProperty(map, ["Diameter", "Nominal Diameter", "直径"]));
  const dimensions = [
    parseNumber(lookupProperty(map, ["Length", "长度", "X Length", "Size X"])),
    parseNumber(lookupProperty(map, ["Width", "宽度", "Y Width", "Size Y"])),
    parseNumber(lookupProperty(map, ["Height", "高度", "Z Height", "Size Z"])),
  ].map((value, index) => (Number.isFinite(value) && value > 0 ? value : index > 0 && Number.isFinite(diameter) && diameter > 0 ? diameter : NaN));
  if (center.every(Number.isFinite) && dimensions.every(Number.isFinite)) {
    return {
      min: center.map((coordinate, index) => coordinate - dimensions[index] / 2),
      max: center.map((coordinate, index) => coordinate + dimensions[index] / 2),
    };
  }

  return null;
}

function flattenNumericArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flat(Infinity).map((item) => Number(item)).filter(Number.isFinite);
}

function normalizeMesh(rawMesh, options = {}) {
  const source = rawMesh && typeof rawMesh === "object" ? rawMesh : {};
  const vertices = flattenNumericArray(source.vertices || source.positions || source.points);
  const triangles = flattenNumericArray(source.triangles || source.indices || source.faces).map((item) => Math.floor(item));
  if (vertices.length < 9 || vertices.length % 3 !== 0 || triangles.length < 3 || triangles.length % 3 !== 0) {
    return null;
  }
  const vertexCount = vertices.length / 3;
  if (triangles.some((index) => index < 0 || index >= vertexCount)) {
    return null;
  }
  const maxTriangles = Math.max(1, Number(options.maxMeshTriangles || 50000) || 50000);
  if (triangles.length / 3 > maxTriangles) {
    return null;
  }
  return { vertices, triangles };
}

function boundingBoxFromMesh(mesh) {
  if (!mesh?.vertices?.length) {
    return null;
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = finiteNumber(mesh.vertices[index + axis], 0);
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return min.every(Number.isFinite) && max.every(Number.isFinite) ? { min, max } : null;
}

function parseDbIdFromLabel(label, objectIds = []) {
  const text = safeText(label, "");
  if (!text) {
    return null;
  }
  const explicit = text.match(/(?:db\s*id|dbid|object\s*id|objectid|dbId|objectId)[_\-:=\s]*(\d+)/i);
  if (explicit) {
    return Number(explicit[1]);
  }
  const requested = new Set((Array.isArray(objectIds) ? objectIds : []).map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0));
  if (requested.size) {
    const numbers = text.match(/\d+/g) || [];
    const matched = numbers.map(Number).filter((item) => requested.has(item));
    if (matched.length === 1) {
      return matched[0];
    }
  }
  return null;
}

function normalizeObjectIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0))];
}

function metadataForDbId(metadataByDbId, dbId) {
  if (!metadataByDbId) {
    return {};
  }
  if (metadataByDbId instanceof Map) {
    return metadataByDbId.get(dbId) || metadataByDbId.get(String(dbId)) || {};
  }
  if (typeof metadataByDbId === "object") {
    return metadataByDbId[dbId] || metadataByDbId[String(dbId)] || {};
  }
  return {};
}

function parseObjFaceVertex(value, vertexCount) {
  const raw = safeText(value, "").split("/")[0];
  const index = Number(raw);
  if (!Number.isInteger(index) || index === 0) {
    return null;
  }
  if (index < 0) {
    const resolved = vertexCount + index;
    return resolved >= 0 && resolved < vertexCount ? resolved : null;
  }
  return index - 1 < vertexCount ? index - 1 : null;
}

function createObjMeshGroup(dbId, label = "") {
  return {
    dbId,
    label: safeText(label, ""),
    vertices: [],
    triangles: [],
    vertexMap: new Map(),
  };
}

function objGroupLocalVertex(group, sourceVertices, globalIndex) {
  if (group.vertexMap.has(globalIndex)) {
    return group.vertexMap.get(globalIndex);
  }
  const point = sourceVertices[globalIndex];
  if (!point) {
    return null;
  }
  const localIndex = group.vertices.length / 3;
  group.vertices.push(point[0], point[1], point[2]);
  group.vertexMap.set(globalIndex, localIndex);
  return localIndex;
}

function triangleCount(mesh) {
  return Math.floor((Array.isArray(mesh?.triangles) ? mesh.triangles.length : 0) / 3);
}

function compactObjMeshGroup(group) {
  if (!group || group.vertices.length < 9 || group.triangles.length < 3) {
    return null;
  }
  return {
    vertices: group.vertices,
    triangles: group.triangles,
  };
}

function buildGeometryIndexFromObjDerivative(objText, options = {}) {
  const objectIds = normalizeObjectIds(options.objectIds);
  const defaultDbId = objectIds.length === 1 ? objectIds[0] : null;
  const defaultDiscipline = normalizeDiscipline(options.defaultDiscipline, "general");
  const metadataByDbId = options.metadataByDbId;
  const sourceVertices = [];
  const groups = new Map();
  const warnings = [];
  let currentLabel = "";
  let currentDbId = defaultDbId;

  function currentGroup() {
    const dbId = Number.isInteger(currentDbId) && currentDbId >= 0 ? currentDbId : null;
    if (dbId === null) {
      return null;
    }
    if (!groups.has(dbId)) {
      groups.set(dbId, createObjMeshGroup(dbId, currentLabel || `dbId ${dbId}`));
    }
    const group = groups.get(dbId);
    if (currentLabel && (!group.label || group.label === `dbId ${dbId}`)) {
      group.label = currentLabel;
    }
    return group;
  }

  String(objText || "").split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      return;
    }
    const [command, ...parts] = line.split(/\s+/);
    if (command === "v") {
      const point = parts.slice(0, 3).map(Number);
      if (point.length === 3 && point.every(Number.isFinite)) {
        sourceVertices.push(point);
      } else {
        warnings.push({ code: "invalid_obj_vertex", line: lineIndex + 1 });
      }
      return;
    }
    if (command === "o" || command === "g") {
      currentLabel = parts.join(" ");
      currentDbId = parseDbIdFromLabel(currentLabel, objectIds);
      if (currentDbId === null && defaultDbId !== null) {
        currentDbId = defaultDbId;
      }
      return;
    }
    if (command !== "f") {
      return;
    }
    const group = currentGroup();
    if (!group) {
      warnings.push({ code: "unassigned_obj_face", line: lineIndex + 1 });
      return;
    }
    const face = parts.map((part) => parseObjFaceVertex(part, sourceVertices.length));
    if (face.length < 3 || face.some((item) => item === null)) {
      warnings.push({ code: "invalid_obj_face", line: lineIndex + 1 });
      return;
    }
    const localIndexes = face.map((globalIndex) => objGroupLocalVertex(group, sourceVertices, globalIndex));
    if (localIndexes.some((item) => item === null)) {
      warnings.push({ code: "invalid_obj_face_vertex", line: lineIndex + 1 });
      return;
    }
    for (let index = 1; index < localIndexes.length - 1; index += 1) {
      group.triangles.push(localIndexes[0], localIndexes[index], localIndexes[index + 1]);
    }
  });

  const geometryIndex = [];
  [...groups.values()].forEach((group) => {
    const mesh = compactObjMeshGroup(group);
    const boundingBox = boundingBoxFromMesh(mesh);
    if (!mesh || !boundingBox) {
      warnings.push({ code: "empty_obj_group", dbId: group.dbId, name: group.label });
      return;
    }
    const metadata = metadataForDbId(metadataByDbId, group.dbId);
    geometryIndex.push({
      dbId: group.dbId,
      name: safeText(metadata.name || metadata.elementName || group.label, `dbId ${group.dbId}`),
      discipline: normalizeDiscipline(metadata.discipline || metadata.category || metadata.elementType, defaultDiscipline),
      boundingBox,
      mesh,
    });
  });

  return {
    geometryIndex,
    elementIndex: [],
    warnings,
    summary: {
      totalObjects: objectIds.length || geometryIndex.length,
      indexedElements: geometryIndex.length,
      skippedElements: Math.max(0, (objectIds.length || geometryIndex.length) - geometryIndex.length),
      elementIndexCount: 0,
      meshElementCount: geometryIndex.filter((item) => item.mesh).length,
      triangleCount: geometryIndex.reduce((sum, item) => sum + triangleCount(item.mesh), 0),
    },
  };
}

function normalizeDiscipline(value, fallback = "general") {
  const text = safeText(value, "").toLowerCase();
  if (!text) {
    return fallback;
  }
  const matched = DISCIPLINE_ALIASES.find((entry) => entry.patterns.some((pattern) => pattern.test(text)));
  return matched?.key || text;
}

function inferDiscipline(item, propertyMap, fallback = "general") {
  const explicit = lookupProperty(propertyMap, [
    "Discipline",
    "System Classification",
    "System Type",
    "Category",
    "类别",
    "专业",
  ]);
  return normalizeDiscipline(explicit || item?.discipline || item?.category || item?.name, fallback);
}

function buildElementIndexRecord(dbId, item, propertyMap) {
  const elementUniqueId = safeText(
    lookupProperty(propertyMap, ["UniqueId", "Unique ID", "GUID", "ExternalId", "External ID", "Handle"]) ||
      item?.externalId ||
      item?.guid ||
      item?.uniqueId,
    "",
  );
  const elementId = safeText(lookupProperty(propertyMap, ["ElementId", "Element ID", "Id", "ID"]) || item?.elementId, "");
  if (!elementUniqueId && !elementId) {
    return null;
  }
  return { dbId, elementUniqueId, elementId };
}

function buildGeometryIndexFromDerivativeProperties(payload, options = {}) {
  const collection = collectionFromDerivativePayload(payload);
  const defaultDiscipline = normalizeDiscipline(options.defaultDiscipline, "general");
  const includeMesh = options.includeMesh !== false;
  const warnings = [];
  const geometryIndex = [];
  const elementIndex = [];

  collection.forEach((item) => {
    const value = item && typeof item === "object" ? item : {};
    const dbId = Number(value.objectid ?? value.objectId ?? value.dbId ?? value.dbid);
    if (!Number.isInteger(dbId) || dbId < 0) {
      warnings.push({ code: "invalid_dbid", name: safeText(value.name, "") });
      return;
    }
    const propertyMap = normalizePropertyMap(value);
    const indexRecord = buildElementIndexRecord(dbId, value, propertyMap);
    if (indexRecord) {
      elementIndex.push(indexRecord);
    }
    const mesh = normalizeMesh(value.mesh || value.geometry?.mesh || value.geometry, options);
    const boundingBox =
      normalizeBoundingBox(value.boundingBox || value.bbox || value.bounds || value.box) ||
      boundingBoxFromProperties(propertyMap) ||
      boundingBoxFromMesh(mesh);
    if (!boundingBox) {
      warnings.push({ code: "missing_bounds", dbId, name: safeText(value.name, `dbId ${dbId}`) });
      return;
    }

    const record = {
      dbId,
      name: safeText(value.name || lookupProperty(propertyMap, ["Name", "名称"]), `dbId ${dbId}`),
      discipline: inferDiscipline(value, propertyMap, defaultDiscipline),
      boundingBox,
    };
    if (includeMesh && mesh) {
      record.mesh = mesh;
    }
    geometryIndex.push(record);
  });

  return {
    geometryIndex,
    elementIndex,
    warnings,
    summary: {
      totalObjects: collection.length,
      indexedElements: geometryIndex.length,
      skippedElements: collection.length - geometryIndex.length,
      elementIndexCount: elementIndex.length,
      meshElementCount: geometryIndex.filter((item) => item.mesh).length,
    },
  };
}

function normalizeManifestObjectIds(value) {
  if (Array.isArray(value)) {
    return normalizeObjectIds(value);
  }
  if (typeof value === "string") {
    return normalizeObjectIds(value.split(/[,;\s]+/));
  }
  return [];
}

function manifestResourceObjectIds(resource) {
  return normalizeManifestObjectIds(
    resource?.objectIds ||
      resource?.objectids ||
      resource?.advanced?.objectIds ||
      resource?.metadata?.objectIds ||
      resource?.properties?.objectIds,
  );
}

function manifestResourceModelGuid(resource) {
  return safeText(
    resource?.modelGuid ||
      resource?.modelguid ||
      resource?.advanced?.modelGuid ||
      resource?.guid ||
      resource?.metadata?.modelGuid,
    "",
  );
}

function isObjManifestResource(resource) {
  const urn = safeText(resource?.urn, "");
  const role = safeText(resource?.role, "").toLowerCase();
  const type = safeText(resource?.type, "").toLowerCase();
  const mime = safeText(resource?.mime, resource?.mimeType || resource?.contentType).toLowerCase();
  return Boolean(
    urn &&
      (/\.obj(?:$|[?#])/i.test(urn) || role === "obj" || type === "obj" || mime.includes("wavefront") || mime.includes("obj")) &&
      !/\.mtl(?:$|[?#])/i.test(urn),
  );
}

function findObjDerivativeResources(manifest, options = {}) {
  const requestedModelGuid = safeText(options.modelGuid, "");
  const requestedObjectIds = normalizeObjectIds(options.objectIds);
  const queue = [manifest];
  const resources = [];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }
    const children = Array.isArray(current.children) ? current.children : [];
    const derivatives = Array.isArray(current.derivatives) ? current.derivatives : [];
    queue.push(...children, ...derivatives);

    if (!isObjManifestResource(current)) {
      continue;
    }
    const status = safeText(current.status, "success").toLowerCase();
    if (status && status !== "success") {
      continue;
    }
    const modelGuid = manifestResourceModelGuid(current);
    if (requestedModelGuid && modelGuid && modelGuid !== requestedModelGuid) {
      continue;
    }
    const objectIds = manifestResourceObjectIds(current);
    if (requestedObjectIds.length && objectIds.length && !requestedObjectIds.every((id) => objectIds.includes(id))) {
      continue;
    }
    const urn = safeText(current.urn, "");
    if (seen.has(urn)) {
      continue;
    }
    seen.add(urn);
    resources.push({
      urn,
      modelGuid,
      objectIds,
      role: safeText(current.role, ""),
      status,
      mimeType: safeText(current.mime || current.mimeType || current.contentType, ""),
    });
  }

  return resources;
}

function mergeElementIndexes(primary = [], fallback = []) {
  const records = new Map();
  [...primary, ...fallback].forEach((item) => {
    const value = item && typeof item === "object" ? item : {};
    const dbId = Number(value.dbId ?? value.dbid);
    if (!Number.isInteger(dbId) || dbId < 0 || records.has(dbId)) {
      return;
    }
    const elementUniqueId = safeText(value.elementUniqueId || value.externalId || value.guid, "");
    const elementId = safeText(value.elementId || value.id, "");
    if (elementUniqueId || elementId) {
      records.set(dbId, { dbId, elementUniqueId, elementId });
    }
  });
  return [...records.values()];
}

function mergeGeometryExtractionSources({ primary = {}, fallback = {} } = {}) {
  const byDbId = new Map();
  (Array.isArray(primary.geometryIndex) ? primary.geometryIndex : []).forEach((item) => {
    if (!item || !Number.isInteger(Number(item.dbId))) {
      return;
    }
    byDbId.set(Number(item.dbId), { ...item });
  });
  (Array.isArray(fallback.geometryIndex) ? fallback.geometryIndex : []).forEach((item) => {
    const dbId = Number(item?.dbId);
    if (!Number.isInteger(dbId) || dbId < 0) {
      return;
    }
    const current = byDbId.get(dbId);
    if (!current) {
      byDbId.set(dbId, { ...item });
      return;
    }
    if (item.mesh && !current.mesh) {
      byDbId.set(dbId, {
        ...current,
        ...item,
        name: safeText(current.name, item.name),
        discipline: safeText(current.discipline, item.discipline),
      });
    }
  });
  const geometryIndex = [...byDbId.values()].sort((left, right) => Number(left.dbId) - Number(right.dbId));
  const elementIndex = mergeElementIndexes(primary.elementIndex, fallback.elementIndex);
  const warnings = [
    ...(Array.isArray(primary.warnings) ? primary.warnings.map((warning) => ({ source: "properties", ...warning })) : []),
    ...(Array.isArray(fallback.warnings) ? fallback.warnings.map((warning) => ({ source: "obj", ...warning })) : []),
  ];
  return {
    geometryIndex,
    elementIndex,
    warnings,
    summary: {
      totalObjects: Math.max(Number(primary.summary?.totalObjects || 0), geometryIndex.length),
      indexedElements: geometryIndex.length,
      skippedElements: Math.max(0, Number(primary.summary?.totalObjects || geometryIndex.length) - geometryIndex.length),
      elementIndexCount: elementIndex.length,
      meshElementCount: geometryIndex.filter((item) => item.mesh).length,
      fallbackIndexedElements: Number(fallback.summary?.indexedElements || 0),
      fallbackMeshElementCount: Number(fallback.summary?.meshElementCount || 0),
    },
  };
}

module.exports = {
  buildGeometryIndexFromDerivativeProperties,
  buildGeometryIndexFromObjDerivative,
  collectionFromDerivativePayload,
  findObjDerivativeResources,
  mergeGeometryExtractionSources,
  normalizeMesh,
};
