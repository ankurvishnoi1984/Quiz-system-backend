const VALID_ROLES = ["super_admin", "client_admin", "dept_admin", "host"];

function validateRegisterPayload(payload) {
  const errors = [];

  if (!payload?.full_name || typeof payload.full_name !== "string") {
    errors.push("full_name is required");
  }

  if (!payload?.email || typeof payload.email !== "string") {
    errors.push("email is required");
  }

  if (!payload?.password || typeof payload.password !== "string") {
    errors.push("password is required");
  } else if (payload.password.length < 8) {
    errors.push("password must be at least 8 characters");
  }

  if (!payload?.role || !VALID_ROLES.includes(payload.role)) {
    errors.push(`role must be one of: ${VALID_ROLES.join(", ")}`);
  }

  return errors;
}

function validateLoginPayload(payload) {
  const errors = [];

  if (!payload?.email || typeof payload.email !== "string") {
    errors.push("email is required");
  }

  if (!payload?.password || typeof payload.password !== "string") {
    errors.push("password is required");
  }

  return errors;
}

function validateForgotPasswordPayload(payload) {
  const errors = [];

  if (!payload?.email || typeof payload.email !== "string" || !payload.email.trim()) {
    errors.push("email is required");
  }

  return errors;
}

function validateChangePasswordPayload(payload, { mustChangePassword = false } = {}) {
  const errors = [];

  if (!mustChangePassword) {
    if (!payload?.current_password || typeof payload.current_password !== "string") {
      errors.push("current_password is required");
    }
  }

  if (!payload?.new_password || typeof payload.new_password !== "string") {
    errors.push("new_password is required");
  } else if (payload.new_password.length < 8) {
    errors.push("new_password must be at least 8 characters");
  }

  return errors;
}

module.exports = {
  validateRegisterPayload,
  validateLoginPayload,
  validateForgotPasswordPayload,
  validateChangePasswordPayload
};
