const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Session = sequelize.define(
  "sessions",
  {
    session_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    dept_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    host_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    session_code: {
      type: DataTypes.CHAR(6),
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM("draft", "live", "paused", "completed", "archived"),
      allowNull: true,
      defaultValue: "draft"
    },
    join_type: {
      type: DataTypes.ENUM('name', 'anonymous', 'name_email'),
      allowNull: false,
      defaultValue: 'name'
    },
    password_hash: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    max_participants: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 500
    },
    show_results_to_participants: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    allow_late_join: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    leaderboard_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    qr_code_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: "sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
);

module.exports = Session;