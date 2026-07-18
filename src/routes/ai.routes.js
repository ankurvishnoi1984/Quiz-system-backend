const express = require("express");
const aiController = require("../controllers/ai.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

router.use("/ai", authMiddleware);

router.get(
  "/ai/question-types",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  aiController.listSupportedTypes
);

router.post(
  "/ai/generate-questions",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  aiController.generateQuestions
);

module.exports = router;
