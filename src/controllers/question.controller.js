const { successResponse, errorResponse } = require("../utils/response");
const {
  listSessionQuestions,
  createQuestion,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  setQuestionLiveState
} = require("../services/question.service");
const {
  validateCreateQuestionPayload,
  validateUpdateQuestionPayload,
  validateReorderPayload
} = require("../validators/question.validator");
const { notifyQuestionChange } = require("../services/websocket.service");
const { Session } = require("../models");

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

function setLiveState(isLive) {
  return async (req, res) => {
    try {
      const question = await setQuestionLiveState({
        questionId: Number(req.params.questionId),
        user: req.user,
        isLive
      });
      const session = await Session.findByPk(question.session_id, {
        attributes: ["session_code"]
      });
      if (session?.session_code) {
        notifyQuestionChange(session.session_code, question.question_id, isLive);
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

module.exports = {
  listBySession,
  createForSession,
  detail,
  update,
  remove,
  reorder,
  activate: setLiveState(true),
  deactivate: setLiveState(false)
};
