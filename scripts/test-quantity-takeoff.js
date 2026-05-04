const assert = require("node:assert/strict");
const {
  normalizeTakeoffTemplate,
  snapshotsFromDerivativeProperties,
  aggregateQuantitySummaries,
  compareQuantitySummaries,
  buildQuantityPropertyDictionary,
} = require("../lib/quantity-takeoff");

const template = normalizeTakeoffTemplate({
  name: "海水淡化工程量",
  fields: ["Category", "System", "Discipline", "Material", "Area", "Length", "Volume"],
  filters: {
    floors: ["RO Unit 1"],
    disciplines: ["Process"],
  },
  groupBy: ["elementType", "floor", "discipline", "material"],
});

const derivativePayload = {
  data: {
    collection: [
      {
        objectid: 101,
        name: "RO Vessel 8 inch A",
        properties: [
          { displayName: "Category", displayValue: "RO Membrane Vessel" },
          { displayName: "System", displayValue: "RO Unit 1" },
          { displayName: "Discipline", displayValue: "Process" },
          { displayName: "Material", displayValue: "FRP" },
          { displayName: "Area", displayValue: "12.5 m²" },
          { displayName: "Length", displayValue: "6 m" },
          { displayName: "Volume", displayValue: "3.75 m³" },
          { displayName: "Unneeded Parameter", displayValue: "noise" },
        ],
      },
      {
        objectid: 102,
        name: "RO Vessel 8 inch B",
        properties: [
          { displayName: "Category", displayValue: "RO Membrane Vessel" },
          { displayName: "System", displayValue: "RO Unit 1" },
          { displayName: "Discipline", displayValue: "Process" },
          { displayName: "Material", displayValue: "FRP" },
          { displayName: "Area", displayValue: 17.5 },
          { displayName: "Length", displayValue: 8 },
          { displayName: "Volume", displayValue: 5.25 },
        ],
      },
      {
        objectid: 201,
        name: "Chemical Dosing Skid",
        properties: [
          { displayName: "Category", displayValue: "Chemical Dosing Skid" },
          { displayName: "System", displayValue: "Chemical Dosing Room" },
          { displayName: "Discipline", displayValue: "Process" },
          { displayName: "Length", displayValue: 10 },
        ],
      },
    ],
  },
};

const snapshots = snapshotsFromDerivativeProperties(derivativePayload, template, { taskId: "task-1" });
assert.equal(snapshots.length, 2, "filters should keep only RO Unit 1 process objects");
assert.equal(snapshots[0].dbId, 101);
assert.equal(snapshots[0].elementType, "RO Membrane Vessel");
assert.equal(snapshots[0].floor, "RO Unit 1");
assert.equal(snapshots[0].discipline, "Process");
assert.equal(snapshots[0].material, "FRP");
assert.equal(snapshots[0].area, 12.5);
assert.equal(snapshots[0].length, 6);
assert.equal(snapshots[0].volume, 3.75);
assert.equal(snapshots[0].properties["Unneeded Parameter"], undefined, "template fields should trim noisy properties");

const summaries = aggregateQuantitySummaries(snapshots, template, { taskId: "task-1" });
assert.equal(summaries.length, 1);
assert.equal(summaries[0].elementType, "RO Membrane Vessel");
assert.equal(summaries[0].floor, "RO Unit 1");
assert.equal(summaries[0].discipline, "Process");
assert.equal(summaries[0].material, "FRP");
assert.equal(summaries[0].count, 2);
assert.equal(summaries[0].area, 30);
assert.equal(summaries[0].length, 14);
assert.equal(summaries[0].volume, 9);

const diff = compareQuantitySummaries(
  [
    {
      elementType: "RO Membrane Vessel",
      floor: "RO Unit 1",
      discipline: "Process",
      material: "FRP",
      count: 1,
      area: 25,
      length: 10,
      volume: 7,
    },
  ],
  summaries,
);
assert.equal(diff.length, 1);
assert.equal(diff[0].status, "changed");
assert.equal(diff[0].countDelta, 1);
assert.equal(diff[0].areaDelta, 5);
assert.equal(diff[0].lengthDelta, 4);
assert.equal(diff[0].volumeDelta, 2);

