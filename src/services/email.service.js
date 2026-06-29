const nodemailer = require("nodemailer");
const { MailConfig } = require("../models");
const { renderPasswordResetEmail } = require("./email-templates");

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

async function sendMailWithConfig(config, { to, subject, text, html }) {
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

  await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text,
    html
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
  const { subject, text, html } = renderPasswordResetEmail({
    fullName,
    temporaryPassword,
    brandName
  });

  await sendMailWithConfig(config, { to, subject, text, html });
}

module.exports = {
  getActiveMailConfig,
  sendMail,
  sendPasswordResetEmail
};
