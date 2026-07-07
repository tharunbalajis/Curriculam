import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import CourseForm from '../components/CourseForm';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function TaskReview() {
  const { token: accessToken } = useParams();
  const { token } = useAuth();
  const toast = useToast();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenNote, setReopenNote] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);

  async function handleReopen() {
    setReopenSubmitting(true);
    try {
      await api.tasks.reopenByAccessToken(token, accessToken, reopenNote.trim());
      toast.success('Task reopened — the faculty member has been notified by email.');
      setReopening(false);
      setReopenNote('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReopenSubmitting(false);
    }
  }

  async function handleDownloadDocx() {
    setDownloading(true);
    try {
      await api.tasks.previewDocxByToken(accessToken);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api.tasks.getReview(token, accessToken);
      setTask(data);
    } catch (err) {
      setError(err.message || 'Unable to load this submission.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function handleApprove() {
    setApproving(true);
    try {
      await api.tasks.approveByAccessToken(token, accessToken);
      toast.success('Course Approved Successfully');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    setRejectSubmitting(true);
    try {
      await api.tasks.rejectByAccessToken(token, accessToken, revisionNotes);
      toast.success('Course Rejected Successfully');
      setRejecting(false);
      setRevisionNotes('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRejectSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500 gap-2">
        <Spinner /> Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen px-4 bg-slate-50">
        <Card className="max-w-md text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Not found</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </Card>
      </div>
    );
  }

  const canDecide = task.status === 'submitted';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/logo.png" alt="PSG iTech" className="h-8 w-8 object-contain" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">Review Submission</h1>
            <p className="text-sm text-slate-500">
              {task.course?.courseCode} — {task.course?.courseTitle} (Sem {task.course?.semester}) · Submitted by{' '}
              {task.faculty?.name}
            </p>
          </div>
          <div className="ml-auto shrink-0">
            <Button variant="secondary" loading={downloading} onClick={handleDownloadDocx}>
              Download .docx
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {!canDecide && (
          <div className="rounded-md bg-slate-100 border border-slate-200 px-4 py-3 text-sm text-slate-700">
            This task is currently <strong>{task.status}</strong> and is not awaiting a decision.
          </div>
        )}

        <Card>
          <CourseForm course={task.course} onChange={() => {}} readOnly />
        </Card>

        {task.status === 'approved' && (
          <Card className="space-y-3">
            <p className="text-sm text-slate-600">
              This course was approved{task.approvedBy ? ` by ${task.approvedBy}` : ''}. If something still needs
              to change, reopen it — the faculty member regains edit access and resubmits through the normal flow.
            </p>
            <Button variant="secondary" disabled={reopenSubmitting} onClick={() => setReopening(!reopening)}>
              Reopen for Edits
            </Button>
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
                  className="whitespace-nowrap"
                  loading={reopenSubmitting}
                  onClick={handleReopen}
                >
                  Confirm Reopen
                </Button>
              </div>
            )}
          </Card>
        )}

        {canDecide && (
          <Card className="space-y-3">
            <div className="flex gap-3">
              <Button variant="success" loading={approving} disabled={rejectSubmitting} onClick={handleApprove}>
                Approve
              </Button>
              <Button
                variant="danger"
                disabled={approving}
                onClick={() => setRejecting(!rejecting)}
              >
                Reject
              </Button>
            </div>
            {rejecting && (
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="Revision notes for the faculty member"
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                />
                <Button
                  variant="secondary"
                  className="whitespace-nowrap"
                  loading={rejectSubmitting}
                  disabled={!revisionNotes.trim()}
                  onClick={handleReject}
                >
                  Confirm Reject
                </Button>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
