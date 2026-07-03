const bcrypt = require("bcryptjs");
const { User, Client, Department } = require("../models");
const { sendNewUserWelcomeEmail } = require("./email.service");

const ROLE_LABELS = {
  client_admin: "Client admin",
  dept_admin: "Department admin",
  host: "Host"
};

function buildUserPayload(user) {
  return {
    user_id: user.user_id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    client_id: user.client_id,
    dept_id: user.dept_id,
    is_active: user.is_active
  };
}

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
      "created_at"
    ],
    order: [["user_id", "DESC"]]
  });

  return users;
}

async function createUserByAdmin(input, adminUser) {
  const normalizedEmail = String(input.email).trim().toLowerCase();
  const existingUser = await User.findOne({ where: { email: normalizedEmail } });

  if (existingUser) {
    const error = new Error("Email already registered");
    error.statusCode = 409;
    throw error;
  }

  const password_hash = await bcrypt.hash(input.password, 10);
  const user = await User.create({
    full_name: String(input.full_name).trim(),
    email: normalizedEmail,
    password_hash,
    role: input.role,
    client_id: input.client_id ? Number(input.client_id) : null,
    dept_id: input.dept_id ? Number(input.dept_id) : null,
    must_change_password: false
  });

  let clientName = null;
  let deptName = null;

  if (user.client_id) {
    const client = await Client.findByPk(user.client_id, { attributes: ["name"] });
    clientName = client?.name || null;
  }

  if (user.dept_id) {
    const department = await Department.findByPk(user.dept_id, { attributes: ["name"] });
    deptName = department?.name || null;
  }

  let emailSent = false;
  let emailError = null;

  try {
    await sendNewUserWelcomeEmail({
      to: user.email,
      cc: adminUser?.email || null,
      fullName: user.full_name,
      email: user.email,
      password: input.password,
      roleLabel: ROLE_LABELS[user.role] || user.role,
      clientName,
      deptName,
      createdByName: adminUser?.full_name || adminUser?.email || "Administrator"
    });
    emailSent = true;
  } catch (err) {
    emailError = err.message || "Failed to send welcome email";
    console.error("createUserByAdmin welcome email failed:", err);
  }

  return {
    user: buildUserPayload(user),
    email_sent: emailSent,
    email_error: emailSent ? null : emailError
  };
}

module.exports = {
  listUsers,
  createUserByAdmin
};
