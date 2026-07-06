function DefaultIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-slate-300" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      {icon || <DefaultIcon />}
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
