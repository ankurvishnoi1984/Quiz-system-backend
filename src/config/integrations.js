/**
 * Platform integrations (PowerPoint / Teams / Zoom / Google Slides embeds).
 *
 * When disabled, core quiz flows (join, live, present mode, view-display JWT links,
 * share link/QR/code) behave as they did before Phase 0. Embed routes, opaque tokens,
 * and frame-ancestors CSP are skipped.
 *
 * Set INTEGRATIONS_ENABLED=false (or 0 / off / no) to turn the feature off without
 * deleting code. See docs/INTEGRATIONS.md § Rollback.
 */
function parseFlag(value, defaultValue = true) {
  if (value == null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["0", "false", "off", "no", "disabled"].includes(normalized)) return false;
  if (["1", "true", "on", "yes", "enabled"].includes(normalized)) return true;
  return defaultValue;
}

function isIntegrationsEnabled() {
  return parseFlag(process.env.INTEGRATIONS_ENABLED, true);
}

module.exports = {
  isIntegrationsEnabled,
  parseFlag
};
