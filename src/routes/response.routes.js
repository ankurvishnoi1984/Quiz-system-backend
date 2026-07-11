const express = require("express");
const responseController = require("../controllers/response.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const participantAuthMiddleware = require("../middlewares/participant-auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const qaAccessMiddleware = require("../middlewares/qa-access.middleware");

const router = express.Router();

router.get("/sessions/:sessionId/participantQuestions",participantAuthMiddleware, responseController.listParticipantQuestions);
router.get("/sessions/:sessionId/leaderboard", participantAuthMiddleware, responseController.participantSessionLeaderboard);
router.get(
  "/sessions/:sessionId/survey-summary",
  participantAuthMiddleware,
  responseController.participantSessionSurveySummary
);
router.get(
  "/questions/:questionId/survey-results",
  participantAuthMiddleware,
  responseController.participantSurveyQuestionResults
);
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
  "/responses/session/:sessionId/leaderboard",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  responseController.sessionLeaderboard
);
router.get(
  "/responses/session/:sessionId/survey-summary",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  responseController.sessionSurveySummary
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
