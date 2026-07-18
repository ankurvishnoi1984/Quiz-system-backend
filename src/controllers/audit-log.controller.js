const { successResponse, errorResponse } = require("../utils/response");
const { listAuditLogs } = require("../services/audit-log.service");

const ALLOWED_ACTIONS = new Set(["create", "update", "delete"]);
const ALLOWED_ACTOR_TYPES = new Set([
  "user",
  "participant",
  "presenter_viewer",
  "system",
  "anonymous"
]);

async function list(req, res) {
  try {
    if (req.query.action && !ALLOWED_ACTIONS.has(req.query.action)) {
      return errorResponse(res, "Invalid audit action", 400);
    }
    if (req.query.actor_type && !ALLOWED_ACTOR_TYPES.has(req.query.actor_type)) {
      return errorResponse(res, "Invalid actor type", 400);
    }
    if (req.query.from && Number.isNaN(Date.parse(req.query.from))) {
      return errorResponse(res, "Invalid from date", 400);
    }
    if (req.query.to && Number.isNaN(Date.parse(req.query.to))) {
      return errorResponse(res, "Invalid to date", 400);
    }

    const result = await listAuditLogs(req.query);
    return successResponse(res, result, "Audit logs fetched", 200);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = { list };
