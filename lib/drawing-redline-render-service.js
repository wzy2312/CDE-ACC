const { spawn } = require("node:child_process");

function normalizeNumber(value, fallback, { min = -Infinity, max = Infinity } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, numeric));
}

function normalizeBBox(value = {}) {
  return {
    x: normalizeNumber(value.x, 0, { min: 0, max: 1 }),
    y: normalizeNumber(value.y, 0, { min: 0, max: 1 }),
    width: normalizeNumber(value.width, 0.16, { min: 0.01, max: 1 }),
    height: normalizeNumber(value.height, 0.08, { min: 0.01, max: 1 }),
  };
}

function normalizeDiffType(value) {
  const type = String(value || "").trim().toLowerCase();
  return ["added", "deleted", "modified", "moved"].includes(type) ? type : "modified";
}

function normalizeDetectorRecord(record = {}) {
  return {
    page: Math.max(1, Math.floor(normalizeNumber(record.page, 1))),
    diffType: normalizeDiffType(record.diffType || record.diff_type),
    bbox: normalizeBBox(record.bbox || record.position),
    textA: String(record.textA ?? record.text_a ?? ""),
    textB: String(record.textB ?? record.text_b ?? ""),
    contentSummary: String(record.contentSummary || record.summary || ""),
    area: Math.max(0, normalizeNumber(record.area, 0)),
    heat: normalizeNumber(record.heat, 0.35, { min: 0, max: 1 }),
    aiConfidence: ["high", "medium", "low"].includes(String(record.aiConfidence || record.confidence || "").toLowerCase())
      ? String(record.aiConfidence || record.confidence).toLowerCase()
      : "medium",
    aiInterpretation: String(record.aiInterpretation || record.ai_interpretation || ""),
    source: String(record.source || "pdf-pixel-render"),
  };
}

function runPdfRedlineDetection({
  pythonBin,
  scriptPath,
  sourceAPath,
  sourceBPath,
  options = {},
  timeoutMs = 120000,
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      const error = new Error("PDF redline detection timed out.");
      error.statusCode = 504;
      reject(error);
    }, timeoutMs);

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const error = new Error(stderr.trim() || stdout.trim() || "PDF redline detection failed.");
        error.statusCode = 500;
        reject(error);
        return;
      }
      try {
        const payload = JSON.parse(stdout || "{}");
        const records = Array.isArray(payload.records)
          ? payload.records.map(normalizeDetectorRecord)
          : [];
        resolve({
          ...payload,
          records,
        });
      } catch (error) {
        error.message = `Invalid PDF redline detector output: ${error.message}`;
        error.statusCode = 500;
        reject(error);
      }
    });

    child.stdin.end(JSON.stringify({
      sourceAPath,
      sourceBPath,
      options,
    }));
  });
}

module.exports = {
  runPdfRedlineDetection,
  normalizeDetectorRecord,
};
