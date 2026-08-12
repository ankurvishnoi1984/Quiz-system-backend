const { getFrontendPublicUrl } = require("../config/publicAppUrl");

const EMAIL_LOGO_CID = "quiz-app-logo";

const BRAND = {
  navy: "#0f172a",
  navyMid: "#1e3a8a",
  blue: "#2563eb",
  amber: "#d97706",
  amberLight: "#fffbeb",
  amberBorder: "#fcd34d",
  slate: "#475569",
  slateLight: "#94a3b8",
  border: "#e2e8f0",
  surface: "#f8fafc",
  white: "#ffffff"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLoginUrl() {
  const origin = getFrontendPublicUrl();
  return origin ? `${origin}/login` : "/login";
}

function buildEmailLogoUrl() {
  const explicit = process.env.EMAIL_LOGO_URL || process.env.APP_LOGO_URL;
  if (explicit) {
    return String(explicit).trim();
  }

  const origin = getFrontendPublicUrl();
  const path = process.env.APP_LOGO_PATH || "/log5.png";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (origin) {
    return `${origin}${normalizedPath}`;
  }

  const apiOrigin =
    process.env.API_PUBLIC_URL ||
    process.env.PUBLIC_API_URL ||
    process.env.BACKEND_PUBLIC_URL;
  if (apiOrigin) {
    return `${String(apiOrigin).replace(/\/+$/, "")}/branding/email-logo.png`;
  }

  return "";
}

function resolveEmailLogoSrc({ logoCid, logoUrl }) {
  if (logoCid) {
    return `cid:${logoCid}`;
  }

  const url = String(logoUrl || "").trim();
  if (!url) return "";

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    const origin = getFrontendPublicUrl();
    if (origin) {
      return `${origin}${url}`;
    }
  }

  return "";
}

