function validateSubmitResponsePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return ["payload is required"];
  }
  if (Number.isNaN(Number(payload.question_id))) {
    errors.push("question_id must be a number");
  }
  if (payload.option_ids != null) {
    if (!Array.isArray(payload.option_ids) || payload.option_ids.length < 1) {
      errors.push("option_ids must be a non-empty array");
    } else {
      const ids = payload.option_ids.map(Number);
      if (ids.some((id) => Number.isNaN(id) || id <= 0)) {
        errors.push("option_ids must include only numeric option ids");
      }
      if (new Set(ids).size !== ids.length) {
        errors.push("option_ids cannot include duplicate option ids");
      }
    }
  }
  if (payload.ranking_order != null) {
    if (!Array.isArray(payload.ranking_order) || payload.ranking_order.length < 2) {
      errors.push("ranking_order must be an array with at least 2 option ids");
    } else {
      const ids = payload.ranking_order.map(Number);
      if (ids.some((id) => Number.isNaN(id) || id <= 0)) {
        errors.push("ranking_order must include only numeric option ids");
      }
      if (new Set(ids).size !== ids.length) {
        errors.push("ranking_order cannot include duplicate option ids");
      }
    }
  }
  return errors;
}

module.exports = {
  validateSubmitResponsePayload
};
