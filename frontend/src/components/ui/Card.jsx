export default function Card({ title, description, actions, children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg shadow-card p-6 ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
