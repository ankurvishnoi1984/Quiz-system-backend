"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("question_sets", {
      set_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      session_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(80),
        allowNull: false
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      }
    });

    await queryInterface.addIndex("question_sets", ["session_id"]);
    await queryInterface.addIndex("question_sets", ["session_id", "display_order"]);

    await queryInterface.addColumn("questions", "set_id", {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addIndex("questions", ["session_id", "set_id"]);

    await queryInterface.addColumn("participants", "assigned_set_id", {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addIndex("participants", ["session_id", "assigned_set_id"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("participants", ["session_id", "assigned_set_id"]).catch(() => {});
    await queryInterface.removeColumn("participants", "assigned_set_id");
    await queryInterface.removeIndex("questions", ["session_id", "set_id"]).catch(() => {});
    await queryInterface.removeColumn("questions", "set_id");
    await queryInterface.dropTable("question_sets");
  }
};
