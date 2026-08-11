const { verifyAccessToken } = require("../utils/jwt");
const { errorResponse } = require("../utils/response");
const { isIntegrationsEnabled } = require("../config/integrations");
const { resolveEmbedToken } = require("../services/session-embed-token.service");

/**
 * Accepts presenter_viewer JWTs always (View Display share links).
 * Opaque embed tokens are only accepted when integrations are enabled.
 */
async function presenterViewerAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, "Authorization token is required", 401);
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return errorResponse(res, "Authorization token is required", 401);
  }

  try {
    const decoded = verifyAccessToken(token);
    if (decoded.role !== "presenter_viewer" || !decoded.session_id) {
      return errorResponse(res, "Invalid presenter viewer token", 401);
    }

    req.presenterViewer = {
      role: "presenter_viewer",
      session_id: Number(decoded.session_id),
      session_code: decoded.session_code || null
    };
    return next();
  } catch {
    // Not a JWT (or expired) — optionally fall through to embed tokens.
  }

  if (!isIntegrationsEnabled()) {
    return errorResponse(res, "Invalid or expired token", 401);
  }

  try {
    const viewer = await resolveEmbedToken(token);
    if (!viewer) {
      return errorResponse(res, "Invalid or expired token", 401);
    }
    req.presenterViewer = viewer;
    return next();
  } catch {
    return errorResponse(res, "Invalid or expired token", 401);
  }
}

module.exports = presenterViewerAuthMiddleware;
