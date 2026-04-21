function validateMediaUploadPayload(payload) {
  const errors = [];
  if (!payload || Number.isNaN(Number(payload.dept_id))) {
    errors.push("dept_id must be a number");
  }
  return errors;
}

module.exports = {
  validateMediaUploadPayload
};
