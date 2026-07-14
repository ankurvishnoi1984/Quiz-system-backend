const { Sequelize } = require("sequelize");
const env = require("./env");

const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: "mysql",
  logging: env.nodeEnv === "development" ? console.log : false,
  pool: {
    max: env.db.pool.max,
    min: env.db.pool.min,
    acquire: env.db.pool.acquire,
    idle: env.db.pool.idle
  },
  define: {
    underscored: true,
    freezeTableName: true
  }
});

async function connectDatabase() {
  await sequelize.authenticate();
  return sequelize;
}

module.exports = {
  sequelize,
  connectDatabase
};
