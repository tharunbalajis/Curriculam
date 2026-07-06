import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import AppShell from '../components/layout/AppShell';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

const NAV_ITEMS = [{ key: 'dashboard', label: 'My Tasks' }];

export default function FacultyDashboard() {
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.tasks.list(token);
        setTasks(data);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="Faculty" navItems={NAV_ITEMS} activeItem="dashboard" onNavClick={() => {}}>
      <Card title="My Tasks" description="Courses assigned to you for curriculum submission.">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
            <Spinner /> Loading…
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            title="No courses assigned yet"
            description="You'll see them here once your department admin assigns one."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/faculty/task/${t.id}`)}
                className="text-left border border-slate-200 rounded-md p-4 hover:border-brand-300 hover:shadow-card transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{t.course?.courseCode}</p>
                    <p className="text-sm text-slate-600">{t.course?.courseTitle}</p>
                  </div>
                  <Badge status={t.status} />
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Deadline: {t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}
                </p>
              </button>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
