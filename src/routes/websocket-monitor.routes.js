const express = require("express");
const websocketMonitorController = require("../controllers/websocket-monitor.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/monitor/websockets",
  authorizeRoles("super_admin"),
  websocketMonitorController.getMonitorStats
);

module.exports = router;
