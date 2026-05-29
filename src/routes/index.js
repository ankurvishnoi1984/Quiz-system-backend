const express = require("express");
const { healthHandler } = require("../health");
const authRoutes = require("./auth.routes");
const clientRoutes = require("./client.routes");
const departmentRoutes = require("./department.routes");
const sessionRoutes = require("./session.routes");
const questionRoutes = require("./question.routes");
const responseRoutes = require("./response.routes");
const qaRoutes = require("./qa.routes");
const mediaRoutes = require("./media.routes");
const analyticsRoutes = require("./analytics.routes");

const router = express.Router();

router.get("/health", healthHandler);

router.use("/auth", authRoutes);
router.use("/clients", clientRoutes);
router.use("/departments", departmentRoutes);
router.use("/", responseRoutes);
router.use("/", sessionRoutes);
router.use("/", questionRoutes);
router.use("/", qaRoutes);
router.use("/", mediaRoutes);
router.use("/", analyticsRoutes);

module.exports = router;
