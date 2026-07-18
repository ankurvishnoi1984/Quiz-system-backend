"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("audit_logs", { action: "read" });
    await queryInterface.changeColumn("audit_logs", "action", {
      type: Sequelize.ENUM("create", "update", "delete"),
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("audit_logs", "action", {
      type: Sequelize.ENUM("create", "read", "update", "delete"),
      allowNull: false
    });
  }
};
