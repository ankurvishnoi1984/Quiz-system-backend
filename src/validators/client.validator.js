function validateCreateClientPayload(payload) {
  const errors = [];

  if (!payload?.name || typeof payload.name !== "string") {
    errors.push("name is required");
  }

  if (!payload?.slug || typeof payload.slug !== "string") {
    errors.push("slug is required");
  }

  if (!payload?.contact_email || typeof payload.contact_email !== "string") {
    errors.push("contact_email is required");
  }

  return errors;
}

module.exports = {
  validateCreateClientPayload
};
