import Badge from './ui/Badge';

export default function DepartmentStatusBadge({ status }) {
  const isGreen = status === 'green';

  return (
    <Badge status={status} dot>
      {isGreen ? 'All approved' : 'Pending work'}
    </Badge>
  );
}
