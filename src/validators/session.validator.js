function validateScheduledDate(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return "scheduled_date must be a valid date (YYYY-MM-DD)";
  }
  return null;
}

function validateScheduledTime(value) {
  if (value == null || value === "") return null;
  const trimmed = String(value).trim();
  // Accept HH:mm or HH:mm:ss (MySQL TIME / some browsers).
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return "scheduled_time must be a valid time (HH:mm)";
  }
  const [hours, minutes, seconds = 0] = trimmed.split(":").map(Number);
  if (hours > 23 || minutes > 59 || seconds > 59) {
    return "scheduled_time must be a valid time (HH:mm)";
  }
  return null;
}

function validateAutoEndFields(payload, { requireFuture = true } = {}) {
  const errors = [];
  const enabled = Boolean(payload?.auto_end_enabled);
  if (!enabled) return errors;

  const dateError = validateScheduledDate(payload?.auto_end_date);
  if (dateError) {
    errors.push(dateError.replace("scheduled_date", "auto_end_date"));
  } else if (!payload?.auto_end_date) {
    errors.push("auto_end_date is required when automatic end is enabled");
  }

  const timeError = validateScheduledTime(payload?.auto_end_time);
  if (timeError) {
    errors.push(timeError.replace("scheduled_time", "auto_end_time"));
  } else if (!payload?.auto_end_time) {
    errors.push("auto_end_time is required when automatic end is enabled");
  }

  if (errors.length) return errors;

  const { buildSessionDateTime, buildScheduledStartAt } = require("../utils/sessionDateTime");
  const endAt = buildSessionDateTime(payload.auto_end_date, payload.auto_end_time);
  if (!endAt || Number.isNaN(endAt.getTime())) {
    errors.push("auto end date and time must be valid");
    return errors;
  }

  // Future check is enforced on create; updates may re-save an existing past end.
  if (requireFuture && endAt.getTime() <= Date.now()) {
    errors.push("automatic end must be scheduled in the future");
  }

  const startAt = buildScheduledStartAt(payload);
  if (startAt && !Number.isNaN(startAt.getTime()) && endAt.getTime() <= startAt.getTime()) {
    errors.push("automatic end must be after the planned session start");
  }

  return errors;
}

const QUIZ_TOTAL_TIME_MINUTES = [15, 30, 45, 60];

function validateQuizTotalTimeMinutes(payload) {
  if (payload?.quiz_total_time_minutes == null || payload?.quiz_total_time_minutes === "") {
    return null;
  }
  const minutes = Number(payload.quiz_total_time_minutes);
  if (!QUIZ_TOTAL_TIME_MINUTES.includes(minutes)) {
    return "quiz_total_time_minutes must be 15, 30, 45, or 60";
  }
  if (payload.participant_navigation_enabled === false) {
    return "quiz_total_time_minutes requires multiple active questions";
  }
  return null;
}

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

  if (
    payload?.participant_navigation_enabled !== undefined &&
    typeof payload.participant_navigation_enabled !== "boolean"
  ) {
    errors.push("participant_navigation_enabled must be a boolean");
  }

  const scheduledDateError = validateScheduledDate(payload?.scheduled_date);
  if (scheduledDateError) errors.push(scheduledDateError);

  const scheduledTimeError = validateScheduledTime(payload?.scheduled_time);
  if (scheduledTimeError) errors.push(scheduledTimeError);

  if (payload?.logo_url !== undefined && payload.logo_url !== null && payload.logo_url !== "") {
    if (typeof payload.logo_url !== "string" || payload.logo_url.trim().length === 0) {
      errors.push("logo_url must be a non-empty string or null");
    }
  }

  const quizTotalTimeError = validateQuizTotalTimeMinutes(payload);
  if (quizTotalTimeError) errors.push(quizTotalTimeError);

  errors.push(...validateAutoEndFields(payload));

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
    "leaderboard_enabled",
    "survey_results_enabled",
    "show_question_leaderboard",
    "participant_navigation_enabled",
    "quiz_total_time_minutes",
    "join_type",
    "scheduled_date",
    "scheduled_time",
    "auto_end_enabled",
    "auto_end_date",
    "auto_end_time",
    "logo_url"
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

  if (
    payload?.join_type !== undefined &&
    !["name", "anonymous", "name_email"].includes(payload.join_type)
  ) {
    errors.push("join_type must be one of: name, anonymous, name_email");
  }

  const scheduledDateError = validateScheduledDate(payload?.scheduled_date);
  if (scheduledDateError) errors.push(scheduledDateError);

  const scheduledTimeError = validateScheduledTime(payload?.scheduled_time);
  if (scheduledTimeError) errors.push(scheduledTimeError);

  if (payload?.logo_url !== undefined && payload.logo_url !== null && payload.logo_url !== "") {
    if (typeof payload.logo_url !== "string" || payload.logo_url.trim().length === 0) {
      errors.push("logo_url must be a non-empty string or null");
    }
  }

  const quizTotalTimeError = validateQuizTotalTimeMinutes(payload);
  if (quizTotalTimeError) errors.push(quizTotalTimeError);

  if (payload?.auto_end_enabled !== undefined) {
    errors.push(...validateAutoEndFields(payload, { requireFuture: false }));
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
