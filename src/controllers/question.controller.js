const { successResponse, errorResponse } = require("../utils/response");
const {
  listSessionQuestions,
  createQuestion,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  setQuestionLiveState,
  setQuestionAnswerRevealed,
  setQuestionLeaderboardVisibility,
  closeQuestionSubmissions,
  openQuestionForReattempt,
  getCorrectOptionIds,
  validateQuestionImport,
  importQuestions
} = require("../services/question.service");
const {
  validateCreateQuestionPayload,
  validateUpdateQuestionPayload,
  validateReorderPayload
} = require("../validators/question.validator");
const {
  notifyQuestionChange,
  notifyQuestionSubmissionsClosed,
  notifyQuestionReattemptOpened,
  notifyAnswerRevealed,
  notifyQuestionLeaderboardVisibility,
  notifyLeaderboard
} = require("../services/websocket.service");
const { Session } = require("../models");
const { buildQuestionLeaderboard } = require("../services/response.service");

async function listBySession(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }
    const questions = await listSessionQuestions({
      sessionId,
      user: req.user
    });
    return successResponse(res, { questions }, "Questions fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function listBySessionPublic(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }

    // Verify participant has access to this session
    if (req.participant && Number(req.participant.session_id) !== Number(sessionId)) {
      return errorResponse(res, "Access denied to this session", 403);
    }

    const questions = await listSessionQuestions({
      sessionId,
      publicView: true
    });
    return successResponse(res, { questions }, "Questions fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function createForSession(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }
    const errors = validateCreateQuestionPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }
    const question = await createQuestion({
      sessionId,
      input: req.body,
      user: req.user
    });
    return successResponse(res, { question }, "Question created", 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function previewImport(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }
    const mode = req.body?.mode || "append";
    const parsedRows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!parsedRows.length) {
      return errorResponse(res, "At least one parsed question row is required", 400);
    }
    const validation = await validateQuestionImport({
      sessionId,
      mode,
      questions: parsedRows.map((row) => ({ ...row.payload, __row: row.row })),
      user: req.user
    });
    const validationByRow = new Map(validation.rows.map((row) => [Number(row.row), row]));
    const rows = parsedRows.map((row) => {
      const serviceValidation = validationByRow.get(Number(row.row));
      const errors = [...new Set([...(row.errors || []), ...(serviceValidation?.errors || [])])];
      return {
        ...row,
        errors,
        valid: errors.length === 0
      };
    });

    return successResponse(
      res,
      {
        filename: req.body?.filename || null,
        mode,
        total_rows: rows.length,
        valid_rows: rows.filter((row) => row.valid).length,
        invalid_rows: rows.filter((row) => !row.valid).length,
        rows
      },
      "Question import preview generated",
      200
    );
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500, err.details || null);
  }
}

async function confirmImport(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }
    const result = await importQuestions({
      sessionId,
      mode: req.body?.mode || "append",
      questions: req.body?.questions,
      user: req.user
    });
    return successResponse(res, result, `${result.created_count} questions imported`, 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500, err.details || null);
  }
}

