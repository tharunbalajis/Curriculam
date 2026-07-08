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
import DepartmentMultiSelect from '../components/DepartmentMultiSelect';
import FacultySelect from '../components/FacultySelect';
import CourseForm from '../components/CourseForm';

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

// Read-only detail view for a course row in the Overview accordion: full
// course content (same read-only CourseForm as the review page), assigned
// faculty + status, and a one-click .docx download via the same export
// endpoint the Download Center uses (top_admin already has that permission —
// this is just a shortcut into it).
function CourseDetailModal({ courseRow, onClose, onReopened }) {
  const { token } = useAuth();
  const toast = useToast();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenNote, setReopenNote] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);

  async function handleReopen() {
    setReopenSubmitting(true);
    try {
      await api.tasks.reopen(token, courseRow.taskId, reopenNote.trim());
      toast.success('Task reopened — the faculty member has been notified by email.');
      onReopened();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReopenSubmitting(false);
    }
  }

  useEffect(() => {
    api.courses
      .get(token, courseRow.id)
      .then(setCourse)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseRow.id]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await api.downloads.export(token, { courseIds: [courseRow.id], format: 'docx', status: 'all' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  }

  const hasContent =
    course &&
    ((course.syllabusUnits || []).length > 0 ||
      (course.courseOutcomes || []).length > 0 ||
      (course.textbooks || []).length > 0 ||
      course.introduction);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 overflow-y-auto p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">
              {courseRow.courseCode} — {courseRow.courseTitle}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {courseRow.faculty ? `Assigned to ${courseRow.faculty}` : 'No faculty assigned yet'}
              {courseRow.shared && ` · Shared — owned by ${courseRow.ownerCode}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge status={courseRow.status} />
            <Button variant="secondary" size="sm" loading={downloading} onClick={handleDownload}>
              Download .docx
            </Button>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        {courseRow.status === 'approved' && courseRow.taskId && (
          <div className="border-b border-slate-200 px-5 py-3 space-y-2 bg-slate-50">
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" disabled={reopenSubmitting} onClick={() => setReopening(!reopening)}>
                Reopen for Edits
              </Button>
              <span className="text-xs text-slate-500">
                Gives the faculty member edit access again; it returns to the owning department's review queue on resubmit.
              </span>
            </div>
            {reopening && (
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="Optional note — why is this being reopened?"
                  value={reopenNote}
                  onChange={(e) => setReopenNote(e.target.value)}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap"
                  loading={reopenSubmitting}
                  onClick={handleReopen}
                >
                  Confirm Reopen
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
              <Spinner /> Loading course…
            </div>
          ) : !course ? (
            <p className="text-sm text-slate-500 py-4">Unable to load this course.</p>
          ) : hasContent ? (
            <CourseForm course={course} onChange={() => {}} readOnly />
          ) : (
            <EmptyState
              title="Nothing submitted yet"
              description={
                courseRow.faculty
                  ? `${courseRow.faculty} hasn't filled in the syllabus for this course yet.`
                  : 'No faculty member has been assigned to fill in this course yet.'
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DepartmentAccordionRow({ department }) {
  const { token } = useAuth();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailCourse, setDetailCourse] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

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

  // Re-fetches the semester breakdown after a status-changing action from the
  // course detail modal (e.g. Reopen for Edits), so the row badges are fresh.
  async function refreshDetail() {
    try {
      setDetail(await api.admin.departmentCourses(token, department.id));
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Optimistic swap of a course with its neighbor within the SAME semester
  // group (cross-semester moves are deliberately not possible here), then
  // persist that semester's full order; revert the local state on failure.
  async function moveCourse(semester, index, delta) {
    const target = index + delta;
    const sem = detail.semesters.find((s) => s.semester === semester);
    if (!sem || target < 0 || target >= sem.courses.length) return;

    const previous = detail;
    const reordered = [...sem.courses];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setDetail({
      ...detail,
      semesters: detail.semesters.map((s) => (s.semester === semester ? { ...s, courses: reordered } : s)),
    });
    try {
      await api.admin.reorderCourses(token, reordered.map((c) => c.id));
    } catch (err) {
      toast.error(err.message);
      setDetail(previous);
    }
  }

  // Deletion is irreversible (DB cascades wipe units, textbooks, outcomes,
  // common-department links, and tasks), so it only fires from the explicit
  // confirm button in the dialog below. A failed request keeps the dialog
  // open with the error visible rather than silently closing.
  async function confirmDeleteCourse() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.courses.remove(token, deleteTarget.id);
      toast.success(`${deleteTarget.courseCode} deleted.`);
      setDeleteTarget(null);
      await refreshDetail();
    } catch (err) {
      setDeleteError(err.message || 'Could not delete the course. Please try again.');
    } finally {
      setDeleting(false);
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
                    {sem.courses.map((c, ci) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <ReorderArrows
                          label={c.courseCode}
                          isFirst={ci === 0}
                          isLast={ci === sem.courses.length - 1}
                          onUp={() => moveCourse(sem.semester, ci, -1)}
                          onDown={() => moveCourse(sem.semester, ci, 1)}
                        />
                        <button
                          type="button"
                          onClick={() => setDetailCourse(c)}
                          className="flex-1 min-w-0 flex items-center justify-between gap-3 bg-white rounded-md border border-slate-200 px-3 py-2 text-left hover:border-blue-300 hover:bg-blue-50/40 transition cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">
                              {c.courseCode} — {c.courseTitle}
                              {c.shared && (
                                <span className="ml-2 inline-flex items-center rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 align-middle">
                                  Shared — owned by {c.ownerCode}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">{c.faculty || 'No faculty assigned'}</p>
                          </div>
                          <Badge status={c.status} />
                        </button>
                        <button
                          type="button"
                          className="px-1.5 py-0.5 text-xs rounded border border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-300 hover:text-red-700 cursor-pointer shrink-0"
                          title={`Delete ${c.courseCode}`}
                          aria-label={`Delete ${c.courseCode}`}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(c);
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {detailCourse && (
        <CourseDetailModal
          courseRow={detailCourse}
          onClose={() => setDetailCourse(null)}
          onReopened={refreshDetail}
        />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-40 bg-black/40 overflow-y-auto p-4 sm:p-8"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Delete course</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-slate-700">
                Delete <span className="font-semibold">{deleteTarget.courseCode} — {deleteTarget.courseTitle}</span>?
                This permanently removes the course and all of its syllabus units, textbooks, references, course
                outcomes, and assigned tasks. This cannot be undone.
              </p>
              {deleteTarget.shared && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  This course is shared — deleting it removes it from its owning department ({deleteTarget.ownerCode})
                  and every department it is common to.
                </p>
              )}
              {deleteError && (
                <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {deleteError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <Button variant="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={confirmDeleteCourse}>
                Delete
              </Button>
            </div>
          </div>
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

// Per-department curriculum revision date — printed in the exported document
// header (the master copy shows e.g. 23.03.2026, the date the revision was
// finalized, not the export date). One date covers the whole department book.
// Small up/down arrow pair used for manual display ordering (departments in
// this tab, courses in the Overview accordion). Disabled at list edges.
function ReorderArrows({ onUp, onDown, isFirst, isLast, label }) {
  const btn =
    'px-1.5 py-0.5 text-xs rounded border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:cursor-default cursor-pointer';
  return (
    <span className="inline-flex flex-col gap-0.5 shrink-0">
      <button type="button" className={btn} disabled={isFirst} title={`Move ${label} up`} onClick={onUp}>
        ▲
      </button>
      <button type="button" className={btn} disabled={isLast} title={`Move ${label} down`} onClick={onDown}>
        ▼
      </button>
    </span>
  );
}

function RevisionDateRow({ department, onSaved }) {
  const { token } = useAuth();
  const toast = useToast();
  const [value, setValue] = useState(department.revisionDate || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.departments.update(token, department.id, { revisionDate: value || null });
      toast.success(`Revision date ${value ? 'saved' : 'cleared'} for ${department.code}.`);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border border-slate-200 rounded-md px-3 py-2 bg-white">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{department.name}</p>
        <p className="text-xs text-slate-500">{department.code}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="date"
          className={inputClass}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="button" loading={saving} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

function DepartmentsTab({ onCreated }) {
  const { token } = useAuth();
  const toast = useToast();
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState([]);

  async function loadDepartments() {
    try {
      setDepartments(await api.departments.list(token));
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateDepartment(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.departments.create(token, deptForm);
      setDeptForm({ name: '', code: '' });
      toast.success('Department created.');
      onCreated();
      loadDepartments();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Optimistic swap with its neighbor, then persist the full order; revert
  // the local list if the reorder call fails.
  async function moveDepartment(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= departments.length) return;
    const previous = departments;
    const next = [...departments];
    [next[index], next[target]] = [next[target], next[index]];
    setDepartments(next);
    try {
      await api.admin.reorderDepartments(token, next.map((d) => d.id));
    } catch (err) {
      toast.error(err.message);
      setDepartments(previous);
    }
  }

  return (
    <div className="space-y-6">
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

      <Card
        title="Departments"
        description="Use the arrows to set the order departments appear in combined exports and dropdowns. The date is printed in the exported document header (e.g. 23.03.2026); if unset, exports fall back to the download date."
      >
        {departments.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No departments yet.</p>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {departments.map((d, i) => (
              <div key={d.id} className="flex items-center gap-2">
                <ReorderArrows
                  label={d.code}
                  isFirst={i === 0}
                  isLast={i === departments.length - 1}
                  onUp={() => moveDepartment(i, -1)}
                  onDown={() => moveDepartment(i, 1)}
                />
                <div className="flex-1 min-w-0">
                  <RevisionDateRow department={d} onSaved={loadDepartments} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const USER_ROLE_SECTIONS = [
  { role: 'top_admin', label: 'Top Admins' },
  { role: 'sub_admin', label: 'Sub-Admins' },
  { role: 'faculty', label: 'Faculty' },
];

function UsersTab({ departments }) {
  const { token, user: currentUser } = useAuth();
  const toast = useToast();
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'sub_admin', departmentId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  // Inline confirm-before-delete, same reveal-then-Confirm pattern the app
  // already uses for Reject and Reopen (no shared modal component exists).
  const [confirmingId, setConfirmingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      setUsers(await api.users.list(token));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateUser(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.users.create(token, userForm);
      setUserForm({ name: '', email: '', password: '', role: 'sub_admin', departmentId: '' });
      toast.success('User created.');
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(u) {
    setRemovingId(u.id);
    try {
      await api.users.remove(token, u.id);
      toast.success(`${u.name} deleted.`);
      setConfirmingId(null);
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
    <Card title="Create User" description="Sub-admins and faculty are scoped to a single department.">
      <form onSubmit={handleCreateUser} className="space-y-3 max-w-md">
        <input
          className={inputClass}
          placeholder="Name"
          required
          value={userForm.name}
          onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
        />
        <div>
          <input
            type="email"
            className={inputClass}
            placeholder="Email"
            required
            value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
          />
          {userForm.role === 'faculty' && (
            <span className="block text-xs text-slate-500 mt-1">
              Faculty accounts need an institutional email (@currisync.edu or @psgitech.ac.in).
            </span>
          )}
        </div>
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

    <Card title="Manage Users" description="Every user across every department, grouped by role.">
      {loadingUsers ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
          <Spinner /> Loading users…
        </div>
      ) : users.length === 0 ? (
        <EmptyState title="No users yet" description="Create a sub-admin or faculty member above." />
      ) : (
        <div className="space-y-5">
          {USER_ROLE_SECTIONS.map((section) => {
            const sectionUsers = users.filter((u) => u.role === section.role);
            if (sectionUsers.length === 0) return null;
            return (
              <div key={section.role}>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                  {section.label} ({sectionUsers.length})
                </h4>
                <div className="space-y-2">
                  {sectionUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-3 bg-white rounded-md border border-slate-200 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {u.email}
                            {u.department?.name && <span> · {u.department.name}</span>}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isSelf ? (
                            <span
                              className="text-xs text-slate-400 cursor-not-allowed"
                              title="You can't delete the account you're signed in with"
                            >
                              Signed in
                            </span>
                          ) : confirmingId === u.id ? (
                            <span className="flex items-center gap-2">
                              <span className="text-xs text-red-700">
                                Permanently delete {u.name} ({u.email})?
                              </span>
                              <Button
                                variant="danger"
                                size="sm"
                                loading={removingId === u.id}
                                onClick={() => handleDelete(u)}
                              >
                                Confirm Delete
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={removingId === u.id}
                                onClick={() => setConfirmingId(null)}
                              >
                                Cancel
                              </Button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="text-sm text-red-600 hover:underline cursor-pointer"
                              onClick={() => setConfirmingId(u.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
    </div>
  );
}

function CoursesTab({ departments, onCreated }) {
  const { token } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [faculty, setFaculty] = useState([]);
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
    commonToDepartmentIds: [],
    facultyUserId: '',
    deadline: '',
  });

  // College-wide faculty list for the direct-assign picker — top_admin's
  // users query is already unscoped, no special param needed.
  useEffect(() => {
    api.users
      .list(token, { role: 'faculty' })
      .then(setFaculty)
      .catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCommonCourse = courseForm.commonToDepartmentIds.length > 0;

  async function handleCreateCourse(e) {
    e.preventDefault();

    const { facultyUserId, deadline, ...rest } = courseForm;
    if ((facultyUserId && !deadline) || (!facultyUserId && deadline)) {
      toast.error('To assign directly, pick both a faculty member and a deadline (or leave both empty).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...rest };
      if (facultyUserId && deadline) {
        payload.facultyUserId = facultyUserId;
        payload.deadline = deadline;
      }
      // Shared course: the owner is the first Common To department — the
      // backend derives department_id from it, no separate field is sent.
      if (isCommonCourse) {
        delete payload.departmentId;
      }
      await api.courses.create(token, payload);
      toast.success(
        facultyUserId && deadline
          ? 'Course created and assigned — an email has been sent to the faculty member.'
          : 'Course created.'
      );
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
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">Common To (optional)</span>
          <DepartmentMultiSelect
            departments={departments}
            selectedIds={courseForm.commonToDepartmentIds}
            ownerId={courseForm.commonToDepartmentIds[0] || null}
            onChange={(ids) =>
              setCourseForm({
                ...courseForm,
                commonToDepartmentIds: ids,
                // Direct assignment only applies to shared courses — clear it
                // if the last common-to department is unchecked.
                ...(ids.length === 0 ? { facultyUserId: '', deadline: '' } : {}),
              })
            }
          />
          {isCommonCourse && (
            <span className="block text-xs text-slate-500 mt-1">
              The ★ Owner department (the first one selected) manages faculty assignment and review — no
              separate department pick needed.
            </span>
          )}
        </label>
        {/* Non-shared course: the single owning department is picked here.
            For a shared course the owner is the first Common To chip, so
            asking again would be the same question twice. */}
        {!isCommonCourse && (
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
        )}
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

        {isCommonCourse && (
          <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 space-y-3">
            <p className="text-xs text-slate-600">
              Shared course — you can assign one faculty member (from any department) to fill it in now.
              Leave empty to let the owning department's sub-admin assign it later, as usual.
            </p>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Faculty (optional)</span>
              <FacultySelect
                faculty={faculty}
                value={courseForm.facultyUserId}
                onChange={(id) => setCourseForm({ ...courseForm, facultyUserId: id })}
                placeholder="Select faculty — any department"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Deadline (optional)</span>
              <input
                type="date"
                className={inputClass}
                value={courseForm.deadline}
                onChange={(e) => setCourseForm({ ...courseForm, deadline: e.target.value })}
              />
            </label>
          </div>
        )}

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
