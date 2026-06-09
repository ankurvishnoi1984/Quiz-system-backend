const { successResponse, errorResponse } = require("../utils/response");
const { listUsers } = require("../services/user.service");

async function list(req, res) {
  try {
    const users = await listUsers();
    return successResponse(res, { users }, "Users fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  list,
};
