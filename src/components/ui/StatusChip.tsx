import { cn } from '../../lib/utils';

interface StatusChipProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusChip({ status, size = 'sm' }: StatusChipProps) {
  const getStatusStyle = () => {
    const styles: Record<string, string> = {
      running: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      idle: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      stopped: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      overspeeding: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'in progress': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return styles[status.toLowerCase()] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      getStatusStyle()
    )}>
      {status}
    </span>
  );
}