async function detail(req, res) {
  try {
    const questionId = Number(req.params.questionId);
    if (Number.isNaN(questionId)) {
      return errorResponse(res, "questionId must be a number", 400);
    }
    const question = await getQuestionById({
      questionId,
      user: req.user
    });
    return successResponse(res, { question }, "Question fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function update(req, res) {
  try {
    const questionId = Number(req.params.questionId);
    if (Number.isNaN(questionId)) {
      return errorResponse(res, "questionId must be a number", 400);
    }
    const errors = validateUpdateQuestionPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }
    const question = await updateQuestion({
      questionId,
      input: req.body,
      user: req.user
    });
    return successResponse(res, { question }, "Question updated", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function remove(req, res) {
  try {
    const questionId = Number(req.params.questionId);
    if (Number.isNaN(questionId)) {
      return errorResponse(res, "questionId must be a number", 400);
    }
    await deleteQuestion({
      questionId,
      user: req.user
    });
    return successResponse(res, null, "Question deleted", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function reorder(req, res) {
  try {
    const errors = validateReorderPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }
    const questions = await reorderQuestions({
      sessionId: Number(req.body.sessionId),
      orderedIds: req.body.orderedIds,
      user: req.user
    });
    return successResponse(res, { questions }, "Questions reordered", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

function buildQuestionChangePayload(question, isLive) {
  return {
    question_id: question.question_id,
    is_live: Boolean(isLive),
    live_activated_at: isLive ? question.live_activated_at ?? null : null,
    time_limit_seconds: question.time_limit_seconds ?? null,
    submissions_closed: isLive ? Boolean(question.submissions_closed) : false,
    open_for_reattempt: isLive ? Boolean(question.open_for_reattempt) : false
  };
}

function buildQuestionDeactivatePayload(questionId) {
  return {
    question_id: questionId,
    is_live: false,
    live_activated_at: null,
    time_limit_seconds: null,
    submissions_closed: false,
    open_for_reattempt: false
  };
}

function setLiveState(isLive) {
  return async (req, res) => {
    try {
      const { question, deactivatedQuestionIds = [] } = await setQuestionLiveState({
        questionId: Number(req.params.questionId),
        user: req.user,
        isLive
      });
      const session = await Session.findByPk(question.session_id, {
        attributes: ["session_code"]
      });
      if (session?.session_code) {
        for (const otherId of deactivatedQuestionIds) {
          notifyQuestionChange(session.session_code, buildQuestionDeactivatePayload(otherId));
          notifyAnswerRevealed(session.session_code, otherId, false, []);
          notifyQuestionLeaderboardVisibility(session.session_code, otherId, false);
        }
        if (!isLive) {
          notifyAnswerRevealed(session.session_code, question.question_id, false, []);
          notifyQuestionLeaderboardVisibility(session.session_code, question.question_id, false);
        }
        notifyQuestionChange(
          session.session_code,
          buildQuestionChangePayload(question, isLive)
        );
      }
      return successResponse(
        res,
        { question },
        isLive ? "Question activated" : "Question deactivated",
        200
      );
    } catch (err) {
      return errorResponse(res, err.message, err.statusCode || 500);
    }
  };
}

function setAnswerRevealedState(revealed) {
  return async (req, res) => {
    try {
      const question = await setQuestionAnswerRevealed({
        questionId: Number(req.params.questionId),
        user: req.user,
        revealed
      });
      const session = await Session.findByPk(question.session_id, {
        attributes: ["session_code"]
      });
      if (session?.session_code) {
        const correctOptionIds = revealed ? getCorrectOptionIds(question) : [];
        notifyAnswerRevealed(
          session.session_code,
          question.question_id,
          revealed,
          correctOptionIds
        );
      }
      return successResponse(
        res,
        { question },
        revealed ? "Answer revealed to participants" : "Answer hidden from participants",
        200
      );
    } catch (err) {
      return errorResponse(res, err.message, err.statusCode || 500);
    }
  };
}

function setLeaderboardVisibilityState(visible) {
  return async (req, res) => {
    try {
      const question = await setQuestionLeaderboardVisibility({
        questionId: Number(req.params.questionId),
        user: req.user,
        visible
      });
      const session = await Session.findByPk(question.session_id, {
        attributes: ["session_code"]
      });
      if (session?.session_code) {
        notifyQuestionLeaderboardVisibility(
          session.session_code,
          question.question_id,
          visible
        );
        if (visible) {
          const questionLeaderboard = await buildQuestionLeaderboard(question.question_id);
          if (questionLeaderboard.length) {
            notifyLeaderboard(session.session_code, {
              leaderboard: [],
              question_id: question.question_id,
              question_leaderboard: questionLeaderboard
            });
          }
        }
      }
      return successResponse(
        res,
        { question },
        visible
          ? "Question leaderboard visible to participants"
          : "Question leaderboard hidden from participants",
        200
      );
    } catch (err) {
      return errorResponse(res, err.message, err.statusCode || 500);
    }
  };
}

async function closeQuestion(req, res) {
  try {
    const question = await closeQuestionSubmissions({
      questionId: Number(req.params.questionId),
      user: req.user
    });
    const session = await Session.findByPk(question.session_id, {
      attributes: ["session_code"]
    });
    if (session?.session_code) {
      notifyQuestionChange(session.session_code, buildQuestionChangePayload(question, true));
      notifyQuestionSubmissionsClosed(session.session_code, question);
    }
    return successResponse(res, { question }, "Question closed", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function openForReattempt(req, res) {
  try {
    const { question, deactivatedQuestionIds = [] } = await openQuestionForReattempt({
      questionId: Number(req.params.questionId),
      user: req.user
    });
    const session = await Session.findByPk(question.session_id, {
      attributes: ["session_code"]
    });
    if (session?.session_code) {
      for (const otherId of deactivatedQuestionIds) {
        notifyQuestionChange(session.session_code, buildQuestionDeactivatePayload(otherId));
        notifyAnswerRevealed(session.session_code, otherId, false, []);
        notifyQuestionLeaderboardVisibility(session.session_code, otherId, false);
      }
      notifyQuestionChange(session.session_code, buildQuestionChangePayload(question, true));
      notifyAnswerRevealed(session.session_code, question.question_id, false, []);
      notifyQuestionLeaderboardVisibility(session.session_code, question.question_id, false);
      notifyQuestionReattemptOpened(
        session.session_code,
        question.question_id,
        question.question_text,
        {
          live_activated_at: question.live_activated_at,
          time_limit_seconds: question.time_limit_seconds
        }
      );
    }
    return successResponse(
      res,
      { question },
      "Question opened for reattempt",
      200
    );
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  listBySession,
  listBySessionPublic,
  createForSession,
  previewImport,
  confirmImport,
  detail,
  update,
  remove,
  reorder,
  activate: setLiveState(true),
  deactivate: setLiveState(false),
  revealAnswer: setAnswerRevealedState(true),
  hideAnswer: setAnswerRevealedState(false),
  showLeaderboard: setLeaderboardVisibilityState(true),
  hideLeaderboard: setLeaderboardVisibilityState(false),
  closeQuestion,
  openForReattempt
};
