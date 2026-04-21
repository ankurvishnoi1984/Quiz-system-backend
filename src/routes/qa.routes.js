const express = require("express");
const qaController = require("../controllers/qa.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const participantAuthMiddleware = require("../middlewares/participant-auth.middleware");
const qaAccessMiddleware = require("../middlewares/qa-access.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/qa/:sessionId/questions", qaAccessMiddleware, qaController.listQuestions);
router.post("/qa/:sessionId/ask", participantAuthMiddleware, qaController.ask);
router.post("/qa/:qaId/upvote", participantAuthMiddleware, qaController.upvote);
router.delete("/qa/:qaId/upvote", participantAuthMiddleware, qaController.unvote);
router.put(
  "/qa/:qaId/approve",
  authMiddleware,
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  qaController.approve
);
router.put(
  "/qa/:qaId/reject",
  authMiddleware,
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  qaController.reject
);
router.put(
  "/qa/:qaId/answer",
  authMiddleware,
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  qaController.answer
);
router.put(
  "/qa/:qaId/pin",
  authMiddleware,
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  qaController.pin
);

module.exports = router;
