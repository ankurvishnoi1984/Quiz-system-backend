const { successResponse, errorResponse } = require("../utils/response");
const { generateQuestionsWithCursor, ALLOWED_UI_TYPES } = require("../services/ai-question.service");

async function generateQuestions(req, res) {
  try {
    const data = await generateQuestionsWithCursor({
      topic: req.body?.topic,
      count: req.body?.count,
      questionType: req.body?.question_type || req.body?.questionType,
      difficulty: req.body?.difficulty
    });
    return successResponse(res, data, "Questions generated", 200);
  } catch (err) {
    return errorResponse(
      res,
      err.message || "Unable to generate questions",
      err.statusCode || 500,
      err.details || null
    );
  }
}

function listSupportedTypes(_req, res) {
  return successResponse(
    res,
    { question_types: ALLOWED_UI_TYPES },
    "Supported AI question types",
    200
  );
}

module.exports = {
  generateQuestions,
  listSupportedTypes
};
