import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

/**
 * Auto-detect database dialect from CONNECTION_STRING format
 * - mysql:// → MySQL
 * - file:// → SQLite
 * - postgresql:// → PostgreSQL (future)
 */
function detectDialect(url: string): "mysql" | "sqlite" | "postgresql" {
  if (url.startsWith("mysql://")) return "mysql";
  if (url.startsWith("file://") || url.startsWith("sqlite://")) return "sqlite";
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) return "postgresql";
  
  // Default to MySQL for backward compatibility
  console.warn("[Drizzle] Could not detect database dialect from DATABASE_URL. Defaulting to MySQL.");
  return "mysql";
}

const dialect = detectDialect(connectionString);
console.log(`[Drizzle] Detected dialect: ${dialect}`);

const config = {
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: dialect,
  dbCredentials: {
    url: connectionString,
  },
} as any;

// SQLite requires file path instead of URL
if (dialect === "sqlite") {
  const filePath = connectionString.replace(/^(file:\/\/|sqlite:\/\/)/, "");
  config.dbCredentials = {
    url: filePath,
  };
}

export default defineConfig(config);
