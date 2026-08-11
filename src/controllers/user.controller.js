const { successResponse, errorResponse } = require("../utils/response");
const {
  listUsers,
  createUserByAdmin,
  assignUserPlan,
  listUserParticipantAddons,
  adjustUserExtraParticipants,
  setUserActiveStatus
} = require("../services/user.service");
const {
  validateCreateUserPayload,
  validateExtraParticipantsPayload,
  validateUserStatusPayload
} = require("../validators/user.validator");
const { validateAssignPlanPayload } = require("../validators/plan.validator");

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

async function assignPlan(req, res) {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) {
      return errorResponse(res, "userId must be a number", 400);
    }

    const errors = validateAssignPlanPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const user = await assignUserPlan({
      userId,
      planId: req.body.plan_id
    });
    return successResponse(res, { user }, "User plan updated", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function listAddons(req, res) {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) {
      return errorResponse(res, "userId must be a number", 400);
    }

    const addons = await listUserParticipantAddons(userId);
    return successResponse(res, { addons }, "Extra seats history fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function adjustExtraParticipants(req, res) {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) {
      return errorResponse(res, "userId must be a number", 400);
    }

    const errors = validateExtraParticipantsPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const user = await adjustUserExtraParticipants({
      userId,
      add: req.body.add,
      set: req.body.set,
      note: req.body.note,
      adminUser: req.user
    });
    return successResponse(res, { user }, "Extra participants updated", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function setStatus(req, res) {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) {
      return errorResponse(res, "userId must be a number", 400);
    }

    const errors = validateUserStatusPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const user = await setUserActiveStatus({
      userId,
      isActive: req.body.is_active,
      adminUser: req.user
    });
    return successResponse(
      res,
      { user },
      user.is_active ? "User activated" : "User deactivated",
      200
    );
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  list,
  create,
  assignPlan,
  listAddons,
  adjustExtraParticipants,
  setStatus
};
