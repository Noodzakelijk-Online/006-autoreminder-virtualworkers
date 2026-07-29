import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("operator migration contract", () => {
  const migration = readFileSync(
    new URL("../drizzle/0029_operator_evidence_foundation.sql", import.meta.url),
    "utf8",
  );
  const parityMigration = readFileSync(
    new URL("../drizzle/0030_restore_schema_parity.sql", import.meta.url),
    "utf8",
  );
  const journal = JSON.parse(
    readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  ) as { entries: Array<{ idx: number; tag: string }> };

  it("is appended after the developer migration lineage", () => {
    const entries = journal.entries.slice(-4);
    expect(entries.map((entry) => entry.tag)).toEqual([
      "0027_glorious_epoch",
      "0028_add_task_assignment_schedule",
      "0029_operator_evidence_foundation",
      "0030_restore_schema_parity",
    ]);
    expect(entries.map((entry) => entry.idx)).toEqual([27, 28, 29, 30]);
  });

  it("does not drop or rename developer data", () => {
    for (const sql of [migration, parityMigration]) {
      expect(sql).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN)\b/i);
      expect(sql).not.toMatch(/\bRENAME\s+TABLE\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    }
  });

  it("creates the required operator evidence domains", () => {
    for (const table of [
      "aptlss_assessments",
      "aptlss_waiting_reasons",
      "decision_outcomes",
      "workspace_evidence_items",
      "communication_evidence",
      "compliance_card_evidence",
      "time_reconciliation_items",
      "scheduled_job_runs",
      "browser_tab_daily_evidence",
    ]) {
      expect(migration).toContain(`CREATE TABLE \`${table}\``);
    }
  });
});
