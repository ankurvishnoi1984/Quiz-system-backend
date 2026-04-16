const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Client = sequelize.define(
  "clients",
  {
    client_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    logo_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    primary_color: {
      type: DataTypes.CHAR(7),
      allowNull: true,
      defaultValue: "#1E3A5F"
    },
    secondary_color: {
      type: DataTypes.CHAR(7),
      allowNull: true,
      defaultValue: "#2E86AB"
    },
    custom_domain: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    contact_email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    contact_phone: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    subscription_tier: {
      type: DataTypes.ENUM("basic", "standard", "enterprise"),
      allowNull: true,
      defaultValue: "standard"
    },
    max_participants_per_session: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 500
    },
    features_enabled: {
      type: DataTypes.JSON,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
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
    tableName: "clients",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
);

module.exports = Client;
