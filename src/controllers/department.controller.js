const { successResponse, errorResponse } = require("../utils/response");
const {
  createDepartment,
  getDepartments,
  getDepartmentById
} = require("../services/department.service");
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
    const clientId = req.query.client_id ? Number(req.query.client_id) : null;
    const departments = await getDepartments({
      client_id: clientId
    });
    return successResponse(res, { departments }, "Departments fetched", 200);
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
  detail
};
