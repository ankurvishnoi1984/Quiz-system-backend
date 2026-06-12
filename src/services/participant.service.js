const { Participant, Session } = require("../models");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const {
  normalizeParticipantEmail,
  normalizeParticipantNickname,
  normalizeParticipantSessionState
} = require("../utils/participantSessionState");
const { notifyParticipantJoined, notifySessionProgress } = require("./websocket.service");

const RETURNING_PARTICIPANT_STATUSES = new Set(["live", "paused", "completed", "archived"]);

function buildParticipantTokenPayload(session, participant) {
  return {
    participant_id: participant.participant_id,
    session_id: session.session_id,
    dept_id: session.dept_id,
    role: "participant"
  };
}

function buildParticipantAuthTokens(session, participant) {
  const payload = buildParticipantTokenPayload(session, participant);
  return {
    access_token: signAccessToken(payload),
    refresh_token: signRefreshToken(payload)
  };
}

function buildParticipantAuthToken(session, participant) {
  return buildParticipantAuthTokens(session, participant).access_token;
}

async function refreshParticipantAccessToken(refreshToken) {
  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    const error = new Error("Invalid or expired refresh token");
    error.statusCode = 401;
    throw error;
  }

  if (decoded.role !== "participant") {
    const error = new Error("Invalid participant refresh token");
    error.statusCode = 401;
    throw error;
  }

  const participant = await Participant.findByPk(decoded.participant_id);
  if (!participant) {
    const error = new Error("Participant not found");
    error.statusCode = 401;
    throw error;
  }

  const session = await Session.findByPk(participant.session_id);
  if (!session) {
    const error = new Error("Session not found");
    error.statusCode = 401;
    throw error;
  }

  const payload = buildParticipantTokenPayload(session, participant);
  return {
    access_token: signAccessToken(payload)
  };
}

function wantsFreshParticipantIdentity(payload) {
  return payload.force_new_participant === true;
}

function assertSessionAcceptingJoin(session, { isReturning = false } = {}) {
  if (isReturning) {
    if (RETURNING_PARTICIPANT_STATUSES.has(session.status)) return;
    const error = new Error("Session is not available for rejoin right now");
    error.statusCode = 400;
    throw error;
  }

  if (session.status !== "live" && !(session.status === "draft" && session.allow_late_join)) {
    const error = new Error("Session is not accepting participants right now");
    error.statusCode = 400;
    throw error;
  }
}

async function assertParticipantCapacity(session) {
  const participantsCount = await Participant.count({
    where: { session_id: session.session_id }
  });
  if (participantsCount >= session.max_participants) {
    const error = new Error("Session participant limit reached");
    error.statusCode = 403;
    throw error;
  }
}

async function findParticipantByNameEmail(session, payload) {
  if (session.join_type !== "name_email") return null;

  const email = normalizeParticipantEmail(payload.email);
  const nickname = normalizeParticipantNickname(payload.nickname);
  if (!email || !nickname) return null;

  const candidates = await Participant.findAll({
    where: {
      session_id: session.session_id,
      email
    }
  });

  const normalizedNickname = nickname.toLowerCase();
  return (
    candidates.find(
      (row) => normalizeParticipantNickname(row.nickname).toLowerCase() === normalizedNickname
    ) || null
  );
}

async function findParticipantByDeviceFingerprint(sessionId, deviceFingerprint) {
  if (!deviceFingerprint) return null;

  return Participant.findOne({
    where: {
      session_id: sessionId,
      device_fingerprint: deviceFingerprint
    }
  });
}

async function touchParticipant(participant, payload = {}) {
  const updates = { last_active_at: new Date() };
  if (payload.device_fingerprint) {
    updates.device_fingerprint = payload.device_fingerprint;
  }
  await participant.update(updates);
  return participant;
}

async function getParticipantSessionState(participantId) {
  const participant = await Participant.findByPk(participantId, {
    attributes: ["session_state"]
  });
  return normalizeParticipantSessionState(participant?.session_state);
}

async function saveParticipantSessionState(participantId, rawState) {
  const sessionState = normalizeParticipantSessionState(rawState);
  await Participant.update(
    {
      session_state: sessionState,
      last_active_at: new Date()
    },
    { where: { participant_id: participantId } }
  );
  return sessionState;
}

async function assertNameEmailSessionStateAllowed(participantId) {
  const participant = await Participant.findByPk(participantId, {
    attributes: ["session_id"]
  });
  if (!participant) {
    const error = new Error("Participant not found");
    error.statusCode = 404;
    throw error;
  }

  const session = await Session.findByPk(participant.session_id, {
    attributes: ["join_type"]
  });
  if (!session || session.join_type !== "name_email") {
    const error = new Error("Session state persistence is only available for name + email sessions");
    error.statusCode = 400;
    throw error;
  }
}

async function finalizeParticipantJoin(session, participant, { isReturning = false, payload = {} } = {}) {
  await touchParticipant(participant, payload);

  const refreshed = await Participant.findByPk(participant.participant_id);
  const tokens = buildParticipantAuthTokens(session, refreshed);
  const result = {
    participant: refreshed,
    token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    is_returning: isReturning
  };

  if (session.join_type === "name_email") {
    result.session_state = normalizeParticipantSessionState(refreshed.session_state);
  }

  if (session.session_code) {
    notifyParticipantJoined(session.session_code, refreshed);
    notifySessionProgress(session.session_code, session.session_id).catch(() => {});
  }

  return result;
}

module.exports = {
  assertNameEmailSessionStateAllowed,
  assertParticipantCapacity,
  assertSessionAcceptingJoin,
  buildParticipantAuthToken,
  buildParticipantAuthTokens,
  refreshParticipantAccessToken,
  finalizeParticipantJoin,
  findParticipantByDeviceFingerprint,
  findParticipantByNameEmail,
  getParticipantSessionState,
  normalizeParticipantEmail,
  normalizeParticipantNickname,
  saveParticipantSessionState,
  wantsFreshParticipantIdentity
};
