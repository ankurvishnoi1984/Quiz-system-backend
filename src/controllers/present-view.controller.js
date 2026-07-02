const { successResponse, errorResponse } = require("../utils/response");
const {
  getPresentViewSession,
  listPresentViewQuestions,
  listPresentViewResponses,
  getPresentViewQuestionResults,
  listPresentViewParticipants,
  listPresentViewQaQuestions,
  getPresentSlideIndexForViewer
} = require("../services/present-view.service");

async function sessionDetail(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const session = await getPresentViewSession({
      sessionId,
      viewer: req.presenterViewer
    });
    return successResponse(res, { session }, "Session fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function listQuestions(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const questions = await listPresentViewQuestions({
      sessionId,
      viewer: req.presenterViewer
    });
    return successResponse(res, { questions }, "Questions fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function listResponses(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const responses = await listPresentViewResponses({
      sessionId,
      viewer: req.presenterViewer
    });
    return successResponse(res, { responses }, "Session responses fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function questionResults(req, res) {
  try {
    const questionId = Number(req.params.questionId);
    const results = await getPresentViewQuestionResults({
      questionId,
      viewer: req.presenterViewer
    });
    return successResponse(res, { results }, "Question results fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function listParticipants(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const participants = await listPresentViewParticipants({
      sessionId,
      viewer: req.presenterViewer
    });
    return successResponse(res, { participants }, "Participants fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function listQaQuestions(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const questions = await listPresentViewQaQuestions({
      sessionId,
      viewer: req.presenterViewer
    });
    const sanitized = questions.map((item) => {
      const payload = item.toJSON();
      if (payload.is_anonymous && payload.participant) {
        payload.participant.nickname = null;
      }
      return payload;
    });
    return successResponse(res, { questions: sanitized }, "Q&A questions fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function presentSlide(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const state = getPresentSlideIndexForViewer({
      sessionId,
      viewer: req.presenterViewer
    });
    return successResponse(res, state, "Present slide fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  sessionDetail,
  listQuestions,
  listResponses,
  questionResults,
  listParticipants,
  listQaQuestions,
  presentSlide
};
