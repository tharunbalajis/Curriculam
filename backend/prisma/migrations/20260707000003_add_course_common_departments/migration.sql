-- "Common To" becomes structured data: a join table between courses and the
-- departments a course is shared with, replacing the free-text courses.common_to
-- column as the source of truth. The legacy text column is kept (deprecated)
-- so courses saved before this migration still render their line.

CREATE TABLE course_common_departments (
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, department_id)
);

CREATE INDEX idx_course_common_departments_department ON course_common_departments(department_id);
