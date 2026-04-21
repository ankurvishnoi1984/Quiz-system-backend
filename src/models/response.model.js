const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Response = sequelize.define(
  "responses",
  {
    response_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    session_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    dept_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    question_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    participant_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    option_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    text_response: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    rating_value: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    ranking_order: {
      type: DataTypes.JSON,
      allowNull: true
    },
    is_correct: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    points_earned: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    response_time_ms: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: "responses",
    timestamps: false
  }
);

module.exports = Response;
