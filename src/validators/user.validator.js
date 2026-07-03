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

  return errors;
}

module.exports = {
  validateCreateUserPayload,
  VALID_ADMIN_CREATED_ROLES
};
