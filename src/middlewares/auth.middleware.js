const { verifyAccessToken } = require("../utils/jwt");
const { User } = require("../models");
const { errorResponse } = require("../utils/response");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, "Authorization token is required", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findByPk(decoded.user_id);

    if (!user || !user.is_active) {
      return errorResponse(res, "User not found or inactive", 401);
    }

    req.user = {
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      client_id: user.client_id,
      dept_id: user.dept_id
    };
    return next();
  } catch (err) {
    return errorResponse(res, "Invalid or expired token", 401);
  }
}

module.exports = authMiddleware;
