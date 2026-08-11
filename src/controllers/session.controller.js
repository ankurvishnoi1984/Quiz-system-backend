const { successResponse, errorResponse } = require("../utils/response");
const {
  listDepartmentSessions,
  createSession,
  duplicateSession,
  getSessionById,
  updateSession,
  archiveSession,
  resetSessionResponses,
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
  notifyLeaderboard,
  notifyQuestionChange,
  notifyAllQuestionsSubmissionsClosed
} = require("../services/websocket.service");
const { buildSessionLeaderboard } = require("../services/response.service");
const {
  activateAllQuestionsForSession,
  closeAllQuestionSubmissionsForSession
} = require("../services/question.service");
const { getSessionSummaryReport, getSessionQuestionsReport, getSessionParticipantsReport, getSessionQaReport } = require("../services/session-report.service");
const { Session } = require("../models");
const { getFrontendPublicUrl } = require("../config/publicAppUrl");
const {
  createPresentViewLink,
  buildEmbedLinkPayload,
  setPresentSlideIndex,
  getPresentSlideIndexForHost
} = require("../services/present-view.service");

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
        survey_results_enabled: session.survey_results_enabled,
        show_question_leaderboard: session.show_question_leaderboard,
        participant_navigation_enabled: session.participant_navigation_enabled !== false,
        quiz_total_time_minutes: session.quiz_total_time_minutes ?? null,
        allow_late_join: Boolean(session.allow_late_join)
      });
      if (req.body.leaderboard_enabled === true && session.leaderboard_enabled) {
        const leaderboard = await buildSessionLeaderboard(session.session_id);
        notifyLeaderboard(session.session_code, { leaderboard });
      }
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

async function resetResponses(req, res) {
  try {
    const result = await resetSessionResponses({
      sessionId: Number(req.params.sessionId),
      user: req.user
    });

    const session = await Session.findByPk(result.session_id);
    if (session?.session_code) {
      notifySessionUpdate(session.session_code, session.status);
      if (session.leaderboard_enabled) {
        buildSessionLeaderboard(session.session_id)
          .then((leaderboard) => notifyLeaderboard(session.session_code, leaderboard))
          .catch(() => {});
      }
    }

    return successResponse(
      res,
      result,
      "Session responses and participants were cleared",
      200
    );
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
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    return successResponse(
      res,
      {
        session: {
          session_id: session.session_id,
          dept_id: session.dept_id,
          title: session.title,
          status: session.status,
          session_code: session.session_code,
          scheduled_date: session.scheduled_date || null,
          scheduled_time: session.scheduled_time || null,
          department: session.department,
          join_type: session.join_type,
          logo_url: session.logo_url || null,
          leaderboard_enabled: Boolean(session.leaderboard_enabled),
          survey_results_enabled: Boolean(session.survey_results_enabled),
          show_question_leaderboard: Boolean(session.show_question_leaderboard),
          participant_navigation_enabled: session.participant_navigation_enabled !== false,
          quiz_total_time_minutes: session.quiz_total_time_minutes ?? null,
          allow_late_join: Boolean(session.allow_late_join),
          join_blocked: Boolean(joinBlock.blocked),
          join_blocked_message: joinBlock.message || null,
          join_blocked_reason: joinBlock.reason || null
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
        participant_token: result.token,
        participant_refresh_token: result.refresh_token,
        is_returning: Boolean(result.is_returning),
        session_state: result.session_state ?? null
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

async function presentViewLink(req, res) {
  try {
    const baseUrl = getFrontendPublicUrl(req);
    const data = await createPresentViewLink({
      sessionId: Number(req.params.sessionId),
      user: req.user,
      baseUrl
    });
    return successResponse(res, data, "Present view link created", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function embedLink(req, res) {
  try {
    const action = String(req.body?.action || "get").toLowerCase();
    if (!["get", "rotate", "revoke"].includes(action)) {
      return errorResponse(res, "Unsupported embed link action", 400);
    }

    const data = await buildEmbedLinkPayload({
      sessionId: Number(req.params.sessionId),
      user: req.user,
      baseUrl: getFrontendPublicUrl(req),
      action
    });
    return successResponse(res, data, "Embed link updated", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function getPresentSlide(req, res) {
  try {
    const data = await getPresentSlideIndexForHost({
      sessionId: Number(req.params.sessionId),
      user: req.user
    });
    return successResponse(res, data, "Present slide fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function presentSlide(req, res) {
  try {
    const slideIndex = Number(req.body?.slide_index)
    const slideTotal = Number(req.body?.slide_total)
    const data = await setPresentSlideIndex({
      sessionId: Number(req.params.sessionId),
      user: req.user,
      slideIndex,
      slideTotal: Number.isFinite(slideTotal) && slideTotal > 0 ? slideTotal : undefined
    });
    return successResponse(res, data, "Present slide updated", 200);
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

async function sessionQaReport(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) return errorResponse(res, "sessionId must be a number", 400);
    const report = await getSessionQaReport({ sessionId, user: req.user });
    return successResponse(res, { report }, "Session Q&A report fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function sessionParticipantsReport(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) return errorResponse(res, "sessionId must be a number", 400);
    const report = await getSessionParticipantsReport({ sessionId, user: req.user });
    return successResponse(res, { report }, "Session participants report fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function sessionQuestionsReport(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) return errorResponse(res, "sessionId must be a number", 400);
    const report = await getSessionQuestionsReport({ sessionId, user: req.user });
    return successResponse(res, { report }, "Session questions report fetched", 200);
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
  sessionQuestionsReport,
  sessionParticipantsReport,
  sessionQaReport,
  listByDepartment,
  createForDepartment,
  detail,
  listParticipants,
  update,
  remove,
  resetResponses,
  duplicate,
  start: lifecycleAction("start"),
  pause: lifecycleAction("pause"),
  resume: lifecycleAction("resume"),
  end: lifecycleAction("end"),
  lookupByCode,
  joinByCode,
  qr,
  presentViewLink,
  embedLink,
  getPresentSlide,
  presentSlide,
  closeAllQuestions,
  activateAllQuestions
};
