const { successResponse, errorResponse } = require("../utils/response");
const {
  assertNameEmailSessionStateAllowed,
  getParticipantSessionState,
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

module.exports = {
  getMySessionState,
  saveMySessionState
};
