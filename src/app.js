const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const apiRoutes = require("./routes");
const { healthHandler } = require("./health");
const { errorResponse } = require("./utils/response");
const { getFrontendPublicUrl, buildSessionJoinPath } = require("./config/publicAppUrl");
const { requestContextMiddleware } = require("./utils/audit-context");
const { isIntegrationsEnabled } = require("./config/integrations");
const { embedFrameHeadersMiddleware } = require("./config/embedSecurity");

const app = express();

app.get("/health", healthHandler);

const integrationsOn = isIntegrationsEnabled();

app.use(
  helmet({
    // Allow frontend apps on another origin to embed uploaded images/videos.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Only open framing when integrations are enabled; otherwise keep Helmet's
    // default X-Frame-Options DENY so core app behaviour matches pre-Phase-0.
    frameguard: integrationsOn ? false : undefined,
    contentSecurityPolicy: false
  })
);
if (integrationsOn) {
  app.use(embedFrameHeadersMiddleware);
}
app.use(cors());
app.use(requestContextMiddleware);
// Question import previews can contain up to 500 parsed rows.
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  "/uploads",
  (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static("uploads")
);
app.use(
  "/branding",
  (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(__dirname, "../assets"))
);

/**
 * Participant join links must open the React app, not the JSON API.
 * Redirect /join/:code (e.g. from old QR codes pointing at the API host) to the frontend.
 */
app.get("/join", (req, res) => {
  const frontendOrigin = getFrontendPublicUrl(req);
  if (!frontendOrigin) {
    return errorResponse(
      res,
      "FRONTEND_PUBLIC_URL is not configured on the server",
      503
    );
  }
  return res.redirect(302, `${frontendOrigin}/join`);
});

app.get("/join/:code", (req, res) => {
  const frontendOrigin = getFrontendPublicUrl(req);
  const path = buildSessionJoinPath(req.params.code);
  if (!frontendOrigin) {
    return errorResponse(
      res,
      "FRONTEND_PUBLIC_URL is not configured on the server",
      503
    );
  }
  return res.redirect(302, `${frontendOrigin}${path}`);
});

app.use("/api/v1", apiRoutes);

app.use((_req, res) => {
  return errorResponse(res, "Route not found", 404);
});

module.exports = app;
