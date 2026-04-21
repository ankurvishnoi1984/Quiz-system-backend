const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const QaQuestion = sequelize.define(
  "qa_questions",
  {
    qa_id: {
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
    participant_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    question_text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    is_anonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    upvotes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "answered", "pinned"),
      allowNull: true,
      defaultValue: "pending"
    },
    is_pinned: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    answered_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    answered_at: {
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
    tableName: "qa_questions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
);

module.exports = QaQuestion;
