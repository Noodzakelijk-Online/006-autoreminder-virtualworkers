import mysql from 'mysql2/promise';
import fs from 'fs';

async function main() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/DATABASE_URL=(.*)/);
  if (!match) {
    console.error("No DATABASE_URL found");
    return;
  }
  const url = match[1].trim();
  console.log("Connecting to:", url);
  const connection = await mysql.createConnection(url);

  console.log("Disabling foreign key checks...");
  await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

  console.log("Wiping worker profiles from va_profiles...");
  await connection.execute('TRUNCATE TABLE va_profiles');

  console.log("Wiping worker user accounts from users...");
  await connection.execute("DELETE FROM users WHERE role = 'worker'");

  console.log("Wiping associated worker logs/data for clean start...");
  await connection.execute('TRUNCATE TABLE time_entries');
  await connection.execute('TRUNCATE TABLE task_assignments');
  await connection.execute('TRUNCATE TABLE triage_logs');
  await connection.execute('TRUNCATE TABLE sunday_checklist');
  await connection.execute('TRUNCATE TABLE pay_logs');
  await connection.execute('TRUNCATE TABLE performance_compliance');

  console.log("Enabling foreign key checks...");
  await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

  console.log("Wipe completed successfully!");
  await connection.end();
}

main().catch(console.error);
