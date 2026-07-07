import { useState } from 'react';
import CourseForm from './CourseForm';
import Card from './ui/Card';
import Button from './ui/Button';

// Shared by the token-based fill page (/task/:token) and the authenticated
// faculty page (/faculty/task/:id) — both reach the exact same course-fill
// experience, just via a different fetch/submit wiring in the parent page.
// `onPreviewDocx` is the page-appropriate preview call (token route vs
// authenticated route) so the same button works from either entry point.
export default function TaskDetailsForm({ taskMeta, course, onCourseChange, onSubmit, submitting, onPreviewDocx }) {
  const { status, revisionNotes, readOnly } = taskMeta;
  const [previewing, setPreviewing] = useState(false);

  // Parent pages pass an onPreviewDocx that reports its own errors (toast or
  // inline error state) — this wrapper only manages the button spinner.
  async function handlePreview() {
    setPreviewing(true);
    try {
      await onPreviewDocx();
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="space-y-6">
      {status === 'rejected' && revisionNotes && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <strong>Revision requested:</strong> {revisionNotes}
        </div>
      )}

      {/* Distinct from a rejection — the original work was approved; it was
          reopened afterwards because something needs to change. */}
      {status === 'reopened' && (
        <div className="rounded-md bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-900">
          <strong>Reopened for edits:</strong>{' '}
          {revisionNotes ||
            'Your approved submission needs a further update. Make your changes and resubmit for review.'}
        </div>
      )}

      {readOnly && (
        <div className="rounded-md bg-slate-100 border border-slate-200 px-4 py-3 text-sm text-slate-700">
          This submission has been approved and is now read-only.
        </div>
      )}

      {!readOnly && status === 'submitted' && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          Submitted and awaiting review — you can still edit and resubmit until it is approved.
        </div>
      )}

      <form onSubmit={onSubmit}>
        <Card className="space-y-6">
          {onPreviewDocx && (
            <div className="flex justify-end">
              <Button type="button" variant="secondary" loading={previewing} onClick={handlePreview}>
                Preview as .docx
              </Button>
            </div>
          )}

          <CourseForm
            course={course}
            onChange={onCourseChange}
            disabledFields={['courseCode', 'courseTitle', 'commonTo']}
            readOnly={readOnly}
          />

          {!readOnly && (
            <Button type="submit" loading={submitting} className="w-full">
              {submitting
                ? 'Submitting…'
                : status === 'submitted' || status === 'reopened'
                ? 'Resubmit for Review'
                : 'Submit for Review'}
            </Button>
          )}
        </Card>
      </form>
    </div>
  );
}
