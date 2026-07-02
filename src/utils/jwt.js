const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signAccessToken(payload, options = {}) {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: options.expiresIn || env.jwt.accessExpiry
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiry
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
