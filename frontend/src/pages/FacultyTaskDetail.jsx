import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import AppShell from '../components/layout/AppShell';
import TaskDetailsForm from '../components/TaskDetailsForm';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';

const NAV_ITEMS = [{ key: 'dashboard', label: 'My Tasks' }];

export default function FacultyTaskDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [taskMeta, setTaskMeta] = useState(null);
  const [course, setCourse] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.tasks.getById(token, id);
        setTaskMeta(data);
        setCourse(data.course);
      } catch (err) {
        setError(err.message || 'Unable to load this task.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await api.tasks.submitById(token, id, course);
      setCourse(result.course);
      setTaskMeta({ ...taskMeta, status: result.status, readOnly: true });
      toast.success('Submitted for review. Your sub-admin has been notified by email.');
      navigate('/faculty');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Faculty" navItems={NAV_ITEMS} activeItem="dashboard" onNavClick={() => navigate('/faculty')}>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
          <Spinner /> Loading…
        </div>
      ) : error ? (
        <Card className="max-w-md mx-auto text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Not found</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </Card>
      ) : (
        <TaskDetailsForm
          taskMeta={taskMeta}
          course={course}
          onCourseChange={setCourse}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </AppShell>
  );
}
