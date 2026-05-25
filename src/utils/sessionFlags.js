/** DB/Sequelize may return 0/1; never use `value !== false` for booleans. */
function participantNavigationEnabled(value) {
  if (value === undefined || value === null) return true;
  return Boolean(value);
}

module.exports = {
  participantNavigationEnabled
};
