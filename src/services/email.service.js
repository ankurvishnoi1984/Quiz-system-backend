const nodemailer = require("nodemailer");
const { MailConfig } = require("../models");

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

async function sendMail({ to, subject, text, html }) {
  const config = await getActiveMailConfig();
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

async function sendPasswordResetEmail({ to, fullName, temporaryPassword }) {
  const greeting = fullName ? `Hello ${fullName},` : "Hello,";
  const subject = "Your password has been reset";
  const text = `${greeting}

Your password has been reset. Use the temporary password below to sign in:

${temporaryPassword}

You will be asked to choose a new password immediately after your first login.

If you did not request this reset, please contact your administrator.

— Quiz Platform`;

  const html = `<p>${greeting}</p>
<p>Your password has been reset. Use the temporary password below to sign in:</p>
<p style="font-family:monospace;font-size:16px;font-weight:bold;letter-spacing:0.05em;">${temporaryPassword}</p>
<p>You will be asked to choose a new password immediately after your first login.</p>
<p>If you did not request this reset, please contact your administrator.</p>
<p>— Quiz Platform</p>`;

  await sendMail({ to, subject, text, html });
}

module.exports = {
  getActiveMailConfig,
  sendMail,
  sendPasswordResetEmail
};
