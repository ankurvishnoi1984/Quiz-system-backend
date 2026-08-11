const env = require("../src/config/env");
const mysql = require("mysql2/promise");

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS present
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [env.db.name, table, column]
  );
  return Number(rows[0]?.present) > 0;
}

async function tableExists(connection, table) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS present
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [env.db.name, table]
  );
  return Number(rows[0]?.present) > 0;
}

(async () => {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name
  });

  try {
    if (!(await columnExists(connection, "users", "extra_participants"))) {
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN extra_participants INT NOT NULL DEFAULT 0 AFTER plan_id
      `);
      console.log("added users.extra_participants");
    } else {
      console.log("users.extra_participants already exists");
    }

    if (!(await tableExists(connection, "user_participant_addons"))) {
      await connection.query(`
        CREATE TABLE user_participant_addons (
          addon_id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          seats INT NOT NULL,
          note VARCHAR(255) NULL,
          created_by INT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (addon_id),
          KEY user_participant_addons_user_id (user_id),
          CONSTRAINT user_participant_addons_user_fk
            FOREIGN KEY (user_id) REFERENCES users (user_id)
            ON UPDATE CASCADE ON DELETE CASCADE
        )
      `);
      console.log("created table user_participant_addons");
    } else {
      console.log("table user_participant_addons already exists");
    }
  } finally {
    await connection.end();
  }
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
