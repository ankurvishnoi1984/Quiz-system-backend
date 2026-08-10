"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("sessions", "logo_url", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      after: "qr_code_url",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("sessions", "logo_url");
  },
};
