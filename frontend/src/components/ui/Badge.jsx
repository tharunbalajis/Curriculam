// Single source of truth for status -> color mapping across the app.
// Task statuses (assigned/in_progress/submitted/approved/rejected) and the
// department overview's green/red completion status both resolve here.
const STATUS_STYLES = {
  pending: 'bg-slate-100 text-slate-700',
  assigned: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-brand-100 text-brand-700',
  submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
};

const DOT_COLORS = {
  pending: 'bg-slate-400',
  assigned: 'bg-slate-400',
  in_progress: 'bg-brand-500',
  submitted: 'bg-amber-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
};

export default function Badge({ status, children, dot = false, className = '' }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-700';
  const label = children ?? (typeof status === 'string' ? status.replace(/_/g, ' ') : status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[status] || 'bg-slate-400'}`} aria-hidden="true" />}
      {label}
    </span>
  );
}