function renderEmailHeaderBrand(brandName, { logoCid, logoUrl } = {}) {
  const safeBrand = escapeHtml(brandName || "Quiz Platform");
  const src = resolveEmailLogoSrc({ logoCid, logoUrl });

  if (src) {
    return `
                <tr>
                  <td style="padding-bottom:18px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background-color:rgba(255,255,255,0.96);border-radius:14px;padding:12px 18px;">
                          <img
                            class="email-brand-logo"
                            src="${escapeHtml(src)}"
                            alt="${safeBrand}"
                            width="180"
                            style="display:block;border:0;outline:none;text-decoration:none;width:180px;max-width:100%;height:auto;max-height:64px;object-fit:contain;"
                          />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:4px;">
                    <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND.white};letter-spacing:-0.01em;">${safeBrand}</p>
                    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.82);">Account notification</p>
                  </td>
                </tr>`;
  }

  return `
                <tr>
                  <td style="vertical-align:middle;padding-bottom:4px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="width:48px;height:48px;background-color:rgba(255,255,255,0.15);border-radius:12px;text-align:center;vertical-align:middle;font-size:22px;font-weight:700;color:${BRAND.white};line-height:48px;">
                          Q
                        </td>
                        <td style="padding-left:14px;vertical-align:middle;">
                          <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND.white};letter-spacing:-0.01em;">${safeBrand}</p>
                          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.82);">Account notification</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;
}

/**
 * Shared responsive email shell (table layout for client compatibility).
 */
function renderEmailLayout({
  preheader,
  brandName,
  title,
  bodyHtml,
  footerNote,
  logoCid,
  logoUrl
}) {
  const safeBrand = escapeHtml(brandName || "Quiz Platform");
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);
  const year = new Date().getFullYear();
  const brandHeaderHtml = renderEmailHeaderBrand(brandName, {
    logoCid,
    logoUrl: logoUrl ?? buildEmailLogoUrl()
  });

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${safeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-body-cell { padding: 28px 20px !important; }
      .email-header-cell { padding: 28px 20px !important; }
      .email-brand-logo { width: 150px !important; max-height: 54px !important; }
      .password-box { font-size: 22px !important; letter-spacing: 0.12em !important; }
      .cta-button { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;height:0;width:0;">
    ${safePreheader}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.surface};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td class="email-header-cell" style="background:linear-gradient(135deg,${BRAND.navy} 0%,${BRAND.navyMid} 55%,${BRAND.blue} 100%);border-radius:16px 16px 0 0;padding:32px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${brandHeaderHtml}
                <tr>
                  <td style="padding-top:24px;">
                    <h1 style="margin:0;font-size:26px;line-height:1.3;font-weight:700;color:${BRAND.white};letter-spacing:-0.02em;">${safeTitle}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-body-cell" style="background-color:${BRAND.white};border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};padding:36px 40px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:${BRAND.white};border:1px solid ${BRAND.border};border-top:none;border-radius:0 0 16px 16px;padding:0 40px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-top:1px solid ${BRAND.border};padding-top:24px;">
                    <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${BRAND.slateLight};text-align:center;">
                      ${escapeHtml(footerNote || "This is an automated message. Please do not reply to this email.")}
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.slateLight};text-align:center;">
                      &copy; ${year} ${safeBrand}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderPasswordResetEmail({ fullName, temporaryPassword, brandName, logoCid, logoUrl }) {
  const greeting = fullName ? `Hello ${fullName},` : "Hello,";
  const loginUrl = buildLoginUrl();
  const safePassword = escapeHtml(temporaryPassword);
  const safeGreeting = escapeHtml(greeting);

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:${BRAND.slate};">${safeGreeting}</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:${BRAND.slate};">
      We received a request to reset the password for your account. Use the temporary password below to sign in&mdash;you&rsquo;ll be prompted to choose a new password right away.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background-color:${BRAND.amberLight};border:1px solid ${BRAND.amberBorder};border-radius:12px;padding:24px;text-align:center;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.amber};">
            Temporary password
          </p>
          <p class="password-box" style="margin:0;font-family:'SF Mono',SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:28px;font-weight:700;letter-spacing:0.18em;color:${BRAND.navy};word-break:break-all;">
            ${safePassword}
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:20px 22px;">
          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:${BRAND.navy};">What to do next</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding:0 0 10px;vertical-align:top;width:28px;font-size:14px;font-weight:700;color:${BRAND.blue};">1.</td>
              <td style="padding:0 0 10px;font-size:14px;line-height:1.55;color:${BRAND.slate};">Open the sign-in page using the button below.</td>
            </tr>
            <tr>
              <td style="padding:0 0 10px;vertical-align:top;width:28px;font-size:14px;font-weight:700;color:${BRAND.blue};">2.</td>
              <td style="padding:0 0 10px;font-size:14px;line-height:1.55;color:${BRAND.slate};">Enter your email and the temporary password shown above.</td>
            </tr>
            <tr>
              <td style="padding:0;vertical-align:top;width:28px;font-size:14px;font-weight:700;color:${BRAND.blue};">3.</td>
              <td style="padding:0;font-size:14px;line-height:1.55;color:${BRAND.slate};">Create a new password when prompted before continuing.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 28px;">
      <tr>
        <td align="center" style="border-radius:12px;background:linear-gradient(135deg,${BRAND.navy} 0%,${BRAND.navyMid} 100%);">
          <a class="cta-button" href="${escapeHtml(loginUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:${BRAND.white};text-decoration:none;border-radius:12px;">
            Sign in to your account
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${BRAND.slateLight};text-align:center;">
      Or copy this link into your browser:<br />
      <a href="${escapeHtml(loginUrl)}" style="color:${BRAND.blue};word-break:break-all;">${escapeHtml(loginUrl)}</a>
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
      <tr>
        <td style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#991b1b;">
            <strong>Didn&rsquo;t request this?</strong> Someone may have entered your email by mistake. If you did not ask for a password reset, ignore this email or contact your administrator. Your existing password will stay unchanged until you sign in with the temporary password above.
          </p>
        </td>
      </tr>
    </table>`;

  const html = renderEmailLayout({
    preheader: `Your temporary password is ${temporaryPassword}. Sign in and choose a new password.`,
    brandName,
    title: "Password reset",
    bodyHtml,
    footerNote: "You received this email because a password reset was requested for your account.",
    logoCid,
    logoUrl
  });

  const text = `${greeting}

We received a request to reset the password for your account.

TEMPORARY PASSWORD
${temporaryPassword}

WHAT TO DO NEXT
1. Open the sign-in page: ${loginUrl}
2. Sign in with your email and the temporary password above.
3. Choose a new password when prompted.

If you did not request this reset, ignore this email or contact your administrator.

— ${brandName || "Quiz Platform"}`;

  return {
    subject: "Your password has been reset",
    text,
    html
  };
}

