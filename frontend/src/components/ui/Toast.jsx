const STYLES = {
  success: 'border-l-4 border-green-500',
  error: 'border-l-4 border-red-500',
};

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`bg-white rounded-md shadow-card px-4 py-3 text-sm text-slate-800 flex items-start justify-between gap-3 ${
            STYLES[t.type] || STYLES.success
          }`}
        >
          <span>{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-600 leading-none"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
