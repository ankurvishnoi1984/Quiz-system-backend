const { successResponse, errorResponse } = require("../utils/response");
const { getWebSocketMonitorData } = require("../services/websocket-monitor.service");

async function getMonitorStats(req, res) {
  try {
    const data = await getWebSocketMonitorData();
    return successResponse(res, { monitor: data }, "WebSocket monitor stats fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  getMonitorStats
};
