import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [facultyNotice, setFacultyNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFacultyNotice(false);
    setSubmitting(true);

    try {
      const user = await login(email, password);

      if (user.role === 'faculty') {
        setFacultyNotice(true);
        return;
      }

      const intendedPath = location.state?.from;
      if (user.role === 'top_admin') {
        navigate(intendedPath || '/admin', { replace: true });
      } else if (user.role === 'sub_admin') {
        navigate(intendedPath || '/subadmin', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">CurriSync</h1>
        <p className="text-sm text-slate-500 mb-6">Curriculum management sign in</p>

        {facultyNotice ? (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
            Faculty access their tasks via the email link sent to them — there is no faculty dashboard
            to log in to. Please check your email for the course assignment link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Email</span>
              <input
                type="email"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Password</span>
              <input
                type="password"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-md py-2 text-sm"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
