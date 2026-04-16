const express = require("express");
const authRoutes = require("./auth.routes");
const clientRoutes = require("./client.routes");
const departmentRoutes = require("./department.routes");
const sessionRoutes = require("./session.routes");
const questionRoutes = require("./question.routes");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy"
  });
});

router.use("/auth", authRoutes);
router.use("/clients", clientRoutes);
router.use("/departments", departmentRoutes);
router.use("/", sessionRoutes);
router.use("/", questionRoutes);

module.exports = router;
