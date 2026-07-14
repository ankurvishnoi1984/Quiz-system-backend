const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || "quiz_db",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    pool: {
      // 20 parallel joins + Present refetches need more than Sequelize's default of 5
      max: Number(process.env.DB_POOL_MAX || 30),
      min: Number(process.env.DB_POOL_MIN || 5),
      acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
      idle: Number(process.env.DB_POOL_IDLE || 10000)
    }
  },
  jwtSecret: process.env.JWT_ACCESS_SECRET || "change_this_access_secret",
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "change_this_access_secret",
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || "1h",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "change_this_refresh_secret",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d"
  }
};

module.exports = env;
