import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEffect, useState } from 'react';

interface KPITileProps {
  label: string;
  value: number;
  unit?: string;
  trend?: number;
  icon?: React.ReactNode;
  color?: string;
  compact?: boolean;
}

export function KPITile({ label, value, unit, trend, icon, color = '#43A047', compact }: KPITileProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const getTrendIcon = () => {
    if (!trend) return <Minus className="w-3 h-3" />;
    if (trend > 0) return <TrendingUp className="w-3 h-3 text-green-500" />;
    return <TrendingDown className="w-3 h-3 text-red-500" />;
  };

  return (
    <div className={cn(
      'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
      'shadow-md hover:shadow-lg transition-all duration-300',
      'backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90',
      compact ? 'p-2' : 'p-3'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn(
            'text-gray-600 dark:text-gray-400 font-medium mb-1',
            compact ? 'text-xs' : 'text-sm'
          )}>
            {label}
          </p>
          <p className={cn(
            'font-bold text-gray-900 dark:text-white',
            compact ? 'text-lg' : 'text-2xl'
          )}>
            {displayValue.toLocaleString()}
            {unit && <span className="text-sm ml-1">{unit}</span>}
          </p>
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-1">
              {getTrendIcon()}
              <span className={cn(
                'text-xs font-medium',
                trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500'
              )}>
                {Math.abs(trend)}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
