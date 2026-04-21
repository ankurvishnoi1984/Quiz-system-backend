function validateSubmitResponsePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return ["payload is required"];
  }
  if (Number.isNaN(Number(payload.question_id))) {
    errors.push("question_id must be a number");
  }
  return errors;
}

module.exports = {
  validateSubmitResponsePayload
};
