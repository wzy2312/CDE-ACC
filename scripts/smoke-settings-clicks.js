const fs = require("fs");
const path = require("path");

const root = process.argv[2] || __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

const failures = [];
function expect(name, condition) {
  if (!condition) {
    failures.push(name);
  }
}

expect("index has ACC File Access nav item", /data-access-menu="acc_integration"/.test(index));
expect("index has ACC Custom Integration nav item", /data-access-menu="acc_custom_integration"/.test(index));
expect("index has ACC integration view", /id="accessAccIntegrationView"/.test(index));
expect("index has ACC custom integration view", /id="accessAccCustomIntegrationView"/.test(index));
expect("index has file ACC button", /id="importAccButton"/.test(index));

expect("app stores importAccButton element", /importAccButton:\s*document\.querySelector\("#importAccButton"\)/.test(app));
expect("app wires importAccButton click", /importAccButton\?\.[\s\S]{0,120}addEventListener\("click"[\s\S]{0,260}acc_integration/.test(app));
expect("app accepts acc_integration menu", /"acc_integration"/.test(app));
expect("app accepts acc_custom_integration menu", /"acc_custom_integration"/.test(app));
expect("project settings allows acc_integration", /function projectAccessMenus\(\)\s*{[\s\S]*acc_integration[\s\S]*}/.test(app));
expect("project settings allows acc_custom_integration", /function projectAccessMenus\(\)\s*{[\s\S]*acc_custom_integration[\s\S]*}/.test(app));
expect("project settings allows ai_configuration", /function projectAccessMenus\(\)\s*{[\s\S]*ai_configuration[\s\S]*}/.test(app));
expect("acc_integration maps to its view", /acc_integration:\s*"accessAccIntegrationView"/.test(app));
expect("acc_custom_integration maps to its view", /acc_custom_integration:\s*"accessAccCustomIntegrationView"/.test(app));
expect("access menu title labels ACC File Access", /acc_integration:\s*text\("ACC 文件接入",\s*"ACC File (?:Intake|Access)"\)/.test(app));

if (failures.length) {
  console.error("FAIL settings click contract:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("PASS settings click contract");
