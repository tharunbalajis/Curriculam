import Spinner from './Spinner';

const VARIANTS = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white border border-transparent',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300',
  danger: 'bg-red-600 hover:bg-red-700 text-white border border-transparent',
  success: 'bg-green-600 hover:bg-green-700 text-white border border-transparent',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 border border-transparent',
};

const SIZES = {
  sm: 'text-xs px-2.5 py-1',
  md: 'text-sm px-4 py-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium
        transition-colors disabled:opacity-60 disabled:cursor-not-allowed
        ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
