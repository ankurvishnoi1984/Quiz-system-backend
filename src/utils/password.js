const crypto = require("crypto");

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function pick(chars) {
  return chars[crypto.randomInt(0, chars.length)];
}

/** Generate a readable temporary password (12 chars, mixed character classes). */
function generateTemporaryPassword(length = 12) {
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const remaining = Array.from({ length: Math.max(0, length - required.length) }, () =>
    pick(ALL)
  );
  const chars = [...required, ...remaining];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

module.exports = {
  generateTemporaryPassword
};
