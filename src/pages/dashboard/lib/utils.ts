import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function getStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    running: '#43A047',
    idle: '#FFA726',
    stopped: '#EF5350',
    overspeeding: '#FF7043',
    completed: '#43A047',
    pending: '#FFA726',
    critical: '#EF5350',
  };
  return statusMap[status.toLowerCase()] || '#757575';
}
