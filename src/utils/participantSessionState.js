const EMPTY_PARTICIPANT_SESSION_STATE = Object.freeze({
  quizResponses: {},
  quizQuestionIndex: 0,
  quizLiveQuestionId: null,
  quizSubmitted: false,
  quizSubmittedQuestionIds: {},
  quizExplicitSubmittedQuestionIds: {},
  quizCountdownByQuestion: {},
  quizSessionCountdown: null,
  quizQuestionOpenedAt: {}
});

function normalizeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function normalizeQuestionIndex(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizeLiveQuestionId(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeParticipantEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeParticipantNickname(nickname) {
  return String(nickname || "").trim();
}

function normalizeParticipantSessionState(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_PARTICIPANT_SESSION_STATE };
  }

  return {
    quizResponses: normalizeRecord(raw.quizResponses),
    quizQuestionIndex: normalizeQuestionIndex(raw.quizQuestionIndex),
    quizLiveQuestionId: normalizeLiveQuestionId(raw.quizLiveQuestionId),
    quizSubmitted: Boolean(raw.quizSubmitted),
    quizSubmittedQuestionIds: normalizeRecord(raw.quizSubmittedQuestionIds),
    quizExplicitSubmittedQuestionIds: normalizeRecord(raw.quizExplicitSubmittedQuestionIds),
    quizCountdownByQuestion: normalizeRecord(raw.quizCountdownByQuestion),
    quizSessionCountdown:
      raw.quizSessionCountdown && typeof raw.quizSessionCountdown === "object"
        ? raw.quizSessionCountdown
        : null,
    quizQuestionOpenedAt: normalizeRecord(raw.quizQuestionOpenedAt)
  };
}

module.exports = {
  EMPTY_PARTICIPANT_SESSION_STATE,
  normalizeParticipantEmail,
  normalizeParticipantNickname,
  normalizeParticipantSessionState
};
