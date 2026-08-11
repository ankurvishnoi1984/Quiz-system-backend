"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("session_embed_tokens", {
      embed_token_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      session_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      token: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true
      },
      scope: {
        type: Sequelize.ENUM("display"),
        allowNull: false,
        defaultValue: "display"
      },
      label: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.addIndex("session_embed_tokens", ["session_id", "scope"]);
    await queryInterface.addIndex("session_embed_tokens", ["revoked_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("session_embed_tokens");
  }
};
