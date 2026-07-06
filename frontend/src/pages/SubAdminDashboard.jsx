import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import AppShell from '../components/layout/AppShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

const NAV_ITEMS = [
  { key: 'department', label: 'My Department' },
  { key: 'assign', label: 'Assign Task' },
  { key: 'review', label: 'Review Submissions' },
];

function MyDepartmentTab({ user, tasks, loading }) {
  const counts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { key: 'assigned', label: 'Assigned' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'submitted', label: 'Awaiting Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <Card title={user?.name} description="Task status summary for your department.">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
          <Spinner /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {stats.map((s) => (
            <div key={s.key} className="rounded-md border border-slate-200 p-4 text-center">
              <p className="text-2xl font-semibold text-slate-900">{counts[s.key] || 0}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AssignTaskTab({ faculty, courses, onAssigned }) {
  const { token } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [assignForm, setAssignForm] = useState({ courseId: '', facultyUserId: '', deadline: '' });

  async function handleAssign(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.tasks.create(token, assignForm);
      setAssignForm({ courseId: '', facultyUserId: '', deadline: '' });
      toast.success('Task assigned — an email has been sent to the faculty member.');
      onAssigned();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title="Assign Task" description="Pick an unassigned course and a faculty member in your department.">
      {courses.length === 0 ? (
        <EmptyState
          title="No unassigned courses"
          description="Every course in your department already has a task, or the top admin hasn't added any yet."
        />
      ) : (
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
          <Button type="submit" loading={submitting}>
            Assign Task
          </Button>
        </form>
      )}
    </Card>
  );
}

function ReviewSubmissionsTab({ tasks, loading, onChanged }) {
  const { token } = useAuth();
  const toast = useToast();
  const [rejectingId, setRejectingId] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState('');

  async function handleApprove(id) {
    try {
      await api.tasks.approve(token, id);
      toast.success('Task approved.');
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function submitReject(id) {
    try {
      await api.tasks.reject(token, id, revisionNotes);
      setRejectingId(null);
      setRevisionNotes('');
      toast.success('Sent back for revision.');
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <Card title="Tasks" description="Every task assigned in your department.">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
          <Spinner /> Loading…
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState title="No tasks yet" description="Assign a course to a faculty member to get started." />
      ) : (
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
                  <Badge status={t.status} />
                </td>
                <td className="py-3">
                  {t.status === 'submitted' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button variant="success" size="sm" onClick={() => handleApprove(t.id)}>
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setRejectingId(rejectingId === t.id ? null : t.id)}
                        >
                          Reject
                        </Button>
                      </div>
                      {rejectingId === t.id && (
                        <div className="flex gap-2">
                          <input
                            className={inputClass}
                            placeholder="Revision notes"
                            value={revisionNotes}
                            onChange={(e) => setRevisionNotes(e.target.value)}
                          />
                          <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={() => submitReject(t.id)}>
                            Confirm
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export default function SubAdminDashboard() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('department');
  const [faculty, setFaculty] = useState([]);
  const [courses, setCourses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
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
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="Sub-Admin" navItems={NAV_ITEMS} activeItem={activeTab} onNavClick={setActiveTab}>
      <div className="space-y-6">
        {activeTab === 'department' && <MyDepartmentTab user={user} tasks={tasks} loading={loading} />}
        {activeTab === 'assign' && <AssignTaskTab faculty={faculty} courses={courses} onAssigned={loadAll} />}
        {activeTab === 'review' && <ReviewSubmissionsTab tasks={tasks} loading={loading} onChanged={loadAll} />}
      </div>
    </AppShell>
  );
}
