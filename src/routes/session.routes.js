const express = require("express");
const sessionController = require("../controllers/session.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

// Public join endpoints (no auth token required)
router.get("/sessions/join/:code", sessionController.lookupByCode);
router.post("/sessions/join/:code", sessionController.joinByCode);

// Only protect session/department management routes in this router.
router.use(["/departments", "/sessions"], authMiddleware);

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
  "/sessions/:sessionId/report/qa",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.sessionQaReport
);
router.get(
  "/sessions/:sessionId/report/participants",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.sessionParticipantsReport
);
router.get(
  "/sessions/:sessionId/report/questions",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.sessionQuestionsReport
);
router.get(
  "/sessions/:sessionId/report/summary",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.sessionSummaryReport
);
router.get(
  "/sessions/:sessionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.detail
);
router.get(
  "/sessions/:sessionId/participants",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.listParticipants
);
router.put(
  "/sessions/:sessionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.update
);
router.post(
  "/sessions/:sessionId/duplicate",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.duplicate
);
router.delete(
  "/sessions/:sessionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.remove
);
router.post(
  "/sessions/:sessionId/reset-responses",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.resetResponses
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
router.post(
  "/sessions/:sessionId/close-all-questions",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.closeAllQuestions
);
router.post(
  "/sessions/:sessionId/activate-all-questions",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.activateAllQuestions
);
router.get(
  "/sessions/:sessionId/qr",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.qr
);
router.post(
  "/sessions/:sessionId/present-view-link",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.presentViewLink
);
if (require("../config/integrations").isIntegrationsEnabled()) {
  router.post(
    "/sessions/:sessionId/embed-link",
    authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
    sessionController.embedLink
  );
}
router.get(
  "/sessions/:sessionId/present-slide",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.getPresentSlide
);
router.put(
  "/sessions/:sessionId/present-slide",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  sessionController.presentSlide
);

module.exports = router;
