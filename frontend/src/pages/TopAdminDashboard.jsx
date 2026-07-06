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

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

const CATEGORIES = ['BS', 'HS', 'ES', 'PC', 'PE', 'OE', 'EEC', 'MC'];

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'departments', label: 'Departments' },
  { key: 'users', label: 'Users' },
  { key: 'courses', label: 'Courses' },
];

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
    <Card title="Departments" description="Live approval status across every department.">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-2">Name</th>
            <th className="py-2">Code</th>
            <th className="py-2">Courses</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => (
            <tr key={d.id} className="border-b border-slate-100">
              <td className="py-2">{d.name}</td>
              <td className="py-2">{d.code}</td>
              <td className="py-2">{d.totalCourses}</td>
              <td className="py-2">
                <DepartmentStatusBadge status={d.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
      </div>
    </AppShell>
  );
}
