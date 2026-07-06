const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
};

export default function Spinner({ size = 'sm', className = '' }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block ${SIZES[size]} rounded-full border-current border-t-transparent animate-spin ${className}`}
    />
  );
}
