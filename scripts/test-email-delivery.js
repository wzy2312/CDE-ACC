"use strict";

const assert = require("node:assert/strict");
const {
  buildTransportOptions,
  formatMailbox,
  formatMailboxList,
  normalizeMailbox,
  sendSmtpMail,
} = require("../lib/email-delivery");

async function main() {
  assert.deepEqual(normalizeMailbox("demo@example.test"), {
    email: "demo@example.test",
    name: "",
  });
  assert.equal(formatMailbox({ name: "CDE 系统", email: "system@example.test" }), "\"CDE 系统\" <system@example.test>");
  assert.equal(
    formatMailboxList([
      { name: "甲", email: "a@example.test" },
      { name: "乙", email: "b@example.test" },
    ]),
    "\"甲\" <a@example.test>, \"乙\" <b@example.test>",
  );

  assert.deepEqual(
    buildTransportOptions({
      host: "smtp.example.test",
      port: 587,
      encryption: "starttls",
      authRequired: true,
      username: "mailer@example.test",
      password: "secret",
    }),
    {
      host: "smtp.example.test",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: "mailer@example.test",
        pass: "secret",
      },
    },
  );

  assert.deepEqual(
    buildTransportOptions({
      host: "smtp.example.test",
      port: 465,
      encryption: "ssl_tls",
      authRequired: false,
    }),
    {
      host: "smtp.example.test",
      port: 465,
      secure: true,
    },
  );

  let capturedOptions = null;
  let capturedMessage = null;
  const info = await sendSmtpMail(
    {
      host: "smtp.example.test",
      port: 587,
      encryption: "starttls",
      authRequired: true,
      username: "mailer@example.test",
      password: "secret",
      senderName: "CDE 文件管理系统",
      senderEmail: "system@example.test",
      replyTo: "reply@example.test",
    },
    {
      to: "target@example.test",
      subject: "邮件测试",
      text: "plain body",
      html: "<p>html body</p>",
    },
    {
      transportFactory(options) {
        capturedOptions = options;
        return {
          async sendMail(message) {
            capturedMessage = message;
            return { messageId: "mock-id" };
          },
        };
      },
    },
  );

  assert.equal(info.messageId, "mock-id");
  assert.deepEqual(capturedOptions, {
    host: "smtp.example.test",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: "mailer@example.test",
      pass: "secret",
    },
  });
  assert.deepEqual(capturedMessage, {
    from: "\"CDE 文件管理系统\" <system@example.test>",
    replyTo: "reply@example.test",
    to: "target@example.test",
    cc: undefined,
    bcc: undefined,
    subject: "邮件测试",
    text: "plain body",
    html: "<p>html body</p>",
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
