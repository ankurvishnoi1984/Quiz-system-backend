const { errorResponse } = require("../utils/response");

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, "Unauthorized", 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, "Forbidden: insufficient permissions", 403);
    }

    return next();
  };
}

module.exports = authorizeRoles;
