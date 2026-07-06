import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const STATUS_STYLES = {
  assigned: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function StatusPill({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function SubAdminDashboard() {
  const { token, user, logout } = useAuth();
  const [faculty, setFaculty] = useState([]);
  const [courses, setCourses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [message, setMessage] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState('');

  const [assignForm, setAssignForm] = useState({ courseId: '', facultyUserId: '', deadline: '' });

  async function loadAll() {
    try {
      const [facultyList, unassignedCourses, taskList] = await Promise.all([
        api.users.list(token, { role: 'faculty' }),
        api.courses.list(token, { unassigned: true }),
        api.tasks.list(token),
      ]);
      setFaculty(facultyList);
      setCourses(unassignedCourses);
      setTasks(taskList);
    } catch (err) {
      setMessage(err.message);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAssign(e) {
    e.preventDefault();
    setMessage('');
    try {
      await api.tasks.create(token, assignForm);
      setAssignForm({ courseId: '', facultyUserId: '', deadline: '' });
      setMessage('Task assigned — an email has been sent to the faculty member.');
      loadAll();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleApprove(id) {
    setMessage('');
    try {
      await api.tasks.approve(token, id);
      loadAll();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function submitReject(id) {
    setMessage('');
    try {
      await api.tasks.reject(token, id, revisionNotes);
      setRejectingId(null);
      setRevisionNotes('');
      loadAll();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">CurriSync — Sub-Admin</h1>
            <p className="text-sm text-slate-500">{user?.name}</p>
          </div>
          <button onClick={logout} className="text-sm text-slate-600 hover:text-slate-900">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {message && (
          <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">{message}</div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Assign Task</h2>
          <form onSubmit={handleAssign} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Course</span>
              <select
                className={inputClass}
                required
                value={assignForm.courseId}
                onChange={(e) => setAssignForm({ ...assignForm, courseId: e.target.value })}
              >
                <option value="">Select unassigned course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode} — {c.courseTitle}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Faculty</span>
              <select
                className={inputClass}
                required
                value={assignForm.facultyUserId}
                onChange={(e) => setAssignForm({ ...assignForm, facultyUserId: e.target.value })}
              >
                <option value="">Select faculty</option>
                {faculty.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Deadline</span>
              <input
                type="date"
                className={inputClass}
                required
                value={assignForm.deadline}
                onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
              />
            </label>
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md py-2">
              Assign Task
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Tasks</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2">Course</th>
                <th className="py-2">Faculty</th>
                <th className="py-2">Deadline</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 align-top">
                  <td className="py-3">
                    {t.course?.courseCode} — {t.course?.courseTitle}
                  </td>
                  <td className="py-3">{t.faculty?.name}</td>
                  <td className="py-3">{t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}</td>
                  <td className="py-3">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="py-3">
                    {t.status === 'submitted' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(t.id)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(rejectingId === t.id ? null : t.id)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1"
                          >
                            Reject
                          </button>
                        </div>
                        {rejectingId === t.id && (
                          <div className="flex gap-2">
                            <input
                              className={inputClass}
                              placeholder="Revision notes"
                              value={revisionNotes}
                              onChange={(e) => setRevisionNotes(e.target.value)}
                            />
                            <button
                              onClick={() => submitReject(t.id)}
                              className="text-xs bg-slate-800 hover:bg-slate-900 text-white rounded px-2 py-1 whitespace-nowrap"
                            >
                              Confirm
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
