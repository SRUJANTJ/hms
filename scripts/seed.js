require("dotenv").config({ path: ".env" });

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL || "admin@hostel.com";

const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD || "Admin@123";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not found.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Execute schema.sql
    const schemaPath = path.join(__dirname, "..", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);

    console.log("✓ Database schema verified.");

    // Check admin
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [ADMIN_EMAIL]
    );

    if (existing.rowCount > 0) {
      console.log("✓ Admin already exists.");
      return;
    }

    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await pool.query(
      `
      INSERT INTO users
      (
        name,
        email,
        phone,
        password_hash,
        role,
        image,
        is_active
      )
      VALUES
      (
        $1,
        $2,
        NULL,
        $3,
        'admin',
        NULL,
        TRUE
      )
      `,
      [
        "Super Admin",
        ADMIN_EMAIL,
        hash,
      ]
    );

    console.log("");
    console.log("========================================");
    console.log("Admin account created successfully");
    console.log("========================================");
    console.log("Email    :", ADMIN_EMAIL);
    console.log("Password :", ADMIN_PASSWORD);
    console.log("Role     : admin");
    console.log("========================================");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});