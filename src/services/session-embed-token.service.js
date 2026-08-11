const crypto = require("crypto");
const { Op } = require("sequelize");
const { Session, SessionEmbedToken } = require("../models");
const { isIntegrationsEnabled } = require("../config/integrations");

/**
 * Embed tokens are long-lived, opaque, and revocable — unlike the 12h presenter-viewer JWT.
 * Entirely unused when INTEGRATIONS_ENABLED=false.
 */
const DEFAULT_TTL_DAYS = Number(process.env.EMBED_TOKEN_TTL_DAYS || 180);
const TOKEN_BYTES = 24;

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function defaultExpiry() {
  if (!Number.isFinite(DEFAULT_TTL_DAYS) || DEFAULT_TTL_DAYS <= 0) return null;
  const expires = new Date();
  expires.setDate(expires.getDate() + DEFAULT_TTL_DAYS);
  return expires;
}

function isUsable(row) {
  if (!row) return false;
  if (row.revoked_at) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return false;
  return true;
}

function assertIntegrationsOn() {
  if (!isIntegrationsEnabled()) {
    const error = new Error("Platform integrations are disabled");
    error.statusCode = 404;
    throw error;
  }
}

function findActiveToken(sessionId, scope = "display") {
  return SessionEmbedToken.findOne({
    where: {
      session_id: sessionId,
      scope,
      revoked_at: null,
      [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
    },
    order: [["created_at", "DESC"]]
  });
}

async function issueToken({ sessionId, scope = "display", userId = null, label = null }) {
  assertIntegrationsOn();
  return SessionEmbedToken.create({
    session_id: sessionId,
    scope,
    token: generateToken(),
    label,
    created_by: userId,
    expires_at: defaultExpiry()
  });
}

/** Reuse the live token so re-opening the share panel does not break already-pasted embeds. */
async function getOrCreateEmbedToken({ sessionId, scope = "display", userId = null }) {
  assertIntegrationsOn();
  const existing = await findActiveToken(sessionId, scope);
  if (existing) return existing;
  return issueToken({ sessionId, scope, userId });
}

async function rotateEmbedToken({ sessionId, scope = "display", userId = null }) {
  assertIntegrationsOn();
  await revokeEmbedTokens({ sessionId, scope });
  return issueToken({ sessionId, scope, userId });
}

async function revokeEmbedTokens({ sessionId, scope = "display" }) {
  assertIntegrationsOn();
  const [count] = await SessionEmbedToken.update(
    { revoked_at: new Date() },
    { where: { session_id: sessionId, scope, revoked_at: null } }
  );
  return count;
}

/**
 * Resolve an opaque embed token into a presenter-viewer identity.
 * Returns null when integrations are off, or the token is unknown/revoked/expired,
 * or the table was rolled back.
 */
async function resolveEmbedToken(token) {
  if (!isIntegrationsEnabled()) return null;

  const value = typeof token === "string" ? token.trim() : "";
  if (!value || value.length > 64) return null;

  let row;
  try {
    row = await SessionEmbedToken.findOne({ where: { token: value } });
  } catch {
    return null;
  }
  if (!isUsable(row)) return null;

  const session = await Session.findByPk(row.session_id, {
    attributes: ["session_id", "session_code", "status"]
  });
  if (!session || session.status === "archived") return null;

  SessionEmbedToken.update(
    { last_used_at: new Date() },
    { where: { embed_token_id: row.embed_token_id }, hooks: false }
  ).catch(() => {});

  return {
    role: "presenter_viewer",
    session_id: Number(session.session_id),
    session_code: session.session_code,
    scope: row.scope,
    via: "embed_token"
  };
}

module.exports = {
  getOrCreateEmbedToken,
  rotateEmbedToken,
  revokeEmbedTokens,
  resolveEmbedToken
};
