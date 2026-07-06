export default function DepartmentStatusBadge({ status }) {
  const isGreen = status === 'green';

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${isGreen ? 'bg-green-500' : 'bg-red-500'}`}
        aria-hidden="true"
      />
      <span className={`text-sm font-medium ${isGreen ? 'text-green-700' : 'text-red-700'}`}>
        {isGreen ? 'All approved' : 'Pending work'}
      </span>
    </span>
  );
}
