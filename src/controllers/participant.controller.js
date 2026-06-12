const { successResponse, errorResponse } = require("../utils/response");
const {
  assertNameEmailSessionStateAllowed,
  getParticipantSessionState,
  refreshParticipantAccessToken,
  saveParticipantSessionState
} = require("../services/participant.service");

async function getMySessionState(req, res) {
  try {
    await assertNameEmailSessionStateAllowed(req.participant.participant_id);
    const sessionState = await getParticipantSessionState(req.participant.participant_id);
    return successResponse(res, { session_state: sessionState }, "Participant session state loaded", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function saveMySessionState(req, res) {
  try {
    await assertNameEmailSessionStateAllowed(req.participant.participant_id);
    const sessionState = await saveParticipantSessionState(
      req.participant.participant_id,
      req.body?.session_state
    );
    return successResponse(res, { session_state: sessionState }, "Participant session state saved", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function refresh(req, res) {
  try {
    const refreshToken = req.body?.refresh_token;

    if (!refreshToken) {
      return errorResponse(res, "refresh_token is required", 400);
    }

    const result = await refreshParticipantAccessToken(refreshToken);
    return successResponse(res, result, "Access token refreshed", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  getMySessionState,
  saveMySessionState,
  refresh
};
