/**
 * Migration: create the daily_update_streak table.
 * Run with: node scripts/migrate-streak-table.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS daily_update_streak (
      id INT AUTO_INCREMENT PRIMARY KEY,
      streakDate DATE NOT NULL UNIQUE,
      completedBeforeDeadline TINYINT(1) NOT NULL DEFAULT 0,
      completedAt TIMESTAMP NULL,
      doingCardCount INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ daily_update_streak table created (or already exists).");
} finally {
  await conn.end();
}
