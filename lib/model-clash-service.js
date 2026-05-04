const crypto = require("node:crypto");

const CLASH_STATUSES = new Set(["open", "resolved", "approved"]);
const HEATMAP_STATUSES = new Set(["queued", "running", "succeeded", "failed"]);

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

function normalizeDbId(value) {
  const dbId = Number(value);
  return Number.isInteger(dbId) && dbId >= 0 ? dbId : null;
}

function normalizeDiscipline(value, fallback = "general") {
  return safeText(value, fallback).toLowerCase();
}

function normalizeTolerance(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function normalizeGridSize(value, fallback = 1) {
  const size = finiteNumber(value, fallback);
  return [0.5, 1, 2].includes(size) ? size : fallback;
}

function normalizeDisciplinePair(pair) {
  if (typeof pair === "string") {
    pair = pair.split(":");
  }
  if (!Array.isArray(pair) || pair.length < 2) {
    return null;
  }
  const left = normalizeDiscipline(pair[0], "");
  const right = normalizeDiscipline(pair[1], "");
  if (!left || !right) {
    return null;
  }
  return [left, right].sort().join(":");
}

function normalizeResponsibilityMap(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.entries(source).reduce((result, [key, mappedValue]) => {
    const normalizedKey = normalizeDisciplinePair(String(key).split(":"));
    const normalizedValue = normalizeDiscipline(mappedValue, "");
    if (normalizedKey && normalizedValue) {
      result[normalizedKey] = normalizedValue;
    }
    return result;
  }, {});
}

function normalizeClashRule(rule = {}) {
  const value = rule && typeof rule === "object" ? rule : {};
  return {
    tolerance: normalizeTolerance(value.tolerance, 0),
    ignoreSameDiscipline: value.ignoreSameDiscipline !== false,
    disciplinePairs: Array.isArray(value.disciplinePairs)
      ? value.disciplinePairs.map(normalizeDisciplinePair).filter(Boolean)
      : [],
    responsibilityMap: normalizeResponsibilityMap(value.responsibilityMap),
  };
}

function normalizeVector(value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value) ? value : fallback;
  return [finiteNumber(source[0], fallback[0] || 0), finiteNumber(source[1], fallback[1] || 0), finiteNumber(source[2], fallback[2] || 0)];
}

function normalizeBoundingBox(value) {
  const source = value && typeof value === "object" ? value : {};
  if (!Array.isArray(source.min) || !Array.isArray(source.max)) {
    return null;
  }
  const min = normalizeVector(source.min);
  const max = normalizeVector(source.max);
  if (min.some((coordinate, index) => coordinate > max[index])) {
    return null;
  }
  return { min, max };
}

function normalizeTransform(value) {
  const transform = value && typeof value === "object" ? value : {};
  const matrix = Array.isArray(transform.matrix)
    ? transform.matrix.map((item) => Number(item)).filter(Number.isFinite)
    : [];
  return {
    translation: normalizeVector(transform.translation, [0, 0, 0]),
    matrix: matrix.length === 16 ? matrix : null,
  };
}

function transformPoint(point, transformInput) {
  const transform = normalizeTransform(transformInput);
  if (transform.matrix) {
    const m = transform.matrix;
    return [
      m[0] * point[0] + m[1] * point[1] + m[2] * point[2] + m[3],
      m[4] * point[0] + m[5] * point[1] + m[6] * point[2] + m[7],
      m[8] * point[0] + m[9] * point[1] + m[10] * point[2] + m[11],
    ];
  }
  const [dx, dy, dz] = transform.translation;
  return [point[0] + dx, point[1] + dy, point[2] + dz];
}

function translateBox(box, transform) {
  const corners = [
    [box.min[0], box.min[1], box.min[2]],
    [box.min[0], box.min[1], box.max[2]],
    [box.min[0], box.max[1], box.min[2]],
    [box.min[0], box.max[1], box.max[2]],
    [box.max[0], box.min[1], box.min[2]],
    [box.max[0], box.min[1], box.max[2]],
    [box.max[0], box.max[1], box.min[2]],
    [box.max[0], box.max[1], box.max[2]],
  ].map((point) => transformPoint(point, transform));
  return corners.reduce(
    (result, point) => ({
      min: result.min.map((value, axis) => Math.min(value, point[axis])),
      max: result.max.map((value, axis) => Math.max(value, point[axis])),
    }),
    { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
  );
}

function flattenNumericArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flat(Infinity).map((item) => Number(item)).filter(Number.isFinite);
}

