import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import DepartmentStatusBadge from '../components/DepartmentStatusBadge';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function TopAdminDashboard() {
  const { token, user, logout } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'sub_admin', departmentId: '' });
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

  async function loadDashboard() {
    setLoading(true);
    try {
      const data = await api.admin.dashboard(token);
      setDepartments(data);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateDepartment(e) {
    e.preventDefault();
    setMessage('');
    try {
      await api.departments.create(token, deptForm);
      setDeptForm({ name: '', code: '' });
      setMessage('Department created.');
      loadDashboard();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setMessage('');
    try {
      await api.users.create(token, userForm);
      setUserForm({ name: '', email: '', password: '', role: 'sub_admin', departmentId: '' });
      setMessage('User created.');
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleCreateCourse(e) {
    e.preventDefault();
    setMessage('');
    try {
      await api.courses.create(token, courseForm);
      setMessage('Course created.');
      loadDashboard();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">CurriSync — Top Admin</h1>
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

        <Card title="Departments">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
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
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Create Department">
            <form onSubmit={handleCreateDepartment} className="space-y-3">
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
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md py-2">
                Create
              </button>
            </form>
          </Card>

          <Card title="Create User (Sub-Admin / Faculty)">
            <form onSubmit={handleCreateUser} className="space-y-3">
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
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md py-2">
                Create
              </button>
            </form>
          </Card>

          <Card title="Create Course">
            <form onSubmit={handleCreateCourse} className="space-y-3">
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
                {['BS', 'HS', 'ES', 'PC', 'PE', 'OE', 'EEC', 'MC'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md py-2">
                Create
              </button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
