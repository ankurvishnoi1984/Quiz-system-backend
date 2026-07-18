const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const AuditLog = sequelize.define(
  "audit_logs",
  {
    audit_log_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    action: {
      type: DataTypes.ENUM("create", "update", "delete"),
      allowNull: false
    },
    entity_type: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    entity_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    actor_type: {
      type: DataTypes.ENUM("user", "participant", "presenter_viewer", "system", "anonymous"),
      allowNull: false,
      defaultValue: "system"
    },
    actor_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    actor_role: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    dept_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    session_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    request_id: {
      type: DataTypes.STRING(36),
      allowNull: true
    },
    http_method: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    request_path: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    before_values: {
      type: DataTypes.JSON,
      allowNull: true
    },
    after_values: {
      type: DataTypes.JSON,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  },
  {
    tableName: "audit_logs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false
  }
);

module.exports = AuditLog;