function normalizeMesh(value) {
  const source = value && typeof value === "object" ? value : {};
  const vertices = flattenNumericArray(source.vertices || source.positions || source.points);
  const triangles = flattenNumericArray(source.triangles || source.indices || source.faces).map((item) => Math.floor(item));
  if (vertices.length < 9 || vertices.length % 3 !== 0 || triangles.length < 3 || triangles.length % 3 !== 0) {
    return null;
  }
  const vertexCount = vertices.length / 3;
  if (triangles.some((index) => index < 0 || index >= vertexCount)) {
    return null;
  }
  return { vertices, triangles };
}

function translateMesh(mesh, transform) {
  if (!mesh) {
    return null;
  }
  const vertices = [];
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    vertices.push(...transformPoint([mesh.vertices[index], mesh.vertices[index + 1], mesh.vertices[index + 2]], transform));
  }
  return { vertices, triangles: [...mesh.triangles] };
}

function expandBox(box, tolerance) {
  const amount = normalizeTolerance(tolerance, 0);
  return {
    min: [box.min[0] - amount, box.min[1] - amount, box.min[2] - amount],
    max: [box.max[0] + amount, box.max[1] + amount, box.max[2] + amount],
  };
}

function intersectionBox(left, right) {
  const min = [
    Math.max(left.min[0], right.min[0]),
    Math.max(left.min[1], right.min[1]),
    Math.max(left.min[2], right.min[2]),
  ];
  const max = [
    Math.min(left.max[0], right.max[0]),
    Math.min(left.max[1], right.max[1]),
    Math.min(left.max[2], right.max[2]),
  ];
  if (min[0] >= max[0] || min[1] >= max[1] || min[2] >= max[2]) {
    return null;
  }
  return { min, max };
}

function boxVolume(box) {
  if (!box) {
    return 0;
  }
  return Math.max(0, box.max[0] - box.min[0]) *
    Math.max(0, box.max[1] - box.min[1]) *
    Math.max(0, box.max[2] - box.min[2]);
}

