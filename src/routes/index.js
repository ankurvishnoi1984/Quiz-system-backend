const express = require("express");
const { healthHandler } = require("../health");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const planRoutes = require("./plan.routes");
const clientRoutes = require("./client.routes");
const departmentRoutes = require("./department.routes");
const sessionRoutes = require("./session.routes");
const questionRoutes = require("./question.routes");
const responseRoutes = require("./response.routes");
const qaRoutes = require("./qa.routes");
const mediaRoutes = require("./media.routes");
const analyticsRoutes = require("./analytics.routes");
const participantRoutes = require("./participant.routes");
const presentViewRoutes = require("./present-view.routes");
const websocketMonitorRoutes = require("./websocket-monitor.routes");
const auditLogRoutes = require("./audit-log.routes");
const aiRoutes = require("./ai.routes");

const router = express.Router();

router.get("/health", healthHandler);

router.use("/auth", authRoutes);
router.use("/audit-logs", auditLogRoutes);
router.use("/users", userRoutes);
router.use("/plans", planRoutes);
router.use("/clients", clientRoutes);
router.use("/departments", departmentRoutes);
router.use("/", responseRoutes);
router.use("/", sessionRoutes);
router.use("/", questionRoutes);
router.use("/", qaRoutes);
router.use("/", mediaRoutes);
router.use("/", participantRoutes);
router.use("/", presentViewRoutes);
router.use("/", analyticsRoutes);
router.use("/", websocketMonitorRoutes);
router.use("/", aiRoutes);

module.exports = router;
