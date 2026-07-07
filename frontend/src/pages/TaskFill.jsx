import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import TaskDetailsForm from '../components/TaskDetailsForm';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';

export default function TaskFill() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [taskMeta, setTaskMeta] = useState(null);
  const [course, setCourse] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    setSubmitting(true);
    try {
      const result = await api.tasks.submitByAccessToken(token, course);
      setCourse(result.course);
      // Only approval locks the form — the faculty member can keep editing
      // and resubmitting until the sub-admin approves.
      setTaskMeta({ ...taskMeta, status: result.status, readOnly: result.status === 'approved' });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreviewDocx() {
    try {
      await api.tasks.previewDocxByToken(token);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500 gap-2">
        <Spinner /> Loading…
      </div>
    );
  }

  if (error && !taskMeta) {
    return (
      <div className="flex items-center justify-center h-screen px-4 bg-slate-50">
        <Card className="max-w-md text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link not found</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/logo.png" alt="PSG iTech" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">Course Curriculum Submission</h1>
            <p className="text-sm text-slate-500">{taskMeta.department?.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {submitted && (
          <div className="mb-6 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            Submitted for review. Your sub-admin has been notified by email — you may close this tab.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        <TaskDetailsForm
          taskMeta={taskMeta}
          course={course}
          onCourseChange={setCourse}
          onSubmit={handleSubmit}
          submitting={submitting}
          onPreviewDocx={handlePreviewDocx}
        />
      </main>
    </div>
  );
}
