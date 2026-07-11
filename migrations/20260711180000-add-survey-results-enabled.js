'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sessions', 'survey_results_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'leaderboard_enabled',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('sessions', 'survey_results_enabled');
  },
};
