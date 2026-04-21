const { successResponse, errorResponse } = require("../utils/response");
const {
  listQaQuestionsForStaff,
  listQaQuestionsForParticipant,
  askQuestion,
  upvoteQuestion,
  removeUpvote,
  moderateQuestion
} = require("../services/qa.service");
const { validateAskPayload } = require("../validators/qa.validator");

async function listQuestions(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const questions = req.user
      ? await listQaQuestionsForStaff({ sessionId, user: req.user })
      : await listQaQuestionsForParticipant({ sessionId, participant: req.participant });
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

async function ask(req, res) {
  try {
    const errors = validateAskPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }
    const qaQuestion = await askQuestion({
      sessionId: Number(req.params.sessionId),
      participant: req.participant,
      input: req.body
    });
    return successResponse(res, { qa_question: qaQuestion }, "Question submitted", 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function upvote(req, res) {
  try {
    const qaQuestion = await upvoteQuestion({
      qaId: Number(req.params.qaId),
      participant: req.participant
    });
    return successResponse(res, { qa_question: qaQuestion }, "Question upvoted", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function unvote(req, res) {
  try {
    const qaQuestion = await removeUpvote({
      qaId: Number(req.params.qaId),
      participant: req.participant
    });
    return successResponse(res, { qa_question: qaQuestion }, "Upvote removed", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

function staffAction(action, message) {
  return async (req, res) => {
    try {
      const qaQuestion = await moderateQuestion({
        qaId: Number(req.params.qaId),
        action,
        user: req.user,
        isPinned: req.body?.is_pinned
      });
      return successResponse(res, { qa_question: qaQuestion }, message, 200);
    } catch (err) {
      return errorResponse(res, err.message, err.statusCode || 500);
    }
  };
}

module.exports = {
  listQuestions,
  ask,
  upvote,
  unvote,
  approve: staffAction("approve", "Question approved"),
  reject: staffAction("reject", "Question rejected"),
  answer: staffAction("answer", "Question marked as answered"),
  pin: staffAction("pin", "Question pin state updated")
};
