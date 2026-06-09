const { User } = require("../models");

async function listUsers() {
  const users = await User.findAll({
    attributes: [
      "user_id",
      "email",
      "full_name",
      "role",
      "client_id",
      "dept_id",
      "is_active",
      "last_login_at",
      "created_at",
    ],
    order: [["user_id", "DESC"]],
  });

  return users;
}

module.exports = {
  listUsers,
};
