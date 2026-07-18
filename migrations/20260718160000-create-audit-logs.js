"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("audit_logs", {
      audit_log_id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      action: {
        type: Sequelize.ENUM("create", "update", "delete"),
        allowNull: false
      },
      entity_type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      entity_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      actor_type: {
        type: Sequelize.ENUM("user", "participant", "presenter_viewer", "system", "anonymous"),
        allowNull: false,
        defaultValue: "system"
      },
      actor_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      actor_role: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      client_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      dept_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      session_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      request_id: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      http_method: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      request_path: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      ip_address: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      user_agent: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      before_values: {
        type: Sequelize.JSON,
        allowNull: true
      },
      after_values: {
        type: Sequelize.JSON,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      }
    });

    await queryInterface.addIndex("audit_logs", ["created_at"]);
    await queryInterface.addIndex("audit_logs", ["action", "entity_type"]);
    await queryInterface.addIndex("audit_logs", ["actor_type", "actor_id"]);
    await queryInterface.addIndex("audit_logs", ["client_id", "dept_id"]);
    await queryInterface.addIndex("audit_logs", ["session_id"]);
    await queryInterface.addIndex("audit_logs", ["request_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("audit_logs");
  }
};
