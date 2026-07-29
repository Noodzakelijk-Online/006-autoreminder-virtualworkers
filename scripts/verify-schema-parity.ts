import "dotenv/config";
import mysql from "mysql2/promise";
import { getTableConfig, type MySqlTable } from "drizzle-orm/mysql-core";
import * as schema from "../drizzle/schema";

type SchemaTable = {
  name: string;
  columns: string[];
};

function collectSchemaTables(): SchemaTable[] {
  const tables = new Map<string, SchemaTable>();
  for (const value of Object.values(schema)) {
    if (!value || typeof value !== "object") continue;
    try {
      const config = getTableConfig(value as MySqlTable);
      if (!config.name || !config.columns.length) continue;
      tables.set(config.name, {
        name: config.name,
        columns: config.columns.map((column) => column.name).sort(),
      });
    } catch {
      // Types and non-table exports are intentionally ignored.
    }
  }
  return [...tables.values()].sort((left, right) => left.name.localeCompare(right.name));
}

const connectionUrl = process.env.DATABASE_URL;
if (!connectionUrl?.startsWith("mysql://")) {
  throw new Error("DATABASE_URL must be a MySQL URL");
}

const connection = await mysql.createConnection(connectionUrl);
try {
  const [rows] = await connection.query<Array<{ TABLE_NAME: string; COLUMN_NAME: string }> & mysql.RowDataPacket[]>(
    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION",
  );
  const actual = new Map<string, Set<string>>();
  for (const row of rows) {
    const columns = actual.get(row.TABLE_NAME) ?? new Set<string>();
    columns.add(row.COLUMN_NAME);
    actual.set(row.TABLE_NAME, columns);
  }

  const missingTables: string[] = [];
  const missingColumns: Array<{ table: string; columns: string[] }> = [];
  const extraColumns: Array<{ table: string; columns: string[] }> = [];
  const schemaTables = collectSchemaTables();

  for (const table of schemaTables) {
    const actualColumns = actual.get(table.name);
    if (!actualColumns) {
      missingTables.push(table.name);
      continue;
    }
    const missing = table.columns.filter((column) => !actualColumns.has(column));
    const extra = [...actualColumns].filter((column) => !table.columns.includes(column)).sort();
    if (missing.length) missingColumns.push({ table: table.name, columns: missing });
    if (extra.length) extraColumns.push({ table: table.name, columns: extra });
  }

  const result = {
    success: missingTables.length === 0 && missingColumns.length === 0,
    expectedTables: schemaTables.length,
    actualTables: actual.size,
    missingTables,
    missingColumns,
    extraColumns,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 2;
} finally {
  await connection.end();
}
