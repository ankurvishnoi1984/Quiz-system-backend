const { successResponse, errorResponse } = require("../utils/response");
const {
  listDepartmentSessions,
  createSession,
  duplicateSession,
  getSessionById,
  updateSession,
  archiveSession,
  transitionSessionStatus,
  getSessionByCode,
  getSessionJoinBlockInfo,
  joinSession,
  listSessionParticipants,
  getSessionQr
} = require("../services/session.service");
const {
  validateCreateSessionPayload,
  validateUpdateSessionPayload,
  validateJoinSessionPayload
} = require("../validators/session.validator");
const {
  notifySessionUpdate,
  notifySessionSettings,
  notifyQuestionChange,
  notifyAllQuestionsSubmissionsClosed
} = require("../services/websocket.service");
const { buildSessionLeaderboard } = require("../services/response.service");
const {
  activateAllQuestionsForSession,
  closeAllQuestionSubmissionsForSession
} = require("../services/question.service");
const { getSessionSummaryReport } = require("../services/session-report.service");
const { Session } = require("../models");
const { getFrontendPublicUrl } = require("../config/publicAppUrl");

async function listByDepartment(req, res) {
  try {
    const sessions = await listDepartmentSessions({
      deptId: Number(req.params.deptId),
      status: req.query.status,
      user: req.user
    });
    return successResponse(res, { sessions }, "Sessions fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function createForDepartment(req, res) {
  try {
    const errors = validateCreateSessionPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const session = await createSession({
      deptId: Number(req.params.deptId),
      input: req.body,
      user: req.user
    });
    return successResponse(res, { session }, "Session created successfully", 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function detail(req, res) {
  try {
    const session = await getSessionById({
      sessionId: Number(req.params.sessionId),
      user: req.user
    });
    return successResponse(res, { session }, "Session fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function listParticipants(req, res) {
  try {
    const participants = await listSessionParticipants({
      sessionId: Number(req.params.sessionId),
      user: req.user
    });
    return successResponse(res, { participants }, "Participants fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function update(req, res) {
  try {
    const errors = validateUpdateSessionPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const session = await updateSession({
      sessionId: Number(req.params.sessionId),
      input: req.body,
      user: req.user
    });
    if (session.session_code) {
      notifySessionSettings(session.session_code, {
        leaderboard_enabled: session.leaderboard_enabled,
        show_question_leaderboard: session.show_question_leaderboard,
        participant_navigation_enabled: session.participant_navigation_enabled !== false,
        allow_late_join: Boolean(session.allow_late_join)
      });
    }
    return successResponse(res, { session }, "Session updated", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function remove(req, res) {
  try {
    const session = await archiveSession({
      sessionId: Number(req.params.sessionId),
      user: req.user
    });
    return successResponse(res, { session }, "Session archived", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

function lifecycleAction(action) {
  const actionMessage = {
    start: "started",
    pause: "paused",
    resume: "resumed",
    end: "ended"
  };

  return async (req, res) => {
    try {
      const session = await transitionSessionStatus({
        sessionId: Number(req.params.sessionId),
        user: req.user,
        action
      });
      if (session?.session_code) {
        (async () => {
          const extra = {};
          if (action === "end" && session.leaderboard_enabled) {
            extra.leaderboard = await buildSessionLeaderboard(session.session_id);
          }
          notifySessionUpdate(session.session_code, session.status, extra);
        })().catch(() => {});
      }
      return successResponse(
        res,
        { session },
        `Session ${actionMessage[action]} successfully`,
        200
      );
    } catch (err) {
      return errorResponse(res, err.message, err.statusCode || 500);
    }
  };
}

async function lookupByCode(req, res) {
  try {
    const session = await getSessionByCode(req.params.code);
    const joinBlock = await getSessionJoinBlockInfo(session);
    return successResponse(
      res,
      {
        session: {
          session_id: session.session_id,
          dept_id: session.dept_id,
          title: session.title,
          status: session.status,
          session_code: session.session_code,
          department: session.department,
          join_type: session.join_type,
          leaderboard_enabled: Boolean(session.leaderboard_enabled),
          show_question_leaderboard: Boolean(session.show_question_leaderboard),
          participant_navigation_enabled: session.participant_navigation_enabled !== false,
          allow_late_join: Boolean(session.allow_late_join),
          join_blocked: Boolean(joinBlock.blocked),
          join_blocked_message: joinBlock.message || null
        }
      },
      "Session found",
      200
    );
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function joinByCode(req, res) {
  try {
    const errors = validateJoinSessionPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const result = await joinSession({
      code: req.params.code,
      payload: req.body || {}
    });
    return successResponse(
      res,
      {
        participant: result.participant,
        participant_token: result.token
      },
      "Joined session successfully",
      200
    );
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function duplicate(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }
    const session = await duplicateSession({
      sourceSessionId: sessionId,
      user: req.user,
      input: req.body || {}
    });
    return successResponse(res, { session }, "Session duplicated successfully", 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function qr(req, res) {
  try {
    const baseUrl = getFrontendPublicUrl(req);
    const data = await getSessionQr({
      sessionId: Number(req.params.sessionId),
      user: req.user,
      baseUrl
    });
    return successResponse(res, data, "Session QR data fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

function buildClosedQuestionChangePayload(question) {
  return {
    question_id: question.question_id,
    is_live: true,
    live_activated_at: question.live_activated_at ?? null,
    time_limit_seconds: question.time_limit_seconds ?? null,
    submissions_closed: true,
    open_for_reattempt: Boolean(question.open_for_reattempt)
  };
}

function buildActivatedQuestionChangePayload(question) {
  return {
    question_id: question.question_id,
    is_live: true,
    live_activated_at: question.live_activated_at ?? null,
    time_limit_seconds: question.time_limit_seconds ?? null,
    submissions_closed: false,
    open_for_reattempt: false
  };
}

async function activateAllQuestions(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const questions = await activateAllQuestionsForSession({
      sessionId,
      user: req.user
    });
    const session = await Session.findByPk(sessionId, {
      attributes: ["session_code"]
    });
    if (session?.session_code) {
      for (const question of questions) {
        notifyQuestionChange(
          session.session_code,
          buildActivatedQuestionChangePayload(question)
        );
      }
    }
    return successResponse(
      res,
      { questions, activated_count: questions.length },
      "All questions activated",
      200
    );
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function closeAllQuestions(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const questions = await closeAllQuestionSubmissionsForSession({
      sessionId,
      user: req.user
    });
    const session = await Session.findByPk(sessionId, {
      attributes: ["session_code"]
    });
    if (session?.session_code) {
      for (const question of questions) {
        notifyQuestionChange(
          session.session_code,
          buildClosedQuestionChangePayload(question)
        );
      }
      notifyAllQuestionsSubmissionsClosed(session.session_code, {
        closed_count: questions.length
      });
    }
    return successResponse(
      res,
      { questions, closed_count: questions.length },
      "All questions closed",
      200
    );
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function sessionSummaryReport(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) return errorResponse(res, "sessionId must be a number", 400);
    const report = await getSessionSummaryReport({ sessionId, user: req.user });
    return successResponse(res, { report }, "Session summary report fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  sessionSummaryReport,
  listByDepartment,
  createForDepartment,
  detail,
  listParticipants,
  update,
  remove,
  duplicate,
  start: lifecycleAction("start"),
  pause: lifecycleAction("pause"),
  resume: lifecycleAction("resume"),
  end: lifecycleAction("end"),
  lookupByCode,
  joinByCode,
  qr,
  closeAllQuestions,
  activateAllQuestions
};
