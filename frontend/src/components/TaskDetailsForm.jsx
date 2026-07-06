import CourseForm from './CourseForm';
import Card from './ui/Card';
import Button from './ui/Button';

// Shared by the token-based fill page (/task/:token) and the authenticated
// faculty page (/faculty/task/:id) — both reach the exact same course-fill
// experience, just via a different fetch/submit wiring in the parent page.
export default function TaskDetailsForm({ taskMeta, course, onCourseChange, onSubmit, submitting }) {
  const { status, revisionNotes, readOnly } = taskMeta;

  return (
    <div className="space-y-6">
      {status === 'rejected' && revisionNotes && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <strong>Revision requested:</strong> {revisionNotes}
        </div>
      )}

      {readOnly && (
        <div className="rounded-md bg-slate-100 border border-slate-200 px-4 py-3 text-sm text-slate-700">
          This submission is {status} and is now read-only.
        </div>
      )}

      <form onSubmit={onSubmit}>
        <Card className="space-y-6">
          <CourseForm
            course={course}
            onChange={onCourseChange}
            disabledFields={['courseCode', 'courseTitle', 'commonTo']}
            readOnly={readOnly}
          />

          {!readOnly && (
            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </Button>
          )}
        </Card>
      </form>
    </div>
  );
}
