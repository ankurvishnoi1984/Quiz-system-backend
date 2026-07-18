const express = require("express");
const auditLogController = require("../controllers/audit-log.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/", authorizeRoles("super_admin"), auditLogController.list);

module.exports = router;
