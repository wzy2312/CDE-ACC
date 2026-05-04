const assert = require("node:assert/strict");

const {
  buildGeometryIndexFromDerivativeProperties,
  buildGeometryIndexFromObjDerivative,
  findObjDerivativeResources,
  mergeGeometryExtractionSources,
} = require("../lib/model-geometry-extraction");

function approx(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

function main() {
  const payload = {
    data: {
      collection: [
        {
          objectid: 101,
          name: "Wall S-101",
          properties: [
            { displayName: "UniqueId", displayValue: "wall-unique-101" },
            { displayName: "ElementId", displayValue: "100101" },
            { displayName: "Category", displayValue: "Structural Framing" },
            { displayName: "Discipline", displayValue: "Structure" },
            { displayName: "Bounding Box Min", displayValue: "0, 0, 0" },
            { displayName: "Bounding Box Max", displayValue: "2, 0.4, 3" },
          ],
        },
        {
          objectid: 201,
          name: "Pipe P-201",
          properties: [
            { displayName: "GUID", displayValue: "pipe-guid-201" },
            { displayName: "System Classification", displayValue: "MEP" },
            { displayName: "Location X", displayValue: "3m" },
            { displayName: "Location Y", displayValue: "1m" },
            { displayName: "Location Z", displayValue: "2m" },
            { displayName: "Length", displayValue: "4m" },
            { displayName: "Width", displayValue: "0.5m" },
            { displayName: "Height", displayValue: "0.5m" },
          ],
        },
        {
          objectid: 301,
          name: "Mesh Duct",
          properties: [
            { displayName: "Discipline", displayValue: "HVAC" },
          ],
          mesh: {
            vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
            triangles: [0, 1, 2],
          },
        },
        {
          objectid: 401,
          name: "No geometry",
          properties: [
            { displayName: "Category", displayValue: "Generic Model" },
          ],
        },
      ],
    },
  };

  const result = buildGeometryIndexFromDerivativeProperties(payload, {
    defaultDiscipline: "general",
    includeMesh: true,
  });

  assert.equal(result.summary.totalObjects, 4);
  assert.equal(result.summary.indexedElements, 3);
  assert.equal(result.summary.skippedElements, 1);
  assert.equal(result.geometryIndex.length, 3);
  assert.equal(result.elementIndex.length, 2);

  const wall = result.geometryIndex.find((item) => item.dbId === 101);
  assert.equal(wall.discipline, "structure");
  assert.deepEqual(wall.boundingBox.min, [0, 0, 0]);
  assert.deepEqual(wall.boundingBox.max, [2, 0.4, 3]);

  const pipe = result.geometryIndex.find((item) => item.dbId === 201);
  assert.equal(pipe.discipline, "mep");
  approx(pipe.boundingBox.min[0], 1);
  approx(pipe.boundingBox.max[0], 5);
  approx(pipe.boundingBox.min[1], 0.75);
  approx(pipe.boundingBox.max[2], 2.25);

  const duct = result.geometryIndex.find((item) => item.dbId === 301);
  assert.equal(duct.discipline, "mep");
  assert.deepEqual(duct.boundingBox.max, [1, 1, 0]);
  assert.deepEqual(duct.mesh.triangles, [0, 1, 2]);

  const wallIndex = result.elementIndex.find((item) => item.dbId === 101);
  assert.equal(wallIndex.elementUniqueId, "wall-unique-101");
  assert.equal(wallIndex.elementId, "100101");

  const objText = [
    "o dbId_501 Pipe Segment",
    "v 10 0 0",
    "v 11 0 0",
    "v 10 1 0",
    "v 10 0 1",
    "f 1 2 3",
    "f 1 2 4",
    "g objectid_601",
    "v 0 0 0",
    "v 0 2 0",
    "v 0 0 2",
    "f 5 6 7",
  ].join("\n");
  const objResult = buildGeometryIndexFromObjDerivative(objText, {
    objectIds: [501, 601],
    metadataByDbId: new Map([
      [501, { name: "Pipe Segment", discipline: "MEP" }],
      [601, { name: "Wall Panel", discipline: "Structure" }],
    ]),
  });
  assert.equal(objResult.geometryIndex.length, 2);
  assert.equal(objResult.summary.meshElementCount, 2);
  const objPipe = objResult.geometryIndex.find((item) => item.dbId === 501);
  assert.equal(objPipe.name, "Pipe Segment");
  assert.equal(objPipe.discipline, "mep");
  assert.deepEqual(objPipe.boundingBox.min, [10, 0, 0]);
  assert.deepEqual(objPipe.boundingBox.max, [11, 1, 1]);
  assert.deepEqual(objPipe.mesh.triangles, [0, 1, 2, 0, 1, 3]);

  const singleObjectObj = [
    "v 3 3 3",
    "v 4 3 3",
    "v 3 4 3",
    "f 1 2 3",
  ].join("\n");
  const singleObjectResult = buildGeometryIndexFromObjDerivative(singleObjectObj, {
    objectIds: [701],
    defaultDiscipline: "Architecture",
  });
  assert.equal(singleObjectResult.geometryIndex[0].dbId, 701);
  assert.equal(singleObjectResult.geometryIndex[0].discipline, "architecture");
  assert.deepEqual(singleObjectResult.geometryIndex[0].boundingBox.max, [4, 4, 3]);

  const manifest = {
    derivatives: [
      {
        children: [
          { role: "obj", status: "success", urn: "urn:adsk.viewing:fs.file:source/output/geometry/a.obj", modelGuid: "model-guid", objectIds: [501] },
          { role: "obj", status: "success", urn: "urn:adsk.viewing:fs.file:source/output/geometry/a.mtl", modelGuid: "model-guid", objectIds: [501] },
          { role: "obj", status: "failed", urn: "urn:adsk.viewing:fs.file:source/output/geometry/b.obj", modelGuid: "model-guid", objectIds: [601] },
          { role: "obj", status: "success", urn: "urn:adsk.viewing:fs.file:source/output/geometry/c.obj", modelGuid: "other-guid", objectIds: [501] },
        ],
      },
    ],
  };
  const resources = findObjDerivativeResources(manifest, { modelGuid: "model-guid", objectIds: [501] });
  assert.equal(resources.length, 1);
  assert.equal(resources[0].urn, "urn:adsk.viewing:fs.file:source/output/geometry/a.obj");

  const merged = mergeGeometryExtractionSources({
    primary: {
      geometryIndex: [
        { dbId: 801, name: "BBox Only", discipline: "structure", boundingBox: { min: [0, 0, 0], max: [1, 1, 1] } },
        { dbId: 802, name: "Already Precise", discipline: "mep", boundingBox: { min: [4, 4, 4], max: [5, 5, 5] }, mesh: { vertices: [4, 4, 4, 5, 4, 4, 4, 5, 4], triangles: [0, 1, 2] } },
      ],
      elementIndex: [{ dbId: 801, elementUniqueId: "bbox-only", elementId: "801" }],
      warnings: [{ code: "missing_bounds", dbId: 803 }],
      summary: { totalObjects: 3, indexedElements: 2, skippedElements: 1, elementIndexCount: 1, meshElementCount: 1 },
    },
    fallback: {
      geometryIndex: [
        { dbId: 801, name: "OBJ Mesh", discipline: "structure", boundingBox: { min: [0, 0, 0], max: [2, 2, 0] }, mesh: { vertices: [0, 0, 0, 2, 0, 0, 0, 2, 0], triangles: [0, 1, 2] } },
        { dbId: 803, name: "Recovered From OBJ", discipline: "mep", boundingBox: { min: [9, 9, 9], max: [10, 10, 9] }, mesh: { vertices: [9, 9, 9, 10, 9, 9, 9, 10, 9], triangles: [0, 1, 2] } },
      ],
      elementIndex: [],
      warnings: [],
      summary: { totalObjects: 2, indexedElements: 2, skippedElements: 0, elementIndexCount: 0, meshElementCount: 2 },
    },
  });
  assert.equal(merged.geometryIndex.length, 3);
  assert.ok(merged.geometryIndex.find((item) => item.dbId === 801).mesh, "OBJ mesh should enrich bbox-only property extraction");
  assert.ok(merged.geometryIndex.find((item) => item.dbId === 802).mesh, "existing precise mesh should be preserved");
  assert.ok(merged.geometryIndex.find((item) => item.dbId === 803).mesh, "OBJ fallback should recover skipped objects");
  assert.equal(merged.summary.meshElementCount, 3);

  console.log("model geometry extraction tests passed");
}

main();
