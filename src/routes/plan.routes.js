const express = require("express");
const planController = require("../controllers/plan.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/usage", planController.usage);
router.get("/", authorizeRoles("super_admin"), planController.list);
router.post("/", authorizeRoles("super_admin"), planController.create);
router.put("/:planId", authorizeRoles("super_admin"), planController.update);

module.exports = router;
