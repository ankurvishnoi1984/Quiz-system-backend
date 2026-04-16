const bcrypt = require("bcryptjs");
const { User } = require("../models");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} = require("../utils/jwt");

function buildUserPayload(user) {
  return {
    user_id: user.user_id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    client_id: user.client_id,
    dept_id: user.dept_id
  };
}

function buildAuthTokens(payload) {
  return {
    access_token: signAccessToken(payload),
    refresh_token: signRefreshToken(payload)
  };
}

async function registerUser(input) {
  const existingUser = await User.findOne({
    where: { email: input.email.toLowerCase() }
  });

  if (existingUser) {
    const error = new Error("Email already registered");
    error.statusCode = 409;
    throw error;
  }

  const password_hash = await bcrypt.hash(input.password, 10);

  const user = await User.create({
    full_name: input.full_name,
    email: input.email.toLowerCase(),
    password_hash,
    role: input.role,
    client_id: input.client_id || null,
    dept_id: input.dept_id || null
  });

  const payload = buildUserPayload(user);
  const tokens = buildAuthTokens(payload);
  return { user: payload, tokens };
}

async function loginUser(input) {
  const user = await User.findOne({
    where: { email: input.email.toLowerCase() }
  });

  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const isPasswordMatch = await bcrypt.compare(input.password, user.password_hash);
  if (!isPasswordMatch) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  if (!user.is_active) {
    const error = new Error("User account is inactive");
    error.statusCode = 403;
    throw error;
  }

  user.last_login_at = new Date();
  await user.save();

  const payload = buildUserPayload(user);
  const tokens = buildAuthTokens(payload);
  return { user: payload, tokens };
}

async function refreshAccessToken(refreshToken) {
  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    const error = new Error("Invalid or expired refresh token");
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findByPk(decoded.user_id);
  if (!user || !user.is_active) {
    const error = new Error("User not found or inactive");
    error.statusCode = 401;
    throw error;
  }

  const payload = buildUserPayload(user);
  return {
    access_token: signAccessToken(payload)
  };
}

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken
};
