-- Fixed curriculum revision date per department, printed in the exported
-- document header (the master copy shows e.g. 23.03.2026 — the date the
-- revision was finalized, not the export date). Nullable: departments with
-- no date set fall back to today's date at export time.

ALTER TABLE departments ADD COLUMN revision_date DATE;
