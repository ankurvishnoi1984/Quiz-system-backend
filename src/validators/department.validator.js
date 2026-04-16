function validateCreateDepartmentPayload(payload) {
  const errors = [];

  if (!payload?.client_id || Number.isNaN(Number(payload.client_id))) {
    errors.push("client_id is required and must be numeric");
  }

  if (!payload?.name || typeof payload.name !== "string") {
    errors.push("name is required");
  }

  if (!payload?.slug || typeof payload.slug !== "string") {
    errors.push("slug is required");
  }

  return errors;
}

module.exports = {
  validateCreateDepartmentPayload
};
