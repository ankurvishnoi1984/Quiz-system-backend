const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { MailConfig } = require("../models");
const {
  renderPasswordResetEmail,
  renderNewUserWelcomeEmail,
  renderParticipantLimitExceededEmail,
  EMAIL_LOGO_CID
} = require("./email-templates");

const EMAIL_LOGO_PATH = path.join(__dirname, "../../assets/email-logo.png");

function getEmailLogoAttachment() {
  if (!fs.existsSync(EMAIL_LOGO_PATH)) {
    return null;
  }

  return {
    filename: "email-logo.png",
    path: EMAIL_LOGO_PATH,
    cid: EMAIL_LOGO_CID
  };
}

async function getActiveMailConfig() {
  return MailConfig.findOne({
    where: { is_active: true },
    order: [
      ["priority", "ASC"],
      ["id", "ASC"]
    ]
  });
}

function createTransport(config) {
  const port = Number(config.smtp_port);
  // Port 465 uses implicit TLS; 587 uses STARTTLS (secure must be false).
  const secure = Boolean(config.secure) && port === 465;

  return nodemailer.createTransport({
    host: config.smtp_host,
    port,
    secure,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass
    }
  });
}

async function sendMailWithConfig(config, { to, cc, subject, text, html, attachments = [] }) {
  if (!config) {
    const error = new Error("No active mail configuration found");
    error.statusCode = 503;
    throw error;
  }

  if (config.sent_count >= config.daily_limit) {
    const error = new Error("Daily email limit reached for mail configuration");
    error.statusCode = 503;
    throw error;
  }

  const transport = createTransport(config);
  const fromName = config.sender_name || "Quiz Platform";
  const fromAddress = config.smtp_from || config.smtp_user;
  const ccList = Array.isArray(cc) ? cc.filter(Boolean) : cc ? [cc] : [];

  await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    cc: ccList.length ? ccList.join(", ") : undefined,
    subject,
    text,
    html,
    attachments
  });

  config.sent_count = Number(config.sent_count || 0) + 1;
  config.last_used_at = new Date();
  await config.save();
}

async function sendMail(payload) {
  const config = await getActiveMailConfig();
  await sendMailWithConfig(config, payload);
}

async function sendPasswordResetEmail({ to, fullName, temporaryPassword }) {
  const config = await getActiveMailConfig();
  const brandName = config?.sender_name || "Quiz Platform";
  const logoAttachment = getEmailLogoAttachment();
  const { subject, text, html } = renderPasswordResetEmail({
    fullName,
    temporaryPassword,
    brandName,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : null
  });

  await sendMailWithConfig(config, {
    to,
    subject,
    text,
    html,
    attachments: logoAttachment ? [logoAttachment] : []
  });
}

async function sendNewUserWelcomeEmail({
  to,
  cc,
  fullName,
  email,
  password,
  roleLabel,
  clientName,
  deptName,
  createdByName
}) {
  const config = await getActiveMailConfig();
  const brandName = config?.sender_name || "Quiz Platform";
  const logoAttachment = getEmailLogoAttachment();
  const { subject, text, html } = renderNewUserWelcomeEmail({
    fullName,
    email,
    password,
    roleLabel,
    clientName,
    deptName,
    createdByName,
    brandName,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : null
  });

  await sendMailWithConfig(config, {
    to,
    cc,
    subject,
    text,
    html,
    attachments: logoAttachment ? [logoAttachment] : []
  });
}

async function sendParticipantLimitExceededEmail({ to, fullName, planName, used, limit }) {
  const config = await getActiveMailConfig();
  const brandName = config?.sender_name || "Quiz Platform";
  const logoAttachment = getEmailLogoAttachment();
  const { subject, text, html } = renderParticipantLimitExceededEmail({
    fullName,
    planName,
    used,
    limit,
    brandName,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : null
  });

  await sendMailWithConfig(config, {
    to,
    subject,
    text,
    html,
    attachments: logoAttachment ? [logoAttachment] : []
  });
}

module.exports = {
  getActiveMailConfig,
  sendMail,
  sendPasswordResetEmail,
  sendNewUserWelcomeEmail,
  sendParticipantLimitExceededEmail
};
