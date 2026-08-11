const express = require("express");
const questionController = require("../controllers/question.controller");
const questionSetController = require("../controllers/question-set.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

// Scope auth to question-related paths only.
router.use(["/sessions", "/questions"], authMiddleware);

router.get(
  "/sessions/:sessionId/question-sets",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionSetController.list
);
router.post(
  "/sessions/:sessionId/question-sets",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionSetController.create
);
router.put(
  "/sessions/:sessionId/question-sets/:setId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionSetController.update
);
router.delete(
  "/sessions/:sessionId/question-sets/:setId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionSetController.remove
);
router.get(
  "/sessions/:sessionId/questions",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.listBySession
);
router.post(
  "/sessions/:sessionId/questions/import/preview",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.previewImport
);
router.post(
  "/sessions/:sessionId/questions/import",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.confirmImport
);
router.post(
  "/sessions/:sessionId/questions",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.createForSession
);
router.get(
  "/questions/:questionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.detail
);
router.put(
  "/questions/:questionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.update
);
router.delete(
  "/questions/:questionId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.remove
);
router.post(
  "/questions/reorder",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.reorder
);
router.post(
  "/questions/:questionId/activate",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.activate
);
router.post(
  "/questions/:questionId/deactivate",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.deactivate
);
router.post(
  "/questions/:questionId/reveal-answer",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.revealAnswer
);
router.post(
  "/questions/:questionId/hide-answer",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.hideAnswer
);
router.post(
  "/questions/:questionId/show-leaderboard",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.showLeaderboard
);
router.post(
  "/questions/:questionId/hide-leaderboard",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.hideLeaderboard
);
router.post(
  "/questions/:questionId/open-reattempt",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.openForReattempt
);
router.post(
  "/questions/:questionId/close",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.closeQuestion
);

module.exports = router;
