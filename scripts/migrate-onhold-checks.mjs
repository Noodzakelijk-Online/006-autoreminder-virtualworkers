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
  // Drop the old single-row daily_onhold_review table if it exists
  `DROP TABLE IF EXISTS \`daily_onhold_review\``,
  // Per-card per-day ON-HOLD check tracking
  `CREATE TABLE IF NOT EXISTS \`on_hold_daily_checks\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`cardId\` varchar(64) NOT NULL,
    \`cardName\` varchar(512) NOT NULL,
    \`cardUrl\` varchar(1024) NOT NULL,
    \`date\` date NOT NULL,
    \`checked\` boolean NOT NULL DEFAULT false,
    \`checkedAt\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`on_hold_daily_checks_id\` PRIMARY KEY(\`id\`),
    UNIQUE KEY \`on_hold_daily_checks_card_date\` (\`cardId\`, \`date\`)
  )`,
];
for (const sql of statements) {
  console.log("Running:", sql.slice(0, 60) + "...");
  await conn.execute(sql);
}
await conn.end();
console.log("Migration complete.");
