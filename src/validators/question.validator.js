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

  if (payload?.question_type === "poll") {
    if (!Array.isArray(payload.options) || payload.options.length < 2) {
      errors.push("poll options must include at least 2 entries");
    }
  }

  if (payload?.question_type === "emoji_reaction") {
    if (!Array.isArray(payload.options) || payload.options.length !== 5) {
      errors.push("emoji_reaction must include exactly 5 emoji options");
    }
    if (payload?.is_quiz_mode) {
      errors.push("emoji_reaction cannot be quiz mode");
    }
    if (payload?.allow_multiple_select) {
      errors.push("emoji_reaction does not support multiple selection");
    }
  }

  if (payload?.question_type === "survey") {
    const allowed = [
      "mcq",
      "poll",
      "rating",
      "open_text",
      "word_cloud",
      "ranking",
      "true_false",
      "emoji_reaction"
    ];
    if (!payload?.survey_subtype || !allowed.includes(payload.survey_subtype)) {
      errors.push("survey must include a valid survey_subtype");
    }
    if (payload.survey_subtype === "mcq" || payload.survey_subtype === "poll") {
      if (!Array.isArray(payload.options) || payload.options.length < 2) {
        errors.push("survey mcq/poll options must include at least 2 entries");
      }
    }
    if (payload.survey_subtype === "ranking") {
      if (!Array.isArray(payload.options) || payload.options.length < 2) {
        errors.push("survey ranking options must include at least 2 entries");
      } else if (payload.options.length > 10) {
        errors.push("survey ranking options cannot exceed 10 entries");
      }
    }
    if (payload.survey_subtype === "true_false") {
      if (!Array.isArray(payload.options) || payload.options.length !== 2) {
        errors.push("survey true_false must include exactly 2 options (True and False)");
      }
    }
    if (payload.survey_subtype === "emoji_reaction") {
      if (!Array.isArray(payload.options) || payload.options.length !== 5) {
        errors.push("survey emoji_reaction must include exactly 5 emoji options");
      }
      if (payload?.allow_multiple_select) {
        errors.push("survey emoji_reaction does not support multiple selection");
      }
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
