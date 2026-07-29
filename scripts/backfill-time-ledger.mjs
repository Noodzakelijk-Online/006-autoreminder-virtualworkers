import "dotenv/config";
import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [result] = await connection.execute(`
    INSERT INTO time_entry_events (timeEntryId, eventType, reason, metadataJson, createdAt)
    SELECT entry.id, 'legacy_import', 'Existing timer session imported into the immutable ledger', '{"source":"backfill"}', COALESCE(entry.updatedAt, entry.createdAt)
    FROM time_entries entry
    WHERE NOT EXISTS (
      SELECT 1 FROM time_entry_events event WHERE event.timeEntryId = entry.id
    )
  `);
  const [rows] = await connection.execute(`
    SELECT
      (SELECT COUNT(*) FROM time_entries) AS entries,
      (SELECT COUNT(*) FROM time_entry_events) AS events
  `);
  console.log(
    JSON.stringify({ inserted: result.affectedRows, counts: rows[0] })
  );
} finally {
  await connection.end();
}
