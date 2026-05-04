const assert = require("node:assert/strict");
const {
  compareModelSnapshots,
  elementsFromDerivativeProperties,
  generateModelDiffNarrative,
} = require("../lib/model-diff-service");

function prop(displayName, displayValue) {
  return { displayName, displayValue };
}

function payload(items) {
  return { data: { collection: items } };
}

const revA = payload([
  {
    objectid: 101,
    name: "SWRO Feed Pipe DN100",
    bbox: { min: [0, 0, 0], max: [1, 0.2, 0.2] },
    properties: [
      prop("UniqueId", "pipe-001"),
      prop("ElementId", "E-1001"),
      prop("Part Type", "Pipe"),
      prop("Process Unit", "RO 一段"),
      prop("Discipline", "管道"),
      prop("Nominal Diameter", "DN100"),
      prop("Material", "2205"),
    ],
  },
  {
    objectid: 102,
    name: "High Pressure Pump P-101",
    bbox: { min: [5, 0, 0], max: [6, 1, 1] },
    properties: [
      prop("Handle", "pump-handle-101"),
      prop("Equipment Type", "High Pressure Pump"),
      prop("Process Unit", "RO 一段"),
      prop("Discipline", "设备"),
      prop("Tag Number", "P-101"),
      prop("Operating Weight", "1.2 t"),
    ],
  },
  {
    objectid: 103,
    name: "Chemical Dosing Skid CD-01",
    bbox: { min: [10, 0, 0], max: [12, 2, 2] },
    properties: [
      prop("GlobalId", "ifc-skid-001"),
      prop("Equipment Type", "Chemical Dosing Skid"),
      prop("Process Unit", "加药间"),
      prop("Discipline", "工艺"),
      prop("Tag Number", "CD-01"),
    ],
  },
  {
    objectid: 104,
    name: "Removed Cartridge Filter CF-01",
    bbox: { min: [14, 0, 0], max: [15, 1, 1] },
    properties: [
      prop("UniqueId", "filter-removed"),
      prop("Equipment Type", "Cartridge Filter"),
      prop("Process Unit", "预处理"),
      prop("Discipline", "设备"),
    ],
  },
  {
    objectid: 105,
    name: "Unnamed spool without stable id",
    bbox: { min: [20, 0, 0], max: [21, 1, 1] },
    properties: [
      prop("Part Type", "Pipe Spool"),
      prop("Process Unit", "取水泵房"),
      prop("Discipline", "管道"),
    ],
  },
  {
    objectid: 106,
    name: "No comparable key",
    properties: [
      prop("Part Type", "Temporary Object"),
      prop("Discipline", "工艺"),
    ],
  },
]);

const revB = payload([
  {
    objectid: 201,
    name: "SWRO Feed Pipe DN150",
    bbox: { min: [0, 0, 0], max: [1, 0.2, 0.2] },
    properties: [
      prop("UniqueId", "pipe-001"),
      prop("ElementId", "E-1001"),
      prop("Part Type", "Pipe"),
      prop("Process Unit", "RO 一段"),
      prop("Discipline", "管道"),
      prop("Nominal Diameter", "DN150"),
      prop("Material", "2205"),
    ],
  },
  {
    objectid: 202,
    name: "High Pressure Pump P-101",
    bbox: { min: [5.15, 0, 0], max: [6.15, 1, 1] },
    properties: [
      prop("Handle", "pump-handle-101"),
      prop("Equipment Type", "High Pressure Pump"),
      prop("Process Unit", "RO 一段"),
      prop("Discipline", "设备"),
      prop("Tag Number", "P-101"),
      prop("Operating Weight", "1.2 t"),
    ],
  },
  {
    objectid: 203,
    name: "Chemical Dosing Skid CD-01",
    bbox: { min: [10.002, 0, 0], max: [12.002, 2, 2] },
    properties: [
      prop("GlobalId", "ifc-skid-001"),
      prop("Equipment Type", "Chemical Dosing Skid"),
      prop("Process Unit", "加药间"),
      prop("Discipline", "工艺"),
      prop("Tag Number", "CD-01"),
    ],
  },
  {
    objectid: 204,
    name: "Energy Recovery Device ERD-01",
    bbox: { min: [16, 0, 0], max: [17, 1, 1] },
    properties: [
      prop("UniqueId", "erd-added"),
      prop("Equipment Type", "Energy Recovery Device"),
      prop("Process Unit", "能量回收"),
      prop("Discipline", "设备"),
    ],
  },
  {
    objectid: 205,
    name: "Unnamed spool without stable id",
    bbox: { min: [20, 0, 0], max: [21, 1, 1] },
    properties: [
      prop("Part Type", "Pipe Spool"),
      prop("Process Unit", "取水泵房"),
      prop("Discipline", "管道"),
    ],
  },
]);

const elementsA = elementsFromDerivativeProperties(revA);
const elementsB = elementsFromDerivativeProperties(revB);
assert.equal(elementsA[0].stableKey, "uniqueid:pipe-001");
assert.equal(elementsA[1].stableKey, "handle:pump-handle-101");
assert.equal(elementsA[2].stableKey, "globalid:ifc-skid-001");
assert.equal(elementsA[4].matchMethod, "fallback", "missing stable IDs should fall back to name plus bbox center");

const diff = compareModelSnapshots(elementsA, elementsB, {
  toleranceMm: 10,
  coordinateUnit: "m",
  versionA: { label: "Rev.A" },
  versionB: { label: "Rev.C" },
});

assert.equal(diff.stats.added, 1);
assert.equal(diff.stats.deleted, 1);
assert.equal(diff.stats.modified, 1);
assert.equal(diff.stats.moved, 1);
assert.equal(diff.stats.unchanged, 2, "fallback match and sub-tolerance movement should be unchanged");
assert.equal(diff.stats.unmatched, 1);

const pipe = diff.records.find((record) => record.uniqueId === "pipe-001");
assert.equal(pipe.diffType, "modified");
assert.equal(pipe.dbIdBefore, 101);
assert.equal(pipe.dbIdAfter, 201);
assert.deepEqual(
  pipe.changedProps.map((item) => [item.propName, item.valueA, item.valueB]),
  [["Nominal Diameter", "DN100", "DN150"]],
);

const pump = diff.records.find((record) => record.uniqueId === "pump-handle-101");
assert.equal(pump.diffType, "moved");
assert.equal(Math.round(pump.bboxDelta.distanceMm), 150);
assert.deepEqual(pump.diffTypes, ["moved"]);

const fallback = diff.records.find((record) => record.name === "Unnamed spool without stable id");
assert.equal(fallback.matchMethod, "fallback");
assert.equal(fallback.diffType, "unchanged");

const missing = diff.records.find((record) => record.diffType === "unmatched");
assert.equal(missing.unmatchedReason, "stable_id_missing_and_fallback_unavailable");

const report = generateModelDiffNarrative(diff, {
  fileName: "海水淡化厂总装模型.ifc",
  versionA: { label: "Rev.A" },
  versionB: { label: "Rev.C" },
});
assert.match(report.summary, /Rev\.A → Rev\.C/);
assert.match(report.summary, /4 个构件差异/);
assert.ok(report.detailByDiscipline.some((item) => item.discipline === "管道" && item.text.includes("管径")));
assert.ok(report.detailByDiscipline.some((item) => item.discipline === "设备" && item.text.includes("新增")));

console.log("model diff service tests passed");
