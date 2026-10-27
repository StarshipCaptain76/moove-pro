/** Explicitly removed bookings must not return from saved copies or calendar imports. */
export function isExcludedJob(job: { type: string; name?: string | null; scheduledDate?: string | null }) {
  return job.type === "job" &&
    (job.name ?? "").toLowerCase().replace(/[^a-z]/g, "") === "nadiauitgevra" &&
    job.scheduledDate !== "2026-10-24";
}