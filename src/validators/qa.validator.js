function validateAskPayload(payload) {
  const errors = [];
  if (!payload?.question_text || typeof payload.question_text !== "string") {
    errors.push("question_text is required");
  } else if (payload.question_text.trim().length > 500) {
    errors.push("question_text must be at most 500 characters");
  }
  return errors;
}

module.exports = {
  validateAskPayload
};
