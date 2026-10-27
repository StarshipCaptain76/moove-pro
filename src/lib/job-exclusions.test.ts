import { test, expect } from "bun:test";
import { isExcludedJob } from "./job-exclusions";

test("removes historical and future Nadia uitgevra jobs", () => {
  for (const scheduledDate of ["2026-04-19", "2026-10-19", "2027-11-19", undefined]) {
    expect(isExcludedJob({ type: "job", name: "Nadia uit gevra", scheduledDate })).toBe(true);
  }
});
test("preserves the 24 October 2026 exception", () => {
  expect(isExcludedJob({ type: "job", name: "NADIA UITGEVRA", scheduledDate: "2026-10-24" })).toBe(false);
});
test("leaves other Nadia customers and invoices unchanged", () => {
  expect(isExcludedJob({ type: "job", name: "Nadia trek", scheduledDate: "2026-10-19" })).toBe(false);
  expect(isExcludedJob({ type: "invoice", name: "Nadia uit gevra", scheduledDate: "2026-10-19" })).toBe(false);
});