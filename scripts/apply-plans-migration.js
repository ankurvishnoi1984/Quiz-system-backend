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
    database: env.db.name,
    multipleStatements: true
  });

  try {
    if (!(await tableExists(connection, "plans"))) {
      await connection.query(`
        CREATE TABLE plans (
          plan_id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(120) NOT NULL,
          description VARCHAR(500) NULL,
          max_participants INT NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (plan_id),
          UNIQUE KEY plans_name_unique (name)
        )
      `);
      console.log("created table plans");
    } else {
      console.log("table plans already exists");
    }

    if (!(await columnExists(connection, "users", "plan_id"))) {
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN plan_id INT NULL AFTER dept_id,
        ADD CONSTRAINT users_plan_id_fk FOREIGN KEY (plan_id) REFERENCES plans (plan_id)
          ON UPDATE CASCADE ON DELETE SET NULL
      `);
      console.log("added users.plan_id");
    } else {
      console.log("users.plan_id already exists");
    }

    if (!(await columnExists(connection, "users", "plan_limit_email_sent_at"))) {
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN plan_limit_email_sent_at DATETIME NULL AFTER plan_id
      `);
      console.log("added users.plan_limit_email_sent_at");
    } else {
      console.log("users.plan_limit_email_sent_at already exists");
    }

    const [existing] = await connection.query("SELECT COUNT(*) AS total FROM plans");
    if (Number(existing[0]?.total) === 0) {
      await connection.query(`
        INSERT INTO plans (name, description, max_participants, is_active)
        VALUES
          ('Starter', 'Up to 50 participants across all sessions', 50, 1),
          ('Standard', 'Up to 100 participants across all sessions', 100, 1),
          ('Professional', 'Up to 500 participants across all sessions', 500, 1),
          ('Enterprise', 'Up to 2000 participants across all sessions', 2000, 1)
      `);
      console.log("seeded default plans");
    } else {
      console.log("plans already seeded");
    }
  } finally {
    await connection.end();
  }
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
