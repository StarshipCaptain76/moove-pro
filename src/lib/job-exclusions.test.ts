import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isExcludedJob } from "./job-exclusions";

test("removes historical and future Nadia uitgevra jobs", () => {
  for (const scheduledDate of ["2026-04-19", "2026-10-19", "2027-11-19", undefined]) {
    assert.equal(isExcludedJob({ type: "job", name: "Nadia uit gevra", scheduledDate }), true);
  }
});
test("preserves the 24 October 2026 exception", () => {
  assert.equal(isExcludedJob({ type: "job", name: "NADIA UITGEVRA", scheduledDate: "2026-10-24" }), false);
});
test("leaves other Nadia customers and invoices unchanged", () => {
  assert.equal(isExcludedJob({ type: "job", name: "Nadia trek", scheduledDate: "2026-10-19" }), false);
  assert.equal(isExcludedJob({ type: "invoice", name: "Nadia uit gevra", scheduledDate: "2026-10-19" }), false);
});