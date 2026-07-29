import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check if time_entries already exists
const [tables] = await conn.execute(
  "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'time_entries'"
);

if (tables.length > 0) {
  console.log("✓ time_entries table already exists");
} else {
  console.log("Creating time_entries table...");
  await conn.execute(`
    CREATE TABLE \`time_entries\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`cardId\` varchar(64) NOT NULL,
      \`cardName\` varchar(512) NOT NULL,
      \`cardUrl\` varchar(1024) NOT NULL,
      \`boardName\` varchar(256) NOT NULL DEFAULT 'Unknown Board',
      \`listName\` varchar(256) NOT NULL DEFAULT 'Unknown',
      \`startedAt\` timestamp NOT NULL,
      \`stoppedAt\` timestamp NULL,
      \`durationSeconds\` int NULL,
      \`notes\` text NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`time_entries_id\` PRIMARY KEY(\`id\`)
    )
  `);
  console.log("✓ time_entries table created");
}

// Also check on_hold_daily_checks
const [ohTables] = await conn.execute(
  "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'on_hold_daily_checks'"
);
if (ohTables.length > 0) {
  console.log("✓ on_hold_daily_checks table already exists");
} else {
  console.log("Creating on_hold_daily_checks table...");
  await conn.execute(`
    CREATE TABLE \`on_hold_daily_checks\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`cardId\` varchar(64) NOT NULL,
      \`cardName\` varchar(512) NOT NULL,
      \`cardUrl\` varchar(1024) NOT NULL,
      \`date\` date NOT NULL,
      \`checked\` boolean NOT NULL DEFAULT false,
      \`checkedAt\` timestamp NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`on_hold_daily_checks_id\` PRIMARY KEY(\`id\`)
    )
  `);
  console.log("✓ on_hold_daily_checks table created");
}

await conn.end();
console.log("Done.");
