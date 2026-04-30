const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Participant = sequelize.define(
  "participants",
  {
    participant_id: {
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
    nickname: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    email:{
      type: DataTypes.STRING(80),
      allowNull: true
    },
    avatar_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    socket_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    is_anonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    device_fingerprint: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_active_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: "participants",
    timestamps: false
  }
);

module.exports = Participant;
