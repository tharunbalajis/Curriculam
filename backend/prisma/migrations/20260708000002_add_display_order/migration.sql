-- Manual display ordering for exports: department_id sorts by random UUID and
-- course_code alphabetically, neither of which matches the university's
-- intended sequence (e.g. Calculus 25MA101 prints before C Programming
-- 25CS101 in Semester I). top_admin/sub_admin control these via the reorder
-- endpoints; null falls back to name / course_code order.

ALTER TABLE departments ADD COLUMN display_order INTEGER;
ALTER TABLE courses ADD COLUMN display_order INTEGER;

-- Backfill so nothing is unordered after this migration: departments 1..N by
-- current name order.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS rn
  FROM departments
)
UPDATE departments d
SET display_order = ranked.rn
FROM ranked
WHERE d.id = ranked.id;

-- Courses: 1..N within each department+semester group (restarting at 1 per
-- group), by current course_code order.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY department_id, semester
    ORDER BY course_code ASC
  ) AS rn
  FROM courses
)
UPDATE courses c
SET display_order = ranked.rn
FROM ranked
WHERE c.id = ranked.id;
