const { verifyAccessToken } = require("../utils/jwt");
const { User, Participant } = require("../models");
const { errorResponse } = require("../utils/response");

async function qaAccessMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, "Authorization token is required", 401);
  }

  try {
    const decoded = verifyAccessToken(authHeader.split(" ")[1]);
    if (decoded.role === "participant") {
      const participant = await Participant.findByPk(decoded.participant_id);
      if (!participant) {
        return errorResponse(res, "Participant not found", 401);
      }
      req.participant = {
        participant_id: participant.participant_id,
        session_id: participant.session_id,
        dept_id: participant.dept_id,
        role: "participant"
      };
      return next();
    }

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

module.exports = qaAccessMiddleware;
