const express = require("express");
const userController = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", authorizeRoles("super_admin"), userController.list);
router.post("/", authorizeRoles("super_admin"), userController.create);
router.patch("/:userId/plan", authorizeRoles("super_admin"), userController.assignPlan);
router.patch("/:userId/status", authorizeRoles("super_admin"), userController.setStatus);
router.get(
  "/:userId/extra-participants",
  authorizeRoles("super_admin"),
  userController.listAddons
);
router.patch(
  "/:userId/extra-participants",
  authorizeRoles("super_admin"),
  userController.adjustExtraParticipants
);

module.exports = router;
