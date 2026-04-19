import { eq } from "drizzle-orm";
import { drizzle as drizzleMySQL } from "drizzle-orm/mysql2";
import mysql2 from "mysql2/promise";
import { InsertUser, users } from "../drizzle/schema";
import * as schema from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: any = null;
let _migrationRan = false;

/**
 * Detect database type from CONNECTION_STRING
 * - mysql:// -> MySQL
 * - file:// or sqlite:// -> SQLite
 */
function detectDatabaseType(url: string): "mysql" | "sqlite" {
  if (url.startsWith("mysql://")) return "mysql";
  if (url.startsWith("file://") || url.startsWith("sqlite://")) return "sqlite";
  return "mysql"; // Default
}

/**
 * Run any pending CREATE TABLE IF NOT EXISTS migrations using a raw connection.
 * Safe to call multiple times — all statements use IF NOT EXISTS.
 */
async function runPendingMigrations(connectionUrl: string): Promise<void> {
  if (_migrationRan) return;
  _migrationRan = true;

  let conn: mysql2.Connection | null = null;
  try {
    conn = await mysql2.createConnection(connectionUrl);

    const statements = [
      `CREATE TABLE IF NOT EXISTS \`ares_configurations\` (
        \`id\` varchar(64) NOT NULL,
        \`userId\` int NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`description\` text,
        \`strictnessLevel\` enum('lenient','moderate','strict') NOT NULL DEFAULT 'moderate',
        \`confidenceThreshold\` int NOT NULL DEFAULT 40,
        \`enableVaguenessCheck\` boolean NOT NULL DEFAULT true,
        \`enableMeasurabilityCheck\` boolean NOT NULL DEFAULT true,
        \`enableTimelineCheck\` boolean NOT NULL DEFAULT true,
        \`enableResourceCheck\` boolean NOT NULL DEFAULT false,
        \`enableDependencyCheck\` boolean NOT NULL DEFAULT false,
        \`isDefault\` boolean NOT NULL DEFAULT false,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      )`,
      `CREATE TABLE IF NOT EXISTS \`ares_validation_rules\` (
        \`id\` varchar(64) NOT NULL,
        \`configId\` varchar(64) NOT NULL,
        \`ruleType\` enum('vagueness','measurability','timeline','resources','dependencies','clarity','specificity','actionability') NOT NULL,
        \`ruleName\` varchar(255) NOT NULL,
        \`description\` text,
        \`severity\` enum('info','warning','error') NOT NULL DEFAULT 'warning',
        \`enabled\` boolean NOT NULL DEFAULT true,
        \`threshold\` int DEFAULT 50,
        \`customLogic\` text,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`ares_rules_config_fk\` FOREIGN KEY (\`configId\`) REFERENCES \`ares_configurations\`(\`id\`)
      )`,
      `CREATE TABLE IF NOT EXISTS \`ares_validation_history\` (
        \`id\` varchar(64) NOT NULL,
        \`configId\` varchar(64) NOT NULL,
        \`cardId\` varchar(64) NOT NULL,
        \`cardName\` text NOT NULL,
        \`goalDefinition\` text,
        \`confidenceScore\` int NOT NULL,
        \`passed\` boolean NOT NULL,
        \`failedRules\` text,
        \`warnings\` text,
        \`validationDetails\` text,
        \`validatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`validatedBy\` int NOT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`ares_history_config_fk\` FOREIGN KEY (\`configId\`) REFERENCES \`ares_configurations\`(\`id\`)
      )`,
    ];

    for (const sql of statements) {
      await conn.execute(sql);
    }

    console.log("[Database] ARES tables ensured (migration applied)");
  } catch (err) {
    // Non-fatal — log and continue. The ARES panel will show its own error state.
    console.warn("[Database] ARES migration warning:", err);
    _migrationRan = false; // allow retry on next request
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const dbType = detectDatabaseType(process.env.DATABASE_URL);
      
      if (dbType === "sqlite") {
        console.warn("[Database] SQLite support is planned but not yet implemented. Please use MySQL.");
        _db = null;
      } else {
        // Run pending migrations before handing out the connection
        await runPendingMigrations(process.env.DATABASE_URL);
        _db = drizzleMySQL(process.env.DATABASE_URL, { schema, mode: 'default' });
        console.log("[Database] Connected to MySQL");
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
