const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const MailConfig = sequelize.define(
  "mail_configs",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sender_name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    smtp_host: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    smtp_port: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 587
    },
    smtp_user: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    smtp_pass: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    smtp_from: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    secure: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    daily_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5000
    },
    batch_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    sent_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    last_used_at: {
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
    tableName: "mail_configs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
);

module.exports = MailConfig;
