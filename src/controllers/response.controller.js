const { successResponse, errorResponse } = require("../utils/response");
const {
  submitResponse,
  getQuestionResults,
  getSessionResponses,
  getSessionSummary,
  exportSessionResponsesCsv,
  listParticipantQuestionsService,
  getParticipantSessionLeaderboard,
  getSessionLeaderboardForStaff,
  getParticipantSurveyQuestionResults,
  getParticipantSessionSurveySummary,
  getSessionSurveySummaryForStaff
} = require("../services/response.service");
const { validateSubmitResponsePayload } = require("../validators/response.validator");
const { broadcastResponse, notifySessionProgress } = require("../services/websocket.service");
const { Session } = require("../models");

async function submit(req, res) {
  try {
    const errors = validateSubmitResponsePayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }
    const { response, created } = await submitResponse({
      participant: req.participant,
      input: req.body
    });
    const session = await Session.findByPk(response.session_id, { attributes: ["session_code"] });
    if (session) {
      broadcastResponse({
        sessionCode: session.session_code,
        sessionId: response.session_id,
        response
      });
      notifySessionProgress(session.session_code, response.session_id).catch(() => {});
    }
    const statusCode = created ? 201 : 200;
    const message = created ? "Response submitted" : "Response updated";
    return successResponse(res, { response }, message, statusCode);
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return errorResponse(
        res,
        "Could not save multiple selections for this question. Run the latest database migration to enable multi-select responses.",
        409
      );
    }
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function questionResults(req, res) {
  try {
    const results = await getQuestionResults({
      questionId: Number(req.params.questionId),
      user: req.user
    });
    return successResponse(res, { results }, "Question results fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function sessionResponses(req, res) {
  try {
    const responses = await getSessionResponses({
      sessionId: Number(req.params.sessionId),
      user: req.user
    });
    return successResponse(res, { responses }, "Session responses fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function sessionSummary(req, res) {
  try {
    const summary = await getSessionSummary({
      sessionId: Number(req.params.sessionId),
      user: req.user
    });
    return successResponse(res, { summary }, "Session summary fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function sessionExport(req, res) {
  try {
    const csv = await exportSessionResponsesCsv({
      sessionId: Number(req.params.sessionId),
      user: req.user
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="session-${Number(req.params.sessionId)}-responses.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function listParticipantQuestions(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }

    const questions = await listParticipantQuestionsService({
      sessionId,
      participant: req.participant
    });
    return successResponse(res, { questions }, "Questions fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function participantSessionLeaderboard(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }

    const leaderboard = await getParticipantSessionLeaderboard({
      sessionId,
      participant: req.participant
    });
    return successResponse(res, { leaderboard }, "Leaderboard fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function sessionLeaderboard(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }

    const limit = Number(req.query.limit);
    const leaderboard = await getSessionLeaderboardForStaff({
      sessionId,
      user: req.user,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 10
    });
    return successResponse(res, { leaderboard }, "Leaderboard fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function participantSurveyQuestionResults(req, res) {
  try {
    const questionId = Number(req.params.questionId);
    if (Number.isNaN(questionId)) {
      return errorResponse(res, "questionId must be a number", 400);
    }

    const results = await getParticipantSurveyQuestionResults({
      questionId,
      participant: req.participant
    });
    return successResponse(res, { results }, "Survey results fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function participantSessionSurveySummary(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }

    const summary = await getParticipantSessionSurveySummary({
      sessionId,
      participant: req.participant
    });
    return successResponse(res, summary, "Survey summary fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function sessionSurveySummary(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) {
      return errorResponse(res, "sessionId must be a number", 400);
    }

    const summary = await getSessionSurveySummaryForStaff({
      sessionId,
      user: req.user
    });
    return successResponse(res, summary, "Survey summary fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  submit,
  questionResults,
  sessionResponses,
  sessionSummary,
  sessionExport,
  listParticipantQuestions,
  participantSessionLeaderboard,
  sessionLeaderboard,
  participantSurveyQuestionResults,
  participantSessionSurveySummary,
  sessionSurveySummary
};
