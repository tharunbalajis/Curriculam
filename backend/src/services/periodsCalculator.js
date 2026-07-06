// Periods are a pure display-derived value on top of `credits` (itself a
// DB-generated column) — not new source data, so this stays a stateless
// calculation with no persistence. Not yet wired into any route: this
// project has no document-generation logic today, so the only current
// consumer is the frontend's own mirrored copy of this same formula in
// CourseForm.jsx. Kept here, ready to be the single source of truth the
// moment a document generator is added, per the instruction that any such
// generator must reuse this exact function rather than recompute inline.
function calculatePeriods(credits, unitCount = 5) {
  const totalPeriods = Number(credits) * 15;
  // periodsPerUnit is rounded to the nearest whole period when it doesn't
  // divide evenly (e.g. 4.5 credits -> 67.5 total -> 13.5/unit -> 14) since
  // a period can't be fractional in a real timetable. totalPeriods itself
  // is left exact.
  const periodsPerUnit = Math.round(totalPeriods / unitCount);

  return { totalPeriods, periodsPerUnit };
}

module.exports = { calculatePeriods };
