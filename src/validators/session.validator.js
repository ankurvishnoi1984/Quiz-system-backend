function validateCreateSessionPayload(payload) {
  const errors = [];

  if (!payload?.title || typeof payload.title !== "string") {
    errors.push("title is required");
  }

  if (!payload?.host_id || Number.isNaN(Number(payload.host_id))) {
    errors.push("host_id is required");
  }

  if (
    payload?.max_participants !== undefined &&
    (Number.isNaN(Number(payload.max_participants)) ||
      Number(payload.max_participants) <= 0)
  ) {
    errors.push("max_participants must be a positive number");
  }

  if (
    payload?.join_type !== undefined &&
    !['name', 'anonymous', 'name_email'].includes(payload.join_type)
  ) {
    errors.push("join_type must be one of: name, anonymous, name_email");
  }

  return errors;
}

function validateUpdateSessionPayload(payload) {
  const errors = [];
  const allowedFields = [
    "title",
    "description",
    "is_anonymous_default",
    "max_participants",
    "show_results_to_participants",
    "allow_late_join",
    "leaderboard_enabled"
  ];

  if (!payload || typeof payload !== "object") {
    return ["payload must be an object"];
  }

  const incoming = Object.keys(payload);
  if (incoming.length === 0) {
    errors.push("at least one field is required");
  }

  const invalidFields = incoming.filter((key) => !allowedFields.includes(key));
  if (invalidFields.length > 0) {
    errors.push(`invalid fields: ${invalidFields.join(", ")}`);
  }

  if (
    payload.max_participants !== undefined &&
    (Number.isNaN(Number(payload.max_participants)) ||
      Number(payload.max_participants) <= 0)
  ) {
    errors.push("max_participants must be a positive number");
  }

  return errors;
}

function validateJoinSessionPayload(payload) {
  const errors = [];

  if (
    payload?.nickname !== undefined &&
    (typeof payload.nickname !== "string" || payload.nickname.trim().length === 0)
  ) {
    errors.push("nickname must be a non-empty string when provided");
  }

  if (
    payload?.email !== null &&
    (typeof payload.email !== "string" || payload.email.trim().length === 0)
  ) {
    errors.push("email must be a non-empty string when provided",payload.email);
  }

  if (
    payload?.force_new_participant !== undefined &&
    typeof payload.force_new_participant !== "boolean"
  ) {
    errors.push("force_new_participant must be a boolean when provided");
  }

  return errors;
}

module.exports = {
  validateCreateSessionPayload,
  validateUpdateSessionPayload,
  validateJoinSessionPayload
};
