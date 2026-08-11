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
const { Participant, Question, Session } = require("../models");
const { sequelize } = require("../config/database");
const { listQaQuestionsForPresenterViewer } = require("./qa.service");
const { buildPresentViewUrl, buildEmbedDisplayUrl } = require("../config/publicAppUrl");
const { isIntegrationsEnabled } = require("../config/integrations");
const { notifyPresentSlideChanged } = require("./websocket.service");
const {
  getOrCreateEmbedToken,
  rotateEmbedToken,
  revokeEmbedTokens
} = require("./session-embed-token.service");

const PRESENTER_VIEWER_TOKEN_EXPIRY = process.env.PRESENTER_VIEWER_TOKEN_EXPIRY || "12h";

/**
 * Core present-mode slide state stays in-memory (pre-integrations behaviour).
 * Optional DB columns (present_slide_*) are only touched via raw SQL when
 * integrations are on — they are NOT on the Session Sequelize model, so rolling
 * back the migration cannot break create/update/list session flows.
 */
const presentSlideBySessionId = new Map();

function clampSlideIndex(slideIndex, slideTotal) {
  const index = Number(slideIndex);
  if (!Number.isFinite(index)) return 0;
  if (!Number.isFinite(slideTotal) || slideTotal <= 0) {
    return Math.max(0, index);
  }
  return Math.min(Math.max(0, index), slideTotal - 1);
}

function memorySlideState(sessionId) {
  return presentSlideBySessionId.get(Number(sessionId)) || { slide_index: 0, updated_at: null };
}

function toSlideState(row) {
  const index = Number(row?.present_slide_index);
  const updatedAt = row?.present_slide_updated_at;
  return {
    slide_index: Number.isFinite(index) ? index : 0,
    updated_at: updatedAt ? new Date(updatedAt).toISOString() : null
  };
}

async function readPersistedSlideState(sessionId) {
  if (!isIntegrationsEnabled()) return null;
  try {
    const [rows] = await sequelize.query(
      `SELECT present_slide_index, present_slide_updated_at
       FROM sessions
       WHERE session_id = :sessionId
       LIMIT 1`,
      { replacements: { sessionId: Number(sessionId) } }
    );
    const row = rows?.[0];
    if (!row || row.present_slide_index == null) return null;
    return toSlideState(row);
  } catch {
    return null;
  }
}

async function persistSlideState(sessionId, state) {
  if (!isIntegrationsEnabled()) return;
  try {
    await sequelize.query(
      `UPDATE sessions
       SET present_slide_index = :slideIndex,
           present_slide_updated_at = :updatedAt
       WHERE session_id = :sessionId`,
      {
        replacements: {
          sessionId: Number(sessionId),
          slideIndex: state.slide_index,
          updatedAt: state.updated_at ? new Date(state.updated_at) : new Date()
        }
      }
    );
  } catch {
    // Ignore — memory Map remains the source of truth for core present mode.
  }
}

async function readPresentSlideState(sessionId) {
  const persisted = await readPersistedSlideState(sessionId);
  if (persisted) {
    presentSlideBySessionId.set(Number(sessionId), persisted);
    return persisted;
  }
  return memorySlideState(sessionId);
}

async function setPresentSlideIndex({ sessionId, user, slideIndex, slideTotal }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);

  const nextIndex = clampSlideIndex(slideIndex, slideTotal);
  const state = {
    slide_index: nextIndex,
    updated_at: new Date().toISOString()
  };
  presentSlideBySessionId.set(Number(session.session_id), state);
  await persistSlideState(session.session_id, state);

  notifyPresentSlideChanged(session.session_code, {
    session_id: session.session_id,
    slide_index: nextIndex
  });
  return state;
}

async function getPresentSlideIndexForViewer({ sessionId, viewer }) {
  assertPresenterViewerSession(viewer, sessionId);
  return readPresentSlideState(sessionId);
}

async function getPresentSlideIndexForHost({ sessionId, user }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);
  return readPresentSlideState(sessionId);
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

async function buildEmbedLinkPayload({ sessionId, user, baseUrl, action = "get" }) {
  if (!isIntegrationsEnabled()) {
    const error = new Error("Platform integrations are disabled");
    error.statusCode = 404;
    throw error;
  }

  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);

  if (session.status === "archived") {
    const error = new Error("Embed links are not available for archived sessions");
    error.statusCode = 400;
    throw error;
  }

  if (action === "revoke") {
    const revoked = await revokeEmbedTokens({ sessionId: session.session_id });
    return {
      session_id: session.session_id,
      session_code: session.session_code,
      revoked_count: revoked,
      embed_token: null,
      embed_url: null
    };
  }

  const row =
    action === "rotate"
      ? await rotateEmbedToken({ sessionId: session.session_id, userId: user?.user_id })
      : await getOrCreateEmbedToken({ sessionId: session.session_id, userId: user?.user_id });

  return {
    session_id: session.session_id,
    session_code: session.session_code,
    embed_token: row.token,
    embed_url: buildEmbedDisplayUrl(session.session_id, row.token, baseUrl),
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null
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
  buildEmbedLinkPayload,
  getPresentViewSession,
  listPresentViewQuestions,
  listPresentViewResponses,
  getPresentViewQuestionResults,
  listPresentViewParticipants,
  listPresentViewQaQuestions,
  getPresentViewLeaderboard,
  getPresentViewSurveySummary,
  setPresentSlideIndex,
  getPresentSlideIndexForViewer,
  getPresentSlideIndexForHost
};
