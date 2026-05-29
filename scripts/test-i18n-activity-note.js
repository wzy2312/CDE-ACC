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
assert(
  source.includes("function localizeUserMessage("),
  "app.js must define localizeUserMessage() to sanitize API and runtime messages for English users",
);
assert(
  !source.includes("throw new Error(payload.error ||"),
  "fetchJson() must localize payload.error before throwing",
);
assert(
  !source.includes("reject(new Error(payload.error ||"),
  "XHR helpers must localize payload.error before rejecting",
);
assert(
  source.includes("message: localizeUserMessage(message ||"),
  "notify() must sanitize toast messages through localizeUserMessage()",
);
assert(
  source.includes("notify(localizeUserMessage(error?.message"),
  "notifyError() must sanitize thrown error messages",
);
assert(
  source.includes("notify(localizeUserMessage(message ||"),
  "showAlert() must sanitize alert messages",
);

console.log("i18n activity note smoke passed");
