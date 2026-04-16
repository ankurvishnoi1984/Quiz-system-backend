const {
  registerUser,
  loginUser,
  refreshAccessToken
} = require("../services/auth.service");
const {
  validateLoginPayload,
  validateRegisterPayload
} = require("../validators/auth.validator");
const { successResponse, errorResponse } = require("../utils/response");

async function register(req, res) {
  try {
    const errors = validateRegisterPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const result = await registerUser(req.body);
    return successResponse(res, result, "User registered successfully", 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function login(req, res) {
  try {
    const errors = validateLoginPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const result = await loginUser(req.body);
    return successResponse(res, result, "Login successful", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function me(req, res) {
  return successResponse(res, { user: req.user }, "Current user fetched", 200);
}

async function refresh(req, res) {
  try {
    const refreshToken = req.body?.refresh_token;

    if (!refreshToken) {
      return errorResponse(res, "refresh_token is required", 400);
    }

    const result = await refreshAccessToken(refreshToken);
    return successResponse(res, result, "Access token refreshed", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  register,
  login,
  me,
  refresh
};
