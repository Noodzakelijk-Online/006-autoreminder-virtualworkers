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
  `CREATE TABLE IF NOT EXISTS \`payment_cycles\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`cycleStart\` date NOT NULL,
    \`cycleEnd\` date NOT NULL,
    \`baseAmount\` decimal(8,2) NOT NULL DEFAULT 90.00,
    \`isPaid\` boolean NOT NULL DEFAULT false,
    \`paidAt\` timestamp NULL,
    \`paidBy\` varchar(64) NULL,
    \`notes\` text NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`payment_cycles_id\` PRIMARY KEY(\`id\`)
  )`,

  `CREATE TABLE IF NOT EXISTS \`weekly_pay_log\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`weekStart\` date NOT NULL,
    \`weekEnd\` date NOT NULL,
    \`paymentCycleId\` int NULL,
    \`baseAmount\` decimal(8,2) NOT NULL DEFAULT 90.00,
    \`meritM1\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`meritM2\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`meritM3\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`meritStreak\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD1\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD2\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD3\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD4\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD5\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD6\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD7\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD8\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD9\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD10\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`demeritD11\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`totalMerits\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`totalDemerits\` decimal(8,2) NOT NULL DEFAULT 0.00,
    \`projectedPay\` decimal(8,2) NOT NULL DEFAULT 90.00,
    \`notes\` text NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`weekly_pay_log_id\` PRIMARY KEY(\`id\`)
  )`,

  `CREATE TABLE IF NOT EXISTS \`daily_triage_state\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`triageDate\` date NOT NULL,
    \`step1Done\` boolean NOT NULL DEFAULT false,
    \`step2Done\` boolean NOT NULL DEFAULT false,
    \`step3Done\` boolean NOT NULL DEFAULT false,
    \`step4Done\` boolean NOT NULL DEFAULT false,
    \`step5Done\` boolean NOT NULL DEFAULT false,
    \`focusTasks\` text NULL,
    \`eveningStep1Done\` boolean NOT NULL DEFAULT false,
    \`eveningStep2Done\` boolean NOT NULL DEFAULT false,
    \`eveningStep3Done\` boolean NOT NULL DEFAULT false,
    \`eveningStep4Done\` boolean NOT NULL DEFAULT false,
    \`eodReport\` text NULL,
    \`currentView\` varchar(32) NOT NULL DEFAULT 'overview',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`daily_triage_state_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`daily_triage_state_triageDate_unique\` UNIQUE(\`triageDate\`)
  )`,

  // Seed the first payment cycle: May 5 2026 (paid today) → next pay May 22 2026
  `INSERT IGNORE INTO \`payment_cycles\` (\`cycleStart\`, \`cycleEnd\`, \`baseAmount\`, \`isPaid\`, \`paidAt\`, \`notes\`) VALUES
    ('2026-04-24', '2026-05-05', 90.00, true, '2026-05-05 00:00:00', 'Early payment — Joyce asked for pay earlier, paid on May 5'),
    ('2026-05-06', '2026-05-22', 90.00, false, NULL, 'Regular cycle — pay due Friday May 22')`,
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    console.log("✓ OK:", sql.trim().split("\n")[0].slice(0, 60));
  } catch (e) {
    console.error("✗ FAIL:", e.message);
    console.error("  SQL:", sql.trim().split("\n")[0].slice(0, 80));
  }
}

await conn.end();
console.log("Migration complete.");
