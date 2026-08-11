const { successResponse, errorResponse } = require("../utils/response");
const {
  listQuestionSets,
  createQuestionSet,
  updateQuestionSet,
  deleteQuestionSet
} = require("../services/question-set.service");

async function list(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const sets = await listQuestionSets({ sessionId, user: req.user });
    return successResponse(res, { sets }, "Question sets fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function create(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const set = await createQuestionSet({
      sessionId,
      user: req.user,
      name: req.body?.name
    });
    return successResponse(res, { set }, "Question set created", 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function update(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const setId = Number(req.params.setId);
    const set = await updateQuestionSet({
      sessionId,
      setId,
      user: req.user,
      name: req.body?.name
    });
    return successResponse(res, { set }, "Question set updated", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function remove(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    const setId = Number(req.params.setId);
    const data = await deleteQuestionSet({
      sessionId,
      setId,
      user: req.user
    });
    return successResponse(res, data, "Question set deleted", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  list,
  create,
  update,
  remove
};
