// Single place that collapses a task's six real statuses
// (assigned/in_progress/submitted/reopened/approved/rejected) into the four
// states the admin-facing views (dashboard accordion, Download Center)
// present: pending/submitted/approved/rejected. No task at all is 'pending',
// and 'reopened' also resolves to 'pending' — the work is in progress again.
function resolveCourseStatus(latestTask) {
  if (latestTask?.status === 'submitted') return 'submitted';
  if (latestTask?.status === 'approved') return 'approved';
  if (latestTask?.status === 'rejected') return 'rejected';
  return 'pending';
}

module.exports = { resolveCourseStatus };
