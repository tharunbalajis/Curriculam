import { useAuth } from '../../context/AuthContext';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

const ROLE_LABELS = {
  top_admin: 'Top Admin',
  sub_admin: 'Sub-Admin',
  faculty: 'Faculty',
};

export default function Topbar({ title }) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{user?.name}</p>
          </div>
          <Badge status={user?.role}>{ROLE_LABELS[user?.role] || user?.role}</Badge>
          <Button variant="ghost" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
