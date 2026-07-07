import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import AppShell from '../components/layout/AppShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import DownloadCenter from '../components/DownloadCenter';
import FacultySelect from '../components/FacultySelect';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

const NAV_ITEMS = [
  { key: 'department', label: 'My Department' },
  { key: 'assign', label: 'Assign Task' },
  { key: 'review', label: 'Review Submissions' },
  { key: 'downloads', label: 'Downloads' },
];

function MyDepartmentTab({ user, tasks, loading }) {
  // Clicking a tile toggles a filtered task list below — uses the tasks
  // already loaded into this component, no extra API call.
  const [selectedStatus, setSelectedStatus] = useState(null);

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

  const selectedLabel = stats.find((s) => s.key === selectedStatus)?.label;
  const filteredTasks = selectedStatus ? tasks.filter((t) => t.status === selectedStatus) : [];

  return (
    <Card title={user?.name} description="Task status summary for your department. Click a tile to see its tasks.">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
          <Spinner /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {stats.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === s.key ? null : s.key)}
                className={`rounded-md border p-4 text-center transition cursor-pointer ${
                  selectedStatus === s.key
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-2xl font-semibold text-slate-900">{counts[s.key] || 0}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </button>
            ))}
          </div>

          {selectedStatus && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                {selectedLabel} ({filteredTasks.length})
              </h4>
              {filteredTasks.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No tasks with this status.</p>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 bg-white rounded-md border border-slate-200 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {t.course?.courseCode} — {t.course?.courseTitle}
                        </p>
                        <p className="text-xs text-slate-500">{t.faculty?.name || 'No faculty'}</p>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">
                        {t.deadline ? new Date(t.deadline).toLocaleDateString() : 'No deadline'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
    <Card
      title="Assign Task"
      description="Click an unassigned course below, then pick a faculty member. Shared (common-to) courses may go to faculty from any of their common-to departments."
    >
      {courses.length === 0 ? (
        <EmptyState
          title="No unassigned courses"
          description="Every course in your department already has a task, or the top admin hasn't added any yet."
        />
      ) : (
        <div className="space-y-5">
          {/* Browsable course cards — the primary way to pick a course. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setAssignForm({ ...assignForm, courseId: assignForm.courseId === c.id ? '' : c.id })}
                className={`rounded-md border p-3 text-left transition cursor-pointer ${
                  assignForm.courseId === c.id
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{c.courseCode}</p>
                <p className="text-sm text-slate-700 truncate">{c.courseTitle}</p>
                <p className="text-xs text-slate-500 mt-1">Semester {c.semester}</p>
              </button>
            ))}
          </div>

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
                    {c.courseCode} — {c.courseTitle} (Sem {c.semester})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Faculty</span>
              <FacultySelect
                faculty={faculty}
                value={assignForm.facultyUserId}
                onChange={(id) => setAssignForm({ ...assignForm, facultyUserId: id })}
              />
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
            <Button type="submit" loading={submitting} disabled={!assignForm.facultyUserId}>
              Assign Task
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}

function ReviewSubmissionsTab({ tasks, loading }) {
  // Approve/Reject decisions live exclusively on the /review/:token page,
  // which shows the full read-only submission — a decision can't be made
  // without seeing (or downloading) what was actually submitted.
  return (
    <Card title="Tasks" description="Every task assigned in your department. Open a task to preview the submission and approve or reject it.">
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
                  <span className="text-slate-400"> · Sem {t.course?.semester}</span>
                </td>
                <td className="py-3">{t.faculty?.name}</td>
                <td className="py-3">{t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}</td>
                <td className="py-3">
                  <Badge status={t.status} />
                </td>
                <td className="py-3">
                  <Link
                    to={`/review/${t.accessToken}`}
                    className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
                  >
                    Preview &amp; Review
                  </Link>
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
        // College-wide faculty for the assign-task picker — shared (common-to)
        // courses may be assigned to faculty from partner departments.
        api.users.list(token, { role: 'faculty', scope: 'college' }),
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
        {activeTab === 'review' && <ReviewSubmissionsTab tasks={tasks} loading={loading} />}
        {activeTab === 'downloads' && <DownloadCenter />}
      </div>
    </AppShell>
  );
}
