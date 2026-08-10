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
    scheduled_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    scheduled_time: {
      type: DataTypes.STRING(5),
      allowNull: true
    },
    auto_end_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    auto_end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    auto_end_time: {
      type: DataTypes.STRING(5),
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
      defaultValue: false
    },
    leaderboard_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    survey_results_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    show_question_leaderboard: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    participant_navigation_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    quiz_total_time_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    },
    qr_code_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    logo_url: {
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