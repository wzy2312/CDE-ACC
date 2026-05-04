const assert = require("node:assert/strict");

const {
  buildClashIssuePayload,
  buildClashHeatmap,
  createClashRecords,
  detectClashes,
  normalizeClashRule,
} = require("../lib/model-clash-service");

function approx(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

function main() {
  const rule = normalizeClashRule({
    tolerance: 0,
    ignoreSameDiscipline: true,
    disciplinePairs: [["structure", "mep"]],
    responsibilityMap: {
      "structure:mep": "mep",
    },
  });

  const detection = detectClashes({
    rule,
    models: [
      {
        documentId: "doc-structure",
        urn: "urn:structure",
        discipline: "structure",
        elements: [
          {
            dbId: 11,
            name: "Concrete wall",
            discipline: "structure",
            boundingBox: { min: [0, 0, 0], max: [2, 2, 2] },
          },
          {
            dbId: 12,
            name: "Second wall",
            discipline: "structure",
            boundingBox: { min: [4, 4, 0], max: [6, 6, 2] },
          },
        ],
      },
      {
        documentId: "doc-pipe",
        urn: "urn:pipe",
        discipline: "mep",
        transform: { translation: [-0.2, 0, 0] },
        elements: [
          {
            dbId: 21,
            name: "Pipe A",
            discipline: "mep",
            boundingBox: { min: [1.8, 0.5, 0.5], max: [2.6, 1, 1] },
          },
          {
            dbId: 22,
            name: "Pipe B",
            discipline: "mep",
            boundingBox: { min: [8, 8, 0], max: [8.5, 8.5, 1] },
          },
        ],
      },
      {
        documentId: "doc-arch",
        urn: "urn:arch",
        discipline: "architecture",
        elements: [
          {
            dbId: 31,
            name: "Door",
            discipline: "architecture",
            boundingBox: { min: [0.25, 0.25, 0], max: [0.75, 0.75, 2] },
          },
        ],
      },
    ],
  });

  assert.equal(detection.clashes.length, 1);
  assert.equal(detection.summary.candidatePairs, 10);
  assert.equal(detection.summary.filteredPairs, 6);
  assert.equal(detection.clashes[0].modelUrnA, "urn:structure");
  assert.equal(detection.clashes[0].dbIdA, 11);
  assert.equal(detection.clashes[0].modelUrnB, "urn:pipe");
  assert.equal(detection.clashes[0].dbIdB, 21);
  assert.equal(detection.clashes[0].responsibilityDiscipline, "mep");
  approx(detection.clashes[0].clashVolume, 0.1);

  const [record] = createClashRecords(detection.clashes, {
    runId: "run-001",
    projectId: "project-001",
    createdAt: "2026-04-25T12:00:00.000Z",
  });

  assert.equal(record.modelUrnA, "urn:structure");
  assert.equal(record.dbIdA, 11);
  assert.equal(record.modelUrnB, "urn:pipe");
  assert.equal(record.dbIdB, 21);
  assert.equal(record.status, "open");
  assert.equal(record.issueId, "");
  assert.equal(record.runId, "run-001");
  assert.equal(record.projectId, "project-001");
  approx(record.clashVolume, 0.1);

  const meshDetection = detectClashes({
    rule: { ignoreSameDiscipline: false },
    models: [
      {
        documentId: "doc-mesh-a",
        urn: "urn:mesh-a",
        discipline: "structure",
        elements: [
          {
            dbId: 501,
            name: "Mesh floor",
            discipline: "structure",
            boundingBox: { min: [0, 0, 0], max: [2, 2, 1] },
            mesh: {
              vertices: [0, 0, 0, 2, 0, 0, 0, 2, 0],
              triangles: [0, 1, 2],
            },
          },
        ],
      },
      {
        documentId: "doc-mesh-b",
        urn: "urn:mesh-b",
        discipline: "mep",
        elements: [
          {
            dbId: 601,
            name: "Parallel tray",
            discipline: "mep",
            boundingBox: { min: [0, 0, 0], max: [2, 2, 1] },
            mesh: {
              vertices: [0, 0, 0.5, 2, 0, 0.5, 0, 2, 0.5],
              triangles: [0, 1, 2],
            },
          },
        ],
      },
    ],
  });
  assert.equal(meshDetection.summary.broadPhaseHits, 1);
  assert.equal(meshDetection.summary.preciseHits, 0);
  assert.equal(meshDetection.clashes.length, 0, "mesh precise phase should reject bbox-only false positives");

  const meshHitDetection = detectClashes({
    rule: { ignoreSameDiscipline: false },
    models: [
      {
        documentId: "doc-mesh-c",
        urn: "urn:mesh-c",
        discipline: "structure",
        elements: [
          {
            dbId: 701,
            name: "Triangle A",
            discipline: "structure",
            boundingBox: { min: [0, 0, 0], max: [2, 2, 0.1] },
            mesh: {
              vertices: [0, 0, 0, 2, 0, 0, 0, 2, 0],
              triangles: [0, 1, 2],
            },
          },
        ],
      },
      {
        documentId: "doc-mesh-d",
        urn: "urn:mesh-d",
        discipline: "mep",
        elements: [
          {
            dbId: 801,
            name: "Triangle B",
            discipline: "mep",
            boundingBox: { min: [0, 0, -0.1], max: [2, 2, 0.1] },
            mesh: {
              vertices: [0.25, 0.25, 0, 1.5, 0.25, 0, 0.25, 1.5, 0],
              triangles: [0, 1, 2],
            },
          },
        ],
      },
    ],
  });
  assert.equal(meshHitDetection.summary.preciseHits, 1);
  assert.equal(meshHitDetection.summary.meshHits, 1);
  assert.equal(meshHitDetection.clashes.length, 1);

  const matrixTransformDetection = detectClashes({
    rule: { ignoreSameDiscipline: false },
    models: [
      {
        documentId: "doc-matrix-a",
        urn: "urn:matrix-a",
        discipline: "structure",
        elements: [
          {
            dbId: 901,
            name: "Reference box",
            discipline: "structure",
            boundingBox: { min: [0, 0, 0], max: [1, 1, 1] },
          },
        ],
      },
      {
        documentId: "doc-matrix-b",
        urn: "urn:matrix-b",
        discipline: "mep",
        transform: {
          matrix: [
            1, 0, 0, -1,
            0, 1, 0, -1,
            0, 0, 1, -1,
            0, 0, 0, 1,
          ],
        },
        elements: [
          {
            dbId: 902,
            name: "Matrix shifted box",
            discipline: "mep",
            boundingBox: { min: [1.5, 1.5, 1.5], max: [2, 2, 2] },
          },
        ],
      },
    ],
  });
  assert.equal(matrixTransformDetection.clashes.length, 1);
  approx(matrixTransformDetection.clashes[0].clashVolume, 0.125);

  const issuePayload = buildClashIssuePayload(record, {
    actor: "系统",
    boundModelVersion: "V2",
    viewerState: { viewport: { eye: [4, 4, 4], target: [1.8, 0.75, 0.75] } },
  });

  assert.equal(issuePayload.variant, "issue");
  assert.equal(issuePayload.status, "open");
  assert.deepEqual(issuePayload.dbIds, [11, 21]);
  assert.equal(issuePayload.modelUrn, "urn:structure");
  assert.equal(issuePayload.boundModelVersion, "V2");
  assert.match(issuePayload.title, /自动碰撞/);
  assert.match(issuePayload.note, /Pipe A/);
  assert.match(issuePayload.note, /0\.100/);

  const heatmap = buildClashHeatmap(
    [
      {
        id: "clash-1",
        runId: "run-heat",
        projectId: "project-001",
        disciplineA: "structure",
        disciplineB: "mep",
        clashVolume: 0.4,
        status: "open",
        issueId: "issue-1",
        center: [0.2, 0.3, 0.4],
      },
      {
        id: "clash-2",
        runId: "run-heat",
        projectId: "project-001",
        disciplineA: "mep",
        disciplineB: "structure",
        clashVolume: 0.2,
        status: "resolved",
        issueId: "issue-2",
        center: [0.8, 0.2, 0.6],
      },
      {
        id: "clash-3",
        runId: "run-heat",
        projectId: "project-001",
        disciplineA: "architecture",
        disciplineB: "mep",
        clashVolume: 2.2,
        status: "open",
        issueId: "issue-3",
        center: [2.1, 0.4, 0.6],
      },
      {
        id: "clash-4",
        runId: "other-run",
        projectId: "project-001",
        disciplineA: "structure",
        disciplineB: "mep",
        clashVolume: 9,
        status: "open",
        issueId: "issue-4",
        center: [9, 9, 9],
      },
    ],
    {
      id: "heatmap-001",
      runId: "run-heat",
      projectId: "project-001",
      gridSize: 1,
      topN: 2,
      createdAt: "2026-04-25T13:00:00.000Z",
    },
  );

  assert.equal(heatmap.task.id, "heatmap-001");
  assert.equal(heatmap.task.clashTaskId, "run-heat");
  assert.equal(heatmap.task.gridSize, 1);
  assert.equal(heatmap.task.status, "succeeded");
  assert.equal(heatmap.summary.clashCount, 3);
  assert.equal(heatmap.summary.cellCount, 2);
  assert.equal(heatmap.cells.length, 2);
  assert.equal(heatmap.cells[0].density, 2);
  assert.deepEqual(heatmap.cells[0].bbox.min, [0, 0, 0]);
  assert.deepEqual(heatmap.cells[0].bbox.max, [1, 1, 1]);
  assert.equal(heatmap.cells[0].disciplinePair, "mep:structure");
  assert.equal(heatmap.hotspots.length, 2);
  assert.equal(heatmap.hotspots[0].clashCount, 2);
  assert.equal(heatmap.hotspots[0].openIssueCount, 1);
  assert.deepEqual(heatmap.matrix.disciplines, ["architecture", "mep", "structure"]);
  assert.equal(heatmap.matrix.counts.mep.structure, 2);
  assert.equal(heatmap.matrix.counts.structure.mep, 2);
  assert.equal(heatmap.matrix.counts.architecture.mep, 1);

  console.log("model clash service tests passed");
}

main();
