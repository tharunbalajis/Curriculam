import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import CourseForm from '../components/CourseForm';

export default function TaskFill() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [taskMeta, setTaskMeta] = useState(null);
  const [course, setCourse] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await api.tasks.getByAccessToken(token);
        setTaskMeta(data);
        setCourse(data.course);
      } catch (err) {
        setError(err.message || 'This link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitMessage('');
    setSubmitting(true);
    try {
      const result = await api.tasks.submitByAccessToken(token, course);
      setCourse(result.course);
      setTaskMeta({ ...taskMeta, status: result.status, readOnly: true });
      setSubmitMessage('Submitted for review. Your sub-admin has been notified by email.');
    } catch (err) {
      setSubmitMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-slate-500">Loading…</div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="max-w-md text-center bg-white rounded-lg shadow p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link not found</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  const readOnly = taskMeta.readOnly;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">Course Curriculum Submission</h1>
          <p className="text-sm text-slate-500">{taskMeta.department?.name}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {taskMeta.status === 'rejected' && taskMeta.revisionNotes && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            <strong>Revision requested:</strong> {taskMeta.revisionNotes}
          </div>
        )}

        {readOnly && (
          <div className="mb-6 rounded-md bg-slate-100 border border-slate-200 px-4 py-3 text-sm text-slate-700">
            This submission is {taskMeta.status} and is now read-only.
          </div>
        )}

        {submitMessage && (
          <div className="mb-6 rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            {submitMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <CourseForm
            course={course}
            onChange={setCourse}
            disabledFields={['courseCode', 'courseTitle']}
            readOnly={readOnly}
          />

          {!readOnly && (
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-md py-2 text-sm"
            >
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          )}
        </form>
      </main>
    </div>
  );
}
