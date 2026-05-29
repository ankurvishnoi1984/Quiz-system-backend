const pkg = require("../package.json");
const env = require("./config/env");
const { sequelize } = require("./config/database");
const { successResponse } = require("./utils/response");

/**
 * Liveness/readiness probe for deploy verification and load balancers.
 * Set GIT_COMMIT or BUILD_ID in the deploy environment to confirm which revision is live.
 */
async function healthHandler(_req, res) {
  const payload = {
    status: "ok",
    service: pkg.name || "live-polling-backend",
    version: process.env.APP_VERSION || pkg.version,
    build: process.env.BUILD_ID || process.env.GIT_COMMIT || null,
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime())
  };

  try {
    await sequelize.authenticate();
    payload.checks = { database: "ok" };
    return successResponse(res, payload, "Healthy", 200);
  } catch {
    payload.status = "degraded";
    payload.checks = { database: "unavailable" };
    return successResponse(res, payload, "Database unavailable", 503);
  }
}

module.exports = { healthHandler };
