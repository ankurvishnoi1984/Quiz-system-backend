const { successResponse, errorResponse } = require("../utils/response");
const {
  listPlans,
  createPlan,
  updatePlan,
  getCurrentUserPlanUsage
} = require("../services/plan.service");
const {
  validateCreatePlanPayload,
  validateUpdatePlanPayload
} = require("../validators/plan.validator");

async function list(req, res) {
  try {
    const plans = await listPlans();
    return successResponse(res, { plans }, "Plans fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function create(req, res) {
  try {
    const errors = validateCreatePlanPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const plan = await createPlan(req.body);
    return successResponse(res, { plan }, "Plan created", 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function update(req, res) {
  try {
    const planId = Number(req.params.planId);
    if (Number.isNaN(planId)) {
      return errorResponse(res, "planId must be a number", 400);
    }

    const errors = validateUpdatePlanPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const plan = await updatePlan({ planId, input: req.body });
    return successResponse(res, { plan }, "Plan updated", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function usage(req, res) {
  try {
    const data = await getCurrentUserPlanUsage(req.user.user_id);
    return successResponse(res, { usage: data }, "Plan usage fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  list,
  create,
  update,
  usage
};
