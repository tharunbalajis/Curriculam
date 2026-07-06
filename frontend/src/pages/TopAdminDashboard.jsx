import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import AppShell from '../components/layout/AppShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import DepartmentStatusBadge from '../components/DepartmentStatusBadge';
import Badge from '../components/ui/Badge';
import DownloadCenter from '../components/DownloadCenter';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

const CATEGORIES = ['BS', 'HS', 'ES', 'PC', 'PE', 'OE', 'EEC', 'MC'];

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'departments', label: 'Departments' },
  { key: 'users', label: 'Users' },
  { key: 'courses', label: 'Courses' },
  { key: 'downloads', label: 'Downloads' },
];

function DepartmentAccordionRow({ department }) {
  const { token } = useAuth();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail) {
      setLoadingDetail(true);
      try {
        const data = await api.admin.departmentCourses(token, department.id);
        setDetail(data);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoadingDetail(false);
      }
    }
  }

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 bg-white hover:bg-slate-50 transition text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            <path d="M7 5l6 5-6 5V5z" />
          </svg>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{department.name}</p>
            <p className="text-xs text-slate-500">{department.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm text-slate-500">{department.totalCourses} courses</span>
          <DepartmentStatusBadge status={department.status} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 space-y-5">
          {loadingDetail ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
              <Spinner /> Loading courses…
            </div>
          ) : (
            detail?.semesters.map((sem) => (
              <div key={sem.semester}>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Semester {sem.semester}</h4>
                {sem.courses.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No courses assigned.</p>
                ) : (
                  <div className="space-y-2">
                    {sem.courses.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-3 bg-white rounded-md border border-slate-200 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {c.courseCode} — {c.courseTitle}
                          </p>
                          <p className="text-xs text-slate-500">{c.faculty || 'No faculty assigned'}</p>
                        </div>
                        <Badge status={c.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ departments, loading }) {
  if (loading) {
    return (
      <Card title="Departments">
        <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
          <Spinner /> Loading departments…
        </div>
      </Card>
    );
  }

  if (departments.length === 0) {
    return (
      <Card title="Departments">
        <EmptyState
          title="No departments yet"
          description="Create a department in the Departments tab to get started."
        />
      </Card>
    );
  }

  return (
    <Card title="Departments" description="Expand a department to see its full semester-by-semester curriculum status.">
      <div className="space-y-3">
        {departments.map((d) => (
          <DepartmentAccordionRow key={d.id} department={d} />
        ))}
      </div>
    </Card>
  );
}

function DepartmentsTab({ onCreated }) {
  const { token } = useAuth();
  const toast = useToast();
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateDepartment(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.departments.create(token, deptForm);
      setDeptForm({ name: '', code: '' });
      toast.success('Department created.');
      onCreated();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title="Create Department">
      <form onSubmit={handleCreateDepartment} className="space-y-3 max-w-md">
        <input
          className={inputClass}
          placeholder="Name"
          required
          value={deptForm.name}
          onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Code"
          required
          value={deptForm.code}
          onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
        />
        <Button type="submit" loading={submitting}>
          Create
        </Button>
      </form>
    </Card>
  );
}

function UsersTab({ departments }) {
  const { token } = useAuth();
  const toast = useToast();
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'sub_admin', departmentId: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateUser(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.users.create(token, userForm);
      setUserForm({ name: '', email: '', password: '', role: 'sub_admin', departmentId: '' });
      toast.success('User created.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title="Create User" description="Sub-admins and faculty are scoped to a single department.">
      <form onSubmit={handleCreateUser} className="space-y-3 max-w-md">
        <input
          className={inputClass}
          placeholder="Name"
          required
          value={userForm.name}
          onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
        />
        <input
          type="email"
          className={inputClass}
          placeholder="Email"
          required
          value={userForm.email}
          onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
        />
        <input
          type="password"
          className={inputClass}
          placeholder="Password"
          required
          minLength={6}
          value={userForm.password}
          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
        />
        <select
          className={inputClass}
          value={userForm.role}
          onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
        >
          <option value="sub_admin">Sub-Admin</option>
          <option value="faculty">Faculty</option>
        </select>
        <select
          className={inputClass}
          required
          value={userForm.departmentId}
          onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}
        >
          <option value="">Select department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <Button type="submit" loading={submitting}>
          Create
        </Button>
      </form>
    </Card>
  );
}

function CoursesTab({ departments, onCreated }) {
  const { token } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [courseForm, setCourseForm] = useState({
    courseCode: '',
    courseTitle: '',
    departmentId: '',
    academicYear: '2025-2026',
    semester: 1,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    caMarks: 40,
    eseMarks: 60,
    category: 'PC',
    commonTo: '',
  });

  async function handleCreateCourse(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.courses.create(token, courseForm);
      toast.success('Course created.');
      onCreated();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title="Create Course" description="Faculty fill in syllabus detail later, via their assigned task.">
      <form onSubmit={handleCreateCourse} className="space-y-3 max-w-md">
        <input
          className={inputClass}
          placeholder="Course Code"
          required
          value={courseForm.courseCode}
          onChange={(e) => setCourseForm({ ...courseForm, courseCode: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Course Title"
          required
          value={courseForm.courseTitle}
          onChange={(e) => setCourseForm({ ...courseForm, courseTitle: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Common To (e.g. Common to CSE and AI&DS) — optional"
          value={courseForm.commonTo}
          onChange={(e) => setCourseForm({ ...courseForm, commonTo: e.target.value })}
        />
        <select
          className={inputClass}
          required
          value={courseForm.departmentId}
          onChange={(e) => setCourseForm({ ...courseForm, departmentId: e.target.value })}
        >
          <option value="">Select department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          required
          value={courseForm.semester}
          onChange={(e) => setCourseForm({ ...courseForm, semester: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <option key={s} value={s}>
              Semester {s}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            className={inputClass}
            placeholder="L"
            value={courseForm.lectureHours}
            onChange={(e) => setCourseForm({ ...courseForm, lectureHours: Number(e.target.value) })}
          />
          <input
            type="number"
            className={inputClass}
            placeholder="T"
            value={courseForm.tutorialHours}
            onChange={(e) => setCourseForm({ ...courseForm, tutorialHours: Number(e.target.value) })}
          />
          <input
            type="number"
            className={inputClass}
            placeholder="P"
            value={courseForm.practicalHours}
            onChange={(e) => setCourseForm({ ...courseForm, practicalHours: Number(e.target.value) })}
          />
        </div>
        <select
          className={inputClass}
          value={courseForm.category}
          onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button type="submit" loading={submitting}>
          Create
        </Button>
      </form>
    </Card>
  );
}

export default function TopAdminDashboard() {
  const { token } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);
    try {
      const data = await api.admin.dashboard(token);
      setDepartments(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="Top Admin" navItems={NAV_ITEMS} activeItem={activeTab} onNavClick={setActiveTab}>
      <div className="space-y-6">
        {activeTab === 'overview' && <OverviewTab departments={departments} loading={loading} />}
        {activeTab === 'departments' && <DepartmentsTab onCreated={loadDashboard} />}
        {activeTab === 'users' && <UsersTab departments={departments} />}
        {activeTab === 'courses' && <CoursesTab departments={departments} onCreated={loadDashboard} />}
        {activeTab === 'downloads' && <DownloadCenter />}
      </div>
    </AppShell>
  );
}
