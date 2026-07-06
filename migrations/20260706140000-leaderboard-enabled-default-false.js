"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE sessions MODIFY leaderboard_enabled TINYINT(1) DEFAULT 0"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE sessions MODIFY leaderboard_enabled TINYINT(1) DEFAULT 1"
    );
  }
};
