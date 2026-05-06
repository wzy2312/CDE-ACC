const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const reviewSource = fs.readFileSync(path.join(root, "export_review_pdf.py"), "utf8");
const workflowSource = fs.readFileSync(path.join(root, "export_workflow_report.py"), "utf8");
const fontUtilsSource = fs.readFileSync(path.join(root, "pdf_font_utils.py"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  reviewSource.includes("from pdf_font_utils import register_pdf_font"),
  "export_review_pdf.py must import register_pdf_font",
);
assert(
  workflowSource.includes("from pdf_font_utils import register_pdf_font"),
  "export_workflow_report.py must import register_pdf_font",
);
assert(
  !reviewSource.includes('FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"'),
  "export_review_pdf.py should not hardcode the macOS Arial Unicode font path",
);
assert(
  !workflowSource.includes('FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"'),
  "export_workflow_report.py should not hardcode the macOS Arial Unicode font path",
);
assert(
  fontUtilsSource.includes('"/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"') ||
    fontUtilsSource.includes('"/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"'),
  "pdf_font_utils.py must include Linux font fallback candidates",
);

console.log("pdf export font fallback smoke passed");
