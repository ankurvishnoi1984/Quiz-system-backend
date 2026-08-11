const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "users",
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    password_hash: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    full_name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    avatar_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM("super_admin", "client_admin", "dept_admin", "host"),
      allowNull: false
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    dept_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    extra_participants: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    plan_limit_email_sent_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    must_change_password: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
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
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
);

module.exports = User;
