const { successResponse, errorResponse } = require("../utils/response");
const {
  submitResponse,
  getQuestionResults,
  getSessionResponses,
  getSessionSummary,
  exportSessionResponsesCsv,
  listParticipantQuestionsService
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
    const response = await submitResponse({
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
    return successResponse(res, { response }, "Response submitted", 201);
  } catch (err) {
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

module.exports = {
  submit,
  questionResults,
  sessionResponses,
  sessionSummary,
  sessionExport,
  listParticipantQuestions
};
