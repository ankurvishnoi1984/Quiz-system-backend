"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("media_assets", {
      asset_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      dept_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "departments",
          key: "dept_id"
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "user_id"
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      original_filename: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      file_path: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      storage_key: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      cdn_url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      media_type: {
        type: Sequelize.ENUM("image", "gif", "video_file"),
        allowNull: false
      },
      mime_type: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      file_size_bytes: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      width_px: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      height_px: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      duration_seconds: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      thumbnail_url: {
        type: Sequelize.TEXT,
        allowNull: true
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

    await queryInterface.addIndex("media_assets", ["dept_id"]);
    await queryInterface.addIndex("media_assets", ["uploaded_by"]);
    await queryInterface.addIndex("media_assets", ["media_type"]);
    await queryInterface.addIndex("media_assets", ["created_at"]);
    await queryInterface.addIndex("media_assets", ["is_active"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("media_assets");
  }
};
