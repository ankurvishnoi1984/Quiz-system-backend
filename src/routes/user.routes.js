const express = require("express");
const userController = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", authorizeRoles("super_admin"), userController.list);

module.exports = router;
