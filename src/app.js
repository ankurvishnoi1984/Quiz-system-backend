const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const apiRoutes = require("./routes");
const { healthHandler } = require("./health");
const { errorResponse } = require("./utils/response");
const { getFrontendPublicUrl, buildSessionJoinPath } = require("./config/publicAppUrl");

const app = express();

app.get("/health", healthHandler);

app.use(
  helmet({
    // Allow frontend apps on another origin to embed uploaded images/videos.
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(cors());
app.use(express.json());
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
