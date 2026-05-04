"use strict";

const nodemailer = require("nodemailer");

function normalizeMailbox(input) {
  if (!input) {
    return null;
  }
  if (typeof input === "string") {
    const email = input.trim();
    return email ? { email, name: "" } : null;
  }
  const value = input && typeof input === "object" ? input : {};
  const email = String(value.email || "").trim();
  if (!email) {
    return null;
  }
  return {
    email,
    name: String(value.name || "").trim(),
  };
}

function formatMailbox(input) {
  const mailbox = normalizeMailbox(input);
  if (!mailbox) {
    return "";
  }
  if (!mailbox.name) {
    return mailbox.email;
  }
  const escapedName = mailbox.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escapedName}" <${mailbox.email}>`;
}

function formatMailboxList(list = []) {
  return list
    .map((item) => formatMailbox(item))
    .filter(Boolean)
    .join(", ");
}

function buildTransportOptions(settings = {}) {
  const encryption = String(settings.encryption || "starttls").trim().toLowerCase();
  const authRequired = Boolean(settings.authRequired);
  const options = {
    host: String(settings.host || "").trim(),
    port: Number(settings.port || (encryption === "ssl_tls" ? 465 : 587)),
    secure: encryption === "ssl_tls",
  };

  if (encryption === "starttls") {
    options.requireTLS = true;
  }

  if (authRequired) {
    options.auth = {
      user: String(settings.username || "").trim(),
      pass: String(settings.password || ""),
    };
  }

  return options;
}

async function sendSmtpMail(settings = {}, message = {}, options = {}) {
  const transportFactory = typeof options.transportFactory === "function"
    ? options.transportFactory
    : nodemailer.createTransport;
  const transport = transportFactory(buildTransportOptions(settings));
  const from = formatMailbox({
    name: String(settings.senderName || "").trim(),
    email: String(settings.senderEmail || "").trim(),
  });

  return transport.sendMail({
    from,
    replyTo: message.replyTo || (settings.replyTo ? formatMailbox({ email: settings.replyTo }) : undefined),
    to: message.to,
    cc: message.cc,
    bcc: message.bcc,
    subject: String(message.subject || "").trim(),
    text: String(message.text || ""),
    html: String(message.html || ""),
  });
}

module.exports = {
  buildTransportOptions,
  formatMailbox,
  formatMailboxList,
  normalizeMailbox,
  sendSmtpMail,
};
