const { successResponse, errorResponse } = require("../utils/response");
const {
  getDepartmentOverview,
  getDepartmentSessionsAnalytics,
  getClientOverview,
  getDepartmentExport,
  getSessionReport
} = require("../services/analytics.service");

async function departmentOverview(req, res) {
  try {
    const deptId = Number(req.params.deptId);
    if (Number.isNaN(deptId)) return errorResponse(res, "deptId must be a number", 400);
    const overview = await getDepartmentOverview({ deptId, user: req.user });
    return successResponse(res, { overview }, "Department overview fetched", 200);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function departmentSessions(req, res) {
  try {
    const deptId = Number(req.params.deptId);
    if (Number.isNaN(deptId)) return errorResponse(res, "deptId must be a number", 400);
    const sessions = await getDepartmentSessionsAnalytics({ deptId, user: req.user });
    return successResponse(res, { sessions }, "Department session analytics fetched", 200);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function clientOverview(req, res) {
  try {
    const clientId = Number(req.params.clientId);
    if (Number.isNaN(clientId)) return errorResponse(res, "clientId must be a number", 400);
    const overview = await getClientOverview({ clientId, user: req.user });
    return successResponse(res, { overview }, "Client overview fetched", 200);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function departmentExport(req, res) {
  try {
    const deptId = Number(req.params.deptId);
    if (Number.isNaN(deptId)) return errorResponse(res, "deptId must be a number", 400);

    const csv = await getDepartmentExport({ deptId, user: req.user });
    const exportType = String(req.query.type || "csv").toLowerCase();

    if (exportType === "excel" || exportType === "xls") {
      res.setHeader("Content-Type", "application/vnd.ms-excel");
      res.setHeader("Content-Disposition", `attachment; filename="dept-${deptId}-analytics.xls"`);
      return res.status(200).send(csv);
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="dept-${deptId}-analytics.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function sessionReport(req, res) {
  try {
    const sessionId = Number(req.params.sessionId);
    if (Number.isNaN(sessionId)) return errorResponse(res, "sessionId must be a number", 400);
    const report = await getSessionReport({ sessionId, user: req.user });
    return successResponse(res, { report }, "Session report fetched", 200);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = {
  departmentOverview,
  departmentSessions,
  clientOverview,
  departmentExport,
  sessionReport
};
