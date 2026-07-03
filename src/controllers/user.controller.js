const { successResponse, errorResponse } = require("../utils/response");
const { listUsers, createUserByAdmin } = require("../services/user.service");
const { validateCreateUserPayload } = require("../validators/user.validator");

async function list(req, res) {
  try {
    const users = await listUsers();
    return successResponse(res, { users }, "Users fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function create(req, res) {
  try {
    const errors = validateCreateUserPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const result = await createUserByAdmin(req.body, req.user);
    const message = result.email_sent
      ? "User created and welcome email sent"
      : "User created, but welcome email could not be sent";

    return successResponse(res, result, message, 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  list,
  create
};
