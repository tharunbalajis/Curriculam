// Single place that collapses a task's five real statuses
// (assigned/in_progress/submitted/approved/rejected) into the four states
// the admin-facing views (dashboard accordion, Download Center) present:
// pending/submitted/approved/rejected. No task at all is also 'pending'.
function resolveCourseStatus(latestTask) {
  if (latestTask?.status === 'submitted') return 'submitted';
  if (latestTask?.status === 'approved') return 'approved';
  if (latestTask?.status === 'rejected') return 'rejected';
  return 'pending';
}

module.exports = { resolveCourseStatus };
