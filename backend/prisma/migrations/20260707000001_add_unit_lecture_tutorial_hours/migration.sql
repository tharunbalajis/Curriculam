-- Split per-unit hours into lecture + tutorial so the generated document can
-- render "(9+3)" the way the university master copy does.
--
-- The legacy `hours` column is kept (deprecated) so existing readers keep
-- working; new writes populate all three columns.

ALTER TABLE syllabus_units ADD COLUMN lecture_hours INTEGER;
ALTER TABLE syllabus_units ADD COLUMN tutorial_hours INTEGER;

-- Backfill: pre-split rows only ever recorded a single (lecture) figure.
UPDATE syllabus_units
SET lecture_hours = hours,
    tutorial_hours = 0
WHERE lecture_hours IS NULL;