function boxCenter(box) {
  return [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
}

function boxesOverlapInclusive(left, right, epsilon = 1e-8) {
  return [0, 1, 2].every((axis) => left.min[axis] <= right.max[axis] + epsilon && left.max[axis] + epsilon >= right.min[axis]);
}

function vectorSubtract(left, right) {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function vectorDot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function vectorCross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function triangleFromMesh(mesh, triangleOffset) {
  const result = [];
  for (let vertex = 0; vertex < 3; vertex += 1) {
    const vertexIndex = mesh.triangles[triangleOffset + vertex] * 3;
    result.push([
      mesh.vertices[vertexIndex],
      mesh.vertices[vertexIndex + 1],
      mesh.vertices[vertexIndex + 2],
    ]);
  }
  return result;
}

function triangleBox(triangle) {
  return triangle.reduce(
    (box, point) => ({
      min: box.min.map((value, axis) => Math.min(value, point[axis])),
      max: box.max.map((value, axis) => Math.max(value, point[axis])),
    }),
    { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
  );
}

function unionBoxes(boxes) {
  return boxes.reduce(
    (result, box) => ({
      min: result.min.map((value, axis) => Math.min(value, box.min[axis])),
      max: result.max.map((value, axis) => Math.max(value, box.max[axis])),
    }),
    { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
  );
}

function triangleCentroid(triangle) {
  return [
    (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3,
    (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3,
    (triangle[0][2] + triangle[1][2] + triangle[2][2]) / 3,
  ];
}

function buildMeshBvh(mesh, leafSize = 16) {
  const triangles = [];
  for (let offset = 0; offset < mesh.triangles.length; offset += 3) {
    const triangle = triangleFromMesh(mesh, offset);
    triangles.push({
      offset,
      triangle,
      box: triangleBox(triangle),
      centroid: triangleCentroid(triangle),
    });
  }

  function build(items) {
    const box = unionBoxes(items.map((item) => item.box));
    if (items.length <= leafSize) {
      return { box, items };
    }
    const span = box.max.map((value, axis) => value - box.min[axis]);
    const axis = span.reduce((best, value, index, values) => (value > values[best] ? index : best), 0);
    const sorted = [...items].sort((left, right) => left.centroid[axis] - right.centroid[axis]);
    const middle = Math.max(1, Math.floor(sorted.length / 2));
    return {
      box,
      left: build(sorted.slice(0, middle)),
      right: build(sorted.slice(middle)),
    };
  }

  return triangles.length ? build(triangles) : null;
}

function segmentIntersectsTriangle(start, end, triangle, epsilon = 1e-8) {
  const edge1 = vectorSubtract(triangle[1], triangle[0]);
  const edge2 = vectorSubtract(triangle[2], triangle[0]);
  const direction = vectorSubtract(end, start);
  const pvec = vectorCross(direction, edge2);
  const determinant = vectorDot(edge1, pvec);
  if (Math.abs(determinant) < epsilon) {
    return false;
  }
  const inverseDeterminant = 1 / determinant;
  const tvec = vectorSubtract(start, triangle[0]);
  const u = vectorDot(tvec, pvec) * inverseDeterminant;
  if (u < -epsilon || u > 1 + epsilon) {
    return false;
  }
  const qvec = vectorCross(tvec, edge1);
  const v = vectorDot(direction, qvec) * inverseDeterminant;
  if (v < -epsilon || u + v > 1 + epsilon) {
    return false;
  }
  const t = vectorDot(edge2, qvec) * inverseDeterminant;
  return t >= -epsilon && t <= 1 + epsilon;
}

function pointInTriangle(point, triangle, epsilon = 1e-8) {
  const v0 = vectorSubtract(triangle[2], triangle[0]);
  const v1 = vectorSubtract(triangle[1], triangle[0]);
  const v2 = vectorSubtract(point, triangle[0]);
  const normal = vectorCross(v1, v0);
  const planeDistance = vectorDot(normal, v2);
  if (Math.abs(planeDistance) > epsilon) {
    return false;
  }
  const dot00 = vectorDot(v0, v0);
  const dot01 = vectorDot(v0, v1);
  const dot02 = vectorDot(v0, v2);
  const dot11 = vectorDot(v1, v1);
  const dot12 = vectorDot(v1, v2);
  const denominator = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denominator) < epsilon) {
    return false;
  }
  const inverse = 1 / denominator;
  const u = (dot11 * dot02 - dot01 * dot12) * inverse;
  const v = (dot00 * dot12 - dot01 * dot02) * inverse;
  return u >= -epsilon && v >= -epsilon && u + v <= 1 + epsilon;
}

function projectTriangle2d(triangle, dropAxis) {
  return triangle.map((point) => point.filter((_, axis) => axis !== dropAxis));
}

function orientation2d(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointOnSegment2d(point, start, end, epsilon = 1e-8) {
  return (
    Math.abs(orientation2d(start, end, point)) <= epsilon &&
    point[0] >= Math.min(start[0], end[0]) - epsilon &&
    point[0] <= Math.max(start[0], end[0]) + epsilon &&
    point[1] >= Math.min(start[1], end[1]) - epsilon &&
    point[1] <= Math.max(start[1], end[1]) + epsilon
  );
}

function segmentsIntersect2d(a, b, c, d, epsilon = 1e-8) {
  const o1 = orientation2d(a, b, c);
  const o2 = orientation2d(a, b, d);
  const o3 = orientation2d(c, d, a);
  const o4 = orientation2d(c, d, b);
  if (Math.abs(o1) <= epsilon && pointOnSegment2d(c, a, b, epsilon)) return true;
  if (Math.abs(o2) <= epsilon && pointOnSegment2d(d, a, b, epsilon)) return true;
  if (Math.abs(o3) <= epsilon && pointOnSegment2d(a, c, d, epsilon)) return true;
  if (Math.abs(o4) <= epsilon && pointOnSegment2d(b, c, d, epsilon)) return true;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function pointInTriangle2d(point, triangle, epsilon = 1e-8) {
  const [a, b, c] = triangle;
  const o1 = orientation2d(a, b, point);
  const o2 = orientation2d(b, c, point);
  const o3 = orientation2d(c, a, point);
  const hasNegative = o1 < -epsilon || o2 < -epsilon || o3 < -epsilon;
  const hasPositive = o1 > epsilon || o2 > epsilon || o3 > epsilon;
  return !(hasNegative && hasPositive);
}

function coplanarTrianglesIntersect(left, right, epsilon = 1e-8) {
  const normal = vectorCross(vectorSubtract(left[1], left[0]), vectorSubtract(left[2], left[0]));
  const dropAxis = normal.map(Math.abs).reduce((best, value, index, values) => (value > values[best] ? index : best), 0);
  const left2d = projectTriangle2d(left, dropAxis);
  const right2d = projectTriangle2d(right, dropAxis);
  if (left2d.some((point) => pointInTriangle2d(point, right2d, epsilon)) || right2d.some((point) => pointInTriangle2d(point, left2d, epsilon))) {
    return true;
  }
  for (let leftIndex = 0; leftIndex < 3; leftIndex += 1) {
    const leftStart = left2d[leftIndex];
    const leftEnd = left2d[(leftIndex + 1) % 3];
    for (let rightIndex = 0; rightIndex < 3; rightIndex += 1) {
      if (segmentsIntersect2d(leftStart, leftEnd, right2d[rightIndex], right2d[(rightIndex + 1) % 3], epsilon)) {
        return true;
      }
    }
  }
  return false;
}

function trianglesIntersect(left, right, epsilon = 1e-8) {
  if (!boxesOverlapInclusive(triangleBox(left), triangleBox(right), epsilon)) {
    return false;
  }
  for (let index = 0; index < 3; index += 1) {
    if (segmentIntersectsTriangle(left[index], left[(index + 1) % 3], right, epsilon)) {
      return true;
    }
    if (segmentIntersectsTriangle(right[index], right[(index + 1) % 3], left, epsilon)) {
      return true;
    }
  }
  if (left.some((point) => pointInTriangle(point, right, epsilon)) || right.some((point) => pointInTriangle(point, left, epsilon))) {
    return true;
  }
  const leftNormal = vectorCross(vectorSubtract(left[1], left[0]), vectorSubtract(left[2], left[0]));
  const rightNormal = vectorCross(vectorSubtract(right[1], right[0]), vectorSubtract(right[2], right[0]));
  const normalCross = vectorCross(leftNormal, rightNormal);
  if (vectorDot(normalCross, normalCross) <= epsilon) {
    const planeDistance = Math.abs(vectorDot(leftNormal, vectorSubtract(right[0], left[0])));
    if (planeDistance <= epsilon) {
      return coplanarTrianglesIntersect(left, right, epsilon);
    }
  }
  return false;
}

function bvhNodesIntersect(leftNode, rightNode) {
  if (!leftNode || !rightNode || !boxesOverlapInclusive(leftNode.box, rightNode.box)) {
    return false;
  }
  if (leftNode.items && rightNode.items) {
    return leftNode.items.some((left) =>
      rightNode.items.some((right) => boxesOverlapInclusive(left.box, right.box) && trianglesIntersect(left.triangle, right.triangle)),
    );
  }
  if (leftNode.items) {
    return bvhNodesIntersect(leftNode, rightNode.left) || bvhNodesIntersect(leftNode, rightNode.right);
  }
  if (rightNode.items) {
    return bvhNodesIntersect(leftNode.left, rightNode) || bvhNodesIntersect(leftNode.right, rightNode);
  }
  return (
    bvhNodesIntersect(leftNode.left, rightNode.left) ||
    bvhNodesIntersect(leftNode.left, rightNode.right) ||
    bvhNodesIntersect(leftNode.right, rightNode.left) ||
    bvhNodesIntersect(leftNode.right, rightNode.right)
  );
}

function meshesIntersect(leftMesh, rightMesh) {
  if (!leftMesh || !rightMesh) {
    return null;
  }
  return bvhNodesIntersect(buildMeshBvh(leftMesh), buildMeshBvh(rightMesh));
}

function disciplinePairKey(left, right) {
  return [normalizeDiscipline(left, ""), normalizeDiscipline(right, "")].sort().join(":");
}

function ruleAllowsPair(rule, left, right) {
  const leftDiscipline = normalizeDiscipline(left.discipline, "");
  const rightDiscipline = normalizeDiscipline(right.discipline, "");
  if (rule.ignoreSameDiscipline && leftDiscipline && leftDiscipline === rightDiscipline) {
    return false;
  }
  if (!rule.disciplinePairs.length) {
    return true;
  }
  return rule.disciplinePairs.includes(disciplinePairKey(leftDiscipline, rightDiscipline));
}

function normalizeModelElements(models = []) {
  return (Array.isArray(models) ? models : []).flatMap((model) => {
    const modelValue = model && typeof model === "object" ? model : {};
    const modelDiscipline = normalizeDiscipline(modelValue.discipline, "general");
    const modelTransform = normalizeTransform(modelValue.transform);
    return (Array.isArray(modelValue.elements) ? modelValue.elements : [])
      .map((element) => {
        const elementValue = element && typeof element === "object" ? element : {};
        const dbId = normalizeDbId(elementValue.dbId ?? elementValue.dbid);
        const localBox = normalizeBoundingBox(elementValue.boundingBox || elementValue.bbox);
        const localMesh = normalizeMesh(elementValue.mesh || elementValue.geometry?.mesh || elementValue.geometry);
        if (dbId === null || !localBox) {
          return null;
        }
        const worldBox = translateBox(localBox, modelTransform);
        return {
          documentId: safeText(modelValue.documentId, ""),
          modelUrn: safeText(modelValue.urn || modelValue.modelUrn, ""),
          modelName: safeText(modelValue.name, ""),
          dbId,
          name: safeText(elementValue.name, `dbId ${dbId}`),
          discipline: normalizeDiscipline(elementValue.discipline, modelDiscipline),
          boundingBox: worldBox,
          mesh: translateMesh(localMesh, modelTransform),
        };
      })
      .filter(Boolean);
  });
}

function compareClashPriority(left, right) {
  if (right.clashVolume !== left.clashVolume) {
    return right.clashVolume - left.clashVolume;
  }
  return `${left.modelUrnA}:${left.dbIdA}:${left.modelUrnB}:${left.dbIdB}`.localeCompare(
    `${right.modelUrnA}:${right.dbIdA}:${right.modelUrnB}:${right.dbIdB}`,
  );
}

function detectClashes({ models = [], rule = {} } = {}) {
  const normalizedRule = normalizeClashRule(rule);
  const elements = normalizeModelElements(models);
  const clashes = [];
  const summary = {
    modelCount: Array.isArray(models) ? models.length : 0,
    elementCount: elements.length,
    candidatePairs: 0,
    filteredPairs: 0,
    broadPhaseHits: 0,
    preciseHits: 0,
    meshTests: 0,
    meshHits: 0,
    bboxFallbackHits: 0,
  };

  for (let leftIndex = 0; leftIndex < elements.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex += 1) {
      const left = elements[leftIndex];
      const right = elements[rightIndex];
      summary.candidatePairs += 1;
      if (!ruleAllowsPair(normalizedRule, left, right)) {
        summary.filteredPairs += 1;
        continue;
      }
      const broadIntersection = intersectionBox(
        expandBox(left.boundingBox, normalizedRule.tolerance),
        expandBox(right.boundingBox, normalizedRule.tolerance),
      );
      if (!broadIntersection) {
        continue;
      }
      summary.broadPhaseHits += 1;
      const meshResult = meshesIntersect(left.mesh, right.mesh);
      if (meshResult !== null) {
        summary.meshTests += 1;
        if (!meshResult) {
          continue;
        }
        summary.meshHits += 1;
      } else {
        summary.bboxFallbackHits += 1;
      }
      const exactIntersection = intersectionBox(left.boundingBox, right.boundingBox) || broadIntersection;
      const clashVolume = boxVolume(exactIntersection);
      const pairKey = disciplinePairKey(left.discipline, right.discipline);
      summary.preciseHits += 1;
      clashes.push({
        modelUrnA: left.modelUrn,
        documentIdA: left.documentId,
        dbIdA: left.dbId,
        elementNameA: left.name,
        disciplineA: left.discipline,
        modelUrnB: right.modelUrn,
        documentIdB: right.documentId,
        dbIdB: right.dbId,
        elementNameB: right.name,
        disciplineB: right.discipline,
        clashVolume,
        intersectionBox: exactIntersection,
        center: boxCenter(exactIntersection),
        responsibilityDiscipline: normalizedRule.responsibilityMap[pairKey] || right.discipline || left.discipline,
      });
    }
  }

  return {
    rule: normalizedRule,
    summary,
    clashes: clashes.sort(compareClashPriority),
  };
}

function normalizeClashStatus(value, fallback = "open") {
  const status = safeText(value, fallback).toLowerCase();
  return CLASH_STATUSES.has(status) ? status : fallback;
}

function normalizeHeatmapStatus(value, fallback = "succeeded") {
  const status = safeText(value, fallback).toLowerCase();
  return HEATMAP_STATUSES.has(status) ? status : fallback;
}

function normalizeClashRecord(record = {}) {
  const value = record && typeof record === "object" ? record : {};
  const createdAt = safeText(value.createdAt || value.created_at, new Date().toISOString());
  return {
    id: safeText(value.id, crypto.randomUUID()),
    runId: safeText(value.runId || value.run_id, ""),
    projectId: safeText(value.projectId || value.project_id, ""),
    documentIdA: safeText(value.documentIdA || value.document_id_a, ""),
    modelUrnA: safeText(value.modelUrnA || value.model_urn_a, ""),
    dbIdA: normalizeDbId(value.dbIdA ?? value.dbidA ?? value.dbid_a) ?? 0,
    elementNameA: safeText(value.elementNameA || value.element_name_a, ""),
    disciplineA: normalizeDiscipline(value.disciplineA || value.discipline_a, ""),
    documentIdB: safeText(value.documentIdB || value.document_id_b, ""),
    modelUrnB: safeText(value.modelUrnB || value.model_urn_b, ""),
    dbIdB: normalizeDbId(value.dbIdB ?? value.dbidB ?? value.dbid_b) ?? 0,
    elementNameB: safeText(value.elementNameB || value.element_name_b, ""),
    disciplineB: normalizeDiscipline(value.disciplineB || value.discipline_b, ""),
    clashVolume: Math.max(0, finiteNumber(value.clashVolume ?? value.clash_volume, 0)),
    status: normalizeClashStatus(value.status, "open"),
    issueId: safeText(value.issueId || value.issue_id, ""),
    responsibilityDiscipline: normalizeDiscipline(value.responsibilityDiscipline || value.responsibility_discipline, ""),
    center: normalizeVector(value.center, [0, 0, 0]),
    intersectionBox: normalizeBoundingBox(value.intersectionBox || value.intersection_box),
    createdAt,
    updatedAt: safeText(value.updatedAt || value.updated_at, createdAt),
  };
}

function normalizeHeatmapTask(task = {}) {
  const value = task && typeof task === "object" ? task : {};
  const createdAt = safeText(value.createdAt || value.created_at, new Date().toISOString());
  const summary = value.summary || value.summary_json;
  return {
    id: safeText(value.id, crypto.randomUUID()),
    clashTaskId: safeText(value.clashTaskId || value.clash_task_id || value.runId || value.run_id, ""),
    projectId: safeText(value.projectId || value.project_id, ""),
    gridSize: normalizeGridSize(value.gridSize ?? value.grid_size, 1),
    status: normalizeHeatmapStatus(value.status, "succeeded"),
    summary: summary && typeof summary === "object" ? JSON.parse(JSON.stringify(summary)) : {},
    createdAt,
    updatedAt: safeText(value.updatedAt || value.updated_at, createdAt),
  };
}

function normalizeHeatmapCell(cell = {}) {
  const value = cell && typeof cell === "object" ? cell : {};
  const x = finiteNumber(value.x, 0);
  const y = finiteNumber(value.y, 0);
  const z = finiteNumber(value.z, 0);
  const gridSize = normalizeGridSize(value.gridSize ?? value.grid_size, 1);
  return {
    id: safeText(value.id, crypto.randomUUID()),
    heatmapId: safeText(value.heatmapId || value.heatmap_id, ""),
    x,
    y,
    z,
    gridSize,
    density: Math.max(0, Math.floor(finiteNumber(value.density, 0))),
    disciplinePair: safeText(value.disciplinePair || value.discipline_pair, ""),
    recordIds: Array.isArray(value.recordIds || value.record_ids)
      ? (value.recordIds || value.record_ids).map((item) => safeText(item, "")).filter(Boolean)
      : [],
    bbox: normalizeBoundingBox(value.bbox) || {
      min: [x, y, z],
      max: [x + gridSize, y + gridSize, z + gridSize],
    },
    color: safeText(value.color, ""),
    intensity: Math.max(0, Math.min(1, finiteNumber(value.intensity, 0))),
  };
}

function normalizeHotspot(hotspot = {}) {
  const value = hotspot && typeof hotspot === "object" ? hotspot : {};
  const bbox = normalizeBoundingBox(value.bbox) || { min: [0, 0, 0], max: [0, 0, 0] };
  return {
    id: safeText(value.id, crypto.randomUUID()),
    heatmapId: safeText(value.heatmapId || value.heatmap_id, ""),
    bbox,
    center: normalizeVector(value.center, boxCenter(bbox)),
    clashCount: Math.max(0, Math.floor(finiteNumber(value.clashCount ?? value.clash_count, 0))),
    disciplines: Array.isArray(value.disciplines)
      ? Array.from(new Set(value.disciplines.map((item) => normalizeDiscipline(item, "")).filter(Boolean))).sort()
      : [],
    disciplinePairs: Array.isArray(value.disciplinePairs || value.discipline_pairs)
      ? Array.from(new Set((value.disciplinePairs || value.discipline_pairs).map((item) => safeText(item, "")).filter(Boolean))).sort()
      : [],
    openIssueCount: Math.max(0, Math.floor(finiteNumber(value.openIssueCount ?? value.open_issue_count, 0))),
    recordIds: Array.isArray(value.recordIds || value.record_ids)
      ? (value.recordIds || value.record_ids).map((item) => safeText(item, "")).filter(Boolean)
      : [],
  };
}

function createClashRecords(clashes = [], options = {}) {
  const createdAt = safeText(options.createdAt, new Date().toISOString());
  return (Array.isArray(clashes) ? clashes : []).map((clash) =>
    normalizeClashRecord({
      id: crypto.randomUUID(),
      runId: options.runId,
      projectId: options.projectId,
      ...clash,
      status: "open",
      issueId: "",
      createdAt,
      updatedAt: createdAt,
    }),
  );
}

function buildIssueViewerState(record, fallbackViewerState = null) {
  if (fallbackViewerState && typeof fallbackViewerState === "object") {
    return JSON.parse(JSON.stringify(fallbackViewerState));
  }
  const center = normalizeVector(record.center, [0, 0, 0]);
  return {
    viewport: {
      eye: [center[0] + 4, center[1] + 4, center[2] + 4],
      target: center,
      up: [0, 0, 1],
    },
  };
}

function buildClashIssuePayload(record, options = {}) {
  const normalized = normalizeClashRecord(record);
  const title = safeText(
    options.title,
    `自动碰撞 · ${normalized.disciplineA || "模型"} / ${normalized.disciplineB || "模型"}`,
  );
  const noteParts = [
    `${normalized.elementNameA || `dbId ${normalized.dbIdA}`} 与 ${normalized.elementNameB || `dbId ${normalized.dbIdB}`} 发生碰撞。`,
    `碰撞体积 ${normalized.clashVolume.toFixed(3)}。`,
    normalized.responsibilityDiscipline ? `责任专业 ${normalized.responsibilityDiscipline}。` : "",
  ].filter(Boolean);
  return {
    type: "note",
    variant: "issue",
    page: 1,
    x: 0.5,
    y: 0.5,
    width: 0.12,
    height: 0.08,
    title,
    note: noteParts.join(" "),
    actor: safeText(options.actor, "系统"),
    color: "red",
    status: "open",
    viewerState: buildIssueViewerState(normalized, options.viewerState),
    dbIds: [normalized.dbIdA, normalized.dbIdB].filter((item, index, source) => source.indexOf(item) === index),
    modelUrn: normalized.modelUrnA,
    boundModelVersion: safeText(options.boundModelVersion, ""),
    migrationStatus: "synced",
  };
}

function heatmapColorForIntensity(intensity) {
  const value = Math.max(0, Math.min(1, finiteNumber(intensity, 0)));
  if (value >= 0.75) {
    return "#d34a4a";
  }
  if (value >= 0.5) {
    return "#f5b535";
  }
  if (value >= 0.25) {
    return "#22a45d";
  }
  return "#237df0";
}

function filterHeatmapRecords(records = [], options = {}) {
  const source = Array.isArray(records) ? records : [];
  const runId = safeText(options.runId || options.clashTaskId || options.clash_task_id, "");
  const status = safeText(options.status || options.statusFilter, "all").toLowerCase();
  const minClashVolume = Math.max(0, finiteNumber(options.minClashVolume ?? options.severityThreshold, 0));
  const pair = safeText(options.disciplinePair, "all");
  const normalizedPair = pair === "all" ? "" : normalizeDisciplinePair(pair);
  return source
    .map(normalizeClashRecord)
    .filter((record) => !runId || record.runId === runId)
    .filter((record) => status === "all" || record.status === status)
    .filter((record) => record.clashVolume >= minClashVolume)
    .filter((record) => !normalizedPair || disciplinePairKey(record.disciplineA, record.disciplineB) === normalizedPair);
}

function buildDisciplineMatrix(records = []) {
  const normalized = (Array.isArray(records) ? records : []).map(normalizeClashRecord);
  const disciplines = Array.from(new Set(normalized.flatMap((record) => [
    normalizeDiscipline(record.disciplineA, ""),
    normalizeDiscipline(record.disciplineB, ""),
  ]).filter(Boolean))).sort();
  const counts = disciplines.reduce((result, discipline) => {
    result[discipline] = disciplines.reduce((row, column) => {
      row[column] = discipline === column ? null : 0;
      return row;
    }, {});
    return result;
  }, {});
  normalized.forEach((record) => {
    const left = normalizeDiscipline(record.disciplineA, "");
    const right = normalizeDiscipline(record.disciplineB, "");
    if (!left || !right || left === right) {
      return;
    }
    counts[left][right] = (counts[left][right] || 0) + 1;
    counts[right][left] = (counts[right][left] || 0) + 1;
  });
  return { disciplines, counts };
}

function buildClashHeatmap(records = [], options = {}) {
  const gridSize = normalizeGridSize(options.gridSize ?? options.grid_size, 1);
  const topN = Math.max(1, Math.min(20, Math.floor(finiteNumber(options.topN, 5))));
  const createdAt = safeText(options.createdAt, new Date().toISOString());
  const heatmapId = safeText(options.id, crypto.randomUUID());
  const clashTaskId = safeText(options.clashTaskId || options.runId, "");
  const projectId = safeText(options.projectId, "");
  const filteredRecords = filterHeatmapRecords(records, { ...options, runId: clashTaskId || options.runId });
  const cellGroups = new Map();
  const hotspotGroups = new Map();

  filteredRecords.forEach((record) => {
    const center = normalizeVector(record.center, [0, 0, 0]);
    const indexes = center.map((coordinate) => Math.floor(coordinate / gridSize));
    const origin = indexes.map((index) => index * gridSize);
    const pair = disciplinePairKey(record.disciplineA, record.disciplineB);
    const cellKey = `${indexes.join(":")}:${pair}`;
    const hotspotKey = indexes.join(":");
    if (!cellGroups.has(cellKey)) {
      cellGroups.set(cellKey, {
        x: origin[0],
        y: origin[1],
        z: origin[2],
        bbox: {
          min: origin,
          max: [origin[0] + gridSize, origin[1] + gridSize, origin[2] + gridSize],
        },
        disciplinePair: pair,
        recordIds: [],
      });
    }
    cellGroups.get(cellKey).recordIds.push(record.id);
    if (!hotspotGroups.has(hotspotKey)) {
      hotspotGroups.set(hotspotKey, {
        bbox: {
          min: origin,
          max: [origin[0] + gridSize, origin[1] + gridSize, origin[2] + gridSize],
        },
        disciplines: new Set(),
        disciplinePairs: new Set(),
        openIssueCount: 0,
        recordIds: [],
      });
    }
    const hotspot = hotspotGroups.get(hotspotKey);
    hotspot.disciplines.add(normalizeDiscipline(record.disciplineA, ""));
    hotspot.disciplines.add(normalizeDiscipline(record.disciplineB, ""));
    hotspot.disciplinePairs.add(pair);
    hotspot.openIssueCount += record.status === "open" ? 1 : 0;
    hotspot.recordIds.push(record.id);
  });

  const maxDensity = Math.max(1, ...Array.from(cellGroups.values()).map((cell) => cell.recordIds.length));
  const cells = Array.from(cellGroups.values())
    .map((cell) => {
      const density = cell.recordIds.length;
      const intensity = density / maxDensity;
      return normalizeHeatmapCell({
        id: crypto.randomUUID(),
        heatmapId,
        gridSize,
        ...cell,
        density,
        intensity,
        color: heatmapColorForIntensity(intensity),
      });
    })
    .sort((left, right) => {
      if (right.density !== left.density) {
        return right.density - left.density;
      }
      return `${left.x}:${left.y}:${left.z}:${left.disciplinePair}`.localeCompare(`${right.x}:${right.y}:${right.z}:${right.disciplinePair}`);
    });

  const hotspots = Array.from(hotspotGroups.values())
    .map((hotspot) => normalizeHotspot({
      id: crypto.randomUUID(),
      heatmapId,
      bbox: hotspot.bbox,
      center: boxCenter(hotspot.bbox),
      clashCount: hotspot.recordIds.length,
      disciplines: Array.from(hotspot.disciplines),
      disciplinePairs: Array.from(hotspot.disciplinePairs),
      openIssueCount: hotspot.openIssueCount,
      recordIds: hotspot.recordIds,
    }))
    .sort((left, right) => {
      if (right.clashCount !== left.clashCount) {
        return right.clashCount - left.clashCount;
      }
      if (right.openIssueCount !== left.openIssueCount) {
        return right.openIssueCount - left.openIssueCount;
      }
      return `${left.bbox.min.join(":")}`.localeCompare(`${right.bbox.min.join(":")}`);
    })
    .slice(0, topN);

  const summary = {
    clashCount: filteredRecords.length,
    openClashCount: filteredRecords.filter((record) => record.status === "open").length,
    cellCount: cells.length,
    hotspotCount: hotspots.length,
    maxDensity,
    topHotspotClashCount: hotspots[0]?.clashCount || 0,
    gridSize,
  };

  const task = normalizeHeatmapTask({
    id: heatmapId,
    clashTaskId,
    projectId,
    gridSize,
    status: "succeeded",
    summary,
    createdAt,
    updatedAt: createdAt,
  });

  return {
    task,
    cells,
    hotspots,
    matrix: buildDisciplineMatrix(filteredRecords),
    summary,
  };
}

module.exports = {
  buildClashIssuePayload,
  buildClashHeatmap,
  buildDisciplineMatrix,
  createClashRecords,
  detectClashes,
  normalizeHeatmapCell,
  normalizeHeatmapTask,
  normalizeHotspot,
  normalizeClashRecord,
  normalizeClashRule,
};
