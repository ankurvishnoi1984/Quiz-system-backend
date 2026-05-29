"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("questions");
    if (!table.live_activated_at) {
      await queryInterface.addColumn("questions", "live_activated_at", {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("questions");
    if (table.live_activated_at) {
      await queryInterface.removeColumn("questions", "live_activated_at");
    }
  }
};
