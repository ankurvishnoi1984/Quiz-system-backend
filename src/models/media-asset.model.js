const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const MediaAsset = sequelize.define(
  "media_assets",
  {
    asset_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    dept_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    original_filename: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    file_path: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    storage_key: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    cdn_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    media_type: {
      type: DataTypes.ENUM("image", "gif", "video_file"),
      allowNull: false
    },
    mime_type: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    file_size_bytes: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    width_px: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    height_px: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    duration_seconds: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    thumbnail_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    tableName: "media_assets",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
);

module.exports = MediaAsset;
