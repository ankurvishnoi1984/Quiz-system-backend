function validateCreateQuestionPayload(payload) {
  const errors = [];

  if (!payload?.question_type || typeof payload.question_type !== "string") {
    errors.push("question_type is required");
  }

  if (!payload?.question_text || typeof payload.question_text !== "string") {
    errors.push("question_text is required");
  }

  if (payload?.question_type === "mcq") {
    if (!Array.isArray(payload.options) || payload.options.length < 2) {
      errors.push("mcq options must include at least 2 entries");
    }
  }

  if (payload?.question_type === "true_false") {
    if (!Array.isArray(payload.options) || payload.options.length !== 2) {
      errors.push("true_false must include exactly 2 options (True and False)");
    } else if (payload.is_quiz_mode) {
      const correctCount = payload.options.filter((o) => o && o.is_correct).length;
      if (correctCount !== 1) {
        errors.push("true_false must have exactly one correct option");
      }
    }
  }

  if (payload?.question_type === "ranking") {
    if (!Array.isArray(payload.options) || payload.options.length < 2) {
      errors.push("ranking options must include at least 2 entries");
    } else if (payload.options.length > 10) {
      errors.push("ranking options cannot exceed 10 entries");
    }
  }

  return errors;
}

function validateUpdateQuestionPayload(payload) {
  if (!payload || typeof payload !== "object" || Object.keys(payload).length === 0) {
    return ["at least one field is required"];
  }
  return [];
}

function validateReorderPayload(payload) {
  const errors = [];
  if (!Array.isArray(payload?.orderedIds) || payload.orderedIds.length === 0) {
    errors.push("orderedIds must be a non-empty array");
  }
  return errors;
}

module.exports = {
  validateCreateQuestionPayload,
  validateUpdateQuestionPayload,
  validateReorderPayload
};
