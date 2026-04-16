const express = require("express");
const sessionController = require("../controllers/session.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

// Public join endpoints (no auth token required)
router.get("/sessions/join/:code", sessionController.lookupByCode);
router.post("/sessions/join/:code", sessionController.joinByCode);

router.use(authMiddleware);

router.get(
  "/departments/:deptId/sessions",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.listByDepartment
);
router.post(
  "/departments/:deptId/sessions",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.createForDepartment
);

router.get(
  "/sessions/:sessionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.detail
);
router.put(
  "/sessions/:sessionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.update
);
router.delete(
  "/sessions/:sessionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.remove
);
router.post(
  "/sessions/:sessionId/start",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.start
);
router.post(
  "/sessions/:sessionId/pause",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.pause
);
router.post(
  "/sessions/:sessionId/resume",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.resume
);
router.post(
  "/sessions/:sessionId/end",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.end
);
router.get(
  "/sessions/:sessionId/qr",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.qr
);

module.exports = router;