const desalinationTemplate = normalizeTakeoffTemplate({
  name: "海淡工艺计量规则",
  fields: "*",
  fieldMappings: {
    elementType: ["Equipment Type", "Part Type"],
    floor: ["Process Unit"],
    discipline: ["Discipline"],
    material: ["Pipe Spec", "Material"],
    length: ["Line Length"],
    diameter: ["Nominal Diameter"],
    weight: ["Weight"],
  },
  groupBy: ["elementType", "floor", "discipline", "material"],
  metrics: {
    pipeLength: {
      label: "管线米数",
      kind: "sum",
      source: "length",
      unit: "m",
      appliesTo: { elementTypes: ["Pipe"] },
    },
    valveCount: {
      label: "阀门台数",
      kind: "count",
      unit: "台",
      appliesTo: { elementTypes: ["Valve"] },
    },
    equipmentWeight: {
      label: "设备重量",
      kind: "sum",
      source: "weight",
      unit: "kg",
    },
  },
});

const desalinationPayload = {
  data: {
    collection: [
      {
        objectid: 301,
        name: "SWRO Pipe DN300",
        properties: [
          { displayName: "Part Type", displayValue: "Pipe" },
          { displayName: "Process Unit", displayValue: "RO 一段" },
          { displayName: "Discipline", displayValue: "管道" },
          { displayName: "Pipe Spec", displayValue: "2205 / DN300" },
          { displayName: "Line Length", displayValue: "6000 mm" },
          { displayName: "Nominal Diameter", displayValue: "300 mm" },
          { displayName: "Weight", displayValue: "1.5 t" },
        ],
      },
      {
        objectid: 302,
        name: "Butterfly Valve DN300",
        properties: [
          { displayName: "Part Type", displayValue: "Valve" },
          { displayName: "Process Unit", displayValue: "RO 一段" },
          { displayName: "Discipline", displayValue: "管道" },
          { displayName: "Pipe Spec", displayValue: "2205 / DN300" },
          { displayName: "Nominal Diameter", displayValue: "300 mm" },
          { displayName: "Weight", displayValue: "80 kg" },
        ],
      },
    ],
  },
};

const desalinationSnapshots = snapshotsFromDerivativeProperties(desalinationPayload, desalinationTemplate, { taskId: "task-desal" });
assert.equal(desalinationSnapshots.length, 2);
assert.equal(desalinationSnapshots[0].length, 6, "line length should normalize millimeters to meters");
assert.equal(desalinationSnapshots[0].diameter, 300);
assert.equal(desalinationSnapshots[0].weight, 1500, "weight should normalize tonnes to kilograms");

const desalinationSummaries = aggregateQuantitySummaries(desalinationSnapshots, desalinationTemplate, { taskId: "task-desal" });
const pipeSummary = desalinationSummaries.find((item) => item.elementType === "Pipe");
const valveSummary = desalinationSummaries.find((item) => item.elementType === "Valve");
assert.equal(pipeSummary.metrics.pipeLength.value, 6);
assert.equal(pipeSummary.metrics.pipeLength.unit, "m");
assert.equal(pipeSummary.metrics.equipmentWeight.value, 1500);
assert.equal(valveSummary.metrics.valveCount.value, 1);
assert.equal(valveSummary.metrics.equipmentWeight.value, 80);

const dictionary = buildQuantityPropertyDictionary(desalinationPayload, desalinationTemplate);
assert.ok(dictionary.fields.some((field) => field.name === "Process Unit" && field.count === 2));
assert.equal(dictionary.coverage.elementType.matched, 2);
assert.equal(dictionary.coverage.length.matched, 1);
assert.equal(dictionary.coverage.weight.matched, 2);

console.log("quantity takeoff test passed");
