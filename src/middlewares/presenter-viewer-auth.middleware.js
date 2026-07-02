const { verifyAccessToken } = require("../utils/jwt");
const { errorResponse } = require("../utils/response");

async function presenterViewerAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, "Authorization token is required", 401);
  }

  try {
    const decoded = verifyAccessToken(authHeader.split(" ")[1]);
    if (decoded.role !== "presenter_viewer") {
      return errorResponse(res, "Invalid presenter viewer token", 401);
    }
    if (!decoded.session_id) {
      return errorResponse(res, "Invalid presenter viewer token", 401);
    }

    req.presenterViewer = {
      role: "presenter_viewer",
      session_id: Number(decoded.session_id),
      session_code: decoded.session_code || null
    };
    return next();
  } catch (err) {
    return errorResponse(res, "Invalid or expired token", 401);
  }
}

module.exports = presenterViewerAuthMiddleware;
