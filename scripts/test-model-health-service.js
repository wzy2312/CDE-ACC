const assert = require("node:assert/strict");

const {
  buildDefaultModelHealthRuleset,
  buildModelHealthReport,
  modelElementsFromDerivativeProperties,
  runModelHealthAiChecks,
  runModelHealthRuleChecks,
} = require("../lib/model-health-service");

function resultByCategory(results, category) {
  return results.filter((item) => item.category === category);
}

async function main() {
  const propertiesPayload = {
    data: {
      collection: [
        {
          objectid: 101,
          name: "B-L01-001",
          properties: [
            { displayName: "Category", displayValue: "结构梁" },
            { displayName: "Level", displayValue: "L01" },
            { displayName: "Family", displayValue: "Concrete Beam" },
            { displayName: "Type Name", displayValue: "B450" },
            { displayName: "Material", displayValue: "C30" },
            { displayName: "Height", displayValue: "450mm" },
            { displayName: "Length", displayValue: "6000mm" },
            { displayName: "Volume", displayValue: "1.5" },
            { displayName: "Workset", displayValue: "结构" },
          ],
        },
        {
          objectid: 102,
          name: "B-L01-002",
          properties: [
            { displayName: "Category", displayValue: "结构梁" },
            { displayName: "Level", displayValue: "L01" },
            { displayName: "Material", displayValue: "" },
            { displayName: "Height", displayValue: "200mm" },
            { displayName: "Length", displayValue: "0mm" },
            { displayName: "Volume", displayValue: "0" },
            { displayName: "Workset", displayValue: "临时工作集" },
            { displayName: "Comments", displayValue: "TEST 临时，勿删" },
          ],
        },
        {
          objectid: 201,
          name: "Pump Temporary",
          properties: [
            { displayName: "Category", displayValue: "设备" },
            { displayName: "Equipment Type", displayValue: "泵" },
            { displayName: "Tag Number", displayValue: "P-100-001" },
            { displayName: "Level", displayValue: "L01" },
            { displayName: "System Name", displayValue: "给排水" },
            { displayName: "Power", displayValue: "15kW" },
            { displayName: "Workset", displayValue: "设备" },
          ],
        },
        {
          objectid: 202,
          name: "Pump Copy",
          properties: [
            { displayName: "Category", displayValue: "设备" },
            { displayName: "Equipment Type", displayValue: "泵" },
            { displayName: "Tag Number", displayValue: "P-100-001" },
            { displayName: "Level", displayValue: "L01" },
            { displayName: "System Name", displayValue: "结构" },
            { displayName: "Power", displayValue: "150kW" },
            { displayName: "Workset", displayValue: "设备" },
          ],
        },
        {
          objectid: 301,
          name: "PIPE-OVERSIZE",
          properties: [
            { displayName: "Category", displayValue: "管道" },
            { displayName: "Diameter", displayValue: "10000mm" },
            { displayName: "Wall Thickness", displayValue: "TBD" },
            { displayName: "Material", displayValue: "316L" },
            { displayName: "System Name", displayValue: "海水进水" },
            { displayName: "Pressure Rating", displayValue: "PN16" },
            { displayName: "Level", displayValue: "L99" },
            { displayName: "Length", displayValue: "5000mm" },
          ],
        },
      ],
    },
  };
  const geometryIndex = [
    { dbId: 101, boundingBox: { min: [0, 0, 0.2], max: [6, 0.3, 0.65] } },
    { dbId: 102, boundingBox: { min: [0, 1, 0.2], max: [0, 1, 0.2] } },
    { dbId: 201, boundingBox: { min: [10, 0, 0.2], max: [11, 1, 1.8] } },
    { dbId: 202, boundingBox: { min: [10, 0, 0.2], max: [11, 1, 1.8] } },
    { dbId: 301, boundingBox: { min: [0, 0, 50], max: [5, 0.5, 50.5] } },
  ];
  const ruleset = buildDefaultModelHealthRuleset({
    projectId: "project-1",
    discipline: "structure",
    rules: {
      requiredFields: {
        "结构梁": ["Material", "Level", "Height"],
        "设备": ["Tag Number", "Equipment Type", "Level"],
        "管道": ["Diameter", "Wall Thickness", "Material", "System Name", "Pressure Rating", "Level"],
      },
      namingRules: {
        name: "^(B|P|PIPE)-[A-Z0-9-]+$",
        tag: "^P-\\d{3}-\\d{3}$",
      },
      allowedSystems: ["给排水", "海水进水"],
      allowedWorksets: ["结构", "设备"],
      levels: [
        { name: "L01", min: 0, max: 4 },
        { name: "L02", min: 4, max: 8 },
      ],
      geometryLimits: {
        "结构梁": {
          Height: { min: 300, max: 1200 },
          Length: { min: 1, max: 20000 },
          Volume: { min: 0.001, max: 1000 },
        },
        "管道": {
          Diameter: { min: 10, max: 3000 },
          Length: { min: 1, max: 50000 },
        },
      },
    },
    gateConfig: {
      mode: "standard",
      aiEnabled: true,
    },
  });
  const elements = modelElementsFromDerivativeProperties(propertiesPayload, { geometryIndex });
  assert.equal(elements.length, 5);
  assert.equal(elements.find((item) => item.dbId === 101).boundingBox.max[2], 0.65);

  const ruleResults = runModelHealthRuleChecks(elements, ruleset);
  assert.ok(resultByCategory(ruleResults, "required").some((item) => item.dbIds.includes(102)), "missing required field should be reported");
  assert.ok(resultByCategory(ruleResults, "naming").some((item) => item.dbIds.includes(201)), "bad element name should be reported");
  assert.ok(resultByCategory(ruleResults, "floor").some((item) => item.dbIds.includes(301)), "invalid floor assignment should be reported");
  assert.ok(resultByCategory(ruleResults, "geometry").some((item) => item.dbIds.includes(301)), "oversized geometry should be reported");
  assert.ok(resultByCategory(ruleResults, "duplicate").some((item) => item.dbIds.includes(201) && item.dbIds.includes(202)), "duplicate tag should be reported");
  assert.ok(resultByCategory(ruleResults, "workset").some((item) => item.dbIds.includes(102)), "invalid workset should be reported");

  const aliasElements = modelElementsFromDerivativeProperties({
    data: {
      collection: [
        {
          objectid: 401,
          name: "SWRO-PIPE-001",
          properties: [
            { displayName: "Part Type", displayValue: "pipe" },
            { displayName: "Line Number Tag", displayValue: "SWRO-100-001" },
            { displayName: "DN", displayValue: "300mm" },
            { displayName: "Wall Thk", displayValue: "8mm" },
            { displayName: "Material", displayValue: "Duplex 2205" },
            { displayName: "System", displayValue: "SWRO" },
            { displayName: "PN", displayValue: "PN16" },
            { displayName: "Plant Area", displayValue: "RO-Building" },
          ],
        },
      ],
    },
  });
  const aliasRuleset = buildDefaultModelHealthRuleset({
    rules: {
      requiredFields: {
        pipe: ["Line Number", "Diameter", "Wall Thickness", "Material", "System Name", "Pressure Rating", "Level"],
      },
    },
  });
  const aliasRuleResults = runModelHealthRuleChecks(aliasElements, aliasRuleset);
  assert.equal(resultByCategory(aliasRuleResults, "required").length, 0, "desalination field aliases should satisfy required checks");

  const aiResults = await runModelHealthAiChecks(elements, ruleResults, ruleset, { maxCalls: 5 });
  assert.ok(aiResults.some((item) => item.category === "semantic" && item.dbIds.includes(102)), "semantic placeholder should be advisory AI finding");
  assert.ok(aiResults.some((item) => item.category === "outlier" && item.dbIds.includes(102)), "outlier should be advisory AI finding");
  assert.ok(aiResults.length >= 2, "AI checks should return batched advisory findings");

  const previousReport = {
    task: { score: 72 },
    summary: { errorCount: 8, warningCount: 15, aiCount: 5, total: 28 },
    signatures: ["old-problem"],
  };
  const report = buildModelHealthReport({
    task: { fileName: "structure.rvt", version: "V4", completedAt: "2026-04-25T00:00:00.000Z" },
    ruleset,
    ruleResults,
    aiResults,
    previousReport,
  });
  assert.ok(report.score < 100 && report.score >= 0);
  assert.equal(report.summary.aiCount, aiResults.length);
  assert.ok(report.sections.some((section) => section.key === "category"));
  assert.equal(report.comparison.previous.score, 72);
  assert.ok(report.comparison.current.errorCount >= 1);
  assert.ok(report.signatures.length >= ruleResults.length);

  console.log("model health service tests passed");
}

main();
