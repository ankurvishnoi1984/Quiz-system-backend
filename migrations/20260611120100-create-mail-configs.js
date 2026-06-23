"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mail_configs", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      sender_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      smtp_host: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      smtp_port: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 587
      },
      smtp_user: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      smtp_pass: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      smtp_from: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      secure: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      daily_limit: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5000
      },
      batch_limit: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      sent_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
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
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
      }
    });


  },

  async down(queryInterface) {
    await queryInterface.dropTable("mail_configs");
  }
};
