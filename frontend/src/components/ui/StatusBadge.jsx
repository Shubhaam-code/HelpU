import { cn } from '../../lib/utils';

const STATUS = {
  confirmed: { label: 'Confirmed', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  pending: { label: 'Pending', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  matched: { label: 'Matched', bg: 'bg-mint', text: 'text-green-700', dot: 'bg-green-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-600', dot: 'bg-red-500' },
  processing: { label: 'Processing', bg: 'bg-peach', text: 'text-orange-700', dot: 'bg-orange-400' },
  offer: { label: 'Offer', bg: 'bg-sky', text: 'text-blue-700', dot: 'bg-blue-400' },
  request: { label: 'Need Ride', bg: 'bg-lavender', text: 'text-purple-700', dot: 'bg-purple-400' },
};

export function StatusBadge({ status = 'pending', className = '' }) {
  const s = STATUS[status?.toLowerCase()] || STATUS.pending;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', s.bg, s.text, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export default StatusBadge;

