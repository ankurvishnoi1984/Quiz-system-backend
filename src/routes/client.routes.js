const express = require("express");
const clientController = require("../controllers/client.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", authorizeRoles("super_admin"), clientController.create);
router.get("/", authorizeRoles("super_admin"), clientController.list);
router.get("/:clientId", authorizeRoles("super_admin"), clientController.detail);

module.exports = router;
