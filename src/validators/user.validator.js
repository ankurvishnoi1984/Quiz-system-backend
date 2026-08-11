const VALID_ADMIN_CREATED_ROLES = ["client_admin", "dept_admin", "host"];

function validateCreateUserPayload(payload) {
  const errors = [];

  if (!payload?.full_name || typeof payload.full_name !== "string" || !payload.full_name.trim()) {
    errors.push("full_name is required");
  }

  if (!payload?.email || typeof payload.email !== "string" || !payload.email.trim()) {
    errors.push("email is required");
  }

  if (!payload?.password || typeof payload.password !== "string") {
    errors.push("password is required");
  } else if (payload.password.length < 8) {
    errors.push("password must be at least 8 characters");
  }

  if (!payload?.role || !VALID_ADMIN_CREATED_ROLES.includes(payload.role)) {
    errors.push(`role must be one of: ${VALID_ADMIN_CREATED_ROLES.join(", ")}`);
  }

  if (["client_admin", "dept_admin", "host"].includes(payload?.role) && !payload?.client_id) {
    errors.push("client_id is required for the selected role");
  }

  if (["dept_admin", "host"].includes(payload?.role) && !payload?.dept_id) {
    errors.push("dept_id is required for the selected role");
  }

  if (payload?.plan_id != null && payload.plan_id !== "") {
    const planId = Number(payload.plan_id);
    if (!Number.isInteger(planId) || planId <= 0) {
      errors.push("plan_id must be a positive number");
    }
  }

  return errors;
}

function validateExtraParticipantsPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return ["payload must be an object"];
  }

  const hasAdd = payload.add !== undefined;
  const hasSet = payload.set !== undefined;
  if (hasAdd === hasSet) {
    errors.push("provide either add or set");
  }

  if (hasAdd) {
    const add = Number(payload.add);
    if (!Number.isInteger(add) || add === 0) {
      errors.push("add must be a non-zero whole number");
    }
  }

  if (hasSet) {
    const set = Number(payload.set);
    if (!Number.isInteger(set) || set < 0) {
      errors.push("set must be a whole number of 0 or more");
    }
  }

  if (
    payload.note != null &&
    payload.note !== "" &&
    typeof payload.note !== "string"
  ) {
    errors.push("note must be a string");
  }

  return errors;
}

function validateUserStatusPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return ["payload must be an object"];
  }
  if (typeof payload.is_active !== "boolean") {
    return ["is_active must be a boolean"];
  }
  return [];
}

module.exports = {
  validateCreateUserPayload,
  validateExtraParticipantsPayload,
  validateUserStatusPayload,
  VALID_ADMIN_CREATED_ROLES
};
