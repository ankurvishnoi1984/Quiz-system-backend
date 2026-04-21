const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const QaUpvote = sequelize.define(
  "qa_upvotes",
  {
    upvote_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    qa_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    participant_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: "qa_upvotes",
    timestamps: false
  }
);

module.exports = QaUpvote;