function renderAssignmentDetail(label, value) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:${BRAND.slateLight};width:120px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;font-size:14px;color:${BRAND.navy};font-weight:600;">${escapeHtml(value)}</td>
    </tr>`;
}

function renderNewUserWelcomeEmail({
  fullName,
  email,
  password,
  roleLabel,
  clientName,
  deptName,
  createdByName,
  brandName,
  logoCid,
  logoUrl
}) {
  const greeting = fullName ? `Hello ${fullName},` : "Hello,";
  const loginUrl = buildLoginUrl();
  const safePassword = escapeHtml(password);
  const safeGreeting = escapeHtml(greeting);
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(roleLabel || "User");
  const safeCreatedBy = escapeHtml(createdByName || "your administrator");

  const assignmentRows = [
    renderAssignmentDetail("Email", email),
    renderAssignmentDetail("Role", roleLabel),
    renderAssignmentDetail("Client", clientName),
    renderAssignmentDetail("Department", deptName)
  ]
    .filter(Boolean)
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:${BRAND.slate};">${safeGreeting}</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:${BRAND.slate};">
      Admin has created an account for you on "Quiz Platform". Use the sign-in details below to access the host workspace.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:20px 22px;">
          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:${BRAND.navy};">Account details</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${assignmentRows}
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background-color:${BRAND.amberLight};border:1px solid ${BRAND.amberBorder};border-radius:12px;padding:24px;text-align:center;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.amber};">
            Password
          </p>
          <p class="password-box" style="margin:0;font-family:'SF Mono',SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:28px;font-weight:700;letter-spacing:0.18em;color:${BRAND.navy};word-break:break-all;">
            ${safePassword}
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:20px 22px;">
          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:${BRAND.navy};">Getting started</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding:0 0 10px;vertical-align:top;width:28px;font-size:14px;font-weight:700;color:${BRAND.blue};">1.</td>
              <td style="padding:0 0 10px;font-size:14px;line-height:1.55;color:${BRAND.slate};">Open the sign-in page using the button below.</td>
            </tr>
            <tr>
              <td style="padding:0 0 10px;vertical-align:top;width:28px;font-size:14px;font-weight:700;color:${BRAND.blue};">2.</td>
              <td style="padding:0 0 10px;font-size:14px;line-height:1.55;color:${BRAND.slate};">Sign in with <strong>${safeEmail}</strong> and the password above.</td>
            </tr>
            <tr>
              <td style="padding:0;vertical-align:top;width:28px;font-size:14px;font-weight:700;color:${BRAND.blue};">3.</td>
              <td style="padding:0;font-size:14px;line-height:1.55;color:${BRAND.slate};">Keep your credentials secure and contact your administrator if you need help.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 28px;">
      <tr>
        <td align="center" style="border-radius:12px;background:linear-gradient(135deg,${BRAND.navy} 0%,${BRAND.navyMid} 100%);">
          <a class="cta-button" href="${escapeHtml(loginUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:${BRAND.white};text-decoration:none;border-radius:12px;">
            Sign in to your account
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${BRAND.slateLight};text-align:center;">
      Or copy this link into your browser:<br />
      <a href="${escapeHtml(loginUrl)}" style="color:${BRAND.blue};word-break:break-all;">${escapeHtml(loginUrl)}</a>
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
      <tr>
        <td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#1e3a8a;">
            <strong>Your role:</strong> ${safeRole}. If any account details look incorrect, please contact your administrator.
          </p>
        </td>
      </tr>
    </table>`;

  const html = renderEmailLayout({
    preheader: `Your ${brandName || "Quiz Platform"} account is ready. Sign in with ${email}.`,
    brandName,
    title: "Welcome to the platform",
    bodyHtml,
    footerNote: "You received this email because an administrator created an account for you.",
    logoCid,
    logoUrl
  });

  const assignmentText = [
    clientName ? `Client: ${clientName}` : null,
    deptName ? `Department: ${deptName}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const text = `${greeting}

Admin has created an account for you on "Quiz Platform".

ACCOUNT DETAILS
Email: ${email}
Role: ${roleLabel || "User"}
${assignmentText}

PASSWORD
${password}

GETTING STARTED
1. Open the sign-in page: ${loginUrl}
2. Sign in with your email and the password above.
3. Keep your credentials secure and contact your administrator if you need help.

— ${brandName || "Quiz Platform"}`;

  return {
    subject: `Your ${brandName || "Quiz Platform"} account has been created`,
    text,
    html
  };
}

function renderParticipantLimitExceededEmail({
  fullName,
  planName,
  used,
  limit,
  brandName,
  logoCid,
  logoUrl
}) {
  const greeting = fullName ? `Hello ${fullName},` : "Hello,";
  const loginUrl = buildLoginUrl();
  const safeGreeting = escapeHtml(greeting);
  const safePlan = escapeHtml(planName || "your plan");
  const usedLabel = Number(used) || 0;
  const limitLabel = Number(limit) || 0;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:${BRAND.slate};">${safeGreeting}</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:${BRAND.slate};">
      Your participant limit has been reached. New people can no longer join any of your sessions until capacity is available.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:${BRAND.amberLight};border:1px solid ${BRAND.amberBorder};border-radius:12px;padding:20px 22px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.amber};">
            Plan limit reached
          </p>
          <p style="margin:0;font-size:16px;line-height:1.6;color:${BRAND.navy};">
            <strong>${safePlan}</strong> allows <strong>${limitLabel}</strong> participants across all sessions.
            Current usage is <strong>${usedLabel} / ${limitLabel}</strong>.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${BRAND.slate};">
      Ask your administrator to upgrade your plan.
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 28px;">
      <tr>
        <td align="center" style="border-radius:12px;background:linear-gradient(135deg,${BRAND.navy} 0%,${BRAND.navyMid} 100%);">
          <a class="cta-button" href="${escapeHtml(loginUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:${BRAND.white};text-decoration:none;border-radius:12px;">
            Open host dashboard
          </a>
        </td>
      </tr>
    </table>`;

  const html = renderEmailLayout({
    preheader: `Your ${planName || "plan"} participant limit (${limitLabel}) has been reached.`,
    brandName,
    title: "Participant limit reached",
    bodyHtml,
    footerNote: "You received this email because a participant tried to join after your plan limit was reached.",
    logoCid,
    logoUrl
  });

  const text = `${greeting}

Your participant limit has been reached. New people can no longer join any of your sessions until capacity is available.

PLAN LIMIT REACHED
Plan: ${planName || "your plan"}
Usage: ${usedLabel} / ${limitLabel}

Ask your administrator to upgrade your plan.

Open host dashboard: ${loginUrl}

— ${brandName || "Quiz Platform"}`;

  return {
    subject: `Participant limit reached on ${brandName || "Quiz Platform"}`,
    text,
    html
  };
}

module.exports = {
  escapeHtml,
  renderEmailLayout,
  renderPasswordResetEmail,
  renderNewUserWelcomeEmail,
  renderParticipantLimitExceededEmail,
  buildLoginUrl,
  buildEmailLogoUrl,
  EMAIL_LOGO_CID
};
