-- New task status 'reopened': an approved task reopened by the sub-admin /
-- top admin for further edits. Behaves like 'rejected' for edit access (the
-- faculty member can edit and resubmit) but is labeled distinctly, since
-- nothing was wrong with the original work.

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('assigned', 'in_progress', 'submitted', 'reopened', 'approved', 'rejected'));
