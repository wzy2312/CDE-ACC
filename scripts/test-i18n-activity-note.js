const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(process.cwd(), "app.js"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  source.includes("function localizeMixedText(value)"),
  "app.js must define localizeMixedText() for dynamic Chinese/English rendering",
);
assert(
  !source.includes("localizedDisplayName(item.note)"),
  "activity item notes must use localizeMixedText(item.note), not localizedDisplayName(item.note)",
);

console.log("i18n activity note smoke passed");
