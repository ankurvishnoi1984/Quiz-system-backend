const { signAccessToken } = require("../utils/jwt");
const { assertPresenterViewerSession } = require("../utils/presenterViewerAccess");
const { getSessionOrThrow, assertSessionWriteAccess } = require("./session.service");
const { listSessionQuestions } = require("./question.service");
const {
  getQuestionResults,
  getSessionResponses,
  buildSessionLeaderboard,
  getSessionSurveySummaryPayload
} = require("./response.service");
const { Participant, Question } = require("../models");
const { listQaQuestionsForPresenterViewer } = require("./qa.service");
const { buildPresentViewUrl } = require("../config/publicAppUrl");
const { notifyPresentSlideChanged } = require("./websocket.service");

const PRESENTER_VIEWER_TOKEN_EXPIRY = process.env.PRESENTER_VIEWER_TOKEN_EXPIRY || "12h";
const presentSlideBySessionId = new Map();

function clampSlideIndex(slideIndex, slideTotal) {
  const index = Number(slideIndex);
  if (!Number.isFinite(index)) return 0;
  if (!Number.isFinite(slideTotal) || slideTotal <= 0) {
    return Math.max(0, index);
  }
  return Math.min(Math.max(0, index), slideTotal - 1);
}

function getPresentSlideState(sessionId) {
  return presentSlideBySessionId.get(Number(sessionId)) || { slide_index: 0, updated_at: null };
}

async function setPresentSlideIndex({ sessionId, user, slideIndex, slideTotal }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);

  const nextIndex = clampSlideIndex(slideIndex, slideTotal);
  const state = {
    slide_index: nextIndex,
    updated_at: new Date().toISOString()
  };
  presentSlideBySessionId.set(Number(sessionId), state);
  notifyPresentSlideChanged(session.session_code, {
    session_id: session.session_id,
    slide_index: nextIndex
  });
  return state;
}

function getPresentSlideIndexForViewer({ sessionId, viewer }) {
  assertPresenterViewerSession(viewer, sessionId);
  return getPresentSlideState(sessionId);
}

async function createPresentViewLink({ sessionId, user, baseUrl }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);

  if (session.status === "archived") {
    const error = new Error("View-only display links are not available for archived sessions");
    error.statusCode = 400;
    throw error;
  }

  const token = signAccessToken(
    {
      role: "presenter_viewer",
      session_id: session.session_id,
      session_code: session.session_code
    },
    { expiresIn: PRESENTER_VIEWER_TOKEN_EXPIRY }
  );

  return {
    session_id: session.session_id,
    session_code: session.session_code,
    view_token: token,
    view_url: buildPresentViewUrl(session.session_id, token, baseUrl),
    token_expires_in: PRESENTER_VIEWER_TOKEN_EXPIRY
  };
}

async function getPresentViewSession({ sessionId, viewer }) {
  assertPresenterViewerSession(viewer, sessionId);
  return getSessionOrThrow(sessionId);
}

async function listPresentViewQuestions({ sessionId, viewer }) {
  assertPresenterViewerSession(viewer, sessionId);
  return listSessionQuestions({ sessionId, publicView: true });
}

async function listPresentViewResponses({ sessionId, viewer }) {
  assertPresenterViewerSession(viewer, sessionId);
  return getSessionResponses({ sessionId, user: viewer });
}

async function getPresentViewQuestionResults({ questionId, viewer }) {
  const question = await Question.findByPk(questionId, {
    attributes: ["question_id", "session_id"]
  });
  if (!question) {
    const error = new Error("Question not found");
    error.statusCode = 404;
    throw error;
  }
  assertPresenterViewerSession(viewer, question.session_id);
  return getQuestionResults({ questionId, user: viewer });
}

async function listPresentViewParticipants({ sessionId, viewer }) {
  assertPresenterViewerSession(viewer, sessionId);

  const rows = await Participant.findAll({
    where: { session_id: sessionId },
    attributes: ["participant_id", "nickname", "is_anonymous", "joined_at"],
    order: [
      ["joined_at", "ASC"],
      ["participant_id", "ASC"]
    ]
  });

  return rows.map((row) => ({
    participant_id: row.participant_id,
    nickname: row.is_anonymous ? "Anonymous" : row.nickname || "Participant",
    is_anonymous: Boolean(row.is_anonymous),
    joined_at: row.joined_at
  }));
}

async function listPresentViewQaQuestions({ sessionId, viewer }) {
  assertPresenterViewerSession(viewer, sessionId);
  return listQaQuestionsForPresenterViewer({ sessionId, viewer });
}

async function getPresentViewLeaderboard({ sessionId, viewer, limit = 10 }) {
  assertPresenterViewerSession(viewer, sessionId);
  return buildSessionLeaderboard(sessionId, limit);
}

async function getPresentViewSurveySummary({ sessionId, viewer }) {
  assertPresenterViewerSession(viewer, sessionId);
  const session = await getSessionOrThrow(sessionId);
  const summary = await getSessionSurveySummaryPayload(sessionId);
  return {
    session: {
      session_id: session.session_id,
      title: session.title,
      status: session.status,
      survey_results_enabled: Boolean(session.survey_results_enabled)
    },
    ...summary
  };
}

module.exports = {
  createPresentViewLink,
  getPresentViewSession,
  listPresentViewQuestions,
  listPresentViewResponses,
  getPresentViewQuestionResults,
  listPresentViewParticipants,
  listPresentViewQaQuestions,
  getPresentViewLeaderboard,
  getPresentViewSurveySummary,
  setPresentSlideIndex,
  getPresentSlideIndexForViewer
};
