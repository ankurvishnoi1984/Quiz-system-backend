const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserParticipantAddon = sequelize.define(
  "user_participant_addons",
  {
    addon_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    seats: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    note: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: "user_participant_addons",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false
  }
);

module.exports = UserParticipantAddon;
