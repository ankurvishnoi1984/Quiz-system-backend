/**
 * Browsers block a page from loading inside an <iframe> unless the page itself opts in.
 * `Content-Security-Policy: frame-ancestors` is that opt-in: it lists which parent origins
 * are allowed to frame us. `X-Frame-Options` is the older, coarser version of the same idea
 * and must be off, because when both are present the stricter one wins.
 */
const DEFAULT_FRAME_ANCESTORS = [
  "'self'",
  // Microsoft Office / PowerPoint add-ins and Teams
  "https://*.officeapps.live.com",
  "https://*.office.com",
  "https://*.office365.com",
  "https://*.microsoft.com",
  "https://*.microsoftonline.com",
  "https://*.sharepoint.com",
  "https://teams.microsoft.com",
  "https://*.teams.microsoft.com",
  "https://*.skype.com",
  // Google Slides add-on surfaces
  "https://docs.google.com",
  "https://*.google.com",
  "https://*.googleusercontent.com",
  // Zoom Apps
  "https://*.zoom.us"
];

function parseConfiguredAncestors() {
  const raw = process.env.EMBED_FRAME_ANCESTORS;
  if (!raw || !raw.trim()) return null;
  const entries = raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  return entries.length ? entries : null;
}

function getFrameAncestors() {
  const configured = parseConfiguredAncestors();
  if (configured) return configured;

  const extra = (process.env.EMBED_FRAME_ANCESTORS_EXTRA || "")
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return [...DEFAULT_FRAME_ANCESTORS, ...extra];
}

function buildFrameAncestorsHeader() {
  return `frame-ancestors ${getFrameAncestors().join(" ")}`;
}

function embedFrameHeadersMiddleware(_req, res, next) {
  res.removeHeader("X-Frame-Options");
  res.setHeader("Content-Security-Policy", buildFrameAncestorsHeader());
  next();
}

module.exports = {
  DEFAULT_FRAME_ANCESTORS,
  getFrameAncestors,
  buildFrameAncestorsHeader,
  embedFrameHeadersMiddleware
};
