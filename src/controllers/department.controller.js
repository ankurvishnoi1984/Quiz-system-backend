const { successResponse, errorResponse } = require("../utils/response");
const {
  createDepartment,
  getDepartments,
  getDepartmentById
} = require("../services/department.service");
const { getDepartmentReport } = require("../services/department-report.service");
const {
  validateCreateDepartmentPayload
} = require("../validators/department.validator");

async function create(req, res) {
  try {
    const errors = validateCreateDepartmentPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const department = await createDepartment({
      ...req.body,
      client_id: Number(req.body.client_id)
    });

    return successResponse(res, { department }, "Department created successfully", 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function list(req, res) {
  try {
    const user = req.user;
    let clientId = req.query.client_id ? Number(req.query.client_id) : null;

    if (user.role === "client_admin") {
      if (!user.client_id) {
        return errorResponse(res, "Client admin has no client assigned", 403);
      }
      clientId = Number(user.client_id);
    } else if (["dept_admin", "host"].includes(user.role) && user.dept_id) {
      const department = await getDepartmentById(user.dept_id);
      clientId = Number(department.client_id);
    }

    const departments = await getDepartments({
      client_id: clientId
    });
    return successResponse(res, { departments }, "Departments fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function report(req, res) {
  try {
    const deptId = Number(req.params.departmentId);
    if (Number.isNaN(deptId)) return errorResponse(res, "departmentId must be a number", 400);

    const reportData = await getDepartmentReport({
      deptId,
      user: req.user,
      from: req.query.from,
      to: req.query.to
    });

    return successResponse(res, { report: reportData }, "Department report fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function detail(req, res) {
  try {
    const department = await getDepartmentById(req.params.departmentId);
    return successResponse(res, { department }, "Department fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  create,
  list,
  detail,
  report
};
