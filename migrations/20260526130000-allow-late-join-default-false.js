"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("sessions", "allow_late_join", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("sessions", "allow_late_join", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: true
    });
  }
};
