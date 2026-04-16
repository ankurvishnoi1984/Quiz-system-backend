const express = require("express");
const departmentController = require("../controllers/department.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/",
  authorizeRoles("super_admin", "client_admin"),
  departmentController.create
);
router.get(
  "/",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  departmentController.list
);
router.get(
  "/:departmentId",
  authorizeRoles("super_admin", "client_admin", "dept_admin", "host"),
  departmentController.detail
);

module.exports = router;
