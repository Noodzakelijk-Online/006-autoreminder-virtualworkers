import mysql2 from "mysql2/promise";
import { readFileSync } from "fs";

// Load env from .env if present
try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch {}

const conn = await mysql2.createConnection(process.env.DATABASE_URL);

const statements = [
  // Tracks per-card per-day whether Joyce has assigned a due date
  `CREATE TABLE IF NOT EXISTS \`daily_due_date_assignments\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`cardId\` varchar(64) NOT NULL,
    \`cardName\` varchar(512) NOT NULL,
    \`cardUrl\` varchar(1024) NOT NULL,
    \`date\` date NOT NULL,
    \`completed\` boolean NOT NULL DEFAULT false,
    \`completedAt\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`daily_due_date_assignments_id\` PRIMARY KEY(\`id\`),
    UNIQUE KEY \`daily_due_date_assignments_card_date\` (\`cardId\`, \`date\`)
  )`,

  // Tracks per-card per-day whether Joyce has posted a daily update
  `CREATE TABLE IF NOT EXISTS \`daily_card_updates\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`cardId\` varchar(64) NOT NULL,
    \`cardName\` varchar(512) NOT NULL,
    \`cardUrl\` varchar(1024) NOT NULL,
    \`date\` date NOT NULL,
    \`completed\` boolean NOT NULL DEFAULT false,
    \`completedAt\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`daily_card_updates_id\` PRIMARY KEY(\`id\`),
    UNIQUE KEY \`daily_card_updates_card_date\` (\`cardId\`, \`date\`)
  )`,

  // Tracks per-day whether Joyce has reviewed the ON-HOLD list
  `CREATE TABLE IF NOT EXISTS \`daily_onhold_review\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`date\` date NOT NULL,
    \`completed\` boolean NOT NULL DEFAULT false,
    \`completedAt\` timestamp NULL,
    \`movedCards\` text NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`daily_onhold_review_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`daily_onhold_review_date_unique\` UNIQUE(\`date\`)
  )`,
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS `([^`]+)`/)?.[1];
    console.log(`✅ Table created/verified: ${tableName}`);
  } catch (err) {
    console.error(`❌ Failed:`, err.message);
    process.exit(1);
  }
}

await conn.end();
console.log("✅ Migration complete — all 3 action-alert tracking tables ready.");
