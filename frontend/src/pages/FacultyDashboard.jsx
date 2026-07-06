import { useAuth } from '../context/AuthContext';

// Faculty do not use a dashboard in this workflow — they access their tasks
// exclusively through the emailed /task/:token link. This page only exists
// as a safe landing spot if a faculty account is ever navigated here directly.
export default function FacultyDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center bg-white rounded-lg shadow p-8">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Welcome, {user?.name}</h1>
        <p className="text-sm text-slate-600">
          Faculty access their tasks via the email link sent to them when a course is assigned. There is
          no dashboard to browse here — check your inbox for the "Fill Course Details" email.
        </p>
        <button onClick={logout} className="mt-6 text-sm text-slate-600 hover:text-slate-900 underline">
          Log out
        </button>
      </div>
    </div>
  );
}
