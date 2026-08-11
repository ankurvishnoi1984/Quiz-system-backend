"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("plans", {
      plan_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      max_participants: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.addIndex("plans", ["name"], {
      unique: true,
      name: "plans_name_unique"
    });

    await queryInterface.addColumn("users", "plan_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: "dept_id",
      references: {
        model: "plans",
        key: "plan_id"
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.addColumn("users", "plan_limit_email_sent_at", {
      type: Sequelize.DATE,
      allowNull: true,
      after: "plan_id"
    });

    await queryInterface.bulkInsert("plans", [
      {
        name: "Starter",
        description: "Up to 50 participants across all sessions",
        max_participants: 50,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: "Standard",
        description: "Up to 100 participants across all sessions",
        max_participants: 100,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: "Professional",
        description: "Up to 500 participants across all sessions",
        max_participants: 500,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: "Enterprise",
        description: "Up to 2000 participants across all sessions",
        max_participants: 2000,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "plan_limit_email_sent_at");
    await queryInterface.removeColumn("users", "plan_id");
    await queryInterface.dropTable("plans");
  }
};
