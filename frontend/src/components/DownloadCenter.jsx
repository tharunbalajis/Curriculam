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

// Deliberately-visible up/down reorder buttons (real <button>s, keyboard
// accessible). `title` doubles as the tooltip explaining a disabled arrow.
function ReorderArrows({ onUp, onDown, upDisabled, downDisabled, label, title }) {
  // Disabled styling matches the Button component's pattern
  // (disabled:opacity-60 disabled:cursor-not-allowed); the disabled
  // attribute itself guarantees onClick can never fire.
  const btn =
    'px-1.5 py-0 text-[11px] leading-5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-300 disabled:hover:text-slate-600 cursor-pointer';
  return (
    <span className="inline-flex items-center gap-1 shrink-0" title={title}>
      <button type="button" className={btn} disabled={upDisabled} aria-label={`Move ${label} up`} onClick={onUp}>
        ▲
      </button>
      <button type="button" className={btn} disabled={downDisabled} aria-label={`Move ${label} down`} onClick={onDown}>
        ▼
      </button>
    </span>
  );
}

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
  const [showDeptOrder, setShowDeptOrder] = useState(false);

  // Reordering needs an unambiguous target group: a specific semester AND
  // (for top_admin) a specific department. sub_admin is already pinned to
  // one department, so only the semester condition applies to them.
  const canReorderCourses = semester !== 'all' && (!isTopAdmin || departmentId !== 'all');

  // Courses may only swap with a neighbor in the SAME (departmentId, semester)
  // group — the list is grouped contiguously by department, so a differing
  // neighbor marks a group boundary (this also covers shared-in courses,
  // whose ordering belongs to their owning department).
  function sameGroup(a, b) {
    return a && b && a.departmentId === b.departmentId && a.semester === b.semester;
  }

  // Optimistic swap, then persist that department+semester group's FULL new
  // id order (the endpoint expects the complete ordered list); revert + toast
  // on failure.
  async function moveCourse(index, delta) {
    // The arrows are disabled in this state, but guard anyway so the handler
    // is non-functional no matter how it's triggered.
    if (!canReorderCourses) return;
    const target = index + delta;
    if (target < 0 || target >= courses.length) return;
    if (!sameGroup(courses[index], courses[target])) return;

    const moved = courses[index];
    const previous = courses;
    const next = [...courses];
    [next[index], next[target]] = [next[target], next[index]];
    setCourses(next);
    try {
      const groupIds = next
        .filter((c) => c.departmentId === moved.departmentId && c.semester === moved.semester)
        .map((c) => c.id);
      await api.admin.reorderCourses(token, groupIds);
    } catch (err) {
      toast.error(err.message);
      setCourses(previous);
    }
  }

  // Optimistic department swap; the Department dropdown and this list both
  // render from the same state, and the loaded course list is locally
  // re-sorted to the new department order (stable within a department) so
  // everything reflects the change immediately, no refetch needed.
  async function moveDepartment(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= departments.length) return;

    const previousDepartments = departments;
    const previousCourses = courses;
    const next = [...departments];
    [next[index], next[target]] = [next[target], next[index]];
    setDepartments(next);
    const rank = new Map(next.map((d, i) => [d.id, i]));
    setCourses((prev) =>
      [...prev].sort((a, b) => (rank.get(a.departmentId) ?? Infinity) - (rank.get(b.departmentId) ?? Infinity))
    );
    try {
      await api.admin.reorderDepartments(token, next.map((d) => d.id));
    } catch (err) {
      toast.error(err.message);
      setDepartments(previousDepartments);
      setCourses(previousCourses);
    }
  }

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
        {isTopAdmin && (
          <div className="mb-4">
            <button
              type="button"
              className="text-sm font-medium text-blue-600 hover:underline cursor-pointer"
              onClick={() => setShowDeptOrder(!showDeptOrder)}
            >
              Reorder departments {showDeptOrder ? '▴' : '▾'}
            </button>
            {showDeptOrder && (
              <div className="mt-2 border border-slate-200 rounded-md divide-y divide-slate-100 max-w-xl">
                <p className="px-3 py-2 text-xs text-slate-500 bg-slate-50">
                  This order controls how departments appear in combined exports and in the dropdown below.
                </p>
                {departments.map((d, i) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="text-slate-400 mr-2">{i + 1}.</span>
                      {d.name}
                    </span>
                    <ReorderArrows
                      label={d.name}
                      upDisabled={i === 0}
                      downDisabled={i === departments.length - 1}
                      onUp={() => moveDepartment(i, -1)}
                      onDown={() => moveDepartment(i, 1)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
          <>
            {!canReorderCourses && (
              <p className="text-xs text-slate-500 mb-1">
                {semester === 'all'
                  ? 'Select a specific semester to reorder courses.'
                  : 'Select a specific department to reorder courses.'}
              </p>
            )}
            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100 mb-4">
              {courses.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                  <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleCourse(c.id)}
                      className="rounded border-slate-300"
                    />
                    <span className="flex-1 min-w-0">
                      {c.courseCode} — {c.courseTitle}{' '}
                      <span className="text-slate-400">
                        ({c.departmentCode}, Sem {c.semester})
                      </span>
                    </span>
                  </label>
                  <Badge status={c.status} />
                  <ReorderArrows
                    label={c.courseCode}
                    title={
                      !canReorderCourses
                        ? semester === 'all'
                          ? 'Select a specific semester to reorder courses'
                          : 'Select a specific department to reorder courses'
                        : 'Reorder within this department + semester'
                    }
                    upDisabled={!canReorderCourses || !sameGroup(c, courses[i - 1])}
                    downDisabled={!canReorderCourses || !sameGroup(c, courses[i + 1])}
                    onUp={() => moveCourse(i, -1)}
                    onDown={() => moveCourse(i, 1)}
                  />
                </div>
              ))}
            </div>
          </>
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
