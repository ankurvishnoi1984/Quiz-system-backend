function parsePlanId(value) {
  if (value == null || value === "") return null;
  const planId = Number(value);
  if (!Number.isInteger(planId) || planId <= 0) return NaN;
  return planId;
}

function validateCreatePlanPayload(payload) {
  const errors = [];

  if (!payload?.name || typeof payload.name !== "string" || !payload.name.trim()) {
    errors.push("name is required");
  }

  const maxParticipants = Number(payload?.max_participants);
  if (!Number.isInteger(maxParticipants) || maxParticipants <= 0) {
    errors.push("max_participants must be a positive whole number");
  }

  if (
    payload?.description != null &&
    payload.description !== "" &&
    typeof payload.description !== "string"
  ) {
    errors.push("description must be a string");
  }

  if (payload?.is_active !== undefined && typeof payload.is_active !== "boolean") {
    errors.push("is_active must be a boolean");
  }

  return errors;
}

function validateUpdatePlanPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    return ["payload must be an object"];
  }

  const keys = Object.keys(payload);
  if (!keys.length) {
    errors.push("at least one field is required");
  }

  const allowed = ["name", "description", "max_participants", "is_active"];
  const invalid = keys.filter((key) => !allowed.includes(key));
  if (invalid.length) {
    errors.push(`invalid fields: ${invalid.join(", ")}`);
  }

  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      errors.push("name must be a non-empty string");
    }
  }

  if (payload.max_participants !== undefined) {
    const maxParticipants = Number(payload.max_participants);
    if (!Number.isInteger(maxParticipants) || maxParticipants <= 0) {
      errors.push("max_participants must be a positive whole number");
    }
  }

  if (
    payload.description !== undefined &&
    payload.description !== null &&
    payload.description !== "" &&
    typeof payload.description !== "string"
  ) {
    errors.push("description must be a string or null");
  }

  if (payload.is_active !== undefined && typeof payload.is_active !== "boolean") {
    errors.push("is_active must be a boolean");
  }

  return errors;
}

function validateAssignPlanPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return ["payload must be an object"];
  }

  if (payload.plan_id === undefined) {
    errors.push("plan_id is required");
    return errors;
  }

  if (payload.plan_id === null || payload.plan_id === "") {
    return errors;
  }

  const planId = parsePlanId(payload.plan_id);
  if (Number.isNaN(planId)) {
    errors.push("plan_id must be a positive number or null");
  }

  return errors;
}

module.exports = {
  parsePlanId,
  validateCreatePlanPayload,
  validateUpdatePlanPayload,
  validateAssignPlanPayload
};
