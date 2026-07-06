import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import CourseForm from '../components/CourseForm';

export default function TaskReview() {
  const { token: accessToken } = useParams();
  const { token } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.tasks.getReview(token, accessToken);
      setTask(data);
    } catch (err) {
      setError(err.message || 'Unable to load this submission.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function handleApprove() {
    setMessage('');
    try {
      await api.tasks.approveByAccessToken(token, accessToken);
      setMessage('Approved.');
      load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleReject() {
    setMessage('');
    try {
      await api.tasks.rejectByAccessToken(token, accessToken, revisionNotes);
      setMessage('Sent back for revision.');
      setRejecting(false);
      setRevisionNotes('');
      load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-slate-500">Loading…</div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="max-w-md text-center bg-white rounded-lg shadow p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Not found</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  const canDecide = task.status === 'submitted';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">Review Submission</h1>
          <p className="text-sm text-slate-500">
            {task.course?.courseCode} — {task.course?.courseTitle} · Submitted by {task.faculty?.name}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {message && (
          <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">{message}</div>
        )}

        {!canDecide && (
          <div className="rounded-md bg-slate-100 border border-slate-200 px-4 py-3 text-sm text-slate-700">
            This task is currently <strong>{task.status}</strong> and is not awaiting a decision.
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <CourseForm course={task.course} onChange={() => {}} readOnly />
        </div>

        {canDecide && (
          <div className="bg-white rounded-lg shadow p-6 space-y-3">
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md px-4 py-2"
              >
                Approve
              </button>
              <button
                onClick={() => setRejecting(!rejecting)}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md px-4 py-2"
              >
                Reject
              </button>
            </div>
            {rejecting && (
              <div className="flex gap-2">
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Revision notes for the faculty member"
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                />
                <button
                  onClick={handleReject}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-md px-4 py-2 whitespace-nowrap"
                >
                  Confirm Reject
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
