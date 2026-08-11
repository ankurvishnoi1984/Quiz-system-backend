/**
 * Origin of the React participant app (QR codes, /join/:code links).
 * Must NOT be the API host unless the SPA is served from the same server.
 */
function trimTrailingSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function getFrontendPublicUrl(req) {
  const configured =
    process.env.FRONTEND_PUBLIC_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.VITE_PUBLIC_APP_URL;

  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (req) {
    const host = req.get("host") || "";
    // Local API default port — Vite dev server is usually :5173
    if (/^localhost:5000$/i.test(host) || /^127\.0\.0\.1:5000$/i.test(host)) {
      return "http://localhost:5173";
    }
    return trimTrailingSlash(`${req.protocol}://${host}`);
  }

  return process.env.NODE_ENV === "production" ? "" : "http://localhost:5173";
}

function buildSessionJoinPath(sessionCode) {
  const code = sessionCode != null ? String(sessionCode).trim() : "";
  if (!code) return "/join";
  return `/join/${encodeURIComponent(code)}`;
}

function buildSessionJoinUrl(sessionCode, req) {
  const origin = getFrontendPublicUrl(req);
  const path = buildSessionJoinPath(sessionCode);
  return origin ? `${origin}${path}` : path;
}

function buildPresentViewPath(sessionId, token) {
  const id = sessionId != null ? String(sessionId).trim() : "";
  const t = token != null ? String(token).trim() : "";
  if (!id || !t) return "/present/view";
  return `/present/view?session=${encodeURIComponent(id)}&token=${encodeURIComponent(t)}`;
}

function buildPresentViewUrl(sessionId, token, reqOrOrigin) {
  const origin =
    typeof reqOrOrigin === "string"
      ? trimTrailingSlash(reqOrOrigin)
      : getFrontendPublicUrl(reqOrOrigin);
  const path = buildPresentViewPath(sessionId, token);
  return origin ? `${origin}${path}` : path;
}

function buildEmbedPath(surface, sessionId, token) {
  const id = sessionId != null ? String(sessionId).trim() : "";
  const t = token != null ? String(token).trim() : "";
  if (!id || !t) return `/embed/${surface}`;
  return `/embed/${surface}?session=${encodeURIComponent(id)}&token=${encodeURIComponent(t)}`;
}

function buildEmbedDisplayUrl(sessionId, token, reqOrOrigin) {
  const origin =
    typeof reqOrOrigin === "string"
      ? trimTrailingSlash(reqOrOrigin)
      : getFrontendPublicUrl(reqOrOrigin);
  const path = buildEmbedPath("display", sessionId, token);
  return origin ? `${origin}${path}` : path;
}

function buildEmbedControlsUrl(sessionId, reqOrOrigin) {
  const origin =
    typeof reqOrOrigin === "string"
      ? trimTrailingSlash(reqOrOrigin)
      : getFrontendPublicUrl(reqOrOrigin);
  const id = sessionId != null ? String(sessionId).trim() : "";
  const path = id ? `/embed/controls?session=${encodeURIComponent(id)}` : "/embed/controls";
  return origin ? `${origin}${path}` : path;
}

module.exports = {
  getFrontendPublicUrl,
  buildSessionJoinPath,
  buildSessionJoinUrl,
  buildPresentViewPath,
  buildPresentViewUrl,
  buildEmbedDisplayUrl,
  buildEmbedControlsUrl
};
