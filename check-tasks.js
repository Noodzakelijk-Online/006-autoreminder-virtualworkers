import mysql from 'mysql2/promise';
import fs from 'fs';

async function main() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/DATABASE_URL=(.*)/);
  const url = match[1].trim();
  const connection = await mysql.createConnection(url);

  const [assignments] = await connection.execute('SELECT * FROM task_assignments');
  console.log("Assignments in DB:");
  console.log(JSON.stringify(assignments, null, 2));

  const [profiles] = await connection.execute('SELECT * FROM va_profiles');
  console.log("Profiles in DB:");
  console.log(JSON.stringify(profiles, null, 2));

  const [users] = await connection.execute('SELECT id, openId, role FROM users');
  console.log("Users in DB:");
  console.log(JSON.stringify(users, null, 2));

  await connection.end();
}

main().catch(console.error);
