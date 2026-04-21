const express = require("express");
const questionController = require("../controllers/question.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

// Scope auth to question-related paths only.
router.use(["/sessions", "/questions"], authMiddleware);

router.get(
  "/sessions/:sessionId/questions",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  questionController.listBySession
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

module.exports = router;
