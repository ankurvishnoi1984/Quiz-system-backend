"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("responses", "deleted_at", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
    await queryInterface.addColumn("participants", "deleted_at", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
    await queryInterface.addIndex("responses", ["deleted_at"]);
    await queryInterface.addIndex("participants", ["deleted_at"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("participants", ["deleted_at"]).catch(() => {});
    await queryInterface.removeIndex("responses", ["deleted_at"]).catch(() => {});
    await queryInterface.removeColumn("participants", "deleted_at");
    await queryInterface.removeColumn("responses", "deleted_at");
  }
};
