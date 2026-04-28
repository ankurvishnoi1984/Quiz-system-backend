const express = require("express");
const responseController = require("../controllers/response.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const participantAuthMiddleware = require("../middlewares/participant-auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const qaAccessMiddleware = require("../middlewares/qa-access.middleware");

const router = express.Router();

router.get("/sessions/:sessionId/participantQuestions",participantAuthMiddleware, responseController.listParticipantQuestions);
router.post("/responses/submit", participantAuthMiddleware, responseController.submit);

// Restrict staff auth to response reporting endpoints only.
router.use("/responses", authMiddleware);

router.get(
  "/responses/question/:questionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  responseController.questionResults
);
router.get(
  "/responses/session/:sessionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  responseController.sessionResponses
);
router.get(
  "/responses/session/:sessionId/summary",
  authorizeRoles("super_admin", "client_admin", "dept_admin"),
  responseController.sessionSummary
);
router.get(
  "/responses/session/:sessionId/export",
  authorizeRoles("super_admin", "client_admin", "dept_admin"),
  responseController.sessionExport
);

module.exports = router;
