import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/ui/Button';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

const DEFAULT_PATH_BY_ROLE = {
  top_admin: '/admin',
  sub_admin: '/subadmin',
  faculty: '/faculty',
};

// A stale `location.state.from` (left over from an earlier, unrelated
// redirect-to-login in this same browser tab/session) must never send a
// user into another role's area — e.g. a leftover `from: '/admin'` sending
// a faculty login straight into the top_admin dashboard's Unauthorized
// screen. Only honor it if it actually belongs to this role's namespace.
const ALLOWED_PREFIXES_BY_ROLE = {
  top_admin: ['/admin'],
  sub_admin: ['/subadmin', '/review'],
  faculty: ['/faculty'],
};

function resolveRedirectPath(role, intendedPath) {
  const allowedPrefixes = ALLOWED_PREFIXES_BY_ROLE[role] || [];
  if (intendedPath && allowedPrefixes.some((prefix) => intendedPath.startsWith(prefix))) {
    return intendedPath;
  }
  return DEFAULT_PATH_BY_ROLE[role];
}

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const user = await login(email, password);
      navigate(resolveRedirectPath(user.role, location.state?.from), { replace: true });
    } catch (err) {
      toast.error(err.message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-card p-8">
        <div className="flex justify-center mb-5">
          <img src="/logo.png" alt="PSG iTech" className="h-16 w-16 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-brand-900 text-center mb-1">CurriSync</h1>
        <p className="text-sm text-slate-500 text-center mb-6">Curriculum management sign in</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Email</span>
            <input
              type="email"
              required
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Password</span>
            <input
              type="password"
              required
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
