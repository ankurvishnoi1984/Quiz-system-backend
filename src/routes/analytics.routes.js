const express = require("express");
const analyticsController = require("../controllers/analytics.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

router.use("/analytics", authMiddleware);

router.get(
  "/analytics/dept/:deptId/overview",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  analyticsController.departmentOverview
);
router.get(
  "/analytics/dept/:deptId/sessions",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  analyticsController.departmentSessions
);
router.get(
  "/analytics/client/:clientId/overview",
  authorizeRoles("super_admin", "client_admin"),
  analyticsController.clientOverview
);
router.get(
  "/analytics/dept/:deptId/export",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  analyticsController.departmentExport
);
router.get(
  "/analytics/session/:sessionId/report",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  analyticsController.sessionReport
);

module.exports = router;
