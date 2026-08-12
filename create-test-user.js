/**
 * create-admin-user.js
 *
 * Install:
 *   npm install pg bcryptjs
 *
 * Run:
 *   node create-admin-user.js
 *
 * Or:
 *   node create-admin-user.js <DATABASE_URL> <name> <email> <password>
 */

const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const DEFAULTS = {
  databaseUrl:
    "postgresql://neondb_owner:npg_8dYSMjEi3UBu@ep-hidden-recipe-ayi5a6yt-pooler.c-5.us-east-2.aws.neon.tech/admin?sslmode=require&channel_binding=require",

  name: "Administrator",
  email: "admin@test.com",
  password: "Admin@123",
};

async function main() {
  const [, , argUrl, argName, argEmail, argPassword] = process.argv;

  const databaseUrl = argUrl || DEFAULTS.databaseUrl;
  const name = argName || DEFAULTS.name;
  const email = (argEmail || DEFAULTS.email).toLowerCase().trim();
  const password = argPassword || DEFAULTS.password;

  if (
    !databaseUrl ||
    databaseUrl.includes("your-neon-host")
  ) {
    console.error("Please provide a valid DATABASE_URL.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();

    // Check if user already exists
    const existing = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rowCount > 0) {
      console.log("Admin user already exists.");
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert admin user
    const result = await client.query(
      `
      INSERT INTO users
      (
        name,
        email,
        password_hash,
        role,
        is_active
      )
      VALUES
      (
        $1,
        $2,
        $3,
        'admin',
        true
      )
      RETURNING
        id,
        name,
        email,
        role,
        is_active
      `,
      [name, email, passwordHash]
    );

    const user = result.rows[0];

    console.log("\n======================================");
    console.log(" ADMIN USER CREATED SUCCESSFULLY");
    console.log("======================================");
    console.log("ID       :", user.id);
    console.log("Name     :", user.name);
    console.log("Email    :", user.email);
    console.log("Password :", password);
    console.log("Role     :", user.role);
    console.log("Active   :", user.is_active);
    console.log("======================================");

    console.log("\nLogin Credentials");
    console.log("----------------------------");
    console.log("Email :", email);
    console.log("Password :", password);
    console.log("Role : admin");
    console.log("----------------------------");

    console.log("\nLogin API:");
    console.log("POST /api/login");
    console.log(`
{
  "email": "${email}",
  "password": "${password}",
  "role": "admin"
}
`);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}

main();