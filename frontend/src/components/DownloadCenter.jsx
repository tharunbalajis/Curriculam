import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

const STATUS_OPTIONS = [
  { value: 'approved', label: 'Approved' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All statuses' },
];

// Shared by both Top Admin and Sub Admin — sub_admin simply never sees the
// department dropdown or the non-approved status options, matching exactly
// what the backend already enforces (own department, approved-only) so the
// UI never offers a choice the API would reject anyway.
export default function DownloadCenter() {
  const { token, user } = useAuth();
  const toast = useToast();
  const isTopAdmin = user?.role === 'top_admin';

  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('all');
  const [semester, setSemester] = useState('all');
  const [status, setStatus] = useState('approved');
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    if (isTopAdmin) {
      api.departments.list(token).then(setDepartments).catch((err) => toast.error(err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadCourses() {
      setLoadingCourses(true);
      try {
        const params = { status };
        if (isTopAdmin) {
          if (departmentId !== 'all') params.departmentId = departmentId;
          if (semester !== 'all') params.semester = semester;
        } else if (semester !== 'all') {
          params.semester = semester;
        }
        const data = await api.downloads.courses(token, params);
        setCourses(data);
        setSelected(new Set());
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoadingCourses(false);
      }
    }
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, semester, status]);

  function toggleCourse(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport(format) {
    setExporting(true);
    try {
      await api.downloads.export(token, {
        departmentId: isTopAdmin ? departmentId : undefined,
        semester,
        status: isTopAdmin ? status : 'approved',
        courseIds: selected.size ? Array.from(selected) : undefined,
        format,
      });
      toast.success(`${format.toUpperCase()} export downloaded.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function loadHistory() {
    try {
      const data = await api.downloads.history(token);
      setHistory(data);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="Download Center"
        description={
          isTopAdmin
            ? 'Export the official syllabus document for any course, semester, department, or the entire university.'
            : 'Export the official syllabus document for your department\'s approved courses.'
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
          {isTopAdmin && (
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Department</span>
              <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Semester</span>
            <select className={inputClass} value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="all">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>
          {isTopAdmin && (
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Status</span>
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {loadingCourses ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
            <Spinner /> Loading courses…
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            title="No courses match these filters"
            description="Try a different department, semester, or status."
          />
        ) : (
          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100 mb-4">
            {courses.map((c) => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggleCourse(c.id)}
                  className="rounded border-slate-300"
                />
                <span className="flex-1">
                  {c.courseCode} — {c.courseTitle}{' '}
                  <span className="text-slate-400">
                    ({c.departmentCode}, Sem {c.semester})
                  </span>
                </span>
                <Badge status={c.status} />
              </label>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500 mb-3">
          {selected.size > 0
            ? `${selected.size} course(s) selected — export will include only these.`
            : 'No individual courses selected — export will include every course matching the filters above.'}
        </p>

        <div className="flex gap-2">
          <Button onClick={() => handleExport('docx')} loading={exporting} disabled={courses.length === 0}>
            Download Word (.docx)
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('pdf')}
            loading={exporting}
            disabled={courses.length === 0}
          >
            Download PDF
          </Button>
        </div>
      </Card>

      {isTopAdmin && (
        <Card
          title="Download History"
          description="Every export performed across the university."
          actions={
            <Button variant="secondary" size="sm" onClick={loadHistory}>
              {history ? 'Refresh' : 'Load history'}
            </Button>
          }
        >
          {history === null ? (
            <p className="text-sm text-slate-500">Click "Load history" to view past exports.</p>
          ) : history.length === 0 ? (
            <EmptyState title="No exports yet" description="Downloads will be logged here as they happen." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2">User</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Department</th>
                  <th className="py-2">File</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-slate-100">
                    <td className="py-2">{h.user?.name || '—'}</td>
                    <td className="py-2">{h.role}</td>
                    <td className="py-2">{h.department?.code || 'All'}</td>
                    <td className="py-2">{h.fileName}</td>
                    <td className="py-2">{new Date(h.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
