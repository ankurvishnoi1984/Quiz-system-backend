const { verifyAccessToken } = require("../utils/jwt");
const { Participant } = require("../models");
const { errorResponse } = require("../utils/response");

async function participantAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, "Authorization token is required", 401);
  }

  try {
    const decoded = verifyAccessToken(authHeader.split(" ")[1]);
    if (decoded.role !== "participant") {
      return errorResponse(res, "Invalid participant token", 401);
    }

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
  } catch (err) {
    return errorResponse(res, "Invalid or expired token", 401);
  }
}

module.exports = participantAuthMiddleware;
