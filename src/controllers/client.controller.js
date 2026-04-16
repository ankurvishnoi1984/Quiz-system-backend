const { successResponse, errorResponse } = require("../utils/response");
const {
  createClient,
  getClients,
  getClientById
} = require("../services/client.service");
const { validateCreateClientPayload } = require("../validators/client.validator");

async function create(req, res) {
  try {
    const errors = validateCreateClientPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const client = await createClient(req.body);
    return successResponse(res, { client }, "Client created successfully", 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function list(req, res) {
  try {
    const clients = await getClients();
    return successResponse(res, { clients }, "Clients fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function detail(req, res) {
  try {
    const client = await getClientById(req.params.clientId);
    return successResponse(res, { client }, "Client fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  create,
  list,
  detail
};
